-- Phase 6 public provider discovery and private, consented nearby matching.
BEGIN;

ALTER TABLE public.provider_service_areas
  ADD COLUMN origin_latitude numeric(8,5),
  ADD COLUMN origin_longitude numeric(8,5),
  ADD COLUMN origin_consented_at timestamptz,
  ADD CONSTRAINT provider_service_area_private_origin CHECK (
    (origin_latitude IS NULL AND origin_longitude IS NULL AND origin_consented_at IS NULL) OR
    (NOT remote_service AND origin_latitude BETWEEN -90 AND 90 AND origin_longitude BETWEEN -180 AND 180
      AND origin_consented_at IS NOT NULL AND approximate_origin IS NOT NULL AND radius_km IS NOT NULL)
  );

CREATE INDEX provider_service_areas_private_origin_idx
  ON public.provider_service_areas(provider_service_id)
  WHERE origin_latitude IS NOT NULL AND origin_longitude IS NOT NULL;

CREATE OR REPLACE FUNCTION public.tl_set_provider_service_origin(
  p_provider_id uuid,
  p_service_id uuid,
  p_latitude numeric,
  p_longitude numeric
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE changed integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.provider_services
    WHERE id=p_service_id AND provider_id=p_provider_id AND status<>'ARCHIVED'
  ) THEN RAISE EXCEPTION 'Provider service not found or not owned by this provider'; END IF;
  IF (p_latitude IS NULL) <> (p_longitude IS NULL) OR
     p_latitude IS NOT NULL AND (p_latitude NOT BETWEEN -90 AND 90 OR p_longitude NOT BETWEEN -180 AND 180) THEN
    RAISE EXCEPTION 'Invalid nearby-search origin';
  END IF;
  IF p_latitude IS NULL THEN
    UPDATE public.provider_service_areas SET origin_latitude=NULL,origin_longitude=NULL,origin_consented_at=NULL
    WHERE provider_id=p_provider_id AND provider_service_id=p_service_id AND NOT remote_service;
    GET DIAGNOSTICS changed=ROW_COUNT;
  ELSE
    UPDATE public.provider_service_areas SET origin_latitude=p_latitude,origin_longitude=p_longitude,origin_consented_at=now()
    WHERE provider_id=p_provider_id AND provider_service_id=p_service_id AND NOT remote_service
      AND approximate_origin IS NOT NULL AND radius_km IS NOT NULL;
    GET DIAGNOSTICS changed=ROW_COUNT;
    IF changed=0 THEN RAISE EXCEPTION 'Add a broad origin and travel radius before enabling nearby matching'; END IF;
  END IF;
  RETURN jsonb_build_object('enabled',p_latitude IS NOT NULL,'areasUpdated',changed);
END $$;

CREATE OR REPLACE FUNCTION public.tl_search_marketplace_services(p_input jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  query_value text:=lower(btrim(coalesce(p_input->>'q','')));
  category_value text:=nullif(btrim(coalesce(p_input->>'category','')),'');
  state_value text:=nullif(btrim(coalesce(p_input->>'state','')),'');
  lga_value text:=nullif(btrim(coalesce(p_input->>'lga','')),'');
  remote_value boolean:=coalesce((p_input->>'remote')::boolean,false);
  date_value date:=nullif(p_input->>'date','')::date;
  sort_value text:=coalesce(p_input->>'sort','best');
  page_value integer:=coalesce((p_input->>'page')::integer,1);
  size_value integer:=coalesce((p_input->>'pageSize')::integer,12);
  latitude_value double precision:=nullif(p_input->>'latitude','')::double precision;
  longitude_value double precision:=nullif(p_input->>'longitude','')::double precision;
  radius_value integer:=nullif(p_input->>'radiusKm','')::integer;
  output jsonb;
BEGIN
  IF char_length(query_value)>100 OR category_value IS NOT NULL AND category_value!~'^[a-z0-9]+(-[a-z0-9]+)*$' OR
     state_value IS NOT NULL AND state_value!~'^NG[0-9]{3}$' OR lga_value IS NOT NULL AND lga_value!~'^NG[0-9]{6}$' OR
     sort_value NOT IN ('best','nearest','completed','rating') OR page_value<1 OR page_value>10000 OR size_value<1 OR size_value>50 OR
     (latitude_value IS NULL)<>(longitude_value IS NULL) OR
     latitude_value IS NOT NULL AND (latitude_value NOT BETWEEN -90 AND 90 OR longitude_value NOT BETWEEN -180 AND 180 OR radius_value NOT IN (5,10,25,50)) OR
     sort_value='nearest' AND latitude_value IS NULL THEN
    RAISE EXCEPTION 'Invalid provider search filters';
  END IF;
  IF lga_value IS NOT NULL AND (state_value IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.nigeria_lgas WHERE code=lga_value AND state_code=state_value AND active
  )) THEN RAISE EXCEPTION 'The selected LGA does not belong to the selected state'; END IF;

  WITH provider_metrics AS (
    SELECT job.provider_id,
      count(DISTINCT job.id) FILTER (WHERE job.status='COMPLETED')::integer AS completed_count,
      count(review.id) FILTER (WHERE job.status='COMPLETED')::integer AS review_count,
      avg(review.rating) FILTER (WHERE job.status='COMPLETED') AS average_rating
    FROM public.jobs job
    LEFT JOIN public.reviews review ON review.job_id=job.id
    GROUP BY job.provider_id
  ), candidates AS (
    SELECT
      service.id AS service_id,profile.username AS provider_username,
      coalesce(provider.business_name,profile.display_name) AS provider_name,
      provider.headline AS provider_headline,provider.bio AS provider_bio,
      definition.slug AS service_slug,definition.name AS service_name,
      category.slug AS category_slug,category.name AS category_name,
      service.public_title,service.description,service.pricing_model,service.price_min,service.price_max,
      service.currency,service.supports_remote,service.supports_onsite,
      coalesce(metrics.completed_count,0) AS completed_transactions,
      coalesce(metrics.review_count,0) AS review_count,
      CASE WHEN coalesce(metrics.review_count,0)>0 THEN round(metrics.average_rating,1) END AS average_rating,
      CASE WHEN latitude_value IS NOT NULL THEN round(geo.distance_km::numeric,1) END AS distance_km,
      CASE
        WHEN query_value='' THEN 0
        WHEN lower(service.public_title)=query_value OR lower(definition.name)=query_value THEN 100
        WHEN lower(service.public_title||' '||definition.name||' '||category.name||' '||array_to_string(definition.approved_aliases,' ')) LIKE '%'||query_value||'%' THEN 60
        WHEN lower(service.description||' '||coalesce(provider.business_name,profile.display_name)||' '||provider.headline) LIKE '%'||query_value||'%' THEN 25
        ELSE 0
      END AS match_score,
      coalesce((SELECT jsonb_agg(jsonb_build_object(
        'durationMinutes',duration.duration_minutes,'label',duration.label
      ) ORDER BY duration.sort_order,duration.duration_minutes)
        FROM public.provider_service_durations duration WHERE duration.provider_service_id=service.id),'[]'::jsonb) AS durations,
      coalesce((SELECT jsonb_agg(jsonb_build_object(
        'remoteService',area.remote_service,'stateCode',area.state_code,'stateName',state.name,
        'lgaCode',area.lga_code,'lgaName',lga.name,'approximateOrigin',area.approximate_origin,'radiusKm',area.radius_km
      ) ORDER BY area.remote_service DESC,state.name,lga.name)
        FROM public.provider_service_areas area
        LEFT JOIN public.nigeria_states state ON state.code=area.state_code
        LEFT JOIN public.nigeria_lgas lga ON lga.code=area.lga_code
        WHERE area.provider_service_id=service.id),'[]'::jsonb) AS service_areas,
      coalesce((SELECT jsonb_agg(jsonb_build_object(
        'dayOfWeek',rule.day_of_week,'localStart',rule.local_start,'localEnd',rule.local_end,
        'timezone',rule.timezone,'effectiveFrom',rule.effective_from,'effectiveTo',rule.effective_to
      ) ORDER BY rule.day_of_week,rule.local_start)
        FROM public.provider_availability_rules rule
        WHERE rule.provider_id=provider.user_id AND (rule.provider_service_id IS NULL OR rule.provider_service_id=service.id)),'[]'::jsonb) AS availability
    FROM public.provider_services service
    JOIN public.provider_profiles provider ON provider.user_id=service.provider_id
    JOIN public.profiles profile ON profile.user_id=provider.user_id
    JOIN public.service_definitions definition ON definition.id=service.service_definition_id
    JOIN public.service_categories category ON category.id=definition.category_id
    LEFT JOIN provider_metrics metrics ON metrics.provider_id=provider.user_id
    LEFT JOIN LATERAL (
      SELECT min(location.distance_km) AS distance_km FROM (
        SELECT area.radius_km,6371*2*asin(sqrt(least(1,
          power(sin(radians((area.origin_latitude::double precision-latitude_value)/2)),2)+
          cos(radians(latitude_value))*cos(radians(area.origin_latitude::double precision))*
          power(sin(radians((area.origin_longitude::double precision-longitude_value)/2)),2)
        ))) AS distance_km
        FROM public.provider_service_areas area
        WHERE area.provider_service_id=service.id AND area.origin_latitude IS NOT NULL AND area.origin_longitude IS NOT NULL
      ) location WHERE location.distance_km<=location.radius_km
    ) geo ON latitude_value IS NOT NULL
    WHERE provider.marketplace_status='PUBLISHED' AND provider.moderation_status='APPROVED'
      AND service.status='PUBLISHED' AND definition.active AND definition.moderation_status='APPROVED' AND category.active
      AND (query_value='' OR lower(service.public_title||' '||definition.name||' '||category.name||' '||array_to_string(definition.approved_aliases,' ')||' '||service.description||' '||coalesce(provider.business_name,profile.display_name)||' '||provider.headline) LIKE '%'||query_value||'%')
      AND (category_value IS NULL OR category.slug=category_value)
      AND (NOT remote_value OR service.supports_remote)
      AND (state_value IS NULL OR EXISTS (SELECT 1 FROM public.provider_service_areas area WHERE area.provider_service_id=service.id AND NOT area.remote_service AND area.state_code=state_value))
      AND (lga_value IS NULL OR EXISTS (SELECT 1 FROM public.provider_service_areas area WHERE area.provider_service_id=service.id AND NOT area.remote_service AND area.lga_code=lga_value))
      AND (date_value IS NULL OR EXISTS (
        SELECT 1 FROM public.provider_availability_rules rule
        WHERE rule.provider_id=provider.user_id AND (rule.provider_service_id IS NULL OR rule.provider_service_id=service.id)
          AND rule.day_of_week=extract(dow FROM date_value)::integer
          AND (rule.effective_from IS NULL OR rule.effective_from<=date_value)
          AND (rule.effective_to IS NULL OR rule.effective_to>=date_value)
      ) AND NOT EXISTS (
        SELECT 1 FROM public.provider_unavailability blocked
        WHERE blocked.provider_id=provider.user_id
          AND blocked.starts_at<((date_value+1)::timestamp AT TIME ZONE 'Africa/Lagos')
          AND blocked.ends_at>(date_value::timestamp AT TIME ZONE 'Africa/Lagos')
      ))
      AND (latitude_value IS NULL OR geo.distance_km<=radius_value)
  ), ordered AS (
    SELECT * FROM candidates ORDER BY
      CASE WHEN sort_value='nearest' THEN distance_km END ASC NULLS LAST,
      CASE WHEN sort_value='completed' THEN completed_transactions END DESC,
      CASE WHEN sort_value='rating' AND review_count>=3 THEN average_rating END DESC NULLS LAST,
      CASE WHEN sort_value='rating' AND review_count>=3 THEN review_count END DESC,
      CASE WHEN sort_value='best' THEN match_score END DESC,
      CASE WHEN sort_value='best' THEN completed_transactions END DESC,
      provider_name,service_id
    LIMIT size_value OFFSET (page_value-1)*size_value
  )
  SELECT jsonb_build_object(
    'total',(SELECT count(*) FROM candidates),'page',page_value,'pageSize',size_value,
    'pageCount',ceil((SELECT count(*) FROM candidates)::numeric/size_value)::integer,
    'items',coalesce((SELECT jsonb_agg(jsonb_build_object(
      'serviceId',service_id,'providerUsername',provider_username,'providerName',provider_name,
      'providerHeadline',provider_headline,'serviceSlug',service_slug,'serviceName',service_name,
      'categorySlug',category_slug,'categoryName',category_name,'publicTitle',public_title,'description',description,
      'pricingModel',pricing_model,'priceMin',price_min,'priceMax',price_max,'currency',currency,
      'supportsRemote',supports_remote,'supportsOnsite',supports_onsite,'durations',durations,
      'serviceAreas',service_areas,'availability',availability,'completedTransactions',completed_transactions,
      'averageRating',average_rating,'reviewCount',review_count,'distanceKm',distance_km,
      'availableOnRequestedDate',date_value IS NOT NULL
    )) FROM ordered),'[]'::jsonb)
  ) INTO output;
  RETURN output;
END $$;

REVOKE ALL ON FUNCTION public.tl_set_provider_service_origin(uuid,uuid,numeric,numeric),public.tl_search_marketplace_services(jsonb)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.tl_set_provider_service_origin(uuid,uuid,numeric,numeric),public.tl_search_marketplace_services(jsonb)
  TO service_role;

COMMENT ON FUNCTION public.tl_search_marketplace_services(jsonb) IS
  'Server-only published-provider search. Accepts transient visitor coordinates and returns no precise coordinates or private fields.';

COMMIT;
