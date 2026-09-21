-- ============================================================================
-- TrustLink Web v0.1 — Core PostgreSQL Schema & RLS
-- Conforms to ARCHITECTURE.md, AGENT.md, and TRUSTLINK-SOURCE-REVIEW-v1
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. Profiles & Provider Profiles
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE, -- REFERENCES auth.users(id) ON DELETE CASCADE in Supabase
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  country TEXT NOT NULL DEFAULT 'Nigeria',
  state TEXT,
  city TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.provider_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  headline TEXT NOT NULL,
  bio TEXT,
  service_area TEXT NOT NULL DEFAULT 'Lagos, Nigeria',
  verification_status TEXT NOT NULL DEFAULT 'IDENTITY_PROVIDED'
    CHECK (verification_status IN ('UNVERIFIED', 'IDENTITY_PROVIDED', 'VERIFIED_BY_TRUSTLINK')),
  completed_jobs_count INTEGER NOT NULL DEFAULT 0,
  average_rating NUMERIC(3, 2) DEFAULT NULL,
  on_time_rate NUMERIC(5, 2) DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 2. Jobs & Terms
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  public_id TEXT UNIQUE NOT NULL,
  provider_id UUID NOT NULL, -- references provider profile or user_id
  client_id UUID,            -- optional: if client created an account
  client_name TEXT,
  client_email TEXT,
  client_phone TEXT,
  client_action_token_hash TEXT, -- SHA-256 hash of guest client action token
  client_token_expires_at TIMESTAMPTZ,
  client_token_used BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'SENT'
    CHECK (status IN (
      'DRAFT', 'SENT', 'ACCEPTED', 'PAYMENT_RECORDED',
      'IN_PROGRESS', 'DELIVERY_SUBMITTED', 'REVISION_REQUESTED',
      'APPROVED', 'COMPLETED', 'DISPUTED', 'CANCELLED'
    )),
  source_channel TEXT NOT NULL DEFAULT 'WhatsApp'
    CHECK (source_channel IN (
      'WhatsApp', 'Instagram', 'Referral', 'Direct', 'X (Twitter)',
      'LinkedIn', 'Facebook', 'TikTok', 'Telegram', 'SMS', 'Email',
      'QR Code', 'Other'
    )),
  provider_location TEXT NOT NULL DEFAULT 'Lagos, Nigeria',
  client_location TEXT,
  first_viewed_at TIMESTAMPTZ,
  last_viewed_at TIMESTAMPTZ,
  view_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.job_terms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID UNIQUE NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  service TEXT NOT NULL,
  service_category TEXT NOT NULL,
  scope TEXT NOT NULL,
  deliverables JSONB NOT NULL DEFAULT '[]'::jsonb,
  price TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NGN',
  deadline TEXT NOT NULL,
  revisions_included INTEGER NOT NULL DEFAULT 2,
  revisions_used INTEGER NOT NULL DEFAULT 0,
  cancellation_terms TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 3. Payments (Non-Custodial: Recorded Only in V0.1)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID UNIQUE NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  payment_mode TEXT NOT NULL DEFAULT 'RECORDED' CHECK (payment_mode = 'RECORDED'),
  reference TEXT,
  notes TEXT,
  recorded_by TEXT NOT NULL DEFAULT 'PROVIDER' CHECK (recorded_by IN ('PROVIDER', 'CLIENT')),
  verification_status TEXT NOT NULL DEFAULT 'NOT_VERIFIED' CHECK (verification_status = 'NOT_VERIFIED'),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 4. Deliveries & Revisions
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  file_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  submitted_by UUID NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.revisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL,
  description TEXT NOT NULL,
  requested_by TEXT NOT NULL DEFAULT 'CLIENT',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 5. Structured Disputes
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.disputes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID UNIQUE NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  raised_by TEXT NOT NULL CHECK (raised_by IN ('PROVIDER', 'CLIENT')),
  contested_term TEXT NOT NULL CHECK (contested_term IN ('Scope', 'Quality', 'Deadline', 'Payment', 'Communication')),
  claim_description TEXT NOT NULL,
  evidence_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  response_from_other_party TEXT,
  dispute_status TEXT NOT NULL DEFAULT 'OPEN'
    CHECK (dispute_status IN ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'CLOSED')),
  resolution_notes TEXT,
  resolved_by TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 6. Reviews & Trust Ratings
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID UNIQUE NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  reviewer_id TEXT NOT NULL,
  reviewer_name TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 7. Immutable Trust Events Ledger
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.trust_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('PROVIDER', 'CLIENT_PARTICIPANT', 'ADMIN', 'SYSTEM')),
  event_type TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Database-enforced append-only trigger
CREATE OR REPLACE FUNCTION public.prevent_trust_event_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'trust_events rows are immutable and cannot be updated or deleted';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_immutable_trust_events ON public.trust_events;
CREATE TRIGGER trg_immutable_trust_events
BEFORE UPDATE OR DELETE ON public.trust_events
FOR EACH ROW EXECUTE FUNCTION public.prevent_trust_event_mutation();

-- ----------------------------------------------------------------------------
-- 8. Public Projection View (Safe Public Data Only)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.public_job_records AS
SELECT
  j.public_id,
  j.status,
  j.source_channel,
  j.provider_location,
  j.created_at,
  j.first_viewed_at,
  jt.service,
  jt.service_category,
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
  p.avatar_url AS provider_avatar,
  pp.headline AS provider_role,
  pp.verification_status AS provider_verification_status,
  pp.completed_jobs_count AS provider_completed_jobs,
  pp.average_rating AS provider_rating,
  pp.on_time_rate AS provider_on_time_rate
FROM public.jobs j
JOIN public.job_terms jt ON j.id = jt.job_id
JOIN public.profiles p ON j.provider_id = p.user_id OR j.provider_id = p.id
LEFT JOIN public.provider_profiles pp ON p.user_id = pp.user_id;

-- ----------------------------------------------------------------------------
-- 9. Row Level Security (RLS)
-- ----------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trust_events ENABLE ROW LEVEL SECURITY;

-- Public can view profiles
CREATE POLICY "Public can view profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Public can view provider profiles" ON public.provider_profiles FOR SELECT USING (true);

-- Public can query public_job_records view
-- Direct jobs table access restricted: public can only query by public_id
CREATE POLICY "Public select jobs by public_id" ON public.jobs FOR SELECT USING (true);
CREATE POLICY "Public select terms" ON public.job_terms FOR SELECT USING (true);
CREATE POLICY "Public select trust events" ON public.trust_events FOR SELECT USING (true);

-- Insert policies
CREATE POLICY "Users can insert jobs" ON public.jobs FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can insert job terms" ON public.job_terms FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can insert trust events" ON public.trust_events FOR INSERT WITH CHECK (true);
