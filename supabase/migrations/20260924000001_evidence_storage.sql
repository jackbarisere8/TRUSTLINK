-- Phase 16 private evidence storage integrity.
-- Public profile assets never use this bucket or metadata table. Delivery and
-- dispute objects remain private and become immutable once attached.
BEGIN;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('transaction-evidence','transaction-evidence',false,10485760,ARRAY['application/pdf','image/jpeg','image/png','image/webp','text/plain'])
ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=10485760,allowed_mime_types=EXCLUDED.allowed_mime_types;

ALTER TABLE public.evidence_files
  ADD COLUMN purpose text,
  ADD COLUMN attachment_status text NOT NULL DEFAULT 'PENDING';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.evidence_files file
    WHERE EXISTS (SELECT 1 FROM public.deliveries delivery WHERE delivery.job_id=file.job_id AND delivery.file_urls ? file.storage_path)
      AND EXISTS (SELECT 1 FROM public.disputes dispute WHERE dispute.job_id=file.job_id AND dispute.evidence_urls ? file.storage_path)
  ) THEN
    RAISE EXCEPTION 'Historical evidence cannot be both delivery and dispute evidence';
  END IF;
END $$;

UPDATE public.evidence_files file SET
  purpose=CASE
    WHEN EXISTS (SELECT 1 FROM public.deliveries delivery WHERE delivery.job_id=file.job_id AND delivery.file_urls ? file.storage_path) THEN 'DELIVERY'
    WHEN EXISTS (SELECT 1 FROM public.disputes dispute WHERE dispute.job_id=file.job_id AND dispute.evidence_urls ? file.storage_path) THEN 'DISPUTE'
    ELSE 'UNASSIGNED'
  END,
  attachment_status=CASE
    WHEN EXISTS (SELECT 1 FROM public.deliveries delivery WHERE delivery.job_id=file.job_id AND delivery.file_urls ? file.storage_path)
      OR EXISTS (SELECT 1 FROM public.disputes dispute WHERE dispute.job_id=file.job_id AND dispute.evidence_urls ? file.storage_path)
    THEN 'ATTACHED' ELSE 'PENDING' END;

ALTER TABLE public.evidence_files
  ALTER COLUMN purpose SET NOT NULL,
  ADD CONSTRAINT evidence_files_purpose CHECK (purpose IN ('DELIVERY','DISPUTE','UNASSIGNED')) NOT VALID,
  ADD CONSTRAINT evidence_files_attachment_status CHECK (attachment_status IN ('PENDING','ATTACHED')) NOT VALID,
  ADD CONSTRAINT evidence_files_unassigned_pending CHECK (purpose<>'UNASSIGNED' OR attachment_status='PENDING') NOT VALID,
  ADD CONSTRAINT evidence_files_content_type CHECK (content_type IN ('application/pdf','image/jpeg','image/png','image/webp','text/plain')) NOT VALID,
  ADD CONSTRAINT evidence_files_safe_filename CHECK (
    btrim(filename)<>'' AND char_length(filename)<=200 AND filename !~ E'[[:cntrl:]/\\\\:*?"<>|]'
  ) NOT VALID,
  ADD CONSTRAINT evidence_files_safe_storage_path CHECK (
    storage_path ~ ('^'||job_id::text||'/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
  ) NOT VALID;

CREATE FUNCTION private.tl_validate_phase16_evidence(p_record jsonb,p_expected_version integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  r jsonb := public.tl_snake_keys(p_record);
  submitted_job public.jobs%ROWTYPE;
  stored_version integer;
  stored_event_count integer;
  new_event jsonb;
  evidence_item jsonb;
  evidence_path text;
  expected_purpose text;
  affected integer;
BEGIN
  IF p_expected_version IS NULL THEN RETURN; END IF;
  submitted_job := jsonb_populate_record(null::public.jobs,r->'job');
  SELECT version INTO stored_version FROM public.jobs WHERE id=submitted_job.id FOR UPDATE;
  IF NOT FOUND OR stored_version<>p_expected_version THEN
    RAISE EXCEPTION 'Concurrent change' USING ERRCODE='40001';
  END IF;
  SELECT count(*) INTO stored_event_count FROM public.trust_events WHERE job_id=submitted_job.id;
  IF jsonb_typeof(r->'events') IS DISTINCT FROM 'array' OR jsonb_array_length(r->'events')<>stored_event_count+1 THEN
    RAISE EXCEPTION 'Evidence attachment requires one new transaction event';
  END IF;
  new_event := r->'events'->stored_event_count;
  IF new_event->>'event_type'='DELIVERY_SUBMITTED' THEN
    IF jsonb_typeof(r->'deliveries') IS DISTINCT FROM 'array' OR jsonb_array_length(r->'deliveries')=0 THEN
      RAISE EXCEPTION 'Delivery evidence requires one submitted delivery';
    END IF;
    evidence_item := r->'deliveries'->(jsonb_array_length(r->'deliveries')-1);
    expected_purpose := 'DELIVERY';
  ELSIF new_event->>'event_type'='DISPUTE_OPENED' THEN
    IF jsonb_typeof(r->'disputes') IS DISTINCT FROM 'array' OR jsonb_array_length(r->'disputes')=0 THEN
      RAISE EXCEPTION 'Dispute evidence requires one submitted dispute';
    END IF;
    evidence_item := r->'disputes'->(jsonb_array_length(r->'disputes')-1);
    expected_purpose := 'DISPUTE';
  ELSE
    RETURN;
  END IF;
  IF jsonb_typeof(CASE WHEN expected_purpose='DELIVERY' THEN evidence_item->'file_urls' ELSE evidence_item->'evidence_urls' END) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Evidence paths must be an array';
  END IF;
  FOR evidence_path IN
    SELECT value FROM jsonb_array_elements_text(CASE WHEN expected_purpose='DELIVERY' THEN evidence_item->'file_urls' ELSE evidence_item->'evidence_urls' END)
  LOOP
    UPDATE public.evidence_files file SET attachment_status='ATTACHED'
    WHERE file.job_id=submitted_job.id AND file.storage_path=evidence_path
      AND file.uploaded_by=new_event->>'actor_id' AND file.purpose=expected_purpose
      AND file.attachment_status='PENDING';
    GET DIAGNOSTICS affected=ROW_COUNT;
    IF affected<>1 THEN
      RAISE EXCEPTION 'Evidence must be pending, purpose-bound and owned by the submitting participant';
    END IF;
  END LOOP;
END $$;

CREATE FUNCTION private.tl_protect_evidence_metadata() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.purpose='UNASSIGNED' OR NEW.attachment_status<>'PENDING' THEN
      RAISE EXCEPTION 'New evidence requires an explicit purpose and must be pending';
    END IF;
    IF EXISTS (SELECT 1 FROM public.deliveries delivery WHERE delivery.job_id=NEW.job_id AND delivery.file_urls ? NEW.storage_path) OR
       EXISTS (SELECT 1 FROM public.disputes dispute WHERE dispute.job_id=NEW.job_id AND dispute.evidence_urls ? NEW.storage_path) THEN
      RAISE EXCEPTION 'Pending evidence cannot already be submitted';
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP='UPDATE' AND OLD.attachment_status='PENDING' AND NEW.attachment_status='ATTACHED' AND
     NEW.id=OLD.id AND NEW.job_id=OLD.job_id AND NEW.storage_path=OLD.storage_path AND
     NEW.filename=OLD.filename AND NEW.content_type=OLD.content_type AND NEW.size_bytes=OLD.size_bytes AND
     NEW.uploaded_by=OLD.uploaded_by AND NEW.created_at=OLD.created_at AND NEW.purpose=OLD.purpose THEN
    RETURN NEW;
  END IF;
  IF TG_OP='DELETE' AND OLD.attachment_status='PENDING' AND
     NOT EXISTS (SELECT 1 FROM public.deliveries delivery WHERE delivery.job_id=OLD.job_id AND delivery.file_urls ? OLD.storage_path) AND
     NOT EXISTS (SELECT 1 FROM public.disputes dispute WHERE dispute.job_id=OLD.job_id AND dispute.evidence_urls ? OLD.storage_path) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Submitted evidence metadata is immutable';
END $$;

CREATE FUNCTION private.tl_assert_evidence_attachment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NEW.attachment_status='ATTACHED' AND NEW.purpose='DELIVERY' AND NOT EXISTS (
    SELECT 1 FROM public.deliveries delivery
    WHERE delivery.job_id=NEW.job_id AND delivery.submitted_by::text=NEW.uploaded_by AND delivery.file_urls ? NEW.storage_path
  ) THEN RAISE EXCEPTION 'Attached delivery evidence requires its submitted delivery';
  ELSIF NEW.attachment_status='ATTACHED' AND NEW.purpose='DISPUTE' AND NOT EXISTS (
    SELECT 1 FROM public.disputes dispute JOIN public.jobs job ON job.id=dispute.job_id
    WHERE dispute.job_id=NEW.job_id AND dispute.evidence_urls ? NEW.storage_path
      AND NEW.uploaded_by=CASE WHEN dispute.raised_by='PROVIDER' THEN job.provider_id::text ELSE 'client:'||dispute.job_id::text END
  ) THEN RAISE EXCEPTION 'Attached dispute evidence requires its submitted dispute';
  ELSIF NEW.attachment_status='ATTACHED' AND NEW.purpose='UNASSIGNED' THEN
    RAISE EXCEPTION 'Unassigned legacy evidence cannot be attached';
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION private.tl_assert_child_evidence() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE evidence_path text; expected_uploader text;
BEGIN
  IF TG_TABLE_NAME='deliveries' THEN
    expected_uploader := NEW.submitted_by::text;
    FOR evidence_path IN SELECT value FROM jsonb_array_elements_text(NEW.file_urls) LOOP
      IF NOT EXISTS (SELECT 1 FROM public.evidence_files file WHERE file.job_id=NEW.job_id AND file.storage_path=evidence_path AND file.purpose='DELIVERY' AND file.attachment_status='ATTACHED' AND file.uploaded_by=expected_uploader) THEN
        RAISE EXCEPTION 'Delivery attachment requires matching private evidence metadata';
      END IF;
    END LOOP;
  ELSE
    SELECT CASE WHEN NEW.raised_by='PROVIDER' THEN job.provider_id::text ELSE 'client:'||NEW.job_id::text END
    INTO expected_uploader FROM public.jobs job WHERE job.id=NEW.job_id;
    FOR evidence_path IN SELECT value FROM jsonb_array_elements_text(NEW.evidence_urls) LOOP
      IF NOT EXISTS (SELECT 1 FROM public.evidence_files file WHERE file.job_id=NEW.job_id AND file.storage_path=evidence_path AND file.purpose='DISPUTE' AND file.attachment_status='ATTACHED' AND file.uploaded_by=expected_uploader) THEN
        RAISE EXCEPTION 'Dispute attachment requires matching private evidence metadata';
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_protect_evidence_metadata BEFORE INSERT OR UPDATE OR DELETE ON public.evidence_files
FOR EACH ROW EXECUTE FUNCTION private.tl_protect_evidence_metadata();
CREATE TRIGGER trg_no_truncate_evidence_files BEFORE TRUNCATE ON public.evidence_files
FOR EACH STATEMENT EXECUTE FUNCTION private.tl_protect_evidence_metadata();
CREATE CONSTRAINT TRIGGER evidence_attachment_requires_record AFTER INSERT OR UPDATE ON public.evidence_files
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION private.tl_assert_evidence_attachment();
CREATE CONSTRAINT TRIGGER delivery_requires_private_evidence AFTER INSERT ON public.deliveries
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION private.tl_assert_child_evidence();
CREATE CONSTRAINT TRIGGER dispute_requires_private_evidence AFTER INSERT ON public.disputes
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION private.tl_assert_child_evidence();

ALTER FUNCTION public.tl_commit_job(jsonb,integer) RENAME TO tl_phase15_commit_job;
ALTER FUNCTION public.tl_phase15_commit_job(jsonb,integer) SET SCHEMA private;

CREATE FUNCTION public.tl_commit_job(p_record jsonb,p_expected_version integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  PERFORM private.tl_validate_phase16_evidence(p_record,p_expected_version);
  PERFORM private.tl_phase15_commit_job(p_record,p_expected_version);
END $$;

REVOKE ALL ON FUNCTION
  private.tl_validate_phase16_evidence(jsonb,integer),
  private.tl_protect_evidence_metadata(),
  private.tl_assert_evidence_attachment(),
  private.tl_assert_child_evidence(),
  private.tl_phase15_commit_job(jsonb,integer)
FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.tl_commit_job(jsonb,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.tl_commit_job(jsonb,integer) TO service_role;

COMMENT ON COLUMN public.evidence_files.purpose IS
  'Private evidence purpose. UNASSIGNED is a quarantined legacy value and cannot be attached.';
COMMENT ON COLUMN public.evidence_files.attachment_status IS
  'PENDING uploads remain uploader-removable; ATTACHED evidence is immutable.';
COMMENT ON FUNCTION private.tl_validate_phase16_evidence(jsonb,integer) IS
  'Purpose-checks and locks private evidence while its delivery or dispute transition commits.';

COMMIT;
