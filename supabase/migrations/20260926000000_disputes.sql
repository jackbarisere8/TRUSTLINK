-- Phase 17 structured dispute responses and operational resolution integrity.
BEGIN;

-- A pre-ledger response cannot be attributed or timed honestly. Stop for an
-- operator-assisted repair instead of inventing provenance during migration.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.disputes WHERE response_from_other_party IS NOT NULL) THEN
    RAISE EXCEPTION 'Historical dispute responses require explicit actor and timestamp repair before Phase 17';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.disputes
    WHERE dispute_status='UNDER_REVIEW'
       OR (dispute_status='OPEN' AND (resolution_notes IS NOT NULL OR resolved_by IS NOT NULL OR resolved_at IS NOT NULL))
       OR (dispute_status IN ('RESOLVED','CLOSED') AND (resolution_notes IS NULL OR resolved_by IS NULL OR resolved_at IS NULL))
  ) THEN
    RAISE EXCEPTION 'Historical dispute status and resolution fields require repair before Phase 17';
  END IF;
END $$;

ALTER TABLE public.disputes
  ADD CONSTRAINT disputes_response_bounds CHECK (
    response_from_other_party IS NULL OR (btrim(response_from_other_party)<>'' AND char_length(response_from_other_party)<=5000)
  ) NOT VALID,
  ADD CONSTRAINT disputes_resolution_bounds CHECK (
    resolution_notes IS NULL OR (btrim(resolution_notes)<>'' AND char_length(resolution_notes)<=5000)
  ) NOT VALID,
  ADD CONSTRAINT disputes_state_shape CHECK (
    (dispute_status='OPEN' AND response_from_other_party IS NULL AND resolution_notes IS NULL AND resolved_by IS NULL AND resolved_at IS NULL) OR
    (dispute_status='UNDER_REVIEW' AND response_from_other_party IS NOT NULL AND resolution_notes IS NULL AND resolved_by IS NULL AND resolved_at IS NULL) OR
    (dispute_status IN ('RESOLVED','CLOSED') AND resolution_notes IS NOT NULL AND resolved_by IS NOT NULL AND resolved_at IS NOT NULL)
  ) NOT VALID;

ALTER TABLE public.trust_events
  DROP CONSTRAINT supported_trust_event,
  ADD CONSTRAINT supported_trust_event CHECK (event_type IN (
    'JOB_CREATED','JOB_SENT','JOB_VIEWED','JOB_ACCEPTED','PAYMENT_RECORDED',
    'WORK_STARTED','DELIVERY_SUBMITTED','REVISION_REQUESTED','DELIVERY_APPROVED',
    'DISPUTE_OPENED','DISPUTE_RESPONDED','DISPUTE_RESOLVED','JOB_COMPLETED','JOB_CANCELLED',
    'CLIENT_REVIEWED','CLIENT_LINK_REISSUED','CLIENT_LINK_REVOKED'
  )) NOT VALID,
  DROP CONSTRAINT trust_events_actor_for_type,
  ADD CONSTRAINT trust_events_actor_for_type CHECK (
    (event_type IN ('JOB_CREATED','JOB_SENT','PAYMENT_RECORDED','WORK_STARTED','DELIVERY_SUBMITTED','JOB_COMPLETED','JOB_CANCELLED','CLIENT_LINK_REISSUED','CLIENT_LINK_REVOKED') AND actor_type='PROVIDER') OR
    (event_type IN ('JOB_ACCEPTED','REVISION_REQUESTED','DELIVERY_APPROVED','CLIENT_REVIEWED') AND actor_type='CLIENT_PARTICIPANT') OR
    (event_type IN ('DISPUTE_OPENED','DISPUTE_RESPONDED') AND actor_type IN ('PROVIDER','CLIENT_PARTICIPANT')) OR
    (event_type='DISPUTE_RESOLVED' AND actor_type='ADMIN') OR
    (event_type='JOB_VIEWED' AND actor_type='SYSTEM')
  ) NOT VALID,
  DROP CONSTRAINT phase15_event_metadata,
  ADD CONSTRAINT phase15_event_metadata CHECK (
    (event_type<>'DELIVERY_SUBMITTED' OR (
      coalesce(metadata->>'delivery_id','') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      AND coalesce(metadata->>'file_count','') ~ '^\d+$' AND (metadata->>'file_count')::integer<=10
    )) AND
    (event_type<>'REVISION_REQUESTED' OR (
      coalesce(metadata->>'revision_id','') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      AND coalesce(metadata->>'revision_number','') ~ '^\d+$' AND (metadata->>'revision_number')::integer>0
    )) AND
    (event_type<>'DELIVERY_APPROVED' OR
      coalesce(metadata->>'delivery_id','') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') AND
    (event_type<>'DISPUTE_OPENED' OR (
      coalesce(metadata->>'dispute_id','') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      AND coalesce(metadata->>'file_count','') ~ '^\d+$' AND (metadata->>'file_count')::integer<=10
    )) AND
    (event_type<>'DISPUTE_RESPONDED' OR
      coalesce(metadata->>'dispute_id','') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') AND
    (event_type<>'DISPUTE_RESOLVED' OR (
      coalesce(metadata->>'dispute_id','') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      AND coalesce(metadata->>'outcome','') IN ('IN_PROGRESS','CANCELLED')
    ))
  ) NOT VALID;

CREATE FUNCTION private.tl_validate_phase17_event_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE existing_event public.trust_events%ROWTYPE; active_dispute public.disputes%ROWTYPE; provider uuid; current_status text;
BEGIN
  IF NEW.event_type NOT IN ('DISPUTE_RESPONDED','DISPUTE_RESOLVED') THEN RETURN NEW; END IF;
  SELECT * INTO existing_event FROM public.trust_events WHERE id=NEW.id;
  IF FOUND THEN
    IF to_jsonb(existing_event) IS DISTINCT FROM to_jsonb(NEW) THEN
      RAISE EXCEPTION 'Persisted trust event history does not match the submitted aggregate';
    END IF;
    RETURN NEW;
  END IF;
  SELECT provider_id,status INTO provider,current_status FROM public.jobs WHERE id=NEW.job_id;
  SELECT * INTO active_dispute FROM public.disputes
  WHERE job_id=NEW.job_id AND dispute_status IN ('OPEN','UNDER_REVIEW')
  ORDER BY created_at,id LIMIT 1;
  IF NOT FOUND OR NEW.metadata->>'dispute_id' IS DISTINCT FROM active_dispute.id::text THEN
    RAISE EXCEPTION 'Dispute event requires the active dispute';
  END IF;
  IF NEW.event_type='DISPUTE_RESPONDED' THEN
    IF current_status<>'DISPUTED' OR active_dispute.dispute_status<>'OPEN' OR active_dispute.response_from_other_party IS NOT NULL OR
       NEW.actor_type IS DISTINCT FROM (CASE WHEN active_dispute.raised_by='PROVIDER' THEN 'CLIENT_PARTICIPANT' ELSE 'PROVIDER' END) OR
       NEW.actor_id IS DISTINCT FROM (CASE WHEN active_dispute.raised_by='PROVIDER' THEN 'client:'||NEW.job_id::text ELSE provider::text END) THEN
      RAISE EXCEPTION 'Only the other transaction party can respond once to an open dispute';
    END IF;
  ELSIF current_status NOT IN ('IN_PROGRESS','CANCELLED') OR NEW.actor_type<>'ADMIN' OR
        NEW.metadata->>'outcome' IS DISTINCT FROM current_status THEN
    RAISE EXCEPTION 'Only an administrator can resolve a dispute with an explicit operational outcome';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_validate_phase17_event_insert
BEFORE INSERT ON public.trust_events FOR EACH ROW
EXECUTE FUNCTION private.tl_validate_phase17_event_insert();

CREATE FUNCTION private.tl_validate_phase17_commit(p_record jsonb,p_expected_version integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  r jsonb := public.tl_snake_keys(p_record);
  submitted_job public.jobs%ROWTYPE;
  stored_job public.jobs%ROWTYPE;
  active_dispute public.disputes%ROWTYPE;
  submitted_dispute jsonb;
  new_event jsonb;
  stored_event_count integer;
  expected_actor_id text;
  expected_actor_type text;
BEGIN
  IF p_expected_version IS NULL THEN RETURN; END IF;
  IF jsonb_typeof(r->'events') IS DISTINCT FROM 'array' OR jsonb_typeof(r->'disputes') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Phase 17 dispute collections must be arrays';
  END IF;
  submitted_job := jsonb_populate_record(null::public.jobs,r->'job');
  SELECT * INTO stored_job FROM public.jobs WHERE id=submitted_job.id FOR UPDATE;
  IF NOT FOUND OR stored_job.version<>p_expected_version THEN RAISE EXCEPTION 'Concurrent change' USING ERRCODE='40001'; END IF;
  SELECT count(*) INTO stored_event_count FROM public.trust_events WHERE job_id=submitted_job.id;
  IF jsonb_array_length(r->'events')<>stored_event_count+1 THEN RAISE EXCEPTION 'A transaction change requires the complete history and one new event'; END IF;
  new_event := r->'events'->stored_event_count;
  SELECT * INTO active_dispute FROM public.disputes
  WHERE job_id=submitted_job.id AND dispute_status IN ('OPEN','UNDER_REVIEW')
  ORDER BY created_at,id LIMIT 1 FOR UPDATE;

  IF new_event->>'event_type'='DISPUTE_OPENED' THEN
    submitted_dispute := r->'disputes'->(jsonb_array_length(r->'disputes')-1);
    IF submitted_dispute->>'dispute_status'<>'OPEN' OR submitted_dispute->>'response_from_other_party' IS NOT NULL OR
       submitted_dispute->>'resolution_notes' IS NOT NULL OR submitted_dispute->>'resolved_by' IS NOT NULL OR
       submitted_dispute->>'resolved_at' IS NOT NULL OR
       (submitted_dispute->>'updated_at')::timestamptz<>(submitted_dispute->>'created_at')::timestamptz THEN
      RAISE EXCEPTION 'A new dispute must begin open without a response or resolution';
    END IF;
  ELSIF new_event->>'event_type'='DISPUTE_RESPONDED' THEN
    IF active_dispute.id IS NULL THEN RAISE EXCEPTION 'No open dispute is awaiting a response'; END IF;
    SELECT value INTO submitted_dispute FROM jsonb_array_elements(r->'disputes') item(value)
    WHERE value->>'id'=active_dispute.id::text;
    expected_actor_type := CASE WHEN active_dispute.raised_by='PROVIDER' THEN 'CLIENT_PARTICIPANT' ELSE 'PROVIDER' END;
    expected_actor_id := CASE WHEN active_dispute.raised_by='PROVIDER' THEN 'client:'||submitted_job.id::text ELSE stored_job.provider_id::text END;
    IF submitted_dispute IS NULL OR active_dispute.dispute_status<>'OPEN' OR active_dispute.response_from_other_party IS NOT NULL OR submitted_job.status<>'DISPUTED' OR
       new_event->>'actor_type' IS DISTINCT FROM expected_actor_type OR new_event->>'actor_id' IS DISTINCT FROM expected_actor_id OR
       new_event->'metadata'->>'dispute_id' IS DISTINCT FROM active_dispute.id::text OR
       submitted_dispute->>'dispute_status'<>'UNDER_REVIEW' OR
       btrim(coalesce(submitted_dispute->>'response_from_other_party',''))='' OR char_length(submitted_dispute->>'response_from_other_party')>5000 OR
       submitted_dispute->>'resolution_notes' IS NOT NULL OR submitted_dispute->>'resolved_by' IS NOT NULL OR submitted_dispute->>'resolved_at' IS NOT NULL OR
       (submitted_dispute->>'updated_at')::timestamptz<>(new_event->>'occurred_at')::timestamptz THEN
      RAISE EXCEPTION 'Dispute response requires the authorized other party and one open dispute';
    END IF;
  ELSIF new_event->>'event_type'='DISPUTE_RESOLVED' THEN
    IF active_dispute.id IS NULL THEN RAISE EXCEPTION 'No active dispute was found'; END IF;
    SELECT value INTO submitted_dispute FROM jsonb_array_elements(r->'disputes') item(value)
    WHERE value->>'id'=active_dispute.id::text;
    IF submitted_dispute IS NULL OR submitted_job.status NOT IN ('IN_PROGRESS','CANCELLED') OR new_event->>'actor_type'<>'ADMIN' OR
       new_event->'metadata'->>'dispute_id' IS DISTINCT FROM active_dispute.id::text OR
       new_event->'metadata'->>'outcome' IS DISTINCT FROM submitted_job.status OR
       submitted_dispute->>'dispute_status'<>'RESOLVED' OR
       submitted_dispute->>'response_from_other_party' IS DISTINCT FROM active_dispute.response_from_other_party OR
       btrim(coalesce(submitted_dispute->>'resolution_notes',''))='' OR char_length(submitted_dispute->>'resolution_notes')>5000 OR
       submitted_dispute->>'resolved_by' IS DISTINCT FROM new_event->>'actor_id' OR
       (submitted_dispute->>'resolved_at')::timestamptz<>(new_event->>'occurred_at')::timestamptz OR
       (submitted_dispute->>'updated_at')::timestamptz<>(new_event->>'occurred_at')::timestamptz OR
       (submitted_job.status='IN_PROGRESS' AND NOT EXISTS (SELECT 1 FROM public.payments WHERE job_id=submitted_job.id)) THEN
      RAISE EXCEPTION 'Dispute resolution requires an administrator, exact active dispute and explicit operational outcome';
    END IF;
  END IF;

  -- Mutable dispute fields may change only on the active row for the two
  -- matching dispute events above. All historical rows remain exact.
  IF EXISTS (
    SELECT 1 FROM public.disputes stored
    WHERE stored.job_id=submitted_job.id
      AND NOT (new_event->>'event_type' IN ('DISPUTE_RESPONDED','DISPUTE_RESOLVED') AND stored.id=active_dispute.id)
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(r->'disputes') item(value)
        WHERE value->>'id'=stored.id::text
          AND value->>'response_from_other_party' IS NOT DISTINCT FROM stored.response_from_other_party
          AND value->>'dispute_status' IS NOT DISTINCT FROM stored.dispute_status
          AND value->>'resolution_notes' IS NOT DISTINCT FROM stored.resolution_notes
          AND value->>'resolved_by' IS NOT DISTINCT FROM stored.resolved_by
          AND (value->>'resolved_at')::timestamptz IS NOT DISTINCT FROM stored.resolved_at
          AND (value->>'updated_at')::timestamptz IS NOT DISTINCT FROM stored.updated_at
      )
  ) THEN RAISE EXCEPTION 'Dispute state changes require their matching response or resolution event'; END IF;
END $$;

CREATE OR REPLACE FUNCTION private.tl_protect_dispute_evidence() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF to_jsonb(NEW) IS NOT DISTINCT FROM to_jsonb(OLD) THEN RETURN NEW; END IF;
  IF NEW.id<>OLD.id OR NEW.job_id<>OLD.job_id OR NEW.raised_by<>OLD.raised_by OR
     NEW.contested_term<>OLD.contested_term OR NEW.claim_description<>OLD.claim_description OR
     NEW.evidence_urls<>OLD.evidence_urls OR NEW.created_at<>OLD.created_at THEN
    RAISE EXCEPTION 'Dispute claim and evidence are immutable';
  END IF;
  IF OLD.dispute_status='OPEN' AND NEW.dispute_status='UNDER_REVIEW' AND
     NEW.resolution_notes IS NULL AND NEW.resolved_by IS NULL AND NEW.resolved_at IS NULL AND
     EXISTS (SELECT 1 FROM public.trust_events event WHERE event.job_id=NEW.job_id AND event.event_type='DISPUTE_RESPONDED'
       AND event.metadata->>'dispute_id'=NEW.id::text AND event.occurred_at=NEW.updated_at) THEN RETURN NEW; END IF;
  IF OLD.dispute_status='UNDER_REVIEW' AND OLD.response_from_other_party IS NULL AND NEW.dispute_status='UNDER_REVIEW' AND
     btrim(coalesce(NEW.response_from_other_party,''))<>'' AND NEW.resolution_notes IS NULL AND NEW.resolved_by IS NULL AND NEW.resolved_at IS NULL AND
     EXISTS (SELECT 1 FROM public.trust_events event WHERE event.job_id=NEW.job_id AND event.event_type='DISPUTE_RESPONDED'
       AND event.metadata->>'dispute_id'=NEW.id::text AND event.occurred_at=NEW.updated_at) THEN RETURN NEW; END IF;
  IF OLD.dispute_status IN ('OPEN','UNDER_REVIEW') AND NEW.dispute_status='RESOLVED' AND
     NEW.response_from_other_party IS NOT DISTINCT FROM OLD.response_from_other_party AND
     btrim(coalesce(NEW.resolution_notes,''))<>'' AND NEW.resolved_by IS NOT NULL AND NEW.resolved_at=NEW.updated_at AND
     EXISTS (SELECT 1 FROM public.trust_events event WHERE event.job_id=NEW.job_id AND event.event_type='DISPUTE_RESOLVED'
       AND event.metadata->>'dispute_id'=NEW.id::text AND event.actor_id=NEW.resolved_by AND event.occurred_at=NEW.resolved_at) THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Dispute state changes require their matching response or resolution event';
END $$;

CREATE FUNCTION private.tl_assert_phase17_dispute_state() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE final_dispute public.disputes%ROWTYPE;
BEGIN
  SELECT * INTO final_dispute FROM public.disputes WHERE id=NEW.id;
  IF final_dispute.dispute_status='OPEN' AND (final_dispute.response_from_other_party IS NOT NULL OR final_dispute.resolution_notes IS NOT NULL OR final_dispute.resolved_by IS NOT NULL OR final_dispute.resolved_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Open dispute cannot contain response or resolution fields';
  ELSIF final_dispute.dispute_status='UNDER_REVIEW' AND (
    btrim(coalesce(final_dispute.response_from_other_party,''))='' OR final_dispute.resolution_notes IS NOT NULL OR final_dispute.resolved_by IS NOT NULL OR final_dispute.resolved_at IS NOT NULL OR
    NOT EXISTS (SELECT 1 FROM public.trust_events event WHERE event.job_id=final_dispute.job_id AND event.event_type='DISPUTE_RESPONDED'
      AND event.metadata->>'dispute_id'=final_dispute.id::text AND event.occurred_at=final_dispute.updated_at)
  ) THEN RAISE EXCEPTION 'Under-review dispute requires its immutable other-party response event';
  ELSIF final_dispute.dispute_status IN ('RESOLVED','CLOSED') AND (
    btrim(coalesce(final_dispute.resolution_notes,''))='' OR final_dispute.resolved_by IS NULL OR final_dispute.resolved_at IS NULL OR final_dispute.updated_at<>final_dispute.resolved_at OR
    NOT EXISTS (SELECT 1 FROM public.trust_events event WHERE event.job_id=final_dispute.job_id AND event.event_type='DISPUTE_RESOLVED'
      AND event.actor_id=final_dispute.resolved_by AND event.occurred_at=final_dispute.resolved_at
      AND (event.metadata->>'dispute_id'=final_dispute.id::text OR NOT event.metadata ? 'dispute_id'))
  ) THEN RAISE EXCEPTION 'Resolved dispute requires its administrator resolution event';
  END IF;
  IF final_dispute.response_from_other_party IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.trust_events event JOIN public.jobs job ON job.id=event.job_id
    WHERE event.job_id=final_dispute.job_id AND event.event_type='DISPUTE_RESPONDED' AND event.metadata->>'dispute_id'=final_dispute.id::text
      AND event.actor_type=CASE WHEN final_dispute.raised_by='PROVIDER' THEN 'CLIENT_PARTICIPANT' ELSE 'PROVIDER' END
      AND event.actor_id=CASE WHEN final_dispute.raised_by='PROVIDER' THEN 'client:'||final_dispute.job_id::text ELSE job.provider_id::text END
      AND event.occurred_at<=final_dispute.updated_at
  ) THEN RAISE EXCEPTION 'Dispute response requires the authorized other party event'; END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION private.tl_assert_phase17_event_dispute() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NEW.event_type='DISPUTE_RESPONDED' AND NOT EXISTS (
    SELECT 1 FROM public.disputes dispute JOIN public.jobs job ON job.id=dispute.job_id
    WHERE dispute.id=(NEW.metadata->>'dispute_id')::uuid AND dispute.job_id=NEW.job_id
      AND dispute.response_from_other_party IS NOT NULL AND dispute.dispute_status IN ('UNDER_REVIEW','RESOLVED','CLOSED')
      AND NEW.actor_type=CASE WHEN dispute.raised_by='PROVIDER' THEN 'CLIENT_PARTICIPANT' ELSE 'PROVIDER' END
      AND NEW.actor_id=CASE WHEN dispute.raised_by='PROVIDER' THEN 'client:'||dispute.job_id::text ELSE job.provider_id::text END
      AND NEW.occurred_at<=dispute.updated_at
  ) THEN RAISE EXCEPTION 'DISPUTE_RESPONDED event requires its other-party response';
  ELSIF NEW.event_type='DISPUTE_RESOLVED' AND NOT EXISTS (
    SELECT 1 FROM public.disputes dispute WHERE dispute.id=(NEW.metadata->>'dispute_id')::uuid AND dispute.job_id=NEW.job_id
      AND dispute.dispute_status IN ('RESOLVED','CLOSED') AND dispute.resolved_by=NEW.actor_id
      AND dispute.resolved_at=NEW.occurred_at AND dispute.updated_at=NEW.occurred_at
  ) THEN RAISE EXCEPTION 'DISPUTE_RESOLVED event requires its administrator resolution';
  END IF;
  RETURN NEW;
END $$;

CREATE CONSTRAINT TRIGGER phase17_dispute_state_after_write
AFTER INSERT OR UPDATE ON public.disputes DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION private.tl_assert_phase17_dispute_state();
CREATE CONSTRAINT TRIGGER phase17_event_requires_dispute
AFTER INSERT ON public.trust_events DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION private.tl_assert_phase17_event_dispute();

ALTER FUNCTION public.tl_commit_job(jsonb,integer) RENAME TO tl_phase16_commit_job;
ALTER FUNCTION public.tl_phase16_commit_job(jsonb,integer) SET SCHEMA private;

CREATE FUNCTION public.tl_commit_job(p_record jsonb,p_expected_version integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  r jsonb := public.tl_snake_keys(p_record);
  base_record jsonb;
  new_event jsonb;
  submitted_dispute jsonb;
  stored_dispute public.disputes%ROWTYPE;
BEGIN
  PERFORM private.tl_validate_phase17_commit(r,p_expected_version);
  new_event := r->'events'->(jsonb_array_length(r->'events')-1);
  base_record := r;
  IF new_event->>'event_type'='DISPUTE_RESPONDED' THEN
    SELECT * INTO stored_dispute FROM public.disputes WHERE id=(new_event->'metadata'->>'dispute_id')::uuid;
    base_record := jsonb_set(r,'{disputes}',(
      SELECT jsonb_agg(CASE WHEN value->>'id'=stored_dispute.id::text THEN value || jsonb_build_object(
        'response_from_other_party',stored_dispute.response_from_other_party,
        'dispute_status',stored_dispute.dispute_status,
        'updated_at',stored_dispute.updated_at
      ) ELSE value END)
      FROM jsonb_array_elements(r->'disputes') item(value)
    ));
  END IF;
  PERFORM private.tl_phase16_commit_job(base_record,p_expected_version);
  IF new_event->>'event_type'='DISPUTE_RESPONDED' THEN
    SELECT value INTO submitted_dispute FROM jsonb_array_elements(r->'disputes') item(value)
    WHERE value->>'id'=new_event->'metadata'->>'dispute_id';
    UPDATE public.disputes SET
      response_from_other_party=submitted_dispute->>'response_from_other_party',
      dispute_status='UNDER_REVIEW',
      updated_at=(submitted_dispute->>'updated_at')::timestamptz
    WHERE id=(new_event->'metadata'->>'dispute_id')::uuid AND job_id=(r->'job'->>'id')::uuid;
    IF NOT FOUND THEN RAISE EXCEPTION 'Dispute response target was not found'; END IF;
  END IF;
END $$;

REVOKE ALL ON FUNCTION
  private.tl_validate_phase17_event_insert(),
  private.tl_validate_phase17_commit(jsonb,integer),
  private.tl_assert_phase17_dispute_state(),
  private.tl_assert_phase17_event_dispute(),
  private.tl_phase16_commit_job(jsonb,integer)
FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.tl_commit_job(jsonb,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.tl_commit_job(jsonb,integer) TO service_role;

COMMENT ON FUNCTION private.tl_validate_phase17_commit(jsonb,integer) IS
  'Authorizes one other-party dispute response or one administrator operational resolution against the locked active dispute.';
COMMENT ON COLUMN public.disputes.response_from_other_party IS
  'Single immutable response from the transaction party that did not raise the dispute; provenance is linked by DISPUTE_RESPONDED.';
COMMENT ON COLUMN public.disputes.resolution_notes IS
  'Operational resolution only. It does not represent payment custody, reversal, or refund.';

COMMIT;
