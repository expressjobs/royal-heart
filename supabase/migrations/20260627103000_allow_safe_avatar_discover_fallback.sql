-- Allow safe default avatars to cover otherwise-complete profiles without photos.

CREATE OR REPLACE FUNCTION public.profile_discovery_block_reason(_profile public.profiles)
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  IF _profile.suspicious_signup_reason IS NOT NULL THEN RETURN 'Suspicious registration needs review'; END IF;
  IF _profile.onboarding_complete IS NOT TRUE THEN RETURN 'Onboarding is incomplete'; END IF;
  IF _profile.birth_date IS NULL THEN RETURN 'Date of birth is missing'; END IF;
  IF _profile.birth_date > (current_date - interval '18 years') THEN RETURN 'Member is under 18'; END IF;
  IF _profile.gender IS NULL THEN RETURN 'Gender is missing'; END IF;
  IF COALESCE(array_length(_profile.interested_in, 1), 0) = 0 THEN RETURN 'Dating preference is missing'; END IF;
  IF _profile.location_city IS NULL OR _profile.location_country IS NULL THEN RETURN 'City and country are required'; END IF;
  IF _profile.safety_agreement_accepted_at IS NULL THEN RETURN 'Safety agreement is required'; END IF;
  IF _profile.terms_accepted_at IS NULL OR _profile.privacy_accepted_at IS NULL THEN RETURN 'Terms and privacy acceptance are required'; END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.demo_profile_is_discoverable(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    p.is_demo_profile IS TRUE
    AND public.demo_profiles_visible()
    AND p.is_active IS TRUE
    AND COALESCE(p.is_discoverable, true) IS TRUE
    AND p.onboarding_complete IS TRUE
    AND p.incognito IS FALSE
    AND p.discovery_blocked_reason IS NULL
    AND p.birth_date IS NOT NULL
    AND p.birth_date <= (current_date - interval '18 years')
    AND p.gender IS NOT NULL
    AND COALESCE(array_length(p.interested_in, 1), 0) > 0
    AND p.location_country IS NOT NULL
    AND p.location_city IS NOT NULL
    AND (
      p.demo_batch_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.demo_generation_batches b
        WHERE b.id = p.demo_batch_id
          AND b.status IN ('completed', 'completed_with_warnings')
          AND b.created_count > 0
          AND b.visible_count > 0
          AND b.hidden_count < b.created_count
      )
    )
  FROM public.profiles p
  WHERE p.id = _user_id
$$;

REVOKE EXECUTE ON FUNCTION public.demo_profile_is_discoverable(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.demo_profile_is_discoverable(uuid) TO authenticated, service_role;

UPDATE public.profiles p
SET discovery_blocked_reason = public.profile_discovery_block_reason(p),
    updated_at = now()
WHERE p.discovery_blocked_reason = 'At least one profile photo is required';
