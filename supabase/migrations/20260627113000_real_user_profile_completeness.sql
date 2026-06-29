-- Real user profile completeness repair.
-- This migration keeps real auth users out of Discover until required profile
-- fields are present and the profile is explicitly marked discoverable.

ALTER TABLE public.profiles
  ALTER COLUMN is_discoverable SET DEFAULT false;

CREATE OR REPLACE FUNCTION public.profile_required_fields_complete(_profile public.profiles)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    _profile.display_name IS NOT NULL
    AND length(btrim(_profile.display_name)) >= 2
    AND _profile.birth_date IS NOT NULL
    AND _profile.birth_date <= (current_date - interval '18 years')
    AND _profile.gender IS NOT NULL
    AND COALESCE(array_length(_profile.interested_in, 1), 0) > 0
    AND _profile.relationship_goal IS NOT NULL
    AND _profile.location_city IS NOT NULL
    AND _profile.location_country IS NOT NULL
    AND _profile.safety_agreement_accepted_at IS NOT NULL
    AND _profile.terms_accepted_at IS NOT NULL
    AND _profile.privacy_accepted_at IS NOT NULL
$$;

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
  IF _profile.relationship_goal IS NULL THEN RETURN 'Relationship goal is missing'; END IF;
  IF _profile.location_city IS NULL OR _profile.location_country IS NULL THEN RETURN 'City and country are required'; END IF;
  IF _profile.safety_agreement_accepted_at IS NULL THEN RETURN 'Safety agreement is required'; END IF;
  IF _profile.terms_accepted_at IS NULL OR _profile.privacy_accepted_at IS NULL THEN RETURN 'Terms and privacy acceptance are required'; END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.profile_is_discoverable(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    p.is_demo_profile IS NOT TRUE
    AND p.is_active IS TRUE
    AND p.is_discoverable IS TRUE
    AND p.incognito IS FALSE
    AND p.discovery_blocked_reason IS NULL
    AND public.profile_discovery_block_reason(p) IS NULL
  FROM public.profiles p
  WHERE p.id = _user_id
$$;

REVOKE EXECUTE ON FUNCTION public.profile_is_discoverable(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.profile_is_discoverable(uuid) TO authenticated, service_role;

INSERT INTO public.profiles (
  id,
  display_name,
  email_verified,
  is_demo_profile,
  is_discoverable,
  onboarding_complete,
  discovery_blocked_reason,
  created_at,
  last_active
)
SELECT
  au.id,
  NULLIF(
    left(
      btrim(
        COALESCE(
          au.raw_user_meta_data->>'display_name',
          au.raw_user_meta_data->>'full_name',
          au.raw_user_meta_data->>'name',
          ''
        )
      ),
      80
    ),
    ''
  ),
  au.email_confirmed_at IS NOT NULL,
  false,
  false,
  false,
  'Onboarding is incomplete',
  au.created_at,
  au.created_at
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

UPDATE public.profiles p
SET
  is_demo_profile = false,
  is_discoverable = CASE
    WHEN public.profile_required_fields_complete(p)
      AND p.suspicious_signup_reason IS NULL
      AND p.incognito IS FALSE
    THEN p.is_discoverable
    ELSE false
  END,
  onboarding_complete = public.profile_required_fields_complete(p),
  discovery_blocked_reason = CASE
    WHEN public.profile_required_fields_complete(p) THEN p.suspicious_signup_reason
    ELSE public.profile_discovery_block_reason(p)
  END,
  updated_at = now()
WHERE EXISTS (
  SELECT 1
  FROM auth.users au
  WHERE au.id = p.id
);
