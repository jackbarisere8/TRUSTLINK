-- Phase 21: protect the prompted/unprompted repeat-use validation signal.
-- Analytics remain a derived read model over canonical jobs and trust events;
-- this migration adds no generic tracking store or page-view writer.
BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT provider_id
    FROM public.jobs
    GROUP BY provider_id
    HAVING count(*) FILTER (WHERE repeat_use='FIRST')<>1
       OR min(created_at) FILTER (WHERE repeat_use='FIRST')<>min(created_at)
  ) THEN
    RAISE EXCEPTION 'Each provider history must identify its earliest transaction as the only first use before Phase 21';
  END IF;
END $$;

CREATE UNIQUE INDEX jobs_one_first_use_per_provider
ON public.jobs(provider_id)
WHERE repeat_use='FIRST';

CREATE FUNCTION private.tl_validate_job_repeat_use() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF TG_OP='UPDATE' THEN
    IF NEW.repeat_use IS DISTINCT FROM OLD.repeat_use THEN
      RAISE EXCEPTION 'Repeat-use classification is immutable';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.repeat_use='FIRST' THEN
    IF EXISTS (SELECT 1 FROM public.jobs WHERE provider_id=NEW.provider_id) THEN
      RAISE EXCEPTION 'A returning provider must classify repeat use as prompted or unprompted';
    END IF;
  ELSIF NOT EXISTS (SELECT 1 FROM public.jobs WHERE provider_id=NEW.provider_id) THEN
    RAISE EXCEPTION 'A provider first transaction must be classified as first use';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER validate_job_repeat_use
BEFORE INSERT OR UPDATE ON public.jobs
FOR EACH ROW EXECUTE FUNCTION private.tl_validate_job_repeat_use();

REVOKE ALL ON FUNCTION private.tl_validate_job_repeat_use() FROM PUBLIC,anon,authenticated,service_role;

COMMENT ON INDEX public.jobs_one_first_use_per_provider IS
  'At most one FIRST classification per provider; later jobs must record prompted or unprompted reuse at creation.';
COMMENT ON FUNCTION private.tl_validate_job_repeat_use() IS
  'Rejects missing, repeated, or changed repeat-use classification without collecting separate analytics telemetry.';

COMMIT;
