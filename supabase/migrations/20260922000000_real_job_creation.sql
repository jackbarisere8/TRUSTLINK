-- Phase 10 real job creation integrity.
-- A publish request must atomically create one canonical SENT transaction,
-- immutable terms, provider/client participant relationships and the two
-- creation events. Public identifiers are opaque 96-bit values.
BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.jobs WHERE public_id !~ '^[a-f0-9]{24}$') THEN
    RAISE EXCEPTION 'Historical public job identifiers require repair before Phase 10';
  END IF;
END $$;

ALTER TABLE public.jobs
  DROP CONSTRAINT jobs_public_id_not_blank,
  ADD CONSTRAINT jobs_public_id_format CHECK (public_id ~ '^[a-f0-9]{24}$');

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
  stored_version integer;
  job public.jobs%ROWTYPE;
  candidate public.trust_events%ROWTYPE;
  persisted public.trust_events%ROWTYPE;
BEGIN
  IF jsonb_typeof(r->'events') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Transaction events must be an array';
  END IF;

  job := jsonb_populate_record(null::public.jobs,r->'job');

  IF p_expected_version IS NULL THEN
    IF job.id IS NULL OR job.provider_id IS NULL OR job.public_id !~ '^[a-f0-9]{24}$' THEN
      RAISE EXCEPTION 'A new transaction requires valid opaque identifiers';
    END IF;
    IF job.status<>'SENT' OR job.version<>0 OR job.updated_at<>job.created_at OR
       job.view_count<>0 OR job.first_viewed_at IS NOT NULL OR job.last_viewed_at IS NOT NULL OR
       job.completed_at IS NOT NULL THEN
      RAISE EXCEPTION 'A new transaction must begin in the canonical SENT state';
    END IF;
    IF coalesce(r->'job'->>'client_action_token_hash','') !~ '^[a-f0-9]{64}$' OR
       nullif(r->'job'->>'client_token_expires_at','')::timestamptz<=job.created_at OR
       coalesce((r->'job'->>'client_token_used')::boolean,false) OR
       nullif(r->'job'->>'client_id','') IS NOT NULL OR
       nullif(r->'job'->>'client_name','') IS NOT NULL OR
       nullif(r->'job'->>'client_email','') IS NOT NULL OR
       nullif(r->'job'->>'client_phone','') IS NOT NULL THEN
      RAISE EXCEPTION 'A new transaction requires an unused expiring client capability';
    END IF;
    IF r->'terms'->>'job_id' IS DISTINCT FROM job.id::text OR
       (r->'terms'->>'created_at')::timestamptz<>job.created_at OR
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
       created_event->>'job_id' IS DISTINCT FROM job.id::text OR sent_event->>'job_id' IS DISTINCT FROM job.id::text OR
       created_event->>'actor_type'<>'PROVIDER' OR sent_event->>'actor_type'<>'PROVIDER' OR
       created_event->>'actor_id' IS DISTINCT FROM job.provider_id::text OR sent_event->>'actor_id' IS DISTINCT FROM job.provider_id::text OR
       (created_event->>'occurred_at')::timestamptz<>job.created_at OR (sent_event->>'occurred_at')::timestamptz<>job.created_at OR
       created_event->'metadata'->>'repeat_use' IS DISTINCT FROM job.repeat_use OR
       created_event->'metadata'->>'source_channel' IS DISTINCT FROM job.source_channel OR
       sent_event->'metadata'<>'{}'::jsonb THEN
      RAISE EXCEPTION 'A new transaction requires canonical creation events';
    END IF;
  END IF;

  IF p_expected_version IS NOT NULL THEN
    SELECT version INTO stored_version FROM public.jobs WHERE id=job.id;
    IF stored_version IS NULL OR stored_version<>p_expected_version THEN
      RAISE EXCEPTION 'Concurrent change' USING ERRCODE='40001';
    END IF;
  END IF;

  SELECT count(*) INTO stored_count FROM public.trust_events WHERE job_id=job.id;

  IF p_expected_version IS NULL THEN
    IF stored_count<>0 THEN
      RAISE EXCEPTION 'A new transaction cannot replace existing event history';
    END IF;
  ELSIF jsonb_array_length(r->'events')<>stored_count+1 THEN
    RAISE EXCEPTION 'A transaction change requires the complete history and one new event';
  END IF;

  FOR item,event_position IN
    SELECT value,ordinality FROM jsonb_array_elements(r->'events') WITH ORDINALITY
  LOOP
    candidate := jsonb_populate_record(null::public.trust_events,item);
    IF candidate.job_id<>job.id OR candidate.event_sequence<>event_position THEN
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

COMMENT ON CONSTRAINT jobs_public_id_format ON public.jobs IS
  'Opaque lowercase hexadecimal identifier carrying 96 bits of server-generated randomness.';
COMMENT ON FUNCTION public.tl_commit_job(jsonb,integer) IS
  'Atomically creates a canonical transaction or appends one authorized lifecycle transition.';

REVOKE ALL ON FUNCTION public.tl_commit_job(jsonb,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.tl_commit_job(jsonb,integer) TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC,anon,authenticated,service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA private
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC,anon,authenticated,service_role;

COMMIT;
