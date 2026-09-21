-- Phase 7 database security and Row Level Security boundary.
--
-- TrustLink authorizes account sessions and guest capabilities in the Next.js
-- server before using its server-only elevated database client. Browser roles
-- therefore have no direct table, view or RPC access. This avoids maintaining a
-- second authorization path that cannot represent the HTTP-only guest
-- capability and would expose raw transaction rows through the Data API.
BEGIN;

-- Remove any earlier or deployment-local public-schema policies. With no policy
-- and no grant, anon/authenticated are deliberately default-deny.
DO $$
DECLARE policy record;
BEGIN
  FOR policy IN
    SELECT schemaname,tablename,policyname
    FROM pg_policies
    WHERE schemaname='public'
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I',policy.policyname,policy.schemaname,policy.tablename);
  END LOOP;
END $$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.provider_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.job_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_terms FORCE ROW LEVEL SECURITY;
ALTER TABLE public.job_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_participants FORCE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries FORCE ROW LEVEL SECURITY;
ALTER TABLE public.revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revisions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputes FORCE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews FORCE ROW LEVEL SECURITY;
ALTER TABLE public.trust_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trust_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_files FORCE ROW LEVEL SECURITY;

-- Views normally check underlying relations as the view owner. Make the safe
-- projection obey the caller's grants and RLS if it is ever granted to another
-- role. It remains server-only in this release.
ALTER VIEW public.public_job_records SET (security_invoker=true);

-- Supabase projects may carry broad legacy default grants. Current objects and
-- objects created by subsequent migrations are opt-in for every application
-- role. Every future table still needs an explicit ENABLE/FORCE RLS statement.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC,anon,authenticated,service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM PUBLIC,anon,authenticated,service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM PUBLIC,anon,authenticated,service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC,anon,authenticated,service_role;

-- The server repository reads these relations after application authorization.
-- All transaction/profile mutations continue through the security-definer RPCs
-- so locking, version checks, relational synchronization and event insertion
-- remain atomic.
GRANT SELECT ON TABLE
  public.profiles,
  public.provider_profiles,
  public.jobs,
  public.job_terms,
  public.job_participants,
  public.payments,
  public.deliveries,
  public.revisions,
  public.disputes,
  public.reviews,
  public.trust_events,
  public.evidence_files,
  public.public_job_records
TO service_role;

-- Evidence metadata is written only after route-level participant authorization.
GRANT INSERT,DELETE ON TABLE public.evidence_files TO service_role;

-- These are the complete callable application API for the elevated repository.
-- uuid_generate_v4 is needed by the evidence_files default during direct insert.
GRANT EXECUTE ON FUNCTION
  public.uuid_generate_v4(),
  public.tl_update_profile(uuid,jsonb),
  public.tl_read_job(text,boolean),
  public.tl_commit_job(jsonb,integer)
TO service_role;

COMMENT ON VIEW public.public_job_records IS
  'Deliberate non-sensitive transaction projection. Server-only; security invoker prevents owner privilege bypass.';
COMMENT ON TABLE public.job_participants IS
  'Private transaction participation, contact provenance and guest capability data. Never expose through anonymous Data API grants.';
COMMENT ON TABLE public.evidence_files IS
  'Private evidence metadata. Object access additionally requires the restrictive transaction-evidence Storage policy.';

COMMIT;
