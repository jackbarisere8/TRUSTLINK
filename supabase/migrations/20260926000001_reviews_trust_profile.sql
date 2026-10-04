-- Phase 18 review provenance and Trust Profile source integrity.
BEGIN;

-- An empty comment means that no optional comment was submitted. Normalize that
-- harmless legacy representation before making new review evidence immutable.
UPDATE public.reviews SET comment=NULL WHERE comment IS NOT NULL AND btrim(comment)='';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.reviews review
    JOIN public.jobs job ON job.id=review.job_id
    LEFT JOIN public.job_participants client ON client.job_id=review.job_id AND client.role='CLIENT_PARTICIPANT'
    WHERE job.status<>'COMPLETED' OR job.completed_at IS NULL OR review.submitted_at<job.completed_at OR
      btrim(review.reviewer_name)='' OR char_length(review.reviewer_name)>120 OR
      (review.comment IS NOT NULL AND char_length(review.comment)>3000) OR
      review.reviewer_id IS DISTINCT FROM 'client:'||review.job_id::text OR
      review.reviewer_name IS DISTINCT FROM client.display_name OR
      1<>(
        SELECT count(*) FROM public.trust_events event
        WHERE event.job_id=review.job_id AND event.event_type='CLIENT_REVIEWED'
          AND event.actor_type='CLIENT_PARTICIPANT' AND event.actor_id=review.reviewer_id
          AND event.occurred_at=review.submitted_at AND event.metadata->>'rating'=review.rating::text
      )
  ) OR EXISTS (
    SELECT 1 FROM public.trust_events event
    WHERE event.event_type='CLIENT_REVIEWED' AND 1<>(
      SELECT count(*) FROM public.reviews review
      WHERE review.job_id=event.job_id AND review.reviewer_id=event.actor_id
        AND review.submitted_at=event.occurred_at AND review.rating::text=event.metadata->>'rating'
    )
  ) THEN
    RAISE EXCEPTION 'Historical reviews and CLIENT_REVIEWED events require provenance repair before Phase 18';
  END IF;
END $$;

-- Earlier review events carried the rating but not the row identifier. The
-- preflight above proves a one-to-one match before this controlled backfill.
ALTER TABLE public.trust_events DISABLE TRIGGER trg_immutable_trust_events;
UPDATE public.trust_events event
SET metadata=event.metadata||jsonb_build_object('review_id',review.id::text,'rating',review.rating)
FROM public.reviews review
WHERE event.event_type='CLIENT_REVIEWED' AND event.job_id=review.job_id
  AND event.actor_type='CLIENT_PARTICIPANT' AND event.actor_id=review.reviewer_id
  AND event.occurred_at=review.submitted_at AND event.metadata->>'rating'=review.rating::text;
ALTER TABLE public.trust_events ENABLE TRIGGER trg_immutable_trust_events;

ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_reviewer_name_bounds CHECK (btrim(reviewer_name)<>'' AND char_length(reviewer_name)<=120) NOT VALID,
  ADD CONSTRAINT reviews_comment_bounds CHECK (comment IS NULL OR (btrim(comment)<>'' AND char_length(comment)<=3000)) NOT VALID;
ALTER TABLE public.reviews VALIDATE CONSTRAINT reviews_reviewer_name_bounds;
ALTER TABLE public.reviews VALIDATE CONSTRAINT reviews_comment_bounds;

ALTER TABLE public.trust_events
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
    )) AND
    (event_type<>'CLIENT_REVIEWED' OR (
      coalesce(metadata->>'review_id','') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      AND coalesce(metadata->>'rating','') IN ('1','2','3','4','5')
    ))
  ) NOT VALID;

CREATE FUNCTION private.tl_validate_phase18_review_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE stored_job public.jobs%ROWTYPE; stored_review public.reviews%ROWTYPE; client_name text;
BEGIN
  IF NEW.event_type<>'CLIENT_REVIEWED' THEN RETURN NEW; END IF;
  SELECT * INTO stored_job FROM public.jobs WHERE id=NEW.job_id;
  SELECT display_name INTO client_name FROM public.job_participants
    WHERE job_id=NEW.job_id AND role='CLIENT_PARTICIPANT';
  SELECT * INTO stored_review FROM public.reviews
    WHERE id::text=NEW.metadata->>'review_id' AND job_id=NEW.job_id;
  IF stored_job.status<>'COMPLETED' OR stored_job.completed_at IS NULL OR
     NEW.actor_type<>'CLIENT_PARTICIPANT' OR NEW.actor_id IS DISTINCT FROM 'client:'||NEW.job_id::text OR
     stored_review.id IS NULL OR stored_review.reviewer_id IS DISTINCT FROM NEW.actor_id OR
     stored_review.reviewer_name IS DISTINCT FROM client_name OR stored_review.rating::text IS DISTINCT FROM NEW.metadata->>'rating' OR
     stored_review.submitted_at<>NEW.occurred_at OR stored_review.submitted_at<stored_job.completed_at THEN
    RAISE EXCEPTION 'Only the transaction client can submit one review after completion';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_validate_phase18_review_event
BEFORE INSERT ON public.trust_events FOR EACH ROW
EXECUTE FUNCTION private.tl_validate_phase18_review_event();

CREATE FUNCTION private.tl_validate_phase18_commit(p_record jsonb,p_expected_version integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  r jsonb := public.tl_snake_keys(p_record);
  submitted_job public.jobs%ROWTYPE;
  stored_job public.jobs%ROWTYPE;
  submitted_review jsonb;
  new_event jsonb;
  stored_event_count integer;
  stored_review_count integer;
  submitted_review_count integer;
  client_name text;
BEGIN
  IF p_expected_version IS NULL THEN RETURN; END IF;
  IF jsonb_typeof(r->'events') IS DISTINCT FROM 'array' OR jsonb_typeof(r->'reviews') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Phase 18 review collections must be arrays';
  END IF;
  submitted_job := jsonb_populate_record(null::public.jobs,r->'job');
  SELECT * INTO stored_job FROM public.jobs WHERE id=submitted_job.id FOR UPDATE;
  IF NOT FOUND OR stored_job.version<>p_expected_version THEN RAISE EXCEPTION 'Concurrent change' USING ERRCODE='40001'; END IF;
  SELECT count(*) INTO stored_event_count FROM public.trust_events WHERE job_id=submitted_job.id;
  IF jsonb_array_length(r->'events')<>stored_event_count+1 THEN RAISE EXCEPTION 'A transaction change requires the complete history and one new event'; END IF;
  new_event := r->'events'->stored_event_count;
  SELECT count(*) INTO stored_review_count FROM public.reviews WHERE job_id=submitted_job.id;
  submitted_review_count := jsonb_array_length(r->'reviews');

  IF new_event->>'event_type'='CLIENT_REVIEWED' THEN
    SELECT display_name INTO client_name FROM public.job_participants
      WHERE job_id=submitted_job.id AND role='CLIENT_PARTICIPANT';
    SELECT value INTO submitted_review FROM jsonb_array_elements(r->'reviews') item(value)
      WHERE value->>'id'=new_event->'metadata'->>'review_id';
    IF stored_job.status<>'COMPLETED' OR submitted_job.status<>'COMPLETED' OR stored_job.completed_at IS NULL OR
       stored_review_count<>0 OR submitted_review_count<>1 OR submitted_review IS NULL OR
       new_event->>'actor_type'<>'CLIENT_PARTICIPANT' OR new_event->>'actor_id' IS DISTINCT FROM 'client:'||submitted_job.id::text OR
       submitted_review->>'job_id' IS DISTINCT FROM submitted_job.id::text OR
       submitted_review->>'reviewer_id' IS DISTINCT FROM new_event->>'actor_id' OR
       submitted_review->>'reviewer_name' IS DISTINCT FROM client_name OR
       submitted_review->>'rating' IS DISTINCT FROM new_event->'metadata'->>'rating' OR
       (submitted_review->>'submitted_at')::timestamptz<>(new_event->>'occurred_at')::timestamptz OR
       (submitted_review->>'submitted_at')::timestamptz<stored_job.completed_at OR
       (submitted_review->>'comment' IS NOT NULL AND (
         btrim(submitted_review->>'comment')='' OR char_length(submitted_review->>'comment')>3000
       )) THEN
      RAISE EXCEPTION 'Client review requires one authorized post-completion review and exact ledger event';
    END IF;
  ELSIF submitted_review_count<>stored_review_count THEN
    RAISE EXCEPTION 'Review changes require CLIENT_REVIEWED';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.reviews stored
    WHERE stored.job_id=submitted_job.id AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(r->'reviews') item(value)
      WHERE value->>'id'=stored.id::text AND value->>'job_id'=stored.job_id::text
        AND value->>'reviewer_id' IS NOT DISTINCT FROM stored.reviewer_id
        AND value->>'reviewer_name' IS NOT DISTINCT FROM stored.reviewer_name
        AND value->>'rating' IS NOT DISTINCT FROM stored.rating::text
        AND value->>'comment' IS NOT DISTINCT FROM stored.comment
        AND (value->>'submitted_at')::timestamptz IS NOT DISTINCT FROM stored.submitted_at
    )
  ) THEN RAISE EXCEPTION 'Submitted reviews are immutable'; END IF;
END $$;

CREATE FUNCTION private.tl_prevent_review_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'Submitted reviews are immutable'; END $$;

CREATE TRIGGER trg_immutable_reviews BEFORE UPDATE OR DELETE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION private.tl_prevent_review_mutation();
CREATE TRIGGER trg_no_truncate_reviews BEFORE TRUNCATE ON public.reviews
FOR EACH STATEMENT EXECUTE FUNCTION private.tl_prevent_review_mutation();

CREATE FUNCTION private.tl_assert_phase18_review_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.trust_events event
    WHERE event.job_id=NEW.job_id AND event.event_type='CLIENT_REVIEWED'
      AND event.metadata->>'review_id'=NEW.id::text AND event.metadata->>'rating'=NEW.rating::text
      AND event.actor_type='CLIENT_PARTICIPANT' AND event.actor_id=NEW.reviewer_id
      AND event.occurred_at=NEW.submitted_at
  ) THEN RAISE EXCEPTION 'Review requires its exact CLIENT_REVIEWED event'; END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION private.tl_assert_phase18_event_review() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NEW.event_type='CLIENT_REVIEWED' AND NOT EXISTS (
    SELECT 1 FROM public.reviews review
    WHERE review.id::text=NEW.metadata->>'review_id' AND review.job_id=NEW.job_id
      AND review.reviewer_id=NEW.actor_id AND review.rating::text=NEW.metadata->>'rating'
      AND review.submitted_at=NEW.occurred_at
  ) THEN RAISE EXCEPTION 'CLIENT_REVIEWED event requires its exact review'; END IF;
  RETURN NEW;
END $$;

CREATE CONSTRAINT TRIGGER phase18_review_requires_event
AFTER INSERT ON public.reviews DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION private.tl_assert_phase18_review_event();
CREATE CONSTRAINT TRIGGER phase18_event_requires_review
AFTER INSERT ON public.trust_events DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION private.tl_assert_phase18_event_review();

ALTER FUNCTION public.tl_commit_job(jsonb,integer) RENAME TO tl_phase17_commit_job;
ALTER FUNCTION public.tl_phase17_commit_job(jsonb,integer) SET SCHEMA private;

CREATE FUNCTION public.tl_commit_job(p_record jsonb,p_expected_version integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  PERFORM private.tl_validate_phase18_commit(p_record,p_expected_version);
  PERFORM private.tl_phase17_commit_job(p_record,p_expected_version);
END $$;

REVOKE ALL ON FUNCTION
  private.tl_validate_phase18_review_event(),
  private.tl_validate_phase18_commit(jsonb,integer),
  private.tl_prevent_review_mutation(),
  private.tl_assert_phase18_review_event(),
  private.tl_assert_phase18_event_review(),
  private.tl_phase17_commit_job(jsonb,integer)
FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.tl_commit_job(jsonb,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.tl_commit_job(jsonb,integer) TO service_role;

COMMENT ON TABLE public.reviews IS
  'Immutable post-completion reviews submitted once by the transaction-scoped client participant.';
COMMENT ON FUNCTION private.tl_validate_phase18_commit(jsonb,integer) IS
  'Locks the completed transaction and binds one authorized client review to its exact immutable ledger event.';

COMMIT;
