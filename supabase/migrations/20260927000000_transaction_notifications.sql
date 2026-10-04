-- Phase 20: minimal, event-derived transactional notification intents.
-- This migration deliberately adds no delivery provider, preferences, read
-- state, social graph, or browser-facing notification feed.
BEGIN;

CREATE TABLE public.notification_intents (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.trust_events(id) ON DELETE CASCADE,
  notification_kind text NOT NULL CONSTRAINT notification_intents_kind_check CHECK (notification_kind IN (
    'TRANSACTION_ACCEPTED','PAYMENT_RECORDED','DELIVERY_SUBMITTED',
    'REVISION_REQUESTED','DISPUTE_RAISED','TRANSACTION_COMPLETED'
  )),
  recipient_role text NOT NULL CONSTRAINT notification_intents_recipient_check CHECK (recipient_role IN (
    'PROVIDER','CLIENT_PARTICIPANT','ADMIN'
  )),
  created_at timestamptz NOT NULL,
  UNIQUE(event_id,recipient_role)
);

CREATE INDEX notification_intents_job_created_idx
ON public.notification_intents(job_id,created_at,id);

CREATE FUNCTION private.tl_validate_notification_intent() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE
  source_event public.trust_events%ROWTYPE;
  expected_kind text;
  expected_role text;
BEGIN
  SELECT * INTO source_event FROM public.trust_events WHERE id=NEW.event_id;
  IF NOT FOUND OR source_event.job_id<>NEW.job_id OR source_event.created_at<>NEW.created_at THEN
    RAISE EXCEPTION 'Notification intent must identify its exact trust event';
  END IF;

  expected_kind := CASE source_event.event_type
    WHEN 'JOB_ACCEPTED' THEN 'TRANSACTION_ACCEPTED'
    WHEN 'PAYMENT_RECORDED' THEN 'PAYMENT_RECORDED'
    WHEN 'DELIVERY_SUBMITTED' THEN 'DELIVERY_SUBMITTED'
    WHEN 'REVISION_REQUESTED' THEN 'REVISION_REQUESTED'
    WHEN 'DISPUTE_OPENED' THEN 'DISPUTE_RAISED'
    WHEN 'JOB_COMPLETED' THEN 'TRANSACTION_COMPLETED'
    ELSE NULL
  END;
  expected_role := CASE source_event.event_type
    WHEN 'JOB_ACCEPTED' THEN 'PROVIDER'
    WHEN 'PAYMENT_RECORDED' THEN 'CLIENT_PARTICIPANT'
    WHEN 'DELIVERY_SUBMITTED' THEN 'CLIENT_PARTICIPANT'
    WHEN 'REVISION_REQUESTED' THEN 'PROVIDER'
    WHEN 'JOB_COMPLETED' THEN 'CLIENT_PARTICIPANT'
    WHEN 'DISPUTE_OPENED' THEN CASE source_event.actor_type
      WHEN 'PROVIDER' THEN 'CLIENT_PARTICIPANT'
      WHEN 'CLIENT_PARTICIPANT' THEN 'PROVIDER'
      ELSE NULL
    END
    ELSE NULL
  END;

  IF NEW.notification_kind IS DISTINCT FROM expected_kind OR
     (NEW.recipient_role IS DISTINCT FROM expected_role AND
      NOT (source_event.event_type='DISPUTE_OPENED' AND NEW.recipient_role='ADMIN')) THEN
    RAISE EXCEPTION 'Notification intent does not match its trust event and recipient';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER validate_notification_intent
BEFORE INSERT ON public.notification_intents
FOR EACH ROW EXECUTE FUNCTION private.tl_validate_notification_intent();

CREATE FUNCTION private.tl_reject_notification_intent_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  RAISE EXCEPTION 'Notification intents are immutable';
END $$;

CREATE TRIGGER notification_intents_immutable
BEFORE UPDATE OR DELETE ON public.notification_intents
FOR EACH ROW EXECUTE FUNCTION private.tl_reject_notification_intent_mutation();
CREATE TRIGGER notification_intents_no_truncate
BEFORE TRUNCATE ON public.notification_intents
FOR EACH STATEMENT EXECUTE FUNCTION private.tl_reject_notification_intent_mutation();

CREATE FUNCTION private.tl_create_notification_intents() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  kind text;
  recipient text;
BEGIN
  kind := CASE NEW.event_type
    WHEN 'JOB_ACCEPTED' THEN 'TRANSACTION_ACCEPTED'
    WHEN 'PAYMENT_RECORDED' THEN 'PAYMENT_RECORDED'
    WHEN 'DELIVERY_SUBMITTED' THEN 'DELIVERY_SUBMITTED'
    WHEN 'REVISION_REQUESTED' THEN 'REVISION_REQUESTED'
    WHEN 'DISPUTE_OPENED' THEN 'DISPUTE_RAISED'
    WHEN 'JOB_COMPLETED' THEN 'TRANSACTION_COMPLETED'
    ELSE NULL
  END;
  recipient := CASE NEW.event_type
    WHEN 'JOB_ACCEPTED' THEN 'PROVIDER'
    WHEN 'PAYMENT_RECORDED' THEN 'CLIENT_PARTICIPANT'
    WHEN 'DELIVERY_SUBMITTED' THEN 'CLIENT_PARTICIPANT'
    WHEN 'REVISION_REQUESTED' THEN 'PROVIDER'
    WHEN 'JOB_COMPLETED' THEN 'CLIENT_PARTICIPANT'
    WHEN 'DISPUTE_OPENED' THEN CASE NEW.actor_type
      WHEN 'PROVIDER' THEN 'CLIENT_PARTICIPANT'
      WHEN 'CLIENT_PARTICIPANT' THEN 'PROVIDER'
      ELSE NULL
    END
    ELSE NULL
  END;

  IF kind IS NOT NULL AND recipient IS NOT NULL THEN
    INSERT INTO public.notification_intents(job_id,event_id,notification_kind,recipient_role,created_at)
    VALUES (NEW.job_id,NEW.id,kind,recipient,NEW.created_at)
    ON CONFLICT (event_id,recipient_role) DO NOTHING;
  END IF;
  IF NEW.event_type='DISPUTE_OPENED' THEN
    INSERT INTO public.notification_intents(job_id,event_id,notification_kind,recipient_role,created_at)
    VALUES (NEW.job_id,NEW.id,'DISPUTE_RAISED','ADMIN',NEW.created_at)
    ON CONFLICT (event_id,recipient_role) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

INSERT INTO public.notification_intents(job_id,event_id,notification_kind,recipient_role,created_at)
SELECT event.job_id,event.id,
  CASE event.event_type
    WHEN 'JOB_ACCEPTED' THEN 'TRANSACTION_ACCEPTED'
    WHEN 'PAYMENT_RECORDED' THEN 'PAYMENT_RECORDED'
    WHEN 'DELIVERY_SUBMITTED' THEN 'DELIVERY_SUBMITTED'
    WHEN 'REVISION_REQUESTED' THEN 'REVISION_REQUESTED'
    WHEN 'JOB_COMPLETED' THEN 'TRANSACTION_COMPLETED'
  END,
  CASE event.event_type
    WHEN 'JOB_ACCEPTED' THEN 'PROVIDER'
    WHEN 'PAYMENT_RECORDED' THEN 'CLIENT_PARTICIPANT'
    WHEN 'DELIVERY_SUBMITTED' THEN 'CLIENT_PARTICIPANT'
    WHEN 'REVISION_REQUESTED' THEN 'PROVIDER'
    WHEN 'JOB_COMPLETED' THEN 'CLIENT_PARTICIPANT'
  END,
  event.created_at
FROM public.trust_events event
WHERE event.event_type IN ('JOB_ACCEPTED','PAYMENT_RECORDED','DELIVERY_SUBMITTED','REVISION_REQUESTED','JOB_COMPLETED')
ON CONFLICT (event_id,recipient_role) DO NOTHING;

INSERT INTO public.notification_intents(job_id,event_id,notification_kind,recipient_role,created_at)
SELECT event.job_id,event.id,'DISPUTE_RAISED',
  CASE event.actor_type WHEN 'PROVIDER' THEN 'CLIENT_PARTICIPANT' ELSE 'PROVIDER' END,
  event.created_at
FROM public.trust_events event
WHERE event.event_type='DISPUTE_OPENED'
ON CONFLICT (event_id,recipient_role) DO NOTHING;

INSERT INTO public.notification_intents(job_id,event_id,notification_kind,recipient_role,created_at)
SELECT event.job_id,event.id,'DISPUTE_RAISED','ADMIN',event.created_at
FROM public.trust_events event
WHERE event.event_type='DISPUTE_OPENED'
ON CONFLICT (event_id,recipient_role) DO NOTHING;

CREATE TRIGGER create_transaction_notification_intents
AFTER INSERT ON public.trust_events
FOR EACH ROW EXECUTE FUNCTION private.tl_create_notification_intents();

ALTER TABLE public.notification_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_intents FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.notification_intents FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.notification_intents TO service_role;

REVOKE ALL ON FUNCTION private.tl_validate_notification_intent() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION private.tl_reject_notification_intent_mutation() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION private.tl_create_notification_intents() FROM PUBLIC,anon,authenticated,service_role;

COMMENT ON TABLE public.notification_intents IS
  'Immutable transactional delivery intents created atomically from selected trust events; no channel delivery or social read state.';

COMMIT;
