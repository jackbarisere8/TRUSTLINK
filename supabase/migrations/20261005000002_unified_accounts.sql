-- Phase 4 unified accounts and provider opt-in.
-- Existing provider profiles are intentionally preserved. New Auth users receive
-- only an account profile and may enable the provider capability explicitly.
BEGIN;

CREATE OR REPLACE FUNCTION public.tl_new_auth_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.profiles(user_id,username,display_name,country)
  VALUES (
    NEW.id,
    'member-' || replace(NEW.id::text,'-',''),
    left(coalesce(nullif(btrim(NEW.raw_user_meta_data->>'display_name'),''),'TrustLink member'),120),
    'Nigeria'
  );
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.tl_update_account_profile(p_user_id uuid, p_input jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_display_name text := btrim(coalesce(p_input->>'displayName',''));
  v_country_name text := btrim(coalesce(p_input->>'country',''));
  v_state_name text := nullif(btrim(coalesce(p_input->>'state','')), '');
  v_city_name text := nullif(btrim(coalesce(p_input->>'city','')), '');
BEGIN
  IF v_display_name='' OR char_length(v_display_name)>120 OR
     v_country_name='' OR char_length(v_country_name)>80 OR
     char_length(coalesce(v_state_name,''))>100 OR char_length(coalesce(v_city_name,''))>100 THEN
    RAISE EXCEPTION 'Invalid account profile';
  END IF;

  UPDATE public.profiles
  SET display_name=v_display_name, country=v_country_name, state=v_state_name, city=v_city_name, updated_at=now()
  WHERE user_id=p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.tl_enable_provider(p_user_id uuid, p_input jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  provider_headline text := btrim(coalesce(p_input->>'headline',''));
  provider_area text := btrim(coalesce(p_input->>'serviceArea',''));
  result public.provider_profiles;
BEGIN
  IF provider_headline='' OR char_length(provider_headline)>160 OR
     provider_area='' OR char_length(provider_area)>160 THEN
    RAISE EXCEPTION 'Invalid provider profile';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id=p_user_id) THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  INSERT INTO public.provider_profiles(
    user_id, headline, service_area, verification_status,
    marketplace_status, moderation_status
  ) VALUES (
    p_user_id, provider_headline, provider_area, 'UNVERIFIED',
    'DRAFT', 'DRAFT'
  ) ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO result FROM public.provider_profiles WHERE user_id=p_user_id;
  RETURN to_jsonb(result);
END $$;

REVOKE ALL ON FUNCTION public.tl_new_auth_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tl_update_account_profile(uuid,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tl_enable_provider(uuid,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tl_update_account_profile(uuid,jsonb), public.tl_enable_provider(uuid,jsonb) TO service_role;

COMMIT;
