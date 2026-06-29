-- Keep real-user repair conservative:
-- - every auth user can have a real profile row
-- - missing dating fields keep profiles out of Discover
-- - repair never fabricates details or opts members into Discover

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
  IF public.profile_required_fields_complete(_profile) IS NOT TRUE THEN RETURN 'Missing required dating fields'; END IF;
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
    p.is_demo_profile IS FALSE
    AND p.is_active IS TRUE
    AND p.is_discoverable IS TRUE
    AND p.incognito IS FALSE
    AND p.discovery_blocked_reason IS NULL
    AND public.profile_required_fields_complete(p) IS TRUE
    AND p.suspicious_signup_reason IS NULL
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
    WHEN p.is_discoverable IS TRUE
      AND public.profile_required_fields_complete(p)
      AND p.suspicious_signup_reason IS NULL
      AND p.incognito IS FALSE
      AND p.is_active IS TRUE
    THEN true
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
