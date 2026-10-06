-- Phase 5 provider marketplace setup.
-- Direct table mutations remain denied. These owner-scoped RPCs validate and
-- persist service configuration atomically through the server-only role.
BEGIN;

CREATE OR REPLACE FUNCTION public.tl_upsert_provider_service(
  p_provider_id uuid,
  p_service_id uuid,
  p_input jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  service public.provider_services%ROWTYPE;
  service_id uuid:=coalesce(p_service_id,public.uuid_generate_v4());
  input_definition_id uuid:=(p_input->>'serviceDefinitionId')::uuid;
  input_category_id uuid:=(p_input->>'categoryId')::uuid;
  title text:=btrim(coalesce(p_input->>'publicTitle',''));
  description_text text:=btrim(coalesce(p_input->>'description',''));
  pricing text:=coalesce(p_input->>'pricingModel','');
  minimum_price numeric:=nullif(p_input->>'priceMin','')::numeric;
  maximum_price numeric:=nullif(p_input->>'priceMax','')::numeric;
  remote_supported boolean:=coalesce((p_input->>'supportsRemote')::boolean,false);
  onsite_supported boolean:=coalesce((p_input->>'supportsOnsite')::boolean,false);
  next_status text:=coalesce(p_input->>'status','DRAFT');
  durations jsonb:=coalesce(p_input->'durationMinutes','[]'::jsonb);
  areas jsonb:=coalesce(p_input->'areas','[]'::jsonb);
  item jsonb;
  duration_value integer;
  remote_area boolean;
  state_value text;
  lga_value text;
  origin_value text;
  radius_value numeric;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.provider_profiles WHERE user_id=p_provider_id) THEN
    RAISE EXCEPTION 'Provider profile not found';
  END IF;
  IF p_service_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.provider_services WHERE id=p_service_id AND provider_id=p_provider_id
  ) THEN RAISE EXCEPTION 'Provider service not found or not owned by this provider'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.service_definitions definition
    JOIN public.service_categories category ON category.id=definition.category_id
    WHERE definition.id=input_definition_id AND definition.category_id=input_category_id
      AND definition.active AND definition.moderation_status='APPROVED' AND category.active
  ) THEN RAISE EXCEPTION 'Choose an approved service in the selected category'; END IF;
  IF title='' OR char_length(title)>120 OR description_text='' OR char_length(description_text)>2000 THEN
    RAISE EXCEPTION 'Invalid service title or description';
  END IF;
  IF pricing NOT IN ('FIXED','STARTING_AT','HOURLY','DAILY','QUOTE_REQUIRED') THEN
    RAISE EXCEPTION 'Invalid pricing model';
  END IF;
  IF next_status NOT IN ('DRAFT','PUBLISHED') OR NOT (remote_supported OR onsite_supported) THEN
    RAISE EXCEPTION 'Choose a delivery mode and valid service status';
  END IF;
  IF (pricing='QUOTE_REQUIRED' AND (minimum_price IS NOT NULL OR maximum_price IS NOT NULL)) OR
     (pricing='FIXED' AND (minimum_price IS NULL OR minimum_price<=0 OR (maximum_price IS NOT NULL AND maximum_price<>minimum_price))) OR
     (pricing IN ('STARTING_AT','HOURLY','DAILY') AND (minimum_price IS NULL OR minimum_price<=0 OR (maximum_price IS NOT NULL AND maximum_price<minimum_price))) THEN
    RAISE EXCEPTION 'Prices do not match the selected pricing model';
  END IF;
  IF jsonb_typeof(durations)<>'array' OR jsonb_array_length(durations)=0 OR jsonb_array_length(durations)>20 THEN
    RAISE EXCEPTION 'Add between one and twenty service durations';
  END IF;
  IF jsonb_typeof(areas)<>'array' OR jsonb_array_length(areas)=0 OR jsonb_array_length(areas)>20 THEN
    RAISE EXCEPTION 'Add between one and twenty service areas';
  END IF;

  IF p_service_id IS NULL THEN
    INSERT INTO public.provider_services(
      id,provider_id,service_definition_id,public_title,description,pricing_model,
      price_min,price_max,currency,supports_remote,supports_onsite,status,published_at
    ) VALUES (
      service_id,p_provider_id,input_definition_id,title,description_text,pricing,
      minimum_price,maximum_price,'NGN',remote_supported,onsite_supported,next_status,
      CASE WHEN next_status='PUBLISHED' THEN now() ELSE NULL END
    ) RETURNING * INTO service;
  ELSE
    UPDATE public.provider_services SET
      service_definition_id=input_definition_id,public_title=title,description=description_text,
      pricing_model=pricing,price_min=minimum_price,price_max=maximum_price,
      supports_remote=remote_supported,supports_onsite=onsite_supported,status=next_status,
      published_at=CASE WHEN next_status='PUBLISHED' THEN coalesce(published_at,now()) ELSE NULL END,
      updated_at=now()
    WHERE id=service_id AND provider_id=p_provider_id RETURNING * INTO service;
    DELETE FROM public.provider_service_durations WHERE provider_service_id=service_id;
    DELETE FROM public.provider_service_areas WHERE provider_service_id=service_id AND provider_id=p_provider_id;
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(durations)
  LOOP
    duration_value:=(item#>>'{}')::integer;
    IF duration_value<15 OR duration_value>10080 OR EXISTS (
      SELECT 1 FROM public.provider_service_durations
      WHERE provider_service_id=service_id AND duration_minutes=duration_value
    ) THEN RAISE EXCEPTION 'Service durations must be unique and between 15 and 10080 minutes'; END IF;
    INSERT INTO public.provider_service_durations(provider_service_id,duration_minutes,sort_order)
    VALUES(service_id,duration_value,(SELECT count(*) FROM public.provider_service_durations WHERE provider_service_id=service_id));
  END LOOP;

  FOR item IN SELECT value FROM jsonb_array_elements(areas)
  LOOP
    remote_area:=coalesce((item->>'remoteService')::boolean,false);
    state_value:=nullif(btrim(coalesce(item->>'stateCode','')),'');
    lga_value:=nullif(btrim(coalesce(item->>'lgaCode','')),'');
    origin_value:=nullif(btrim(coalesce(item->>'approximateOrigin','')),'');
    radius_value:=nullif(item->>'radiusKm','')::numeric;
    IF remote_area THEN
      IF NOT remote_supported OR state_value IS NOT NULL OR lga_value IS NOT NULL OR origin_value IS NOT NULL OR radius_value IS NOT NULL THEN
        RAISE EXCEPTION 'Remote service areas cannot contain a physical location';
      END IF;
      IF EXISTS (SELECT 1 FROM public.provider_service_areas WHERE provider_service_id=service_id AND remote_service) THEN
        RAISE EXCEPTION 'A service can contain only one remote area';
      END IF;
    ELSE
      IF NOT onsite_supported OR state_value IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.nigeria_states WHERE code=state_value AND active
      ) THEN RAISE EXCEPTION 'Choose an active state for on-site service'; END IF;
      IF lga_value IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.nigeria_lgas WHERE code=lga_value AND state_code=state_value AND active
      ) THEN RAISE EXCEPTION 'The selected LGA does not belong to the selected state'; END IF;
      IF origin_value IS NOT NULL AND char_length(origin_value)>160 THEN RAISE EXCEPTION 'Approximate origin is too long'; END IF;
      IF radius_value IS NOT NULL AND (origin_value IS NULL OR radius_value<=0 OR radius_value>1000) THEN
        RAISE EXCEPTION 'A radius requires an approximate origin and must be between 1 and 1000 km';
      END IF;
      IF EXISTS (
        SELECT 1 FROM public.provider_service_areas
        WHERE provider_service_id=service_id AND NOT remote_service
          AND state_code=state_value AND lga_code IS NOT DISTINCT FROM lga_value
      ) THEN RAISE EXCEPTION 'Duplicate service area'; END IF;
    END IF;
    INSERT INTO public.provider_service_areas(
      provider_id,provider_service_id,state_code,lga_code,remote_service,approximate_origin,radius_km
    ) VALUES (
      p_provider_id,service_id,state_value,lga_value,remote_area,origin_value,radius_value
    );
  END LOOP;

  IF remote_supported AND NOT EXISTS (
    SELECT 1 FROM public.provider_service_areas WHERE provider_service_id=service_id AND remote_service
  ) THEN RAISE EXCEPTION 'Remote delivery requires a remote service area'; END IF;
  IF onsite_supported AND NOT EXISTS (
    SELECT 1 FROM public.provider_service_areas WHERE provider_service_id=service_id AND NOT remote_service
  ) THEN RAISE EXCEPTION 'On-site delivery requires a physical service area'; END IF;

  RETURN to_jsonb(service);
END $$;

CREATE OR REPLACE FUNCTION public.tl_archive_provider_service(p_provider_id uuid,p_service_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE service public.provider_services%ROWTYPE;
BEGIN
  UPDATE public.provider_services SET status='ARCHIVED',published_at=NULL,updated_at=now()
  WHERE id=p_service_id AND provider_id=p_provider_id RETURNING * INTO service;
  IF NOT FOUND THEN RAISE EXCEPTION 'Provider service not found or not owned by this provider'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.provider_services WHERE provider_id=p_provider_id AND status='PUBLISHED') THEN
    UPDATE public.provider_profiles SET marketplace_status='DRAFT',published_at=NULL,remote_services=false,updated_at=now()
    WHERE user_id=p_provider_id AND marketplace_status='PUBLISHED';
  END IF;
  RETURN to_jsonb(service);
END $$;

CREATE OR REPLACE FUNCTION public.tl_replace_provider_availability(p_provider_id uuid,p_rules jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  item jsonb;
  day_value integer;
  start_value time;
  end_value time;
  service_value uuid;
  from_value date;
  to_value date;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.provider_profiles WHERE user_id=p_provider_id) THEN RAISE EXCEPTION 'Provider profile not found'; END IF;
  IF jsonb_typeof(p_rules)<>'array' OR jsonb_array_length(p_rules)>50 THEN RAISE EXCEPTION 'Invalid availability rules'; END IF;
  DELETE FROM public.provider_availability_rules WHERE provider_id=p_provider_id;
  FOR item IN SELECT value FROM jsonb_array_elements(p_rules)
  LOOP
    day_value:=(item->>'dayOfWeek')::integer;
    start_value:=(item->>'localStart')::time;
    end_value:=(item->>'localEnd')::time;
    service_value:=nullif(item->>'providerServiceId','')::uuid;
    from_value:=nullif(item->>'effectiveFrom','')::date;
    to_value:=nullif(item->>'effectiveTo','')::date;
    IF day_value<0 OR day_value>6 OR end_value<=start_value OR (to_value IS NOT NULL AND from_value IS NOT NULL AND to_value<from_value) THEN
      RAISE EXCEPTION 'Invalid availability period';
    END IF;
    IF service_value IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.provider_services WHERE id=service_value AND provider_id=p_provider_id AND status<>'ARCHIVED'
    ) THEN RAISE EXCEPTION 'Availability service is not owned by this provider'; END IF;
    IF EXISTS (
      SELECT 1 FROM public.provider_availability_rules rule
      WHERE rule.provider_id=p_provider_id AND rule.day_of_week=day_value
        AND rule.provider_service_id IS NOT DISTINCT FROM service_value
        AND rule.local_start<end_value AND rule.local_end>start_value
        AND coalesce(rule.effective_from,'-infinity'::date)<=coalesce(to_value,'infinity'::date)
        AND coalesce(from_value,'-infinity'::date)<=coalesce(rule.effective_to,'infinity'::date)
    ) THEN RAISE EXCEPTION 'Availability periods cannot overlap'; END IF;
    INSERT INTO public.provider_availability_rules(
      provider_id,provider_service_id,day_of_week,local_start,local_end,timezone,effective_from,effective_to
    ) VALUES(p_provider_id,service_value,day_value,start_value,end_value,'Africa/Lagos',from_value,to_value);
  END LOOP;
  RETURN coalesce((SELECT jsonb_agg(to_jsonb(rule) ORDER BY day_of_week,local_start)
    FROM public.provider_availability_rules rule WHERE provider_id=p_provider_id),'[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.tl_add_provider_blackout(p_provider_id uuid,p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  start_value timestamptz:=(p_input->>'startsAt')::timestamptz;
  end_value timestamptz:=(p_input->>'endsAt')::timestamptz;
  reason_value text:=nullif(btrim(coalesce(p_input->>'reason','')),'');
  blackout public.provider_unavailability%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.provider_profiles WHERE user_id=p_provider_id) THEN RAISE EXCEPTION 'Provider profile not found'; END IF;
  IF end_value<=start_value OR char_length(coalesce(reason_value,''))>500 THEN RAISE EXCEPTION 'Invalid blackout period'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.provider_unavailability
    WHERE provider_id=p_provider_id AND starts_at<end_value AND ends_at>start_value
  ) THEN RAISE EXCEPTION 'Blackout periods cannot overlap'; END IF;
  INSERT INTO public.provider_unavailability(provider_id,starts_at,ends_at,reason,source)
  VALUES(p_provider_id,start_value,end_value,reason_value,'MANUAL') RETURNING * INTO blackout;
  RETURN to_jsonb(blackout);
END $$;

CREATE OR REPLACE FUNCTION public.tl_delete_provider_blackout(p_provider_id uuid,p_blackout_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  DELETE FROM public.provider_unavailability
  WHERE id=p_blackout_id AND provider_id=p_provider_id AND source='MANUAL';
  IF NOT FOUND THEN RAISE EXCEPTION 'Manual blackout not found or not owned by this provider'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.tl_set_provider_publication(p_provider_id uuid,p_publish boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE provider public.provider_profiles%ROWTYPE;
BEGIN
  SELECT * INTO provider FROM public.provider_profiles WHERE user_id=p_provider_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Provider profile not found'; END IF;
  IF p_publish THEN
    IF provider.moderation_status IN ('REJECTED','SUSPENDED') THEN RAISE EXCEPTION 'This provider profile cannot be published'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.provider_services WHERE provider_id=p_provider_id AND status='PUBLISHED') THEN
      RAISE EXCEPTION 'Publish at least one complete service first';
    END IF;
    UPDATE public.provider_profiles SET
      marketplace_status='PUBLISHED',moderation_status='APPROVED',published_at=coalesce(published_at,now()),
      remote_services=EXISTS(SELECT 1 FROM public.provider_services WHERE provider_id=p_provider_id AND status='PUBLISHED' AND supports_remote),
      updated_at=now()
    WHERE user_id=p_provider_id RETURNING * INTO provider;
  ELSE
    UPDATE public.provider_profiles SET marketplace_status='DRAFT',published_at=NULL,remote_services=false,updated_at=now()
    WHERE user_id=p_provider_id RETURNING * INTO provider;
  END IF;
  RETURN to_jsonb(provider);
END $$;

DROP VIEW IF EXISTS public.public_marketplace_services;
CREATE VIEW public.public_marketplace_services WITH (security_invoker=true) AS
SELECT
  service.id AS service_id,
  profile.username AS provider_username,
  coalesce(provider.business_name,profile.display_name) AS provider_name,
  provider.headline AS provider_headline,
  provider.bio AS provider_bio,
  definition.slug AS service_slug,
  definition.name AS service_name,
  category.slug AS category_slug,
  category.name AS category_name,
  service.public_title,
  service.description,
  service.pricing_model,
  service.price_min,
  service.price_max,
  service.currency,
  service.supports_remote,
  service.supports_onsite,
  coalesce((SELECT jsonb_agg(jsonb_build_object(
    'durationMinutes',duration.duration_minutes,'label',duration.label
  ) ORDER BY duration.sort_order,duration.duration_minutes)
    FROM public.provider_service_durations duration WHERE duration.provider_service_id=service.id),'[]'::jsonb) AS durations,
  coalesce((SELECT jsonb_agg(jsonb_build_object(
    'remoteService',area.remote_service,
    'stateCode',area.state_code,'stateName',state.name,
    'lgaCode',area.lga_code,'lgaName',lga.name,
    'approximateOrigin',area.approximate_origin,'radiusKm',area.radius_km
  ) ORDER BY area.remote_service DESC,state.name,lga.name)
    FROM public.provider_service_areas area
    LEFT JOIN public.nigeria_states state ON state.code=area.state_code
    LEFT JOIN public.nigeria_lgas lga ON lga.code=area.lga_code
    WHERE area.provider_service_id=service.id),'[]'::jsonb) AS service_areas,
  coalesce((SELECT jsonb_agg(jsonb_build_object(
    'dayOfWeek',rule.day_of_week,'localStart',rule.local_start,
    'localEnd',rule.local_end,'timezone',rule.timezone,
    'effectiveFrom',rule.effective_from,'effectiveTo',rule.effective_to
  ) ORDER BY rule.day_of_week,rule.local_start)
    FROM public.provider_availability_rules rule
    WHERE rule.provider_id=provider.user_id AND (rule.provider_service_id IS NULL OR rule.provider_service_id=service.id)),'[]'::jsonb) AS availability
FROM public.provider_services service
JOIN public.provider_profiles provider ON provider.user_id=service.provider_id
JOIN public.profiles profile ON profile.user_id=provider.user_id
JOIN public.service_definitions definition ON definition.id=service.service_definition_id
JOIN public.service_categories category ON category.id=definition.category_id
WHERE provider.marketplace_status='PUBLISHED' AND provider.moderation_status='APPROVED'
  AND service.status='PUBLISHED' AND definition.active AND definition.moderation_status='APPROVED' AND category.active;

REVOKE ALL ON FUNCTION
  public.tl_upsert_provider_service(uuid,uuid,jsonb),
  public.tl_archive_provider_service(uuid,uuid),
  public.tl_replace_provider_availability(uuid,jsonb),
  public.tl_add_provider_blackout(uuid,jsonb),
  public.tl_delete_provider_blackout(uuid,uuid),
  public.tl_set_provider_publication(uuid,boolean)
FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION
  public.tl_upsert_provider_service(uuid,uuid,jsonb),
  public.tl_archive_provider_service(uuid,uuid),
  public.tl_replace_provider_availability(uuid,jsonb),
  public.tl_add_provider_blackout(uuid,jsonb),
  public.tl_delete_provider_blackout(uuid,uuid),
  public.tl_set_provider_publication(uuid,boolean)
TO service_role;
REVOKE ALL ON public.public_marketplace_services FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.public_marketplace_services TO service_role;

COMMENT ON VIEW public.public_marketplace_services IS
  'Discoverable provider-service projection. Excludes unpublished rows, blackout reasons, account email, private addresses, and precise coordinates.';

COMMIT;
