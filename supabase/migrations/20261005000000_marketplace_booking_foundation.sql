-- Phase 3 marketplace, booking, and availability foundation.
-- Browser roles remain default-deny. The server repository uses the narrow
-- authorization RPCs below; all booking mutations are versioned and atomic.
BEGIN;

ALTER TABLE public.jobs DROP CONSTRAINT jobs_source_channel_check;
ALTER TABLE public.jobs ADD CONSTRAINT jobs_source_channel_check CHECK (source_channel IN (
  'WhatsApp','Instagram','Referral','Direct','X (Twitter)','LinkedIn','Facebook',
  'TikTok','Telegram','SMS','Email','QR Code','TrustLink Marketplace','Other'
));

CREATE TABLE public.reference_data_releases (
  id text PRIMARY KEY,
  title text NOT NULL,
  publisher text NOT NULL,
  landing_page text NOT NULL,
  download_url text NOT NULL,
  license text NOT NULL,
  source_valid_on text NOT NULL,
  retrieved_at date NOT NULL,
  source_sha256 text NOT NULL CHECK (source_sha256 ~ '^[a-f0-9]{64}$'),
  normalized_sha256 text NOT NULL CHECK (normalized_sha256 ~ '^[a-f0-9]{64}$'),
  state_count integer NOT NULL CHECK (state_count=37),
  lga_count integer NOT NULL CHECK (lga_count=774),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.nigeria_states (
  code text PRIMARY KEY CHECK (code ~ '^NG[0-9]{3}$'),
  name text NOT NULL UNIQUE CHECK (btrim(name)<>''),
  kind text NOT NULL CHECK (kind IN ('STATE','FCT')),
  release_id text NOT NULL REFERENCES public.reference_data_releases(id) ON DELETE RESTRICT,
  active boolean NOT NULL DEFAULT true,
  UNIQUE(code,release_id)
);

CREATE TABLE public.nigeria_lgas (
  code text PRIMARY KEY CHECK (code ~ '^NG[0-9]{6}$'),
  state_code text NOT NULL REFERENCES public.nigeria_states(code) ON DELETE RESTRICT,
  name text NOT NULL CHECK (btrim(name)<>''),
  kind text NOT NULL CHECK (kind IN ('LGA','AREA_COUNCIL')),
  release_id text NOT NULL REFERENCES public.reference_data_releases(id) ON DELETE RESTRICT,
  active boolean NOT NULL DEFAULT true,
  CONSTRAINT nigeria_lgas_state_code_prefix CHECK (left(code,5)=state_code),
  CONSTRAINT nigeria_lgas_state_name_unique UNIQUE(state_code,name),
  CONSTRAINT nigeria_lgas_code_state_unique UNIQUE(code,state_code),
  CONSTRAINT nigeria_lgas_release_state_fk FOREIGN KEY(state_code,release_id)
    REFERENCES public.nigeria_states(code,release_id) ON DELETE RESTRICT
);

CREATE TABLE public.service_categories (
  id uuid PRIMARY KEY,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text NOT NULL UNIQUE CHECK (btrim(name)<>'' AND char_length(name)<=80),
  parent_id uuid REFERENCES public.service_categories(id) ON DELETE RESTRICT,
  description text CHECK (description IS NULL OR (btrim(description)<>'' AND char_length(description)<=500)),
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order>=0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (parent_id IS NULL OR parent_id<>id)
);

CREATE TABLE public.service_definitions (
  id uuid PRIMARY KEY,
  category_id uuid NOT NULL REFERENCES public.service_categories(id) ON DELETE RESTRICT,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text NOT NULL UNIQUE CHECK (btrim(name)<>'' AND char_length(name)<=100),
  description text CHECK (description IS NULL OR (btrim(description)<>'' AND char_length(description)<=800)),
  approved_aliases text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  moderation_status text NOT NULL DEFAULT 'APPROVED'
    CHECK (moderation_status IN ('DRAFT','PENDING','APPROVED','REJECTED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT service_definition_aliases_nonblank CHECK (
    array_position(approved_aliases,'') IS NULL
  )
);

CREATE INDEX service_categories_active_sort_idx ON public.service_categories(active,sort_order,slug);
CREATE INDEX service_definitions_category_active_idx ON public.service_definitions(category_id,active,name);
CREATE INDEX service_definitions_name_search_idx ON public.service_definitions(lower(name));
CREATE INDEX service_definitions_aliases_idx ON public.service_definitions USING gin(approved_aliases);

INSERT INTO public.service_categories(id,slug,name,description,sort_order) VALUES
  ('10000000-0000-4000-8000-000000000001','technology-digital','Technology & Digital','Websites, software, IT support, and digital growth.',10),
  ('10000000-0000-4000-8000-000000000002','home-repairs','Home & Repairs','Repairs, installations, maintenance, and property services.',20),
  ('10000000-0000-4000-8000-000000000003','auto-mobility','Auto & Mobility','Vehicle inspection, repair, maintenance, and roadside help.',30),
  ('10000000-0000-4000-8000-000000000004','creative-media','Creative & Media','Design, photography, video, writing, and brand production.',40),
  ('10000000-0000-4000-8000-000000000005','business-professional','Business & Professional','Administrative, accounting, legal-support, and consulting services.',50),
  ('10000000-0000-4000-8000-000000000006','personal-events','Personal & Events','Beauty, wellness, tutoring, catering, and event services.',60);

INSERT INTO public.service_definitions(id,category_id,slug,name,description,approved_aliases) VALUES
  ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','website-development','Website Development','Design and development of business, portfolio, and commerce websites.',ARRAY['web developer','website designer','build a business website','web design']),
  ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','mobile-app-development','Mobile App Development','Design and development of mobile applications.',ARRAY['app developer','android developer','ios developer']),
  ('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','it-support','IT Support','Device, network, software, and workplace technology support.',ARRAY['computer repair','tech support','network support']),
  ('20000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000002','electrical-services','Electrical Services','Residential and commercial electrical installation and repair.',ARRAY['electrician','wiring','electrical repair']),
  ('20000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000002','plumbing','Plumbing','Pipe, fixture, water-system, and drainage work.',ARRAY['plumber','pipe repair','leak repair']),
  ('20000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000002','air-conditioning-repair','Air Conditioning Repair','Air-conditioner installation, servicing, and repair.',ARRAY['ac repair','air conditioner technician','ac installation']),
  ('20000000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000003','auto-mechanic','Auto Mechanic','Vehicle diagnosis, servicing, and mechanical repair.',ARRAY['mechanic','car repair','vehicle mechanic','auto repair']),
  ('20000000-0000-4000-8000-000000000008','10000000-0000-4000-8000-000000000003','auto-electrician','Auto Electrician','Vehicle electrical diagnosis and repair.',ARRAY['car electrician','vehicle electrical repair']),
  ('20000000-0000-4000-8000-000000000009','10000000-0000-4000-8000-000000000004','graphic-design','Graphic Design','Visual identity, marketing, and communication design.',ARRAY['graphic designer','logo designer','brand designer']),
  ('20000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000004','photography','Photography','Portrait, product, event, and commercial photography.',ARRAY['photographer','event photographer','product photography']),
  ('20000000-0000-4000-8000-000000000011','10000000-0000-4000-8000-000000000004','video-production','Video Production','Video recording, editing, and production.',ARRAY['videographer','video editor','video production']),
  ('20000000-0000-4000-8000-000000000012','10000000-0000-4000-8000-000000000005','bookkeeping','Bookkeeping','Business record keeping and accounts support.',ARRAY['bookkeeper','accounting support','small business accounts']),
  ('20000000-0000-4000-8000-000000000013','10000000-0000-4000-8000-000000000005','business-consulting','Business Consulting','Planning, operations, and business advisory support.',ARRAY['business consultant','strategy consultant','business advisory']),
  ('20000000-0000-4000-8000-000000000014','10000000-0000-4000-8000-000000000006','tutoring','Tutoring','Individual or group academic instruction.',ARRAY['tutor','private teacher','lessons']),
  ('20000000-0000-4000-8000-000000000015','10000000-0000-4000-8000-000000000006','catering','Catering','Food preparation and service for private and public events.',ARRAY['caterer','event food','food vendor']);

ALTER TABLE public.provider_profiles
  ADD COLUMN marketplace_status text NOT NULL DEFAULT 'NOT_LISTED'
    CHECK (marketplace_status IN ('NOT_LISTED','DRAFT','PUBLISHED','SUSPENDED')),
  ADD COLUMN business_name text CHECK (business_name IS NULL OR (btrim(business_name)<>'' AND char_length(business_name)<=120)),
  ADD COLUMN remote_services boolean NOT NULL DEFAULT false,
  ADD COLUMN booking_policy text CHECK (booking_policy IS NULL OR (btrim(booking_policy)<>'' AND char_length(booking_policy)<=1500)),
  ADD COLUMN moderation_status text NOT NULL DEFAULT 'DRAFT'
    CHECK (moderation_status IN ('DRAFT','PENDING','APPROVED','REJECTED','SUSPENDED')),
  ADD COLUMN published_at timestamptz,
  ADD COLUMN booking_capacity smallint NOT NULL DEFAULT 1 CHECK (booking_capacity BETWEEN 1 AND 20),
  ADD CONSTRAINT provider_marketplace_publication CHECK (
    marketplace_status<>'PUBLISHED' OR (moderation_status='APPROVED' AND published_at IS NOT NULL)
  );

CREATE TABLE public.provider_services (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id uuid NOT NULL REFERENCES public.provider_profiles(user_id) ON DELETE CASCADE,
  service_definition_id uuid NOT NULL REFERENCES public.service_definitions(id) ON DELETE RESTRICT,
  public_title text NOT NULL CHECK (btrim(public_title)<>'' AND char_length(public_title)<=120),
  description text NOT NULL CHECK (btrim(description)<>'' AND char_length(description)<=2000),
  pricing_model text NOT NULL CHECK (pricing_model IN ('FIXED','STARTING_AT','HOURLY','DAILY','QUOTE_REQUIRED')),
  price_min numeric(14,2),
  price_max numeric(14,2),
  currency text NOT NULL DEFAULT 'NGN' CHECK (currency='NGN'),
  supports_remote boolean NOT NULL DEFAULT false,
  supports_onsite boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PUBLISHED','ARCHIVED')),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,provider_id),
  CONSTRAINT provider_services_delivery_mode CHECK (supports_remote OR supports_onsite),
  CONSTRAINT provider_services_price_shape CHECK (
    (pricing_model='QUOTE_REQUIRED' AND price_min IS NULL AND price_max IS NULL) OR
    (pricing_model='FIXED' AND price_min>0 AND (price_max IS NULL OR price_max=price_min)) OR
    (pricing_model IN ('STARTING_AT','HOURLY','DAILY') AND price_min>0 AND (price_max IS NULL OR price_max>=price_min))
  ),
  CONSTRAINT provider_services_publication CHECK (status<>'PUBLISHED' OR published_at IS NOT NULL)
);

CREATE TABLE public.provider_service_durations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_service_id uuid NOT NULL REFERENCES public.provider_services(id) ON DELETE CASCADE,
  duration_minutes integer NOT NULL CHECK (duration_minutes BETWEEN 15 AND 10080),
  label text CHECK (label IS NULL OR (btrim(label)<>'' AND char_length(label)<=80)),
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order>=0),
  UNIQUE(provider_service_id,duration_minutes)
);

CREATE TABLE public.provider_service_areas (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id uuid NOT NULL REFERENCES public.provider_profiles(user_id) ON DELETE CASCADE,
  provider_service_id uuid,
  state_code text REFERENCES public.nigeria_states(code) ON DELETE RESTRICT,
  lga_code text,
  remote_service boolean NOT NULL DEFAULT false,
  approximate_origin text CHECK (approximate_origin IS NULL OR (btrim(approximate_origin)<>'' AND char_length(approximate_origin)<=160)),
  radius_km numeric(7,2) CHECK (radius_km IS NULL OR (radius_km>0 AND radius_km<=1000)),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT provider_service_areas_service_owner_fk FOREIGN KEY(provider_service_id,provider_id)
    REFERENCES public.provider_services(id,provider_id) ON DELETE CASCADE,
  CONSTRAINT provider_service_areas_lga_state_fk FOREIGN KEY(lga_code,state_code)
    REFERENCES public.nigeria_lgas(code,state_code) ON DELETE RESTRICT,
  CONSTRAINT provider_service_areas_scope CHECK (
    (remote_service AND state_code IS NULL AND lga_code IS NULL AND radius_km IS NULL) OR
    (NOT remote_service AND state_code IS NOT NULL)
  )
);

CREATE TABLE public.provider_availability_rules (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id uuid NOT NULL REFERENCES public.provider_profiles(user_id) ON DELETE CASCADE,
  provider_service_id uuid,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  local_start time NOT NULL,
  local_end time NOT NULL,
  timezone text NOT NULL DEFAULT 'Africa/Lagos' CHECK (timezone='Africa/Lagos'),
  effective_from date,
  effective_to date,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT provider_availability_service_owner_fk FOREIGN KEY(provider_service_id,provider_id)
    REFERENCES public.provider_services(id,provider_id) ON DELETE CASCADE,
  CHECK (local_end>local_start),
  CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_to>=effective_from)
);

CREATE TABLE public.provider_unavailability (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id uuid NOT NULL REFERENCES public.provider_profiles(user_id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  reason text CHECK (reason IS NULL OR (btrim(reason)<>'' AND char_length(reason)<=500)),
  source text NOT NULL DEFAULT 'MANUAL' CHECK (source IN ('MANUAL','CONFIRMED_TRANSACTION','SYSTEM')),
  job_id uuid REFERENCES public.jobs(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at>starts_at),
  CHECK (source<>'CONFIRMED_TRANSACTION' OR job_id IS NOT NULL)
);

CREATE TABLE public.marketplace_settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  booking_request_ttl interval NOT NULL DEFAULT interval '72 hours' CHECK (booking_request_ttl>interval '0'),
  slot_hold_ttl interval NOT NULL DEFAULT interval '24 hours' CHECK (slot_hold_ttl>interval '0'),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.marketplace_settings DEFAULT VALUES;

CREATE TABLE public.booking_requests (
  id uuid PRIMARY KEY,
  public_id text NOT NULL UNIQUE CHECK (public_id ~ '^[a-f0-9]{24}$'),
  customer_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE RESTRICT,
  provider_id uuid NOT NULL REFERENCES public.provider_profiles(user_id) ON DELETE RESTRICT,
  provider_service_id uuid NOT NULL,
  request_text text NOT NULL CHECK (btrim(request_text)<>'' AND char_length(request_text)<=3000),
  requested_start timestamptz NOT NULL,
  requested_end timestamptz NOT NULL,
  timezone text NOT NULL DEFAULT 'Africa/Lagos' CHECK (timezone='Africa/Lagos'),
  duration_minutes integer NOT NULL CHECK (duration_minutes BETWEEN 15 AND 10080),
  location_mode text NOT NULL CHECK (location_mode IN ('REMOTE','PROVIDER_LOCATION','CUSTOMER_LOCATION')),
  state_code text REFERENCES public.nigeria_states(code) ON DELETE RESTRICT,
  lga_code text,
  broad_area text CHECK (broad_area IS NULL OR (btrim(broad_area)<>'' AND char_length(broad_area)<=160)),
  private_address text CHECK (private_address IS NULL OR (btrim(private_address)<>'' AND char_length(private_address)<=500)),
  budget_min numeric(14,2) CHECK (budget_min IS NULL OR budget_min>0),
  budget_max numeric(14,2) CHECK (budget_max IS NULL OR budget_max>0),
  currency text NOT NULL DEFAULT 'NGN' CHECK (currency='NGN'),
  status text NOT NULL DEFAULT 'REQUESTED'
    CHECK (status IN ('REQUESTED','DECLINED','CANCELLED','EXPIRED','TERMS_SENT','CONFIRMED')),
  version integer NOT NULL DEFAULT 0 CHECK (version>=0),
  expires_at timestamptz NOT NULL,
  linked_job_id uuid UNIQUE REFERENCES public.jobs(id) ON DELETE RESTRICT,
  hold_expires_at timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT booking_service_owner_fk FOREIGN KEY(provider_service_id,provider_id)
    REFERENCES public.provider_services(id,provider_id) ON DELETE RESTRICT,
  CONSTRAINT booking_lga_state_fk FOREIGN KEY(lga_code,state_code)
    REFERENCES public.nigeria_lgas(code,state_code) ON DELETE RESTRICT,
  CONSTRAINT booking_period_matches_duration CHECK (requested_end=requested_start+(duration_minutes*interval '1 minute')),
  CONSTRAINT booking_budget_shape CHECK (budget_max IS NULL OR (budget_min IS NOT NULL AND budget_max>=budget_min)),
  CONSTRAINT booking_location_shape CHECK (
    (location_mode='REMOTE' AND state_code IS NULL AND lga_code IS NULL AND private_address IS NULL) OR
    (location_mode<>'REMOTE' AND state_code IS NOT NULL)
  ),
  CONSTRAINT booking_status_link_shape CHECK (
    (status='REQUESTED' AND linked_job_id IS NULL AND hold_expires_at IS NULL) OR
    (status IN ('DECLINED') AND linked_job_id IS NULL AND hold_expires_at IS NULL) OR
    (status='TERMS_SENT' AND linked_job_id IS NOT NULL AND hold_expires_at IS NOT NULL) OR
    (status='CONFIRMED' AND linked_job_id IS NOT NULL AND hold_expires_at IS NULL) OR
    (status IN ('CANCELLED','EXPIRED') AND hold_expires_at IS NULL)
  ),
  CHECK (expires_at>created_at),
  CHECK (updated_at>=created_at)
);

CREATE TABLE public.booking_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id uuid NOT NULL REFERENCES public.booking_requests(id) ON DELETE CASCADE,
  event_sequence integer NOT NULL CHECK (event_sequence>0),
  actor_id text NOT NULL CHECK (btrim(actor_id)<>''),
  actor_type text NOT NULL CHECK (actor_type IN ('CUSTOMER','PROVIDER','SYSTEM','ADMIN')),
  event_type text NOT NULL CHECK (event_type IN (
    'REQUEST_CREATED','PROVIDER_DECLINED','CUSTOMER_CANCELLED','REQUEST_EXPIRED',
    'TERMS_SENT','CLIENT_ACCEPTED_TRANSACTION','TRANSACTION_CANCELLED',
    'SLOT_HOLD_CREATED','SLOT_HOLD_RELEASED','SLOT_HOLD_CONFIRMED'
  )),
  request_id uuid,
  command_hash text,
  expected_version integer,
  metadata jsonb NOT NULL DEFAULT '{}',
  occurred_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(booking_id,event_sequence),
  CONSTRAINT booking_event_request_shape CHECK (
    (request_id IS NULL AND command_hash IS NULL AND expected_version IS NULL) OR
    (request_id IS NOT NULL AND command_hash ~ '^[a-f0-9]{64}$' AND expected_version IS NOT NULL AND expected_version>=0)
  )
);
CREATE UNIQUE INDEX booking_events_request_once ON public.booking_events(booking_id,request_id) WHERE request_id IS NOT NULL;

CREATE TABLE public.booking_slot_holds (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id uuid NOT NULL UNIQUE REFERENCES public.booking_requests(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES public.provider_profiles(user_id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('ACTIVE','CONFIRMED','RELEASED','EXPIRED')),
  expires_at timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  released_at timestamptz,
  CHECK (ends_at>starts_at),
  CHECK (
    (status='ACTIVE' AND expires_at IS NOT NULL AND released_at IS NULL) OR
    (status='CONFIRMED' AND expires_at IS NULL AND released_at IS NULL) OR
    (status IN ('RELEASED','EXPIRED') AND expires_at IS NULL AND released_at IS NOT NULL)
  )
);

CREATE INDEX provider_services_discovery_idx ON public.provider_services(service_definition_id,status,provider_id);
CREATE INDEX provider_service_areas_location_idx ON public.provider_service_areas(state_code,lga_code,provider_id);
CREATE INDEX provider_availability_lookup_idx ON public.provider_availability_rules(provider_id,day_of_week);
CREATE INDEX provider_unavailability_period_idx ON public.provider_unavailability(provider_id,starts_at,ends_at);
CREATE INDEX booking_customer_status_idx ON public.booking_requests(customer_id,status,created_at DESC);
CREATE INDEX booking_provider_status_idx ON public.booking_requests(provider_id,status,requested_start);
CREATE INDEX booking_service_date_idx ON public.booking_requests(provider_service_id,requested_start);
CREATE INDEX booking_holds_conflict_idx ON public.booking_slot_holds(provider_id,status,starts_at,ends_at);

CREATE FUNCTION private.tl_append_booking_event(
  p_booking_id uuid,p_actor_id text,p_actor_type text,p_event_type text,
  p_occurred_at timestamptz,p_request_id uuid DEFAULT NULL,p_command_hash text DEFAULT NULL,
  p_expected_version integer DEFAULT NULL,p_metadata jsonb DEFAULT '{}'
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE next_sequence integer;
BEGIN
  SELECT coalesce(max(event_sequence),0)+1 INTO next_sequence
  FROM public.booking_events WHERE booking_id=p_booking_id;
  INSERT INTO public.booking_events(
    booking_id,event_sequence,actor_id,actor_type,event_type,request_id,
    command_hash,expected_version,metadata,occurred_at,created_at
  ) VALUES (
    p_booking_id,next_sequence,p_actor_id,p_actor_type,p_event_type,p_request_id,
    p_command_hash,p_expected_version,p_metadata,p_occurred_at,p_occurred_at
  );
END $$;

CREATE FUNCTION private.tl_release_booking_hold(p_booking_id uuid,p_status text,p_occurred_at timestamptz)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE changed integer;
BEGIN
  UPDATE public.booking_slot_holds SET status=p_status,expires_at=NULL,released_at=p_occurred_at,updated_at=p_occurred_at
  WHERE booking_id=p_booking_id AND status='ACTIVE';
  GET DIAGNOSTICS changed=ROW_COUNT;
  IF changed>0 THEN
    PERFORM private.tl_append_booking_event(p_booking_id,'system','SYSTEM','SLOT_HOLD_RELEASED',p_occurred_at,NULL,NULL,NULL,jsonb_build_object('hold_status',p_status));
  END IF;
  RETURN changed>0;
END $$;

CREATE FUNCTION private.tl_expire_provider_bookings(p_provider_id uuid,p_now timestamptz)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE candidate public.booking_requests%ROWTYPE; changed integer:=0;
BEGIN
  FOR candidate IN
    SELECT booking.* FROM public.booking_requests booking
    WHERE booking.provider_id=p_provider_id AND (
      (booking.status='REQUESTED' AND booking.expires_at<=p_now) OR
      (booking.status='TERMS_SENT' AND booking.hold_expires_at<=p_now)
    ) ORDER BY booking.created_at FOR UPDATE
  LOOP
    UPDATE public.booking_requests SET status='EXPIRED',version=version+1,hold_expires_at=NULL,updated_at=p_now
    WHERE id=candidate.id;
    PERFORM private.tl_append_booking_event(candidate.id,'system','SYSTEM','REQUEST_EXPIRED',p_now,NULL,NULL,NULL,'{}');
    PERFORM private.tl_release_booking_hold(candidate.id,'EXPIRED',p_now);
    changed:=changed+1;
  END LOOP;
  RETURN changed;
END $$;

CREATE FUNCTION private.tl_reject_booking_event_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'Booking events are immutable'; END $$;
CREATE TRIGGER booking_events_immutable BEFORE UPDATE OR DELETE ON public.booking_events
FOR EACH ROW EXECUTE FUNCTION private.tl_reject_booking_event_mutation();
CREATE TRIGGER booking_events_no_truncate BEFORE TRUNCATE ON public.booking_events
FOR EACH STATEMENT EXECUTE FUNCTION private.tl_reject_booking_event_mutation();

CREATE FUNCTION public.tl_create_booking(
  p_record jsonb,p_actor_id uuid,p_request_id uuid,p_command_hash text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE booking public.booking_requests%ROWTYPE; existing_event public.booking_events%ROWTYPE; ttl interval;
BEGIN
  booking:=jsonb_populate_record(NULL::public.booking_requests,p_record);
  SELECT * INTO existing_event FROM public.booking_events
    WHERE booking_id=booking.id AND request_id=p_request_id;
  IF FOUND THEN
    IF existing_event.actor_type<>'CUSTOMER' OR existing_event.actor_id<>p_actor_id::text OR
       existing_event.command_hash IS DISTINCT FROM p_command_hash OR existing_event.expected_version<>0 THEN
      RAISE EXCEPTION 'Booking request identifier was reused for different input';
    END IF;
    SELECT * INTO booking FROM public.booking_requests WHERE id=booking.id;
    RETURN jsonb_build_object('booking',to_jsonb(booking),'replayed',true);
  END IF;
  SELECT booking_request_ttl INTO ttl FROM public.marketplace_settings WHERE singleton;
  IF booking.customer_id<>p_actor_id OR booking.status<>'REQUESTED' OR booking.version<>0 OR
     booking.created_at<>booking.updated_at OR booking.expires_at<>booking.created_at+ttl OR
     booking.linked_job_id IS NOT NULL OR booking.hold_expires_at IS NOT NULL OR
     p_command_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'A new booking requires canonical customer-owned request data';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.provider_services service
    JOIN public.provider_profiles provider ON provider.user_id=service.provider_id
    JOIN public.service_definitions definition ON definition.id=service.service_definition_id
    WHERE service.id=booking.provider_service_id AND service.provider_id=booking.provider_id
      AND service.status='PUBLISHED' AND definition.active AND definition.moderation_status='APPROVED'
      AND provider.marketplace_status='PUBLISHED' AND provider.moderation_status='APPROVED'
  ) THEN RAISE EXCEPTION 'The selected provider service is not bookable'; END IF;
  INSERT INTO public.booking_requests SELECT booking.*;
  PERFORM private.tl_append_booking_event(booking.id,p_actor_id::text,'CUSTOMER','REQUEST_CREATED',booking.created_at,p_request_id,p_command_hash,0,'{}');
  RETURN jsonb_build_object('booking',to_jsonb(booking),'replayed',false);
END $$;

CREATE FUNCTION public.tl_read_booking(p_booking_id uuid,p_actor_id uuid,p_actor_type text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE booking public.booking_requests%ROWTYPE; output jsonb;
BEGIN
  SELECT * INTO booking FROM public.booking_requests WHERE id=p_booking_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF NOT (
    p_actor_type='ADMIN' OR
    (p_actor_type='CUSTOMER' AND booking.customer_id=p_actor_id) OR
    (p_actor_type='PROVIDER' AND booking.provider_id=p_actor_id)
  ) THEN RAISE EXCEPTION 'You do not have access to this booking'; END IF;
  output:=to_jsonb(booking);
  IF p_actor_type='PROVIDER' AND booking.status<>'CONFIRMED' THEN
    output:=jsonb_set(output,'{private_address}','null'::jsonb);
  END IF;
  RETURN output;
END $$;

CREATE FUNCTION public.tl_list_bookings(p_actor_id uuid,p_actor_type text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF p_actor_type NOT IN ('CUSTOMER','PROVIDER','ADMIN') THEN RAISE EXCEPTION 'Invalid booking actor'; END IF;
  RETURN coalesce((
    SELECT jsonb_agg(
      CASE WHEN p_actor_type='PROVIDER' AND booking.status<>'CONFIRMED'
        THEN jsonb_set(to_jsonb(booking),'{private_address}','null'::jsonb)
        ELSE to_jsonb(booking) END
      ORDER BY booking.created_at DESC
    ) FROM public.booking_requests booking
    WHERE p_actor_type='ADMIN' OR
      (p_actor_type='CUSTOMER' AND booking.customer_id=p_actor_id) OR
      (p_actor_type='PROVIDER' AND booking.provider_id=p_actor_id)
  ),'[]'::jsonb);
END $$;

CREATE FUNCTION public.tl_transition_booking(
  p_booking_id uuid,p_actor_id uuid,p_actor_type text,p_next_status text,
  p_expected_version integer,p_request_id uuid,p_command_hash text,p_occurred_at timestamptz
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE booking public.booking_requests%ROWTYPE; previous public.booking_events%ROWTYPE; event_type text;
BEGIN
  SELECT * INTO previous FROM public.booking_events WHERE booking_id=p_booking_id AND request_id=p_request_id;
  IF FOUND THEN
    IF previous.actor_id<>p_actor_id::text OR previous.actor_type<>p_actor_type OR
       previous.command_hash IS DISTINCT FROM p_command_hash OR previous.expected_version<>p_expected_version THEN
      RAISE EXCEPTION 'Booking request identifier was reused for a different action';
    END IF;
    SELECT * INTO booking FROM public.booking_requests WHERE id=p_booking_id;
    RETURN jsonb_build_object('booking',to_jsonb(booking),'replayed',true);
  END IF;
  SELECT * INTO booking FROM public.booking_requests WHERE id=p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;
  IF booking.version<>p_expected_version THEN RAISE EXCEPTION 'Concurrent change' USING ERRCODE='40001'; END IF;
  IF p_command_hash !~ '^[a-f0-9]{64}$' OR p_occurred_at<booking.updated_at THEN RAISE EXCEPTION 'Invalid booking command'; END IF;
  IF booking.status='REQUESTED' AND p_next_status='DECLINED' AND p_actor_type='PROVIDER' AND booking.provider_id=p_actor_id THEN
    event_type:='PROVIDER_DECLINED';
  ELSIF booking.status IN ('REQUESTED','TERMS_SENT') AND p_next_status='CANCELLED' AND p_actor_type='CUSTOMER' AND booking.customer_id=p_actor_id THEN
    event_type:='CUSTOMER_CANCELLED';
  ELSE RAISE EXCEPTION 'Illegal or unauthorized booking transition'; END IF;
  UPDATE public.booking_requests SET status=p_next_status,version=version+1,hold_expires_at=NULL,updated_at=p_occurred_at
  WHERE id=booking.id RETURNING * INTO booking;
  PERFORM private.tl_append_booking_event(booking.id,p_actor_id::text,p_actor_type,event_type,p_occurred_at,p_request_id,p_command_hash,p_expected_version,'{}');
  PERFORM private.tl_release_booking_hold(booking.id,'RELEASED',p_occurred_at);
  RETURN jsonb_build_object('booking',to_jsonb(booking),'replayed',false);
END $$;

CREATE FUNCTION public.tl_convert_booking(
  p_booking_id uuid,p_provider_id uuid,p_expected_version integer,p_request_id uuid,
  p_command_hash text,p_job_record jsonb,p_occurred_at timestamptz
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE booking public.booking_requests%ROWTYPE; previous public.booking_events%ROWTYPE;
  capacity integer; active_count integer; hold_ttl interval; submitted_job public.jobs%ROWTYPE;
BEGIN
  SELECT * INTO previous FROM public.booking_events WHERE booking_id=p_booking_id AND request_id=p_request_id;
  IF FOUND THEN
    IF previous.event_type<>'TERMS_SENT' OR previous.actor_type<>'PROVIDER' OR previous.actor_id<>p_provider_id::text OR
       previous.command_hash IS DISTINCT FROM p_command_hash OR previous.expected_version<>p_expected_version THEN
      RAISE EXCEPTION 'Booking conversion identifier was reused for different input';
    END IF;
    SELECT * INTO booking FROM public.booking_requests WHERE id=p_booking_id;
    RETURN jsonb_build_object('booking',to_jsonb(booking),'replayed',true);
  END IF;
  SELECT * INTO booking FROM public.booking_requests WHERE id=p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;
  IF booking.provider_id<>p_provider_id THEN RAISE EXCEPTION 'Only the selected provider can prepare terms'; END IF;
  IF booking.status<>'REQUESTED' THEN RAISE EXCEPTION 'Only a requested booking can receive terms'; END IF;
  IF booking.version<>p_expected_version THEN RAISE EXCEPTION 'Concurrent change' USING ERRCODE='40001'; END IF;
  IF booking.expires_at<=p_occurred_at THEN RAISE EXCEPTION 'The booking request has expired'; END IF;
  IF p_command_hash !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Invalid booking conversion command'; END IF;
  SELECT booking_capacity INTO capacity FROM public.provider_profiles WHERE user_id=p_provider_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Provider profile not found'; END IF;
  PERFORM private.tl_expire_provider_bookings(p_provider_id,p_occurred_at);
  SELECT count(*) INTO active_count FROM public.booking_slot_holds hold
  WHERE hold.provider_id=p_provider_id AND hold.status IN ('ACTIVE','CONFIRMED')
    AND hold.starts_at<booking.requested_end AND hold.ends_at>booking.requested_start
    AND (hold.status='CONFIRMED' OR hold.expires_at>p_occurred_at);
  IF active_count>=capacity THEN RAISE EXCEPTION 'The requested provider slot is no longer available'; END IF;
  submitted_job:=jsonb_populate_record(NULL::public.jobs,public.tl_snake_keys(p_job_record)->'job');
  IF submitted_job.id IS NULL OR submitted_job.provider_id<>p_provider_id THEN RAISE EXCEPTION 'Converted transaction must belong to the booking provider'; END IF;
  PERFORM public.tl_commit_job(p_job_record,NULL);
  SELECT slot_hold_ttl INTO hold_ttl FROM public.marketplace_settings WHERE singleton;
  INSERT INTO public.booking_slot_holds(booking_id,provider_id,starts_at,ends_at,status,expires_at,created_at,updated_at)
  VALUES (booking.id,booking.provider_id,booking.requested_start,booking.requested_end,'ACTIVE',p_occurred_at+hold_ttl,p_occurred_at,p_occurred_at);
  UPDATE public.booking_requests SET status='TERMS_SENT',version=version+1,linked_job_id=submitted_job.id,
    hold_expires_at=p_occurred_at+hold_ttl,updated_at=p_occurred_at
  WHERE id=booking.id RETURNING * INTO booking;
  PERFORM private.tl_append_booking_event(booking.id,p_provider_id::text,'PROVIDER','TERMS_SENT',p_occurred_at,p_request_id,p_command_hash,p_expected_version,jsonb_build_object('job_id',submitted_job.id));
  PERFORM private.tl_append_booking_event(booking.id,'system','SYSTEM','SLOT_HOLD_CREATED',p_occurred_at,NULL,NULL,NULL,jsonb_build_object('expires_at',booking.hold_expires_at));
  RETURN jsonb_build_object('booking',to_jsonb(booking),'replayed',false);
END $$;

CREATE FUNCTION public.tl_expire_bookings(p_now timestamptz) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE provider record; changed integer:=0;
BEGIN
  FOR provider IN SELECT DISTINCT provider_id FROM public.booking_requests
    WHERE (status='REQUESTED' AND expires_at<=p_now) OR (status='TERMS_SENT' AND hold_expires_at<=p_now)
  LOOP changed:=changed+private.tl_expire_provider_bookings(provider.provider_id,p_now); END LOOP;
  RETURN changed;
END $$;

CREATE FUNCTION private.tl_guard_linked_booking_acceptance() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE booking public.booking_requests%ROWTYPE; hold public.booking_slot_holds%ROWTYPE;
BEGIN
  IF NEW.status='ACCEPTED' AND OLD.status IS DISTINCT FROM 'ACCEPTED' THEN
    SELECT * INTO booking FROM public.booking_requests WHERE linked_job_id=NEW.id FOR UPDATE;
    IF FOUND THEN
      SELECT * INTO hold FROM public.booking_slot_holds WHERE booking_id=booking.id FOR UPDATE;
      IF booking.status<>'TERMS_SENT' OR hold.status<>'ACTIVE' OR hold.expires_at<=clock_timestamp() THEN
        RAISE EXCEPTION 'The linked booking hold is no longer active';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION private.tl_sync_linked_booking() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE booking public.booking_requests%ROWTYPE; occurred timestamptz:=clock_timestamp();
BEGIN
  SELECT * INTO booking FROM public.booking_requests WHERE linked_job_id=NEW.id FOR UPDATE;
  IF NOT FOUND THEN RETURN NEW; END IF;
  IF NEW.status='ACCEPTED' AND OLD.status IS DISTINCT FROM 'ACCEPTED' THEN
    UPDATE public.booking_slot_holds SET status='CONFIRMED',expires_at=NULL,updated_at=occurred
      WHERE booking_id=booking.id AND status='ACTIVE';
    UPDATE public.booking_requests SET status='CONFIRMED',version=version+1,hold_expires_at=NULL,updated_at=occurred
      WHERE id=booking.id;
    PERFORM private.tl_append_booking_event(booking.id,booking.customer_id::text,'CUSTOMER','CLIENT_ACCEPTED_TRANSACTION',occurred,NULL,NULL,NULL,jsonb_build_object('job_id',NEW.id));
    PERFORM private.tl_append_booking_event(booking.id,'system','SYSTEM','SLOT_HOLD_CONFIRMED',occurred,NULL,NULL,NULL,jsonb_build_object('job_id',NEW.id));
  ELSIF NEW.status='CANCELLED' AND OLD.status IS DISTINCT FROM 'CANCELLED' AND booking.status='TERMS_SENT' THEN
    UPDATE public.booking_requests SET status='CANCELLED',version=version+1,hold_expires_at=NULL,updated_at=occurred WHERE id=booking.id;
    PERFORM private.tl_append_booking_event(booking.id,'system','SYSTEM','TRANSACTION_CANCELLED',occurred,NULL,NULL,NULL,jsonb_build_object('job_id',NEW.id));
    PERFORM private.tl_release_booking_hold(booking.id,'RELEASED',occurred);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER guard_linked_booking_acceptance BEFORE UPDATE OF status ON public.jobs
FOR EACH ROW EXECUTE FUNCTION private.tl_guard_linked_booking_acceptance();
CREATE TRIGGER sync_linked_booking AFTER UPDATE OF status ON public.jobs
FOR EACH ROW EXECUTE FUNCTION private.tl_sync_linked_booking();

ALTER TABLE public.reference_data_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reference_data_releases FORCE ROW LEVEL SECURITY;
ALTER TABLE public.nigeria_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nigeria_states FORCE ROW LEVEL SECURITY;
ALTER TABLE public.nigeria_lgas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nigeria_lgas FORCE ROW LEVEL SECURITY;
ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_categories FORCE ROW LEVEL SECURITY;
ALTER TABLE public.service_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_definitions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.provider_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_services FORCE ROW LEVEL SECURITY;
ALTER TABLE public.provider_service_durations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_service_durations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.provider_service_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_service_areas FORCE ROW LEVEL SECURITY;
ALTER TABLE public.provider_availability_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_availability_rules FORCE ROW LEVEL SECURITY;
ALTER TABLE public.provider_unavailability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_unavailability FORCE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_settings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.booking_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE public.booking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.booking_slot_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_slot_holds FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  public.reference_data_releases,public.nigeria_states,public.nigeria_lgas,
  public.service_categories,public.service_definitions,public.provider_services,
  public.provider_service_durations,public.provider_service_areas,public.provider_availability_rules,
  public.provider_unavailability,public.marketplace_settings,public.booking_requests,
  public.booking_events,public.booking_slot_holds
FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON TABLE
  public.reference_data_releases,public.nigeria_states,public.nigeria_lgas,
  public.service_categories,public.service_definitions,public.provider_services,
  public.provider_service_durations,public.provider_service_areas,public.provider_availability_rules,
  public.provider_unavailability,public.marketplace_settings,public.booking_requests,
  public.booking_events,public.booking_slot_holds
TO service_role;

REVOKE ALL ON FUNCTION
  private.tl_append_booking_event(uuid,text,text,text,timestamptz,uuid,text,integer,jsonb),
  private.tl_release_booking_hold(uuid,text,timestamptz),
  private.tl_expire_provider_bookings(uuid,timestamptz),
  private.tl_reject_booking_event_mutation(),
  private.tl_guard_linked_booking_acceptance(),
  private.tl_sync_linked_booking()
FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION
  public.tl_create_booking(jsonb,uuid,uuid,text),
  public.tl_read_booking(uuid,uuid,text),
  public.tl_list_bookings(uuid,text),
  public.tl_transition_booking(uuid,uuid,text,text,integer,uuid,text,timestamptz),
  public.tl_convert_booking(uuid,uuid,integer,uuid,text,jsonb,timestamptz),
  public.tl_expire_bookings(timestamptz)
FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION
  public.tl_create_booking(jsonb,uuid,uuid,text),
  public.tl_read_booking(uuid,uuid,text),
  public.tl_list_bookings(uuid,text),
  public.tl_transition_booking(uuid,uuid,text,text,integer,uuid,text,timestamptz),
  public.tl_convert_booking(uuid,uuid,integer,uuid,text,jsonb,timestamptz),
  public.tl_expire_bookings(timestamptz)
TO service_role;

COMMENT ON TABLE public.booking_requests IS 'Private proposed-work records; confirmed work state is derived from the linked canonical transaction.';
COMMENT ON TABLE public.booking_events IS 'Append-only booking lifecycle ledger with versioned idempotent command provenance.';
COMMENT ON TABLE public.booking_slot_holds IS 'Expiring capacity reservations created only while final transaction terms await customer acceptance.';
COMMENT ON FUNCTION public.tl_convert_booking(uuid,uuid,integer,uuid,text,jsonb,timestamptz) IS
  'Atomically creates the canonical transaction, booking TERMS_SENT transition, ledger events, and expiring provider slot hold.';

COMMIT;
