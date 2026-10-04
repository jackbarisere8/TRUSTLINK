-- Phase 8 trust-event ledger integrity.
-- Add deterministic per-job ordering, validate event/actor/operation semantics,
-- and reject aggregate commits that rewrite or omit persisted history.
BEGIN;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC,anon,authenticated,service_role;

ALTER TABLE public.trust_events ADD COLUMN event_sequence integer;

ALTER TABLE public.trust_events DISABLE TRIGGER trg_immutable_trust_events;
WITH ranked AS (
  SELECT id,row_number() OVER (
    PARTITION BY job_id
    ORDER BY occurred_at,created_at,
      CASE
        WHEN event_type='JOB_CREATED' THEN 0
        WHEN event_type='JOB_SENT' THEN 1
        WHEN coalesce(metadata->>'expected_version','') ~ '^\d+$' THEN 2+(metadata->>'expected_version')::integer
        ELSE 2147483647
      END,
      id
  )::integer AS event_sequence
  FROM public.trust_events
)
UPDATE public.trust_events event
SET event_sequence=ranked.event_sequence
FROM ranked
WHERE ranked.id=event.id;
ALTER TABLE public.trust_events ENABLE TRIGGER trg_immutable_trust_events;

ALTER TABLE public.trust_events
  ALTER COLUMN event_sequence SET NOT NULL,
  ADD CONSTRAINT trust_events_positive_sequence CHECK (event_sequence > 0),
  ADD CONSTRAINT trust_events_job_sequence_unique UNIQUE (job_id,event_sequence),
  ADD CONSTRAINT trust_events_metadata_object CHECK (jsonb_typeof(metadata)='object'),
  ADD CONSTRAINT trust_events_actor_not_blank CHECK (btrim(actor_id)<>''),
  ADD CONSTRAINT trust_events_timestamp_order CHECK (created_at >= occurred_at) NOT VALID,
  ADD CONSTRAINT trust_events_actor_for_type CHECK (
    (event_type IN ('JOB_CREATED','JOB_SENT','PAYMENT_RECORDED','WORK_STARTED','DELIVERY_SUBMITTED','JOB_COMPLETED','JOB_CANCELLED','CLIENT_LINK_REISSUED') AND actor_type='PROVIDER') OR
    (event_type IN ('JOB_ACCEPTED','REVISION_REQUESTED','DELIVERY_APPROVED','CLIENT_REVIEWED') AND actor_type='CLIENT_PARTICIPANT') OR
    (event_type='DISPUTE_OPENED' AND actor_type IN ('PROVIDER','CLIENT_PARTICIPANT')) OR
    (event_type='DISPUTE_RESOLVED' AND actor_type='ADMIN') OR
    (event_type='JOB_VIEWED' AND actor_type='SYSTEM')
  ) NOT VALID;

COMMENT ON COLUMN public.trust_events.event_sequence IS
  'Gap-free, one-based order of immutable events within a transaction.';

CREATE FUNCTION private.tl_validate_trust_event_insert() RETURNS trigger
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
     (NEW.event_type='CLIENT_LINK_REISSUED' AND current_status IN ('DRAFT','CANCELLED')) THEN
    RAISE EXCEPTION 'Trust event does not match the transaction state';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_validate_trust_event_insert
BEFORE INSERT ON public.trust_events
FOR EACH ROW EXECUTE FUNCTION private.tl_validate_trust_event_insert();

-- Keep the Phase 6 persistence implementation private, and expose a wrapper
-- that proves the caller submitted the exact stored prefix plus the expected
-- new event(s) before any state or child record can change.
ALTER FUNCTION public.tl_commit_job(jsonb,integer) SET SCHEMA private;
REVOKE ALL ON FUNCTION private.tl_commit_job(jsonb,integer) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.tl_commit_job(p_record jsonb,p_expected_version integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  r jsonb := public.tl_snake_keys(p_record);
  item jsonb;
  event_position bigint;
  stored_count integer;
  stored_version integer;
  candidate public.trust_events%ROWTYPE;
  persisted public.trust_events%ROWTYPE;
BEGIN
  IF jsonb_typeof(r->'events') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Transaction events must be an array';
  END IF;

  IF p_expected_version IS NOT NULL THEN
    SELECT version INTO stored_version FROM public.jobs WHERE id=(r->'job'->>'id')::uuid;
    IF stored_version IS NULL OR stored_version<>p_expected_version THEN
      RAISE EXCEPTION 'Concurrent change' USING ERRCODE='40001';
    END IF;
  END IF;

  SELECT count(*) INTO stored_count FROM public.trust_events
  WHERE job_id=(r->'job'->>'id')::uuid;

  IF p_expected_version IS NULL THEN
    IF stored_count<>0 OR jsonb_array_length(r->'events')<>2 THEN
      RAISE EXCEPTION 'A new transaction requires its creation and publication events';
    END IF;
  ELSIF jsonb_array_length(r->'events')<>stored_count+1 THEN
    RAISE EXCEPTION 'A transaction change requires the complete history and one new event';
  END IF;

  FOR item,event_position IN
    SELECT value,ordinality FROM jsonb_array_elements(r->'events') WITH ORDINALITY
  LOOP
    candidate := jsonb_populate_record(null::public.trust_events,item);
    IF candidate.job_id<>(r->'job'->>'id')::uuid OR candidate.event_sequence<>event_position THEN
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

CREATE OR REPLACE FUNCTION public.tl_read_job(p_id text,p_public boolean DEFAULT false) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
SELECT jsonb_build_object(
  'job',to_jsonb(j)||jsonb_strip_nulls(jsonb_build_object(
    'client_id',client.user_id,
    'client_name',client.display_name,
    'client_email',client.email,
    'client_phone',client.phone,
    'client_action_token_hash',client.action_token_hash,
    'client_token_expires_at',client.token_expires_at,
    'client_token_used',coalesce(client.token_used,false)
  )),
  'terms',(SELECT (to_jsonb(t)-'updated_at')||jsonb_build_object('price',t.price::text) FROM public.job_terms t WHERE t.job_id=j.id),
  'payments',coalesce((SELECT jsonb_agg(t ORDER BY recorded_at) FROM public.payments t WHERE t.job_id=j.id),'[]'::jsonb),
  'deliveries',coalesce((SELECT jsonb_agg(t ORDER BY submitted_at) FROM public.deliveries t WHERE t.job_id=j.id),'[]'::jsonb),
  'revisions',coalesce((SELECT jsonb_agg(t ORDER BY requested_at) FROM public.revisions t WHERE t.job_id=j.id),'[]'::jsonb),
  'disputes',coalesce((SELECT jsonb_agg(t ORDER BY created_at) FROM public.disputes t WHERE t.job_id=j.id),'[]'::jsonb),
  'reviews',coalesce((SELECT jsonb_agg(t ORDER BY submitted_at) FROM public.reviews t WHERE t.job_id=j.id),'[]'::jsonb),
  'events',coalesce((SELECT jsonb_agg(t ORDER BY event_sequence) FROM public.trust_events t WHERE t.job_id=j.id),'[]'::jsonb)
)
FROM public.jobs j
LEFT JOIN public.job_participants client ON client.job_id=j.id AND client.role='CLIENT_PARTICIPANT'
WHERE CASE WHEN p_public THEN j.public_id=p_id ELSE j.id::text=p_id END;
$$;

REVOKE ALL ON FUNCTION private.tl_validate_trust_event_insert() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.tl_commit_job(jsonb,integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.tl_read_job(text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.tl_commit_job(jsonb,integer),public.tl_read_job(text,boolean) TO service_role;

-- Reassert future-function defaults after creating the Phase 8 routines so
-- later migrations remain opt-in in both exposed and private schemas.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC,anon,authenticated,service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA private
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC,anon,authenticated,service_role;

COMMIT;
