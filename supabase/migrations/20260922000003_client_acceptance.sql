-- Phase 13: persistent client acceptance.
-- The agreement terms are immutable from publication. Each new acceptance now
-- records the exact reviewed terms in the immutable ledger and can only update
-- the client participant through a matching JOB_ACCEPTED transition.
BEGIN;

CREATE OR REPLACE FUNCTION private.tl_validate_trust_event_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  duplicate_event public.trust_events%ROWTYPE;
  previous_sequence integer;
  previous_occurred_at timestamptz;
  provider uuid;
  current_status text;
  current_version integer;
  accepted_terms jsonb;
BEGIN
  SELECT * INTO duplicate_event FROM public.trust_events WHERE id=NEW.id;
  IF FOUND THEN
    IF to_jsonb(duplicate_event) IS DISTINCT FROM to_jsonb(NEW) THEN
      RAISE EXCEPTION 'Persisted trust event history does not match the submitted aggregate';
    END IF;
    RETURN NEW;
  END IF;

  SELECT event_sequence,occurred_at INTO previous_sequence,previous_occurred_at
  FROM public.trust_events WHERE job_id=NEW.job_id
  ORDER BY event_sequence DESC LIMIT 1;

  IF NEW.event_sequence <> coalesce(previous_sequence,0)+1 THEN
    RAISE EXCEPTION 'Trust event sequence must be contiguous';
  END IF;
  IF previous_occurred_at IS NOT NULL AND NEW.occurred_at < previous_occurred_at THEN
    RAISE EXCEPTION 'Trust event time cannot move backwards';
  END IF;
  IF NEW.created_at < NEW.occurred_at THEN
    RAISE EXCEPTION 'Trust event creation cannot predate occurrence';
  END IF;

  SELECT provider_id,status,version INTO provider,current_status,current_version
  FROM public.jobs WHERE id=NEW.job_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trust event job does not exist'; END IF;

  IF NEW.actor_type='PROVIDER' AND NEW.actor_id<>provider::text THEN
    RAISE EXCEPTION 'Provider trust event actor does not own the transaction';
  ELSIF NEW.actor_type='CLIENT_PARTICIPANT' AND NEW.actor_id<>'client:'||NEW.job_id::text THEN
    RAISE EXCEPTION 'Client trust event actor does not match the transaction';
  ELSIF NEW.actor_type='ADMIN' AND NEW.actor_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'Administrator trust event actor must be an Auth user';
  ELSIF NEW.actor_type='SYSTEM' AND NEW.actor_id<>'system' THEN
    RAISE EXCEPTION 'System trust event actor is invalid';
  END IF;

  IF NEW.event_sequence=1 AND NEW.event_type<>'JOB_CREATED' THEN
    RAISE EXCEPTION 'The first trust event must create the record';
  ELSIF NEW.event_sequence=2 AND NEW.event_type<>'JOB_SENT' THEN
    RAISE EXCEPTION 'The second trust event must publish the record';
  ELSIF NEW.event_sequence>2 AND NEW.event_type IN ('JOB_CREATED','JOB_SENT') THEN
    RAISE EXCEPTION 'Creation events cannot be repeated';
  END IF;

  IF NEW.event_type NOT IN ('JOB_CREATED','JOB_SENT','JOB_VIEWED') THEN
    IF coalesce(NEW.metadata->>'request_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' OR
       coalesce(NEW.metadata->>'command_hash','') !~ '^[a-f0-9]{64}$' OR
       coalesce(NEW.metadata->>'expected_version','') !~ '^\d+$' THEN
      RAISE EXCEPTION 'Transition trust events require valid operation metadata';
    END IF;
    IF (NEW.metadata->>'expected_version')::numeric <> current_version-1 THEN
      RAISE EXCEPTION 'Trust event version does not match the transaction change';
    END IF;
  END IF;

  IF NEW.event_type='JOB_ACCEPTED' THEN
    SELECT jsonb_build_object(
      'service',terms.service,
      'service_category',terms.service_category,
      'scope',terms.scope,
      'deliverables',terms.deliverables,
      'price',terms.price::text,
      'currency',terms.currency,
      'deadline',terms.deadline::text,
      'revisions_included',terms.revisions_included,
      'cancellation_terms',terms.cancellation_terms
    ) INTO accepted_terms
    FROM public.job_terms terms WHERE terms.job_id=NEW.job_id;
    IF NEW.metadata->>'participant_detail_status' IS DISTINCT FROM 'SELF_PROVIDED' THEN
      RAISE EXCEPTION 'Client acceptance details are self-provided, not verified';
    END IF;
    IF NEW.metadata ? 'identity_status' AND NEW.metadata->>'identity_status' IS DISTINCT FROM 'SELF_PROVIDED' THEN
      RAISE EXCEPTION 'Client acceptance details are self-provided, not verified';
    END IF;
    IF NEW.metadata->'accepted_terms' IS DISTINCT FROM accepted_terms THEN
      RAISE EXCEPTION 'Client acceptance must snapshot the reviewed agreement terms';
    END IF;
  END IF;

  IF (NEW.event_type='JOB_ACCEPTED' AND current_status<>'ACCEPTED') OR
     (NEW.event_type='PAYMENT_RECORDED' AND current_status<>'PAYMENT_RECORDED') OR
     (NEW.event_type='WORK_STARTED' AND current_status<>'IN_PROGRESS') OR
     (NEW.event_type='DELIVERY_SUBMITTED' AND current_status<>'DELIVERY_SUBMITTED') OR
     (NEW.event_type='REVISION_REQUESTED' AND current_status<>'REVISION_REQUESTED') OR
     (NEW.event_type='DELIVERY_APPROVED' AND current_status<>'APPROVED') OR
     (NEW.event_type='JOB_COMPLETED' AND current_status<>'COMPLETED') OR
     (NEW.event_type='JOB_CANCELLED' AND current_status<>'CANCELLED') OR
     (NEW.event_type='DISPUTE_OPENED' AND current_status<>'DISPUTED') OR
     (NEW.event_type='DISPUTE_RESOLVED' AND current_status NOT IN ('IN_PROGRESS','CANCELLED')) OR
     (NEW.event_type='CLIENT_REVIEWED' AND current_status<>'COMPLETED') OR
     (NEW.event_type IN ('CLIENT_LINK_REISSUED','CLIENT_LINK_REVOKED') AND current_status IN ('DRAFT','CANCELLED')) THEN
    RAISE EXCEPTION 'Trust event does not match the transaction state';
  END IF;
  RETURN NEW;
END $$;

-- Capability expiry must be measured by the database clock. The earlier
-- trigger compared it with a submitted updated_at value, which is not an
-- authority for deciding whether a new bearer capability is active.
CREATE OR REPLACE FUNCTION private.tl_validate_client_capability() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  latest_event text;
  participant_exists boolean;
BEGIN
  IF NEW.role <> 'CLIENT_PARTICIPANT' THEN RETURN NEW; END IF;

  IF TG_OP='INSERT' THEN
    -- Aggregate projection uses INSERT ... ON CONFLICT DO UPDATE. BEFORE
    -- INSERT runs before conflict resolution, so defer existing participants
    -- to the UPDATE invocation that validates the capability transition.
    SELECT EXISTS(
      SELECT 1 FROM public.job_participants
      WHERE job_id=NEW.job_id AND role='CLIENT_PARTICIPANT'
    ) INTO participant_exists;
    IF participant_exists THEN RETURN NEW; END IF;
    IF NEW.action_token_hash IS NULL OR NEW.token_expires_at IS NULL OR NEW.token_expires_at<=clock_timestamp() THEN
      RAISE EXCEPTION 'A new client participant requires an active expiring capability';
    END IF;
    SELECT event_type INTO latest_event FROM public.trust_events
    WHERE job_id=NEW.job_id ORDER BY event_sequence DESC LIMIT 1;
    IF latest_event IS DISTINCT FROM 'JOB_SENT' THEN
      RAISE EXCEPTION 'A new client capability must accompany record publication';
    END IF;
    RETURN NEW;
  END IF;

  SELECT event_type INTO latest_event FROM public.trust_events
  WHERE job_id=NEW.job_id ORDER BY event_sequence DESC LIMIT 1;

  IF NEW.action_token_hash IS NOT DISTINCT FROM OLD.action_token_hash AND
     NEW.token_expires_at IS NOT DISTINCT FROM OLD.token_expires_at THEN
    IF latest_event IN ('CLIENT_LINK_REVOKED','CLIENT_LINK_REISSUED') THEN
      RAISE EXCEPTION 'Client capability event requires a matching capability change';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.action_token_hash IS NULL AND NEW.token_expires_at IS NULL THEN
    IF latest_event IS DISTINCT FROM 'CLIENT_LINK_REVOKED' THEN
      RAISE EXCEPTION 'Client capability revocation requires its ledger event';
    END IF;
    IF OLD.action_token_hash IS NULL OR OLD.token_expires_at IS NULL THEN
      RAISE EXCEPTION 'Client capability is already revoked';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.action_token_hash IS NOT NULL AND NEW.token_expires_at IS NOT NULL AND
     NEW.action_token_hash IS DISTINCT FROM OLD.action_token_hash AND NEW.token_expires_at>clock_timestamp() THEN
    IF latest_event IS DISTINCT FROM 'CLIENT_LINK_REISSUED' THEN
      RAISE EXCEPTION 'Client capability replacement requires its ledger event';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Client capability fields must change together through revocation or replacement';
END $$;

CREATE OR REPLACE FUNCTION private.tl_validate_client_acceptance() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  latest_event text;
  current_status text;
  acceptance_count integer;
  participant_exists boolean;
BEGIN
  IF NEW.role <> 'CLIENT_PARTICIPANT' THEN RETURN NEW; END IF;

  IF TG_OP='INSERT' THEN
    -- private.tl_commit_job projects an aggregate with INSERT ... ON CONFLICT
    -- DO UPDATE. PostgreSQL invokes BEFORE INSERT before resolving that
    -- conflict, so only enforce the blank initial shape when no participant
    -- row exists. The ensuing UPDATE invocation validates acceptance changes.
    SELECT EXISTS(
      SELECT 1 FROM public.job_participants
      WHERE job_id=NEW.job_id AND role='CLIENT_PARTICIPANT'
    ) INTO participant_exists;
    IF NOT participant_exists AND (
       NEW.user_id IS NOT NULL OR NEW.token_used IS NOT FALSE OR NEW.display_name IS NOT NULL OR NEW.email IS NOT NULL OR
       NEW.phone IS NOT NULL OR NEW.detail_status IS DISTINCT FROM 'UNKNOWN') THEN
      RAISE EXCEPTION 'A new client participant must begin without accepted details';
    END IF;
    RETURN NEW;
  END IF;

  SELECT event_type INTO latest_event FROM public.trust_events
  WHERE job_id=NEW.job_id ORDER BY event_sequence DESC LIMIT 1;
  SELECT status INTO current_status FROM public.jobs WHERE id=NEW.job_id;
  SELECT count(*) INTO acceptance_count FROM public.trust_events
  WHERE job_id=NEW.job_id AND event_type='JOB_ACCEPTED';

  IF NEW.user_id IS NOT DISTINCT FROM OLD.user_id AND
     NEW.token_used IS NOT DISTINCT FROM OLD.token_used AND
     NEW.display_name IS NOT DISTINCT FROM OLD.display_name AND
     NEW.email IS NOT DISTINCT FROM OLD.email AND
     NEW.phone IS NOT DISTINCT FROM OLD.phone AND
     NEW.detail_status IS NOT DISTINCT FROM OLD.detail_status THEN
    IF latest_event='JOB_ACCEPTED' AND (
      NOT NEW.token_used OR NEW.display_name IS NULL OR NEW.email IS NULL OR
      NEW.detail_status IS DISTINCT FROM 'SELF_PROVIDED' OR acceptance_count<>1
    ) THEN
      RAISE EXCEPTION 'A JOB_ACCEPTED event requires matching accepted client details';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.token_used IS TRUE THEN
    -- Leave values outside the table's declared provenance vocabulary to the
    -- CHECK constraint so PostgreSQL reports the authoritative shape error.
    IF NEW.detail_status NOT IN ('SELF_PROVIDED','EMAIL_VERIFIED','OTHER_VERIFIED','UNKNOWN') THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Accepted client details are immutable';
  END IF;

  IF NEW.user_id IS NOT DISTINCT FROM OLD.user_id AND NEW.token_used AND NEW.display_name IS NOT NULL AND NEW.email IS NOT NULL AND
     NEW.detail_status='SELF_PROVIDED' AND NEW.action_token_hash IS NOT NULL AND
     NEW.token_expires_at>clock_timestamp() AND latest_event='JOB_ACCEPTED' AND
     current_status='ACCEPTED' AND acceptance_count=1 THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Client acceptance requires an active capability and matching JOB_ACCEPTED event';
END $$;

DROP TRIGGER IF EXISTS trg_validate_client_acceptance ON public.job_participants;
CREATE TRIGGER trg_validate_client_acceptance
BEFORE INSERT OR UPDATE OF user_id,token_used,display_name,email,phone,detail_status ON public.job_participants
FOR EACH ROW EXECUTE FUNCTION private.tl_validate_client_acceptance();

-- The Phase 10 wrapper proves that a submitted aggregate has one appended
-- event, but the ledger trigger runs after private.tl_commit_job updates jobs.
-- Lock the persisted predecessor here so an ACCEPTED record cannot be forged
-- from any state other than SENT before that update takes place.
CREATE OR REPLACE FUNCTION public.tl_commit_job(p_record jsonb,p_expected_version integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  r jsonb := public.tl_snake_keys(p_record);
  item jsonb;
  created_event jsonb;
  sent_event jsonb;
  collection_name text;
  event_position bigint;
  stored_count integer;
  submitted_job public.jobs%ROWTYPE;
  stored_job public.jobs%ROWTYPE;
  stored_client public.job_participants%ROWTYPE;
  candidate public.trust_events%ROWTYPE;
  persisted public.trust_events%ROWTYPE;
  new_event jsonb;
BEGIN
  IF jsonb_typeof(r->'events') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Transaction events must be an array';
  END IF;

  submitted_job := jsonb_populate_record(null::public.jobs,r->'job');

  IF p_expected_version IS NULL THEN
    IF submitted_job.id IS NULL OR submitted_job.provider_id IS NULL OR submitted_job.public_id !~ '^[a-f0-9]{24}$' THEN
      RAISE EXCEPTION 'A new transaction requires valid opaque identifiers';
    END IF;
    IF submitted_job.status<>'SENT' OR submitted_job.version<>0 OR submitted_job.updated_at<>submitted_job.created_at OR
       submitted_job.view_count<>0 OR submitted_job.first_viewed_at IS NOT NULL OR submitted_job.last_viewed_at IS NOT NULL OR
       submitted_job.completed_at IS NOT NULL THEN
      RAISE EXCEPTION 'A new transaction must begin in the canonical SENT state';
    END IF;
    IF coalesce(r->'job'->>'client_action_token_hash','') !~ '^[a-f0-9]{64}$' OR
       nullif(r->'job'->>'client_token_expires_at','')::timestamptz IS NULL OR
       nullif(r->'job'->>'client_token_expires_at','')::timestamptz<=submitted_job.created_at OR
       nullif(r->'job'->>'client_token_expires_at','')::timestamptz<=clock_timestamp() OR
       coalesce((r->'job'->>'client_token_used')::boolean,false) OR
       nullif(r->'job'->>'client_id','') IS NOT NULL OR
       nullif(r->'job'->>'client_name','') IS NOT NULL OR
       nullif(r->'job'->>'client_email','') IS NOT NULL OR
       nullif(r->'job'->>'client_phone','') IS NOT NULL THEN
      RAISE EXCEPTION 'A new transaction requires an unused expiring client capability';
    END IF;
    IF r->'terms'->>'job_id' IS DISTINCT FROM submitted_job.id::text OR
       (r->'terms'->>'created_at')::timestamptz<>submitted_job.created_at OR
       coalesce((r->'terms'->>'revisions_used')::integer,-1)<>0 THEN
      RAISE EXCEPTION 'A new transaction requires its immutable initial terms';
    END IF;

    FOREACH collection_name IN ARRAY ARRAY['payments','deliveries','revisions','disputes','reviews'] LOOP
      IF jsonb_typeof(r->collection_name) IS DISTINCT FROM 'array' OR jsonb_array_length(r->collection_name)<>0 THEN
        RAISE EXCEPTION 'A new transaction cannot contain lifecycle evidence';
      END IF;
    END LOOP;

    IF jsonb_array_length(r->'events')<>2 THEN
      RAISE EXCEPTION 'A new transaction requires its creation and publication events';
    END IF;
    created_event := r->'events'->0;
    sent_event := r->'events'->1;
    IF created_event->>'event_type'<>'JOB_CREATED' OR sent_event->>'event_type'<>'JOB_SENT' OR
       (created_event->>'event_sequence')::integer<>1 OR (sent_event->>'event_sequence')::integer<>2 OR
       created_event->>'job_id' IS DISTINCT FROM submitted_job.id::text OR sent_event->>'job_id' IS DISTINCT FROM submitted_job.id::text OR
       created_event->>'actor_type'<>'PROVIDER' OR sent_event->>'actor_type'<>'PROVIDER' OR
       created_event->>'actor_id' IS DISTINCT FROM submitted_job.provider_id::text OR sent_event->>'actor_id' IS DISTINCT FROM submitted_job.provider_id::text OR
       (created_event->>'occurred_at')::timestamptz<>submitted_job.created_at OR (sent_event->>'occurred_at')::timestamptz<>submitted_job.created_at OR
       created_event->'metadata'->>'repeat_use' IS DISTINCT FROM submitted_job.repeat_use OR
       created_event->'metadata'->>'source_channel' IS DISTINCT FROM submitted_job.source_channel OR
       sent_event->'metadata'<>'{}'::jsonb THEN
      RAISE EXCEPTION 'A new transaction requires canonical creation events';
    END IF;
  ELSE
    SELECT * INTO stored_job FROM public.jobs WHERE id=submitted_job.id FOR UPDATE;
    IF NOT FOUND OR stored_job.version<>p_expected_version THEN
      RAISE EXCEPTION 'Concurrent change' USING ERRCODE='40001';
    END IF;
    IF submitted_job.version<>stored_job.version+1 THEN
      RAISE EXCEPTION 'Invalid next version';
    END IF;
  END IF;

  SELECT count(*) INTO stored_count FROM public.trust_events WHERE job_id=submitted_job.id;

  IF p_expected_version IS NULL THEN
    IF stored_count<>0 THEN
      RAISE EXCEPTION 'A new transaction cannot replace existing event history';
    END IF;
  ELSIF jsonb_array_length(r->'events')<>stored_count+1 THEN
    RAISE EXCEPTION 'A transaction change requires the complete history and one new event';
  ELSE
    new_event := r->'events'->stored_count;
    IF new_event->>'event_type'='JOB_ACCEPTED' THEN
      IF stored_job.status<>'SENT' OR submitted_job.status<>'ACCEPTED' THEN
        RAISE EXCEPTION 'Client acceptance requires the reviewed SENT agreement';
      END IF;

      SELECT * INTO stored_client FROM public.job_participants
      WHERE job_id=submitted_job.id AND role='CLIENT_PARTICIPANT'
      FOR UPDATE;
      IF NOT FOUND OR stored_client.token_used IS NOT FALSE OR stored_client.action_token_hash IS NULL OR
         stored_client.token_expires_at IS NULL OR stored_client.token_expires_at<=clock_timestamp() OR stored_client.display_name IS NOT NULL OR
         stored_client.email IS NOT NULL OR stored_client.phone IS NOT NULL OR
         stored_client.detail_status IS DISTINCT FROM 'UNKNOWN' THEN
        RAISE EXCEPTION 'Client acceptance requires an unused active capability for the participant';
      END IF;

      IF new_event->>'actor_type' IS DISTINCT FROM 'CLIENT_PARTICIPANT' OR
         new_event->>'actor_id' IS DISTINCT FROM 'client:'||submitted_job.id::text OR
         coalesce((r->'job'->>'client_token_used')::boolean,false) IS NOT TRUE OR
         nullif(r->'job'->>'client_id','') IS DISTINCT FROM stored_client.user_id::text OR
         nullif(btrim(coalesce(r->'job'->>'client_name','')),'') IS NULL OR
         nullif(btrim(coalesce(r->'job'->>'client_email','')),'') IS NULL OR
         nullif(r->'job'->>'client_action_token_hash','') IS DISTINCT FROM stored_client.action_token_hash OR
         nullif(r->'job'->>'client_token_expires_at','')::timestamptz IS DISTINCT FROM stored_client.token_expires_at THEN
        RAISE EXCEPTION 'Client acceptance requires the stored active capability and supplied details';
      END IF;
    END IF;
  END IF;

  FOR item,event_position IN
    SELECT value,ordinality FROM jsonb_array_elements(r->'events') WITH ORDINALITY
  LOOP
    candidate := jsonb_populate_record(null::public.trust_events,item);
    IF candidate.job_id<>submitted_job.id OR candidate.event_sequence<>event_position THEN
      RAISE EXCEPTION 'Trust event history is not in canonical order';
    END IF;
    IF event_position<=stored_count THEN
      SELECT * INTO persisted FROM public.trust_events
      WHERE job_id=candidate.job_id AND event_sequence=candidate.event_sequence;
      IF NOT FOUND OR to_jsonb(persisted) IS DISTINCT FROM to_jsonb(candidate) THEN
        RAISE EXCEPTION 'Persisted trust event history does not match the submitted aggregate';
      END IF;
    END IF;
  END LOOP;

  PERFORM private.tl_commit_job(p_record,p_expected_version);
END $$;

REVOKE ALL ON FUNCTION private.tl_validate_trust_event_insert() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION private.tl_validate_client_capability() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION private.tl_validate_client_acceptance() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.tl_commit_job(jsonb,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.tl_commit_job(jsonb,integer) TO service_role;

COMMENT ON FUNCTION private.tl_validate_client_acceptance() IS
  'Client contact details become immutable only through a capability-authorized JOB_ACCEPTED transition.';

COMMIT;
