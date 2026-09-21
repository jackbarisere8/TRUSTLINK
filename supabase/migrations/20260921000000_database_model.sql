-- Phase 6 canonical relational model.
-- Normalize transaction participants and strengthen the existing tables without
-- introducing duplicate event, evidence, notification, analytics or audit stores.
BEGIN;

-- Existing application validation has always produced these shapes. Fail with a
-- useful message before changing column types if historical rows do not comply.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.job_terms
    WHERE price !~ '^\d+(\.\d{1,2})?$' OR price::numeric <= 0
      OR deadline !~ '^\d{4}-\d{2}-\d{2}$'
  ) THEN
    RAISE EXCEPTION 'Historical job terms require repair before Phase 6';
  END IF;
END $$;

DROP VIEW public.public_job_records;

ALTER TABLE public.provider_profiles
  DROP COLUMN completed_jobs_count,
  DROP COLUMN average_rating,
  DROP COLUMN on_time_rate;

ALTER TABLE public.job_terms
  ALTER COLUMN price TYPE numeric(14,2) USING price::numeric,
  ALTER COLUMN deadline TYPE date USING deadline::date,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now(),
  ADD CONSTRAINT job_terms_positive_price CHECK (price > 0),
  ADD CONSTRAINT job_terms_ngn_currency CHECK (currency = 'NGN'),
  ADD CONSTRAINT job_terms_deliverables_array CHECK (jsonb_typeof(deliverables) = 'array');

ALTER TABLE public.deliveries
  ADD CONSTRAINT deliveries_files_array CHECK (jsonb_typeof(file_urls) = 'array');
ALTER TABLE public.disputes
  ADD CONSTRAINT disputes_evidence_array CHECK (jsonb_typeof(evidence_urls) = 'array');
ALTER TABLE public.revisions
  ADD CONSTRAINT revisions_job_number_unique UNIQUE (job_id, revision_number);
ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_public_id_not_blank CHECK (btrim(public_id) <> ''),
  ADD CONSTRAINT jobs_nonnegative_views CHECK (view_count >= 0);
ALTER TABLE public.trust_events
  ADD CONSTRAINT accepted_participant_detail_status CHECK (
    event_type <> 'JOB_ACCEPTED' OR
    coalesce(metadata->>'participant_detail_status' IN ('SELF_PROVIDED','EMAIL_VERIFIED','OTHER_VERIFIED','UNKNOWN'),false) OR
    coalesce(metadata->>'identity_status' IN ('SELF_PROVIDED','EMAIL_VERIFIED','OTHER_VERIFIED','UNKNOWN'),false)
  ) NOT VALID;

CREATE TABLE public.job_participants (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('PROVIDER','CLIENT_PARTICIPANT')),
  user_id uuid REFERENCES public.profiles(user_id) ON DELETE RESTRICT,
  display_name text,
  email text,
  phone text,
  detail_status text NOT NULL DEFAULT 'UNKNOWN'
    CHECK (detail_status IN ('SELF_PROVIDED','EMAIL_VERIFIED','OTHER_VERIFIED','UNKNOWN')),
  action_token_hash text,
  token_expires_at timestamptz,
  token_used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_participants_role_unique UNIQUE (job_id, role),
  CONSTRAINT job_participants_display_name CHECK (display_name IS NULL OR (btrim(display_name) <> '' AND char_length(display_name) <= 120)),
  CONSTRAINT job_participants_email_length CHECK (email IS NULL OR char_length(email) <= 254),
  CONSTRAINT job_participants_phone_length CHECK (phone IS NULL OR char_length(phone) <= 30),
  CONSTRAINT job_participants_token_hash CHECK (action_token_hash IS NULL OR action_token_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT provider_participant_shape CHECK (
    role <> 'PROVIDER' OR (
      user_id IS NOT NULL AND display_name IS NOT NULL AND detail_status = 'SELF_PROVIDED'
      AND email IS NULL AND phone IS NULL AND action_token_hash IS NULL
      AND token_expires_at IS NULL AND token_used = false
    )
  ),
  CONSTRAINT client_participant_shape CHECK (
    role <> 'CLIENT_PARTICIPANT' OR (
      action_token_hash IS NOT NULL AND token_expires_at IS NOT NULL
      AND (
        (token_used = false AND display_name IS NULL AND email IS NULL AND phone IS NULL AND detail_status = 'UNKNOWN')
        OR (token_used = true AND display_name IS NOT NULL AND email IS NOT NULL)
      )
    )
  )
);

CREATE INDEX job_participants_user_jobs ON public.job_participants(user_id, job_id) WHERE user_id IS NOT NULL;
CREATE INDEX evidence_files_job_created ON public.evidence_files(job_id, created_at);
CREATE INDEX disputes_job_created ON public.disputes(job_id, created_at);

-- Backfill provider snapshots. A job without its required linked provider profile
-- is a historical-integrity error and must be repaired before this migration.
INSERT INTO public.job_participants(job_id,role,user_id,display_name,detail_status,created_at,updated_at)
SELECT j.id,'PROVIDER',p.user_id,p.display_name,'SELF_PROVIDED',j.created_at,j.updated_at
FROM public.jobs j JOIN public.profiles p ON p.user_id=j.provider_id;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE NOT EXISTS (
      SELECT 1 FROM public.job_participants participant
      WHERE participant.job_id=j.id AND participant.role='PROVIDER'
    )
  ) THEN
    RAISE EXCEPTION 'Every historical job must map to an Auth-linked provider profile';
  END IF;
END $$;

INSERT INTO public.job_participants(
  job_id,role,user_id,display_name,email,phone,detail_status,
  action_token_hash,token_expires_at,token_used,created_at,updated_at
)
SELECT
  j.id,
  'CLIENT_PARTICIPANT',
  CASE WHEN EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id=j.client_id) THEN j.client_id ELSE NULL END,
  j.client_name,
  j.client_email,
  j.client_phone,
  CASE
    WHEN j.client_token_used THEN coalesce((
      SELECT CASE
        WHEN e.metadata->>'participant_detail_status' IN ('SELF_PROVIDED','EMAIL_VERIFIED','OTHER_VERIFIED','UNKNOWN') THEN e.metadata->>'participant_detail_status'
        WHEN e.metadata->>'identity_status' IN ('SELF_PROVIDED','EMAIL_VERIFIED','OTHER_VERIFIED','UNKNOWN') THEN e.metadata->>'identity_status'
        ELSE 'UNKNOWN'
      END
      FROM public.trust_events e
      WHERE e.job_id=j.id AND e.event_type='JOB_ACCEPTED'
      ORDER BY e.occurred_at DESC,e.id DESC LIMIT 1
    ),'UNKNOWN')
    ELSE 'UNKNOWN'
  END,
  j.client_action_token_hash,
  j.client_token_expires_at,
  j.client_token_used,
  j.created_at,
  j.updated_at
FROM public.jobs j;

CREATE FUNCTION public.tl_assert_job_participants(p_job_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.jobs WHERE id=p_job_id) AND (
    (SELECT count(*) FROM public.job_participants WHERE job_id=p_job_id) <> 2 OR
    NOT EXISTS (
      SELECT 1 FROM public.job_participants participant
      JOIN public.jobs job ON job.id=participant.job_id
      WHERE participant.job_id=p_job_id AND participant.role='PROVIDER' AND participant.user_id=job.provider_id
    ) OR
    NOT EXISTS (
      SELECT 1 FROM public.job_participants participant
      WHERE participant.job_id=p_job_id AND participant.role='CLIENT_PARTICIPANT'
    )
  ) THEN
    RAISE EXCEPTION 'A job requires one matching provider and one client participant';
  END IF;
END $$;

CREATE FUNCTION public.tl_check_job_participants_from_job() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  PERFORM public.tl_assert_job_participants(NEW.id);
  RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER job_requires_participants
AFTER INSERT OR UPDATE ON public.jobs
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.tl_check_job_participants_from_job();

CREATE FUNCTION public.tl_check_job_participants_from_participant() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  PERFORM public.tl_assert_job_participants(coalesce(NEW.job_id,OLD.job_id));
  RETURN coalesce(NEW,OLD);
END $$;
CREATE CONSTRAINT TRIGGER participant_preserves_job_roles
AFTER INSERT OR UPDATE OR DELETE ON public.job_participants
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.tl_check_job_participants_from_participant();

-- The participant table is now authoritative for guest/account association,
-- contact provenance and client capabilities.
DROP FUNCTION public.tl_read_job(text,boolean);
DROP FUNCTION public.tl_commit_job(jsonb,integer);
ALTER TABLE public.jobs
  DROP COLUMN client_id,
  DROP COLUMN client_name,
  DROP COLUMN client_email,
  DROP COLUMN client_phone,
  DROP COLUMN client_action_token_hash,
  DROP COLUMN client_token_expires_at,
  DROP COLUMN client_token_used;

CREATE VIEW public.public_job_records AS
SELECT
  j.public_id,
  j.status,
  j.source_channel,
  j.provider_location,
  j.created_at,
  j.first_viewed_at,
  jt.service,
  jt.service_category,
  jt.scope,
  jt.deliverables,
  jt.price,
  jt.currency,
  jt.deadline,
  jt.revisions_included,
  jt.revisions_used,
  jt.cancellation_terms,
  p.username AS provider_username,
  p.display_name AS provider_name,
  p.avatar_url AS provider_avatar,
  pp.headline AS provider_role,
  pp.verification_status AS provider_verification_status
FROM public.jobs j
JOIN public.job_terms jt ON j.id=jt.job_id
JOIN public.profiles p ON j.provider_id=p.user_id
LEFT JOIN public.provider_profiles pp ON p.user_id=pp.user_id;

CREATE OR REPLACE FUNCTION public.tl_read_job(p_id text, p_public boolean DEFAULT false) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
SELECT jsonb_build_object(
  'job', to_jsonb(j) || jsonb_strip_nulls(jsonb_build_object(
    'client_id',client.user_id,
    'client_name',client.display_name,
    'client_email',client.email,
    'client_phone',client.phone,
    'client_action_token_hash',client.action_token_hash,
    'client_token_expires_at',client.token_expires_at,
    'client_token_used',coalesce(client.token_used,false)
  )),
  'terms', (SELECT (to_jsonb(t) - 'updated_at') || jsonb_build_object('price',t.price::text) FROM public.job_terms t WHERE t.job_id=j.id),
  'payments', coalesce((SELECT jsonb_agg(t ORDER BY recorded_at) FROM public.payments t WHERE t.job_id=j.id),'[]'::jsonb),
  'deliveries', coalesce((SELECT jsonb_agg(t ORDER BY submitted_at) FROM public.deliveries t WHERE t.job_id=j.id),'[]'::jsonb),
  'revisions', coalesce((SELECT jsonb_agg(t ORDER BY requested_at) FROM public.revisions t WHERE t.job_id=j.id),'[]'::jsonb),
  'disputes', coalesce((SELECT jsonb_agg(t ORDER BY created_at) FROM public.disputes t WHERE t.job_id=j.id),'[]'::jsonb),
  'reviews', coalesce((SELECT jsonb_agg(t ORDER BY submitted_at) FROM public.reviews t WHERE t.job_id=j.id),'[]'::jsonb),
  'events', coalesce((SELECT jsonb_agg(t ORDER BY occurred_at,id) FROM public.trust_events t WHERE t.job_id=j.id),'[]'::jsonb)
)
FROM public.jobs j
LEFT JOIN public.job_participants client ON client.job_id=j.id AND client.role='CLIENT_PARTICIPANT'
WHERE CASE WHEN p_public THEN j.public_id=p_id ELSE j.id::text=p_id END;
$$;

CREATE OR REPLACE FUNCTION public.tl_commit_job(p_record jsonb, p_expected_version integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  r jsonb := public.tl_snake_keys(p_record);
  j public.jobs;
  old_version integer;
  item jsonb;
  previous_events integer;
  client_status text;
BEGIN
  j := jsonb_populate_record(null::public.jobs,r->'job');
  IF r->'terms'->>'job_id' IS DISTINCT FROM j.id::text THEN RAISE EXCEPTION 'Mismatched terms'; END IF;

  SELECT CASE
    WHEN event->'metadata'->>'participant_detail_status' IN ('SELF_PROVIDED','EMAIL_VERIFIED','OTHER_VERIFIED','UNKNOWN') THEN event->'metadata'->>'participant_detail_status'
    WHEN event->'metadata'->>'identity_status' IN ('SELF_PROVIDED','EMAIL_VERIFIED','OTHER_VERIFIED','UNKNOWN') THEN event->'metadata'->>'identity_status'
    ELSE NULL
  END INTO client_status
  FROM jsonb_array_elements(r->'events') event
  WHERE event->>'event_type'='JOB_ACCEPTED'
  ORDER BY event->>'occurred_at' DESC LIMIT 1;
  client_status := coalesce(client_status,'UNKNOWN');

  IF p_expected_version IS NULL THEN
    previous_events := 0;
    IF j.version <> 0 THEN RAISE EXCEPTION 'Invalid initial version'; END IF;
    INSERT INTO public.jobs SELECT j.*;
    INSERT INTO public.job_terms SELECT (jsonb_populate_record(null::public.job_terms,r->'terms' || jsonb_build_object('updated_at',j.updated_at))).*;
  ELSE
    SELECT version INTO old_version FROM public.jobs WHERE id=j.id FOR UPDATE;
    IF old_version IS NULL OR old_version <> p_expected_version THEN RAISE EXCEPTION 'Concurrent change' USING ERRCODE='40001'; END IF;
    SELECT count(*) INTO previous_events FROM public.trust_events WHERE job_id=j.id;
    IF j.version <> old_version+1 THEN RAISE EXCEPTION 'Invalid next version'; END IF;
    UPDATE public.jobs SET status=j.status,version=j.version,completed_at=j.completed_at,updated_at=j.updated_at WHERE id=j.id;
    UPDATE public.job_terms SET revisions_used=(r->'terms'->>'revisions_used')::integer,updated_at=j.updated_at WHERE job_id=j.id;
  END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(r->'payments') LOOP
    IF item->>'job_id' <> j.id::text THEN RAISE EXCEPTION 'Mismatched job'; END IF;
    INSERT INTO public.payments SELECT (jsonb_populate_record(null::public.payments,item)).* ON CONFLICT (id) DO NOTHING;
  END LOOP;
  FOR item IN SELECT * FROM jsonb_array_elements(r->'deliveries') LOOP
    IF item->>'job_id' <> j.id::text THEN RAISE EXCEPTION 'Mismatched job'; END IF;
    INSERT INTO public.deliveries SELECT (jsonb_populate_record(null::public.deliveries,item)).* ON CONFLICT (id) DO NOTHING;
  END LOOP;
  FOR item IN SELECT * FROM jsonb_array_elements(r->'revisions') LOOP
    IF item->>'job_id' <> j.id::text THEN RAISE EXCEPTION 'Mismatched job'; END IF;
    INSERT INTO public.revisions SELECT (jsonb_populate_record(null::public.revisions,item)).* ON CONFLICT (id) DO NOTHING;
  END LOOP;
  FOR item IN SELECT * FROM jsonb_array_elements(r->'reviews') LOOP
    IF item->>'job_id' <> j.id::text THEN RAISE EXCEPTION 'Mismatched job'; END IF;
    INSERT INTO public.reviews SELECT (jsonb_populate_record(null::public.reviews,item)).* ON CONFLICT (id) DO NOTHING;
  END LOOP;
  FOR item IN SELECT * FROM jsonb_array_elements(r->'events') LOOP
    IF item->>'job_id' <> j.id::text THEN RAISE EXCEPTION 'Mismatched job'; END IF;
    INSERT INTO public.trust_events SELECT (jsonb_populate_record(null::public.trust_events,item)).* ON CONFLICT (id) DO NOTHING;
  END LOOP;
  FOR item IN SELECT * FROM jsonb_array_elements(r->'disputes') LOOP
    IF item->>'job_id' <> j.id::text THEN RAISE EXCEPTION 'Mismatched job'; END IF;
    INSERT INTO public.disputes SELECT (jsonb_populate_record(null::public.disputes,item)).*
    ON CONFLICT (id) DO UPDATE SET dispute_status=EXCLUDED.dispute_status,resolution_notes=EXCLUDED.resolution_notes,resolved_by=EXCLUDED.resolved_by,resolved_at=EXCLUDED.resolved_at,updated_at=EXCLUDED.updated_at;
  END LOOP;

  INSERT INTO public.job_participants(job_id,role,user_id,display_name,detail_status,created_at,updated_at)
  SELECT j.id,'PROVIDER',p.user_id,p.display_name,'SELF_PROVIDED',j.created_at,j.updated_at
  FROM public.profiles p WHERE p.user_id=j.provider_id
  ON CONFLICT (job_id,role) DO NOTHING;
  IF NOT FOUND AND NOT EXISTS (SELECT 1 FROM public.job_participants WHERE job_id=j.id AND role='PROVIDER') THEN
    RAISE EXCEPTION 'Provider profile not found';
  END IF;

  INSERT INTO public.job_participants(
    job_id,role,user_id,display_name,email,phone,detail_status,
    action_token_hash,token_expires_at,token_used,created_at,updated_at
  ) VALUES (
    j.id,
    'CLIENT_PARTICIPANT',
    nullif(r->'job'->>'client_id','')::uuid,
    nullif(r->'job'->>'client_name',''),
    nullif(r->'job'->>'client_email',''),
    nullif(r->'job'->>'client_phone',''),
    client_status,
    nullif(r->'job'->>'client_action_token_hash',''),
    nullif(r->'job'->>'client_token_expires_at','')::timestamptz,
    coalesce((r->'job'->>'client_token_used')::boolean,false),
    j.created_at,
    j.updated_at
  )
  ON CONFLICT (job_id,role) DO UPDATE SET
    user_id=EXCLUDED.user_id,
    display_name=EXCLUDED.display_name,
    email=EXCLUDED.email,
    phone=EXCLUDED.phone,
    detail_status=EXCLUDED.detail_status,
    action_token_hash=EXCLUDED.action_token_hash,
    token_expires_at=EXCLUDED.token_expires_at,
    token_used=EXCLUDED.token_used,
    updated_at=EXCLUDED.updated_at;

  IF (SELECT count(*) FROM public.trust_events WHERE job_id=j.id) <= previous_events THEN RAISE EXCEPTION 'A change requires a new event'; END IF;
END $$;

ALTER TABLE public.job_participants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.job_participants FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.public_job_records FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.job_participants TO service_role;
GRANT SELECT ON public.public_job_records TO service_role;
REVOKE ALL ON FUNCTION public.tl_assert_job_participants(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.tl_check_job_participants_from_job() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.tl_check_job_participants_from_participant() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.tl_read_job(text,boolean) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.tl_commit_job(jsonb,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.tl_read_job(text,boolean),public.tl_commit_job(jsonb,integer) TO service_role;

COMMENT ON TABLE public.job_participants IS 'Canonical provider/client participation, guest capability and participant-detail provenance for each transaction.';
COMMENT ON COLUMN public.job_participants.detail_status IS 'Provenance of participant details; SELF_PROVIDED is not verified identity.';

COMMIT;
