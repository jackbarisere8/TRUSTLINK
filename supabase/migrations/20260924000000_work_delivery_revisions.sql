-- Phase 15 work, delivery, revision, approval and dispute integrity.
-- Lifecycle evidence remains private and can be appended only with its exact
-- authorized transition inside the atomic aggregate commit.
BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.jobs job
    JOIN public.job_terms terms ON terms.job_id=job.id
    WHERE terms.revisions_used<>(SELECT count(*) FROM public.revisions revision WHERE revision.job_id=job.id)
       OR terms.revisions_used>terms.revisions_included
  ) THEN
    RAISE EXCEPTION 'Historical revision usage does not match revision evidence';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.deliveries delivery
    WHERE NOT EXISTS (
      SELECT 1 FROM public.trust_events event
      WHERE event.job_id=delivery.job_id AND event.event_type='DELIVERY_SUBMITTED'
        AND event.actor_type='PROVIDER' AND event.actor_id=delivery.submitted_by::text
        AND event.occurred_at=delivery.submitted_at
    )
  ) OR EXISTS (
    SELECT 1 FROM public.trust_events event
    WHERE event.event_type='DELIVERY_SUBMITTED' AND NOT EXISTS (
      SELECT 1 FROM public.deliveries delivery
      WHERE delivery.job_id=event.job_id AND delivery.submitted_at=event.occurred_at
        AND delivery.submitted_by::text=event.actor_id
    )
  ) OR EXISTS (
    SELECT 1 FROM public.jobs job
    WHERE (SELECT count(*) FROM public.deliveries delivery WHERE delivery.job_id=job.id)<>
          (SELECT count(*) FROM public.trust_events event WHERE event.job_id=job.id AND event.event_type='DELIVERY_SUBMITTED')
  ) THEN
    RAISE EXCEPTION 'Historical deliveries and delivery events do not agree';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.revisions revision
    WHERE NOT EXISTS (
      SELECT 1 FROM public.trust_events event
      WHERE event.job_id=revision.job_id AND event.event_type='REVISION_REQUESTED'
        AND event.actor_type='CLIENT_PARTICIPANT' AND event.actor_id=revision.requested_by
        AND event.occurred_at=revision.requested_at
        AND (event.metadata->>'revision_number')::integer=revision.revision_number
    )
  ) OR EXISTS (
    SELECT 1 FROM public.trust_events event
    WHERE event.event_type='REVISION_REQUESTED' AND NOT EXISTS (
      SELECT 1 FROM public.revisions revision
      WHERE revision.job_id=event.job_id AND revision.requested_at=event.occurred_at
        AND revision.requested_by=event.actor_id
    )
  ) OR EXISTS (
    SELECT 1 FROM public.jobs job
    WHERE (SELECT count(*) FROM public.revisions revision WHERE revision.job_id=job.id)<>
          (SELECT count(*) FROM public.trust_events event WHERE event.job_id=job.id AND event.event_type='REVISION_REQUESTED')
  ) THEN
    RAISE EXCEPTION 'Historical revisions and revision events do not agree';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.disputes dispute
    WHERE NOT EXISTS (
      SELECT 1 FROM public.trust_events event
      WHERE event.job_id=dispute.job_id AND event.event_type='DISPUTE_OPENED'
        AND event.occurred_at=dispute.created_at
        AND event.actor_id=CASE WHEN dispute.raised_by='PROVIDER'
          THEN (SELECT provider_id::text FROM public.jobs WHERE id=dispute.job_id)
          ELSE 'client:'||dispute.job_id::text END
    )
  ) OR EXISTS (
    SELECT 1 FROM public.trust_events event
    WHERE event.event_type='DISPUTE_OPENED' AND NOT EXISTS (
      SELECT 1 FROM public.disputes dispute
      WHERE dispute.job_id=event.job_id AND dispute.created_at=event.occurred_at
    )
  ) OR EXISTS (
    SELECT 1 FROM public.jobs job
    WHERE (SELECT count(*) FROM public.disputes dispute WHERE dispute.job_id=job.id)<>
          (SELECT count(*) FROM public.trust_events event WHERE event.job_id=job.id AND event.event_type='DISPUTE_OPENED')
  ) THEN
    RAISE EXCEPTION 'Historical disputes and dispute events do not agree';
  END IF;
END $$;

ALTER TABLE public.deliveries
  ADD CONSTRAINT deliveries_description_bounds CHECK (btrim(description)<>'' AND char_length(description)<=5000) NOT VALID,
  ADD CONSTRAINT deliveries_file_limit CHECK (jsonb_array_length(file_urls)<=10) NOT VALID;
ALTER TABLE public.revisions
  ADD CONSTRAINT revisions_positive_number CHECK (revision_number>0) NOT VALID,
  ADD CONSTRAINT revisions_description_bounds CHECK (btrim(description)<>'' AND char_length(description)<=5000) NOT VALID;
ALTER TABLE public.disputes
  ADD CONSTRAINT disputes_description_bounds CHECK (btrim(claim_description)<>'' AND char_length(claim_description)<=5000) NOT VALID,
  ADD CONSTRAINT disputes_evidence_limit CHECK (jsonb_array_length(evidence_urls)<=10) NOT VALID;
ALTER TABLE public.trust_events
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
    ))
  ) NOT VALID;

CREATE FUNCTION private.tl_validate_phase15_commit(p_record jsonb,p_expected_version integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  r jsonb := public.tl_snake_keys(p_record);
  submitted_job public.jobs%ROWTYPE;
  stored_job public.jobs%ROWTYPE;
  stored_terms public.job_terms%ROWTYPE;
  new_event jsonb;
  evidence_item jsonb;
  stored_event_count integer;
  stored_delivery_count integer;
  stored_revision_count integer;
  stored_dispute_count integer;
  submitted_delivery_count integer;
  submitted_revision_count integer;
  submitted_dispute_count integer;
  submitted_revisions_used integer;
  path_count integer;
  distinct_path_count integer;
  latest_delivery_id uuid;
BEGIN
  IF p_expected_version IS NULL THEN RETURN; END IF;
  IF jsonb_typeof(r->'events') IS DISTINCT FROM 'array' OR jsonb_typeof(r->'deliveries') IS DISTINCT FROM 'array' OR
     jsonb_typeof(r->'revisions') IS DISTINCT FROM 'array' OR jsonb_typeof(r->'disputes') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Phase 15 lifecycle collections must be arrays';
  END IF;

  submitted_job := jsonb_populate_record(null::public.jobs,r->'job');
  SELECT * INTO stored_job FROM public.jobs WHERE id=submitted_job.id FOR UPDATE;
  IF NOT FOUND OR stored_job.version<>p_expected_version THEN
    RAISE EXCEPTION 'Concurrent change' USING ERRCODE='40001';
  END IF;
  SELECT * INTO stored_terms FROM public.job_terms WHERE job_id=submitted_job.id;
  SELECT count(*) INTO stored_event_count FROM public.trust_events WHERE job_id=submitted_job.id;
  IF jsonb_array_length(r->'events')<>stored_event_count+1 THEN
    RAISE EXCEPTION 'A transaction change requires the complete history and one new event';
  END IF;
  new_event := r->'events'->stored_event_count;

  SELECT count(*) INTO stored_delivery_count FROM public.deliveries WHERE job_id=submitted_job.id;
  SELECT count(*) INTO stored_revision_count FROM public.revisions WHERE job_id=submitted_job.id;
  SELECT count(*) INTO stored_dispute_count FROM public.disputes WHERE job_id=submitted_job.id;
  submitted_delivery_count := jsonb_array_length(r->'deliveries');
  submitted_revision_count := jsonb_array_length(r->'revisions');
  submitted_dispute_count := jsonb_array_length(r->'disputes');
  submitted_revisions_used := (r->'terms'->>'revisions_used')::integer;

  IF new_event->>'event_type'='WORK_STARTED' THEN
    IF stored_job.status NOT IN ('PAYMENT_RECORDED','REVISION_REQUESTED') OR submitted_job.status<>'IN_PROGRESS' OR
       new_event->>'actor_type'<>'PROVIDER' OR new_event->>'actor_id' IS DISTINCT FROM stored_job.provider_id::text OR
       submitted_delivery_count<>stored_delivery_count OR submitted_revision_count<>stored_revision_count OR submitted_dispute_count<>stored_dispute_count THEN
      RAISE EXCEPTION 'Work start requires the provider and canonical predecessor state';
    END IF;
  ELSIF new_event->>'event_type'='DELIVERY_SUBMITTED' THEN
    IF stored_job.status<>'IN_PROGRESS' OR submitted_job.status<>'DELIVERY_SUBMITTED' OR
       new_event->>'actor_type'<>'PROVIDER' OR new_event->>'actor_id' IS DISTINCT FROM stored_job.provider_id::text OR
       submitted_delivery_count<>stored_delivery_count+1 OR submitted_revision_count<>stored_revision_count OR submitted_dispute_count<>stored_dispute_count THEN
      RAISE EXCEPTION 'Delivery submission requires one provider delivery from IN_PROGRESS';
    END IF;
    evidence_item := r->'deliveries'->(submitted_delivery_count-1);
    IF jsonb_typeof(evidence_item->'file_urls') IS DISTINCT FROM 'array' OR
       evidence_item->>'id' IS DISTINCT FROM new_event->'metadata'->>'delivery_id' OR
       evidence_item->>'job_id' IS DISTINCT FROM submitted_job.id::text OR
       evidence_item->>'submitted_by' IS DISTINCT FROM new_event->>'actor_id' OR
       (evidence_item->>'submitted_at')::timestamptz<>(new_event->>'occurred_at')::timestamptz OR
       jsonb_array_length(evidence_item->'file_urls')<>(new_event->'metadata'->>'file_count')::integer THEN
      RAISE EXCEPTION 'Delivery evidence must match its DELIVERY_SUBMITTED event';
    END IF;
    SELECT count(*),count(DISTINCT value) INTO path_count,distinct_path_count FROM jsonb_array_elements_text(evidence_item->'file_urls');
    IF path_count<>distinct_path_count OR path_count>10 OR EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(evidence_item->'file_urls') path
      WHERE NOT EXISTS (
        SELECT 1 FROM public.evidence_files file
        WHERE file.job_id=submitted_job.id AND file.storage_path=path.value AND file.uploaded_by=new_event->>'actor_id'
      )
    ) THEN RAISE EXCEPTION 'Delivery attachments must be unique authorized provider evidence'; END IF;
  ELSIF new_event->>'event_type'='REVISION_REQUESTED' THEN
    IF stored_job.status<>'DELIVERY_SUBMITTED' OR submitted_job.status<>'REVISION_REQUESTED' OR
       new_event->>'actor_type'<>'CLIENT_PARTICIPANT' OR new_event->>'actor_id' IS DISTINCT FROM 'client:'||submitted_job.id::text OR
       submitted_delivery_count<>stored_delivery_count OR submitted_revision_count<>stored_revision_count+1 OR submitted_dispute_count<>stored_dispute_count OR
       submitted_revisions_used<>stored_terms.revisions_used+1 OR submitted_revisions_used>stored_terms.revisions_included THEN
      RAISE EXCEPTION 'Revision request exceeds the included limit or lacks its client transition';
    END IF;
    evidence_item := r->'revisions'->(submitted_revision_count-1);
    IF evidence_item->>'id' IS DISTINCT FROM new_event->'metadata'->>'revision_id' OR
       evidence_item->>'job_id' IS DISTINCT FROM submitted_job.id::text OR
       evidence_item->>'requested_by' IS DISTINCT FROM new_event->>'actor_id' OR
       (evidence_item->>'requested_at')::timestamptz<>(new_event->>'occurred_at')::timestamptz OR
       (evidence_item->>'revision_number')::integer<>submitted_revisions_used OR
       (new_event->'metadata'->>'revision_number')::integer<>submitted_revisions_used THEN
      RAISE EXCEPTION 'Revision evidence must match its REVISION_REQUESTED event';
    END IF;
  ELSIF new_event->>'event_type'='DELIVERY_APPROVED' THEN
    SELECT id INTO latest_delivery_id FROM public.deliveries WHERE job_id=submitted_job.id ORDER BY submitted_at DESC,id DESC LIMIT 1;
    IF stored_job.status<>'DELIVERY_SUBMITTED' OR submitted_job.status<>'APPROVED' OR latest_delivery_id IS NULL OR
       new_event->>'actor_type'<>'CLIENT_PARTICIPANT' OR new_event->>'actor_id' IS DISTINCT FROM 'client:'||submitted_job.id::text OR
       new_event->'metadata'->>'delivery_id' IS DISTINCT FROM latest_delivery_id::text OR
       submitted_delivery_count<>stored_delivery_count OR submitted_revision_count<>stored_revision_count OR submitted_dispute_count<>stored_dispute_count THEN
      RAISE EXCEPTION 'Approval requires the client and latest submitted delivery';
    END IF;
  ELSIF new_event->>'event_type'='DISPUTE_OPENED' THEN
    IF stored_job.status NOT IN ('ACCEPTED','PAYMENT_RECORDED','IN_PROGRESS','DELIVERY_SUBMITTED','REVISION_REQUESTED','APPROVED') OR submitted_job.status<>'DISPUTED' OR
       new_event->>'actor_type' NOT IN ('PROVIDER','CLIENT_PARTICIPANT') OR
       submitted_delivery_count<>stored_delivery_count OR submitted_revision_count<>stored_revision_count OR submitted_dispute_count<>stored_dispute_count+1 THEN
      RAISE EXCEPTION 'Dispute opening requires one participant dispute from an active state';
    END IF;
    evidence_item := r->'disputes'->(submitted_dispute_count-1);
    IF jsonb_typeof(evidence_item->'evidence_urls') IS DISTINCT FROM 'array' OR
       evidence_item->>'id' IS DISTINCT FROM new_event->'metadata'->>'dispute_id' OR
       evidence_item->>'job_id' IS DISTINCT FROM submitted_job.id::text OR
       (evidence_item->>'created_at')::timestamptz<>(new_event->>'occurred_at')::timestamptz OR
       evidence_item->>'contested_term' IS DISTINCT FROM new_event->'metadata'->>'contested_term' OR
       jsonb_array_length(evidence_item->'evidence_urls')<>(new_event->'metadata'->>'file_count')::integer OR
       evidence_item->>'raised_by' IS DISTINCT FROM (CASE WHEN new_event->>'actor_type'='PROVIDER' THEN 'PROVIDER' ELSE 'CLIENT' END) OR
       new_event->>'actor_id' IS DISTINCT FROM (CASE WHEN new_event->>'actor_type'='PROVIDER' THEN stored_job.provider_id::text ELSE 'client:'||submitted_job.id::text END) THEN
      RAISE EXCEPTION 'Dispute evidence must match its DISPUTE_OPENED event';
    END IF;
    SELECT count(*),count(DISTINCT value) INTO path_count,distinct_path_count FROM jsonb_array_elements_text(evidence_item->'evidence_urls');
    IF path_count<>distinct_path_count OR path_count>10 OR EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(evidence_item->'evidence_urls') path
      WHERE NOT EXISTS (
        SELECT 1 FROM public.evidence_files file
        WHERE file.job_id=submitted_job.id AND file.storage_path=path.value AND file.uploaded_by=new_event->>'actor_id'
      )
    ) THEN RAISE EXCEPTION 'Dispute attachments must be unique authorized participant evidence'; END IF;
  ELSIF new_event->>'event_type'='DISPUTE_RESOLVED' THEN
    IF stored_job.status<>'DISPUTED' OR submitted_job.status NOT IN ('IN_PROGRESS','CANCELLED') OR
       new_event->>'actor_type'<>'ADMIN' OR new_event->'metadata'->>'outcome' IS DISTINCT FROM submitted_job.status OR
       submitted_delivery_count<>stored_delivery_count OR submitted_revision_count<>stored_revision_count OR submitted_dispute_count<>stored_dispute_count THEN
      RAISE EXCEPTION 'Dispute resolution requires an administrator and explicit outcome';
    END IF;
  ELSE
    IF submitted_delivery_count<>stored_delivery_count OR submitted_revision_count<>stored_revision_count OR submitted_dispute_count<>stored_dispute_count THEN
      RAISE EXCEPTION 'Lifecycle evidence changes require their matching transition event';
    END IF;
  END IF;

  IF new_event->>'event_type'<>'REVISION_REQUESTED' AND submitted_revisions_used<>stored_terms.revisions_used THEN
    RAISE EXCEPTION 'Revision usage changes require a matching revision request';
  END IF;
END $$;

CREATE FUNCTION private.tl_assert_delivery_event_link() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.trust_events event
    WHERE event.job_id=NEW.job_id AND event.event_type='DELIVERY_SUBMITTED'
      AND event.metadata->>'delivery_id'=NEW.id::text AND event.actor_type='PROVIDER'
      AND event.actor_id=NEW.submitted_by::text AND event.occurred_at=NEW.submitted_at
      AND (event.metadata->>'file_count')::integer=jsonb_array_length(NEW.file_urls)
  ) THEN RAISE EXCEPTION 'Delivery evidence requires one matching DELIVERY_SUBMITTED event'; END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION private.tl_assert_revision_event_link() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.trust_events event
    WHERE event.job_id=NEW.job_id AND event.event_type='REVISION_REQUESTED'
      AND event.metadata->>'revision_id'=NEW.id::text AND event.actor_type='CLIENT_PARTICIPANT'
      AND event.actor_id=NEW.requested_by AND event.occurred_at=NEW.requested_at
      AND (event.metadata->>'revision_number')::integer=NEW.revision_number
  ) THEN RAISE EXCEPTION 'Revision evidence requires one matching REVISION_REQUESTED event'; END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION private.tl_assert_dispute_event_link() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.trust_events event JOIN public.jobs job ON job.id=event.job_id
    WHERE event.job_id=NEW.job_id AND event.event_type='DISPUTE_OPENED'
      AND event.metadata->>'dispute_id'=NEW.id::text AND event.occurred_at=NEW.created_at
      AND event.metadata->>'contested_term'=NEW.contested_term
      AND (event.metadata->>'file_count')::integer=jsonb_array_length(NEW.evidence_urls)
      AND event.actor_id=CASE WHEN NEW.raised_by='PROVIDER' THEN job.provider_id::text ELSE 'client:'||NEW.job_id::text END
  ) THEN RAISE EXCEPTION 'Dispute evidence requires one matching DISPUTE_OPENED event'; END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION private.tl_assert_phase15_event_record() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NEW.event_type='DELIVERY_SUBMITTED' AND NOT EXISTS (
    SELECT 1 FROM public.deliveries delivery WHERE delivery.id=(NEW.metadata->>'delivery_id')::uuid AND delivery.job_id=NEW.job_id
      AND delivery.submitted_by::text=NEW.actor_id AND delivery.submitted_at=NEW.occurred_at
      AND jsonb_array_length(delivery.file_urls)=(NEW.metadata->>'file_count')::integer
  ) THEN RAISE EXCEPTION 'DELIVERY_SUBMITTED event requires its matching delivery';
  ELSIF NEW.event_type='REVISION_REQUESTED' AND NOT EXISTS (
    SELECT 1 FROM public.revisions revision WHERE revision.id=(NEW.metadata->>'revision_id')::uuid AND revision.job_id=NEW.job_id
      AND revision.requested_by=NEW.actor_id AND revision.requested_at=NEW.occurred_at
      AND revision.revision_number=(NEW.metadata->>'revision_number')::integer
  ) THEN RAISE EXCEPTION 'REVISION_REQUESTED event requires its matching revision';
  ELSIF NEW.event_type='DELIVERY_APPROVED' AND NOT EXISTS (
    SELECT 1 FROM public.deliveries delivery WHERE delivery.id=(NEW.metadata->>'delivery_id')::uuid
      AND delivery.job_id=NEW.job_id AND delivery.submitted_at<=NEW.occurred_at
  ) THEN RAISE EXCEPTION 'DELIVERY_APPROVED event requires its submitted delivery';
  ELSIF NEW.event_type='DISPUTE_OPENED' AND NOT EXISTS (
    SELECT 1 FROM public.disputes dispute WHERE dispute.id=(NEW.metadata->>'dispute_id')::uuid AND dispute.job_id=NEW.job_id
      AND dispute.created_at=NEW.occurred_at AND dispute.contested_term=NEW.metadata->>'contested_term'
      AND jsonb_array_length(dispute.evidence_urls)=(NEW.metadata->>'file_count')::integer
  ) THEN RAISE EXCEPTION 'DISPUTE_OPENED event requires its matching dispute';
  END IF;
  RETURN NEW;
END $$;

CREATE CONSTRAINT TRIGGER delivery_requires_event AFTER INSERT ON public.deliveries
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION private.tl_assert_delivery_event_link();
CREATE CONSTRAINT TRIGGER revision_requires_event AFTER INSERT ON public.revisions
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION private.tl_assert_revision_event_link();
CREATE CONSTRAINT TRIGGER dispute_requires_event AFTER INSERT ON public.disputes
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION private.tl_assert_dispute_event_link();
CREATE CONSTRAINT TRIGGER phase15_event_requires_record AFTER INSERT ON public.trust_events
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION private.tl_assert_phase15_event_record();

CREATE FUNCTION private.tl_prevent_phase15_evidence_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'Work, delivery and revision evidence is immutable'; END $$;
CREATE TRIGGER trg_immutable_deliveries BEFORE UPDATE OR DELETE ON public.deliveries
FOR EACH ROW EXECUTE FUNCTION private.tl_prevent_phase15_evidence_mutation();
CREATE TRIGGER trg_no_truncate_deliveries BEFORE TRUNCATE ON public.deliveries
FOR EACH STATEMENT EXECUTE FUNCTION private.tl_prevent_phase15_evidence_mutation();
CREATE TRIGGER trg_immutable_revisions BEFORE UPDATE OR DELETE ON public.revisions
FOR EACH ROW EXECUTE FUNCTION private.tl_prevent_phase15_evidence_mutation();
CREATE TRIGGER trg_no_truncate_revisions BEFORE TRUNCATE ON public.revisions
FOR EACH STATEMENT EXECUTE FUNCTION private.tl_prevent_phase15_evidence_mutation();

CREATE FUNCTION private.tl_protect_dispute_evidence() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF TG_OP='UPDATE' AND NEW.id=OLD.id AND NEW.job_id=OLD.job_id AND NEW.raised_by=OLD.raised_by AND
     NEW.contested_term=OLD.contested_term AND NEW.claim_description=OLD.claim_description AND
     NEW.evidence_urls=OLD.evidence_urls AND NEW.created_at=OLD.created_at THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Dispute evidence is immutable';
END $$;
CREATE TRIGGER trg_protect_dispute_evidence BEFORE UPDATE OR DELETE ON public.disputes
FOR EACH ROW EXECUTE FUNCTION private.tl_protect_dispute_evidence();
CREATE TRIGGER trg_no_truncate_disputes BEFORE TRUNCATE ON public.disputes
FOR EACH STATEMENT EXECUTE FUNCTION private.tl_prevent_phase15_evidence_mutation();

-- Keep persisted child arrays deterministic so the domain and database agree
-- on the latest delivery even when two records share a timestamp.
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
  'payments',coalesce((SELECT jsonb_agg(to_jsonb(payment)||jsonb_build_object('amount',payment.amount::text) ORDER BY payment.recorded_at,payment.id) FROM public.payments payment WHERE payment.job_id=j.id),'[]'::jsonb),
  'deliveries',coalesce((SELECT jsonb_agg(delivery ORDER BY delivery.submitted_at,delivery.id) FROM public.deliveries delivery WHERE delivery.job_id=j.id),'[]'::jsonb),
  'revisions',coalesce((SELECT jsonb_agg(revision ORDER BY revision.requested_at,revision.id) FROM public.revisions revision WHERE revision.job_id=j.id),'[]'::jsonb),
  'disputes',coalesce((SELECT jsonb_agg(dispute ORDER BY dispute.created_at,dispute.id) FROM public.disputes dispute WHERE dispute.job_id=j.id),'[]'::jsonb),
  'reviews',coalesce((SELECT jsonb_agg(review ORDER BY review.submitted_at,review.id) FROM public.reviews review WHERE review.job_id=j.id),'[]'::jsonb),
  'events',coalesce((SELECT jsonb_agg(event ORDER BY event.event_sequence) FROM public.trust_events event WHERE event.job_id=j.id),'[]'::jsonb)
)
FROM public.jobs j
LEFT JOIN public.job_participants client ON client.job_id=j.id AND client.role='CLIENT_PARTICIPANT'
WHERE CASE WHEN p_public THEN j.public_id=p_id ELSE j.id::text=p_id END;
$$;

ALTER FUNCTION public.tl_commit_job(jsonb,integer) RENAME TO tl_phase13_commit_job;
ALTER FUNCTION public.tl_phase13_commit_job(jsonb,integer) SET SCHEMA private;

CREATE FUNCTION public.tl_commit_job(p_record jsonb,p_expected_version integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  PERFORM private.tl_validate_phase15_commit(p_record,p_expected_version);
  PERFORM private.tl_phase13_commit_job(p_record,p_expected_version);
END $$;

REVOKE ALL ON FUNCTION
  private.tl_validate_phase15_commit(jsonb,integer),
  private.tl_assert_delivery_event_link(),
  private.tl_assert_revision_event_link(),
  private.tl_assert_dispute_event_link(),
  private.tl_assert_phase15_event_record(),
  private.tl_prevent_phase15_evidence_mutation(),
  private.tl_protect_dispute_evidence(),
  private.tl_phase13_commit_job(jsonb,integer)
FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.tl_commit_job(jsonb,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.tl_commit_job(jsonb,integer) TO service_role;

COMMENT ON FUNCTION private.tl_validate_phase15_commit(jsonb,integer) IS
  'Validates Phase 15 predecessor states, actors, revision limits and exact evidence deltas before atomic persistence.';

COMMIT;
