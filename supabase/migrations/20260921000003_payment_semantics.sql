-- Phase 9 recorded-payment semantics.
-- A payment row is an immutable provider declaration of direct receipt. It is
-- not processor verification, custody, protection, authorization or settlement.
BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.payments
    WHERE payment_mode<>'RECORDED' OR recorded_by<>'PROVIDER' OR verification_status<>'NOT_VERIFIED'
      OR length(coalesce(reference,''))>200 OR length(coalesce(notes,''))>2000
  ) THEN
    RAISE EXCEPTION 'Historical payments contain unsupported custody, actor, verification or text semantics';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.payments payment
    WHERE NOT EXISTS (
      SELECT 1 FROM public.trust_events event
      WHERE event.job_id=payment.job_id AND event.event_type='PAYMENT_RECORDED'
        AND event.actor_type='PROVIDER' AND event.occurred_at=payment.recorded_at
    )
  ) OR EXISTS (
    SELECT 1 FROM public.trust_events event
    WHERE event.event_type='PAYMENT_RECORDED' AND NOT EXISTS (
      SELECT 1 FROM public.payments payment
      WHERE payment.job_id=event.job_id AND payment.recorded_at=event.occurred_at
    )
  ) THEN
    RAISE EXCEPTION 'Historical payment declarations and trust events do not agree';
  END IF;
END $$;

ALTER TABLE public.payments
  ADD COLUMN amount numeric(14,2),
  ADD COLUMN currency text;

UPDATE public.payments payment
SET amount=terms.price,currency=terms.currency
FROM public.job_terms terms
WHERE terms.job_id=payment.job_id;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.payments WHERE amount IS NULL OR currency IS NULL) THEN
    RAISE EXCEPTION 'Every recorded payment must map to immutable transaction terms';
  END IF;
END $$;

ALTER TABLE public.payments
  DROP CONSTRAINT payments_recorded_by_check,
  ALTER COLUMN amount SET NOT NULL,
  ALTER COLUMN currency SET NOT NULL,
  ADD CONSTRAINT payments_provider_declaration CHECK (recorded_by='PROVIDER'),
  ADD CONSTRAINT payments_positive_recorded_value CHECK (amount>0),
  ADD CONSTRAINT payments_recorded_currency CHECK (currency='NGN'),
  ADD CONSTRAINT payments_reference_length CHECK (length(coalesce(reference,''))<=200),
  ADD CONSTRAINT payments_notes_length CHECK (length(coalesce(notes,''))<=2000);

COMMENT ON TABLE public.payments IS
  'Immutable provider declarations of direct payment receipt. Rows do not prove transfer verification, custody, protection or settlement.';
COMMENT ON COLUMN public.payments.amount IS
  'Snapshot of the agreed transaction value declared received; not an independently verified bank-transfer amount.';
COMMENT ON COLUMN public.payments.verification_status IS
  'Always NOT_VERIFIED because V0.1 has no payment verification capability.';

CREATE FUNCTION private.tl_validate_recorded_payment_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  persisted public.payments%ROWTYPE;
  job_status text;
  job_created_at timestamptz;
  agreed_price numeric;
  agreed_currency text;
BEGIN
  SELECT * INTO persisted FROM public.payments WHERE id=NEW.id;
  IF FOUND THEN
    IF to_jsonb(persisted) IS DISTINCT FROM to_jsonb(NEW) THEN
      RAISE EXCEPTION 'Recorded payment evidence is immutable';
    END IF;
    RETURN NEW;
  END IF;

  SELECT job.status,job.created_at,terms.price,terms.currency
  INTO job_status,job_created_at,agreed_price,agreed_currency
  FROM public.jobs job JOIN public.job_terms terms ON terms.job_id=job.id
  WHERE job.id=NEW.job_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Recorded payment transaction does not exist'; END IF;
  IF job_status<>'PAYMENT_RECORDED' THEN
    RAISE EXCEPTION 'A new payment declaration requires the PAYMENT_RECORDED transition';
  END IF;
  IF NEW.payment_mode<>'RECORDED' OR NEW.recorded_by<>'PROVIDER' OR NEW.verification_status<>'NOT_VERIFIED' THEN
    RAISE EXCEPTION 'Unsupported payment semantics';
  END IF;
  IF NEW.amount<>agreed_price OR NEW.currency<>agreed_currency THEN
    RAISE EXCEPTION 'Recorded transaction value must match the agreed terms';
  END IF;
  IF NEW.recorded_at<job_created_at THEN
    RAISE EXCEPTION 'Payment declaration cannot predate the transaction';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_validate_recorded_payment_insert
BEFORE INSERT ON public.payments
FOR EACH ROW EXECUTE FUNCTION private.tl_validate_recorded_payment_insert();

CREATE FUNCTION private.tl_assert_recorded_payment_link() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  target_job uuid := NEW.job_id;
  payment public.payments%ROWTYPE;
  event public.trust_events%ROWTYPE;
  payment_count integer;
  event_count integer;
BEGIN
  IF TG_TABLE_NAME='trust_events' THEN
    IF NEW.event_type<>'PAYMENT_RECORDED' THEN RETURN NEW; END IF;
  END IF;

  SELECT count(*) INTO payment_count FROM public.payments WHERE job_id=target_job;
  SELECT count(*) INTO event_count FROM public.trust_events WHERE job_id=target_job AND event_type='PAYMENT_RECORDED';
  IF payment_count<>1 OR event_count<>1 THEN
    RAISE EXCEPTION 'A recorded payment requires exactly one matching trust event';
  END IF;

  SELECT * INTO payment FROM public.payments WHERE job_id=target_job;
  SELECT * INTO event FROM public.trust_events WHERE job_id=target_job AND event_type='PAYMENT_RECORDED';
  IF event.actor_type<>'PROVIDER' OR event.occurred_at<>payment.recorded_at OR
     coalesce(event.metadata->>'payment_mode','')<>payment.payment_mode OR
     coalesce(event.metadata->>'recorded_by','')<>payment.recorded_by OR
     coalesce(event.metadata->>'verification_status','')<>payment.verification_status OR
     coalesce(event.metadata->>'currency','')<>payment.currency OR
     coalesce(event.metadata->>'amount','') !~ '^\d+(\.\d{1,2})?$' OR
     (event.metadata->>'amount')::numeric<>payment.amount THEN
    RAISE EXCEPTION 'Recorded payment and trust event semantics do not agree';
  END IF;
  RETURN NEW;
END $$;

CREATE CONSTRAINT TRIGGER payment_requires_matching_event
AFTER INSERT ON public.payments
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION private.tl_assert_recorded_payment_link();

CREATE CONSTRAINT TRIGGER payment_event_requires_record
AFTER INSERT ON public.trust_events
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION private.tl_assert_recorded_payment_link();

CREATE FUNCTION private.tl_prevent_recorded_payment_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  RAISE EXCEPTION 'Recorded payment evidence is immutable';
END $$;

CREATE TRIGGER trg_immutable_recorded_payments
BEFORE UPDATE OR DELETE ON public.payments
FOR EACH ROW EXECUTE FUNCTION private.tl_prevent_recorded_payment_mutation();
CREATE TRIGGER trg_no_truncate_recorded_payments
BEFORE TRUNCATE ON public.payments
FOR EACH STATEMENT EXECUTE FUNCTION private.tl_prevent_recorded_payment_mutation();

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
  'payments',coalesce((SELECT jsonb_agg(to_jsonb(payment)||jsonb_build_object('amount',payment.amount::text) ORDER BY payment.recorded_at) FROM public.payments payment WHERE payment.job_id=j.id),'[]'::jsonb),
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

REVOKE ALL ON FUNCTION
  private.tl_validate_recorded_payment_insert(),
  private.tl_assert_recorded_payment_link(),
  private.tl_prevent_recorded_payment_mutation()
FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.tl_read_job(text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.tl_read_job(text,boolean) TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA private
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC,anon,authenticated,service_role;

COMMIT;
