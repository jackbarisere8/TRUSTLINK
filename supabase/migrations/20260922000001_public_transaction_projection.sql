-- Phase 11: persisted public transaction projection.
-- The route reads only these server-only views for anonymous requests. Private
-- aggregates, participant contact data, capabilities, evidence and event
-- metadata remain behind tl_read_job and participant authorization.
BEGIN;

DROP VIEW public.public_job_records;

CREATE VIEW public.public_job_records AS
SELECT
  j.public_id,
  j.status,
  j.provider_location,
  jt.service,
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
  coalesce(pp.headline, 'Independent professional') AS provider_headline
FROM public.jobs j
JOIN public.job_terms jt ON j.id=jt.job_id
JOIN public.profiles p ON j.provider_id=p.user_id
LEFT JOIN public.provider_profiles pp ON p.user_id=pp.user_id
WHERE j.status <> 'DRAFT';

ALTER VIEW public.public_job_records SET (security_invoker=true);

CREATE VIEW public.public_transaction_events AS
SELECT
  j.public_id,
  e.id,
  e.event_type,
  e.occurred_at,
  e.event_sequence
FROM public.jobs j
JOIN public.trust_events e ON e.job_id=j.id
WHERE j.status <> 'DRAFT'
  AND e.event_type IN (
    'JOB_CREATED', 'JOB_SENT', 'JOB_ACCEPTED', 'PAYMENT_RECORDED',
    'WORK_STARTED', 'DELIVERY_SUBMITTED', 'REVISION_REQUESTED',
    'DELIVERY_APPROVED', 'JOB_COMPLETED', 'JOB_CANCELLED',
    'DISPUTE_OPENED', 'DISPUTE_RESOLVED', 'CLIENT_REVIEWED'
  );

ALTER VIEW public.public_transaction_events SET (security_invoker=true);

REVOKE ALL ON public.public_job_records,public.public_transaction_events FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.public_job_records,public.public_transaction_events TO service_role;

COMMENT ON VIEW public.public_job_records IS
  'Narrow public agreement fields only. Server-only security-invoker projection.';
COMMENT ON VIEW public.public_transaction_events IS
  'Server-only public lifecycle DTO. Excludes actors, metadata, capability operations and page reads.';

COMMIT;
