-- Phase 12: transaction-scoped client capability revocation and enforcement.
-- A client link remains a bearer capability, but it can now be explicitly
-- revoked without creating a replacement. Capability changes are ledgered and
-- may not be smuggled into an unrelated transaction transition.
BEGIN;

ALTER TABLE public.job_participants
  DROP CONSTRAINT client_participant_shape,
  ADD CONSTRAINT client_participant_shape CHECK (
    role <> 'CLIENT_PARTICIPANT' OR (
      (
        (action_token_hash IS NULL AND token_expires_at IS NULL) OR
        (action_token_hash IS NOT NULL AND token_expires_at IS NOT NULL)
      ) AND (
        (token_used = false AND display_name IS NULL AND email IS NULL AND phone IS NULL AND detail_status = 'UNKNOWN') OR
        (token_used = true AND display_name IS NOT NULL AND email IS NOT NULL)
      )
    )
  );

ALTER TABLE public.trust_events
  DROP CONSTRAINT supported_trust_event,
  ADD CONSTRAINT supported_trust_event CHECK (event_type IN (
    'JOB_CREATED','JOB_SENT','JOB_VIEWED','JOB_ACCEPTED','PAYMENT_RECORDED',
    'WORK_STARTED','DELIVERY_SUBMITTED','REVISION_REQUESTED','DELIVERY_APPROVED',
    'DISPUTE_OPENED','DISPUTE_RESOLVED','JOB_COMPLETED','JOB_CANCELLED',
    'CLIENT_REVIEWED','CLIENT_LINK_REISSUED','CLIENT_LINK_REVOKED'
  )) NOT VALID,
  DROP CONSTRAINT trust_events_actor_for_type,
  ADD CONSTRAINT trust_events_actor_for_type CHECK (
    (event_type IN ('JOB_CREATED','JOB_SENT','PAYMENT_RECORDED','WORK_STARTED','DELIVERY_SUBMITTED','JOB_COMPLETED','JOB_CANCELLED','CLIENT_LINK_REISSUED','CLIENT_LINK_REVOKED') AND actor_type='PROVIDER') OR
    (event_type IN ('JOB_ACCEPTED','REVISION_REQUESTED','DELIVERY_APPROVED','CLIENT_REVIEWED') AND actor_type='CLIENT_PARTICIPANT') OR
    (event_type='DISPUTE_OPENED' AND actor_type IN ('PROVIDER','CLIENT_PARTICIPANT')) OR
    (event_type='DISPUTE_RESOLVED' AND actor_type='ADMIN') OR
    (event_type='JOB_VIEWED' AND actor_type='SYSTEM')
  ) NOT VALID;

CREATE OR REPLACE FUNCTION private.tl_validate_trust_event_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  duplicate_event public.trust_events%ROWTYPE;
  previous_sequence integer;
  previous_occurred_at timestamptz;
  provider uuid;
  current_status text;
  current_version integer;
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
    IF NEW.action_token_hash IS NULL OR NEW.token_expires_at IS NULL OR NEW.token_expires_at<=NEW.updated_at THEN
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
     NEW.action_token_hash IS DISTINCT FROM OLD.action_token_hash AND NEW.token_expires_at>NEW.updated_at THEN
    IF latest_event IS DISTINCT FROM 'CLIENT_LINK_REISSUED' THEN
      RAISE EXCEPTION 'Client capability replacement requires its ledger event';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Client capability fields must change together through revocation or replacement';
END $$;

DROP TRIGGER IF EXISTS trg_validate_client_capability ON public.job_participants;
CREATE TRIGGER trg_validate_client_capability
BEFORE INSERT OR UPDATE OF action_token_hash,token_expires_at ON public.job_participants
FOR EACH ROW EXECUTE FUNCTION private.tl_validate_client_capability();

REVOKE ALL ON FUNCTION private.tl_validate_trust_event_insert() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION private.tl_validate_client_capability() FROM PUBLIC,anon,authenticated,service_role;

COMMENT ON FUNCTION private.tl_validate_client_capability() IS
  'Client capability hashes and expiry may only be created, replaced or cleared through their matching immutable trust event.';

COMMIT;
