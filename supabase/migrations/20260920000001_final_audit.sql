-- Final audit hardening; no new product scope.
BEGIN;
REVOKE UPDATE, DELETE, TRUNCATE ON public.trust_events FROM service_role;
CREATE TRIGGER trg_immutable_trust_events_truncate
BEFORE TRUNCATE ON public.trust_events FOR EACH STATEMENT EXECUTE FUNCTION public.prevent_trust_event_mutation();
CREATE UNIQUE INDEX trust_events_request_once ON public.trust_events(job_id, (metadata->>'request_id')) WHERE metadata ? 'request_id';
ALTER TABLE public.trust_events ADD CONSTRAINT supported_trust_event
CHECK (event_type IN ('JOB_CREATED','JOB_SENT','JOB_VIEWED','JOB_ACCEPTED','PAYMENT_RECORDED','WORK_STARTED','DELIVERY_SUBMITTED','REVISION_REQUESTED','DELIVERY_APPROVED','DISPUTE_OPENED','DISPUTE_RESOLVED','JOB_COMPLETED','JOB_CANCELLED','CLIENT_REVIEWED','CLIENT_LINK_REISSUED')) NOT VALID;

-- Restrictive policies combine with any existing permissive Storage policies.
-- They prevent an unrelated broad policy from publishing transaction evidence.
CREATE POLICY transaction_evidence_private ON storage.objects AS RESTRICTIVE
FOR ALL TO anon, authenticated
USING (bucket_id <> 'transaction-evidence')
WITH CHECK (bucket_id <> 'transaction-evidence');

CREATE OR REPLACE FUNCTION public.tl_commit_job(p_record jsonb, p_expected_version integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r jsonb := public.tl_snake_keys(p_record); j public.jobs; old_version integer; item jsonb; previous_events integer;
BEGIN
  j := jsonb_populate_record(null::public.jobs,r->'job');
  IF r->'terms'->>'job_id' IS DISTINCT FROM j.id::text THEN RAISE EXCEPTION 'Mismatched terms'; END IF;
  IF p_expected_version IS NULL THEN
    previous_events := 0;
    IF j.version <> 0 THEN RAISE EXCEPTION 'Invalid initial version'; END IF;
    INSERT INTO public.jobs SELECT j.*;
    INSERT INTO public.job_terms SELECT (jsonb_populate_record(null::public.job_terms,r->'terms')).*;
  ELSE
    SELECT version INTO old_version FROM public.jobs WHERE id=j.id FOR UPDATE;
    IF old_version IS NULL OR old_version <> p_expected_version THEN RAISE EXCEPTION 'Concurrent change' USING ERRCODE='40001'; END IF;
    SELECT count(*) INTO previous_events FROM public.trust_events WHERE job_id=j.id;
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
  IF (SELECT count(*) FROM public.trust_events WHERE job_id=j.id) <= previous_events THEN RAISE EXCEPTION 'A change requires a new event'; END IF;
END $$;


REVOKE ALL ON FUNCTION public.tl_commit_job(jsonb,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tl_commit_job(jsonb,integer) TO service_role;
COMMIT;
