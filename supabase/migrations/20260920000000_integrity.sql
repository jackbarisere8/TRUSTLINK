-- Hardening upgrade: apply after 20260917000000_v0_core.sql.
-- Public links are projected by the application; raw tables and RPCs are server-only.
BEGIN;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 0;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS repeat_use text NOT NULL DEFAULT 'FIRST' CHECK (repeat_use IN ('FIRST','PROMPTED','UNPROMPTED'));
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE public.jobs ALTER COLUMN provider_location DROP DEFAULT;
ALTER TABLE public.provider_profiles ALTER COLUMN service_area DROP DEFAULT;
ALTER TABLE public.provider_profiles ALTER COLUMN verification_status SET DEFAULT 'UNVERIFIED';
ALTER TABLE public.disputes DROP CONSTRAINT IF EXISTS disputes_job_id_key;
CREATE UNIQUE INDEX one_active_dispute ON public.disputes(job_id) WHERE dispute_status IN ('OPEN','UNDER_REVIEW');
ALTER TABLE public.job_terms ADD CONSTRAINT revision_bounds CHECK (revisions_included BETWEEN 0 AND 20 AND revisions_used BETWEEN 0 AND revisions_included) NOT VALID;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_auth_user_fk FOREIGN KEY (user_id) REFERENCES auth.users(id) NOT VALID;
ALTER TABLE public.jobs ADD CONSTRAINT jobs_provider_fk FOREIGN KEY (provider_id) REFERENCES public.profiles(user_id) NOT VALID;
CREATE UNIQUE INDEX profiles_username_lower ON public.profiles(lower(username));
CREATE INDEX jobs_provider_created ON public.jobs(provider_id, created_at DESC);
CREATE INDEX trust_events_job_time ON public.trust_events(job_id, occurred_at);
CREATE INDEX deliveries_job_time ON public.deliveries(job_id, submitted_at);

DO $$
DECLARE item record;
BEGIN
  FOR item IN SELECT tablename, policyname FROM pg_policies WHERE schemaname='public' AND tablename IN ('profiles','provider_profiles','jobs','job_terms','payments','deliveries','revisions','disputes','reviews','trust_events')
  LOOP EXECUTE format('DROP POLICY %I ON public.%I', item.policyname, item.tablename); END LOOP;
END $$;
REVOKE ALL ON public.profiles, public.provider_profiles, public.jobs, public.job_terms, public.payments, public.deliveries, public.revisions, public.disputes, public.reviews, public.trust_events, public.public_job_records FROM anon, authenticated;
-- RLS remains enabled and default-deny. Application reads are shaped after authorization.
GRANT SELECT, INSERT, UPDATE ON public.profiles, public.provider_profiles, public.jobs, public.job_terms, public.payments, public.deliveries, public.revisions, public.disputes, public.reviews, public.trust_events TO service_role;
GRANT SELECT ON public.public_job_records TO service_role;

CREATE OR REPLACE FUNCTION public.tl_new_auth_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.profiles(user_id,username,display_name,country)
  VALUES (NEW.id, 'provider-' || replace(NEW.id::text,'-',''), left(coalesce(nullif(NEW.raw_user_meta_data->>'display_name',''),'Provider'),120), 'Nigeria');
  INSERT INTO public.provider_profiles(user_id,headline,service_area,verification_status)
  VALUES (NEW.id, left(coalesce(nullif(NEW.raw_user_meta_data->>'headline',''),'Independent professional'),160), 'Not provided', 'UNVERIFIED');
  RETURN NEW;
END $$;
CREATE TRIGGER tl_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.tl_new_auth_user();
-- Backfill existing Auth accounts, without associating legacy profiles by unverified email.
INSERT INTO public.profiles(user_id,username,display_name,country)
SELECT id, 'provider-' || replace(id::text,'-',''), left(coalesce(nullif(raw_user_meta_data->>'display_name',''),'Provider'),120), 'Nigeria'
FROM auth.users ON CONFLICT (user_id) DO NOTHING;
INSERT INTO public.provider_profiles(user_id,headline,service_area,verification_status)
SELECT p.user_id,'Independent professional','Not provided','UNVERIFIED' FROM public.profiles p JOIN auth.users u ON u.id=p.user_id ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.tl_update_profile(p_user_id uuid, p_input jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.profiles SET display_name=p_input->>'displayName',country=p_input->>'country',state=p_input->>'state',city=p_input->>'city',updated_at=now() WHERE user_id=p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;
  UPDATE public.provider_profiles SET headline=p_input->>'headline',bio=p_input->>'bio',service_area=p_input->>'serviceArea',updated_at=now() WHERE user_id=p_user_id;
END $$;

CREATE OR REPLACE FUNCTION public.tl_snake_keys(value jsonb) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE result jsonb; k text; v jsonb;
BEGIN
  IF jsonb_typeof(value)='object' THEN
    result := '{}'::jsonb;
    FOR k,v IN SELECT * FROM jsonb_each(value) LOOP
      result := result || jsonb_build_object(lower(regexp_replace(k,'([a-z0-9])([A-Z])','\1_\2','g')),public.tl_snake_keys(v));
    END LOOP;
    RETURN result;
  ELSIF jsonb_typeof(value)='array' THEN
    SELECT coalesce(jsonb_agg(public.tl_snake_keys(e)), '[]'::jsonb) INTO result FROM jsonb_array_elements(value) e;
    RETURN result;
  ELSE RETURN value;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.tl_read_job(p_id text, p_public boolean DEFAULT false) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
SELECT jsonb_build_object(
  'job', to_jsonb(j), 'terms', (SELECT to_jsonb(t) FROM public.job_terms t WHERE t.job_id=j.id),
  'payments', coalesce((SELECT jsonb_agg(t ORDER BY recorded_at) FROM public.payments t WHERE t.job_id=j.id),'[]'::jsonb),
  'deliveries', coalesce((SELECT jsonb_agg(t ORDER BY submitted_at) FROM public.deliveries t WHERE t.job_id=j.id),'[]'::jsonb),
  'revisions', coalesce((SELECT jsonb_agg(t ORDER BY requested_at) FROM public.revisions t WHERE t.job_id=j.id),'[]'::jsonb),
  'disputes', coalesce((SELECT jsonb_agg(t ORDER BY created_at) FROM public.disputes t WHERE t.job_id=j.id),'[]'::jsonb),
  'reviews', coalesce((SELECT jsonb_agg(t ORDER BY submitted_at) FROM public.reviews t WHERE t.job_id=j.id),'[]'::jsonb),
  'events', coalesce((SELECT jsonb_agg(t ORDER BY occurred_at, id) FROM public.trust_events t WHERE t.job_id=j.id),'[]'::jsonb)
) FROM public.jobs j WHERE CASE WHEN p_public THEN j.public_id=p_id ELSE j.id::text=p_id END;
$$;

CREATE OR REPLACE FUNCTION public.tl_commit_job(p_record jsonb, p_expected_version integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r jsonb := public.tl_snake_keys(p_record); j public.jobs; old_version integer; item jsonb;
BEGIN
  j := jsonb_populate_record(null::public.jobs,r->'job');
  IF p_expected_version IS NULL THEN
    IF j.version <> 0 THEN RAISE EXCEPTION 'Invalid initial version'; END IF;
    INSERT INTO public.jobs SELECT j.*;
    INSERT INTO public.job_terms SELECT (jsonb_populate_record(null::public.job_terms,r->'terms')).*;
  ELSE
    SELECT version INTO old_version FROM public.jobs WHERE id=j.id FOR UPDATE;
    IF old_version IS NULL OR old_version <> p_expected_version THEN RAISE EXCEPTION 'Concurrent change' USING ERRCODE='40001'; END IF;
    IF j.version <> old_version+1 THEN RAISE EXCEPTION 'Invalid next version'; END IF;
    UPDATE public.jobs SET status=j.status, version=j.version, client_name=j.client_name,client_email=j.client_email,client_phone=j.client_phone,
      client_token_used=j.client_token_used,client_action_token_hash=j.client_action_token_hash,client_token_expires_at=j.client_token_expires_at,
      completed_at=j.completed_at,updated_at=j.updated_at WHERE id=j.id;
    UPDATE public.job_terms SET revisions_used=(r->'terms'->>'revisions_used')::integer WHERE job_id=j.id;
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
  IF NOT EXISTS (SELECT 1 FROM public.trust_events WHERE job_id=j.id) THEN RAISE EXCEPTION 'A transaction requires events'; END IF;
END $$;

-- Private evidence. Only authorized application routes upload and sign downloads.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('transaction-evidence','transaction-evidence',false,10485760,ARRAY['application/pdf','image/jpeg','image/png','image/webp','text/plain'])
ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=10485760,allowed_mime_types=EXCLUDED.allowed_mime_types;
CREATE TABLE public.evidence_files (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id uuid NOT NULL REFERENCES public.jobs(id),
  storage_path text UNIQUE NOT NULL,
  filename text NOT NULL,
  content_type text NOT NULL,
  size_bytes integer NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),
  uploaded_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.evidence_files ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.evidence_files FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.evidence_files TO service_role;

REVOKE ALL ON FUNCTION public.tl_new_auth_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tl_snake_keys(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tl_update_profile(uuid,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tl_read_job(text,boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tl_commit_job(jsonb,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tl_snake_keys(jsonb), public.tl_update_profile(uuid,jsonb), public.tl_read_job(text,boolean), public.tl_commit_job(jsonb,integer) TO service_role;
COMMIT;

