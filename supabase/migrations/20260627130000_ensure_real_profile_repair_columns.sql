-- Defensive repair prerequisites for real profile admin actions.
-- These are metadata/system fields only; this does not add photos, dating
-- details, activity, or Discover opt-ins.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS failed_login_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS account_locked_until timestamptz,
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_demo_profile boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_discoverable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_complete boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS discovery_blocked_reason text,
  ADD COLUMN IF NOT EXISTS safety_agreement_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS suspicious_signup_reason text;

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
