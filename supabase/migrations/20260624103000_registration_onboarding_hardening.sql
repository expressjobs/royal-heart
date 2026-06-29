-- Production registration and onboarding hardening.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone_country_code text,
  ADD COLUMN IF NOT EXISTS phone_number text,
  ADD COLUMN IF NOT EXISTS age_attested_at timestamptz,
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS safety_agreement_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS profile_completion_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS signup_ip_hash text,
  ADD COLUMN IF NOT EXISTS signup_user_agent text,
  ADD COLUMN IF NOT EXISTS suspicious_signup_reason text,
  ADD COLUMN IF NOT EXISTS discovery_blocked_reason text;

CREATE TABLE IF NOT EXISTS public.registration_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email_hash text,
  phone_hash text,
  ip_hash text,
  user_agent text,
  event_type text NOT NULL CHECK (
    event_type IN ('signup_attempt', 'signup_blocked', 'signup_created', 'login_attempt', 'password_reset_request')
  ),
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.registration_audit TO authenticated;
GRANT ALL ON public.registration_audit TO service_role;
ALTER TABLE public.registration_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read registration audit" ON public.registration_audit;
CREATE POLICY "Admins read registration audit"
ON public.registration_audit
FOR SELECT
TO authenticated
USING (private.has_min_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS registration_audit_created_at_idx ON public.registration_audit (created_at DESC);
CREATE INDEX IF NOT EXISTS registration_audit_email_hash_idx ON public.registration_audit (email_hash);
CREATE INDEX IF NOT EXISTS registration_audit_phone_hash_idx ON public.registration_audit (phone_hash);
CREATE INDEX IF NOT EXISTS registration_audit_ip_hash_idx ON public.registration_audit (ip_hash);

CREATE OR REPLACE FUNCTION public.calculate_profile_completion(_profile public.profiles)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  score integer := 0;
BEGIN
  IF _profile.display_name IS NOT NULL AND length(btrim(_profile.display_name)) >= 2 THEN score := score + 10; END IF;
  IF _profile.birth_date IS NOT NULL THEN score := score + 10; END IF;
  IF _profile.gender IS NOT NULL THEN score := score + 10; END IF;
  IF COALESCE(array_length(_profile.interested_in, 1), 0) > 0 THEN score := score + 10; END IF;
  IF _profile.relationship_goal IS NOT NULL THEN score := score + 8; END IF;
  IF _profile.location_country IS NOT NULL THEN score := score + 8; END IF;
  IF _profile.location_city IS NOT NULL THEN score := score + 8; END IF;
  IF _profile.bio IS NOT NULL AND length(btrim(_profile.bio)) >= 40 THEN score := score + 10; END IF;
  IF COALESCE(array_length(_profile.interests, 1), 0) >= 3 THEN score := score + 8; END IF;
  IF _profile.phone_number IS NOT NULL THEN score := score + 4; END IF;
  IF _profile.safety_agreement_accepted_at IS NOT NULL THEN score := score + 7; END IF;
  IF _profile.terms_accepted_at IS NOT NULL AND _profile.privacy_accepted_at IS NOT NULL THEN score := score + 7; END IF;
  RETURN LEAST(score, 100);
END;
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
  IF _profile.location_city IS NULL OR _profile.location_country IS NULL THEN RETURN 'City and country are required'; END IF;
  IF _profile.safety_agreement_accepted_at IS NULL THEN RETURN 'Safety agreement is required'; END IF;
  IF _profile.terms_accepted_at IS NULL OR _profile.privacy_accepted_at IS NULL THEN RETURN 'Terms and privacy acceptance are required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profile_photos pp WHERE pp.user_id = _profile.id) THEN RETURN 'At least one profile photo is required'; END IF;
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
  SELECT public.profile_discovery_block_reason(p) IS NULL
  FROM public.profiles p
  WHERE p.id = _user_id
$$;

REVOKE EXECUTE ON FUNCTION public.profile_is_discoverable(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.profile_is_discoverable(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.sync_registration_profile_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.profile_completion_score := public.calculate_profile_completion(NEW);
  NEW.discovery_blocked_reason := public.profile_discovery_block_reason(NEW);

  IF NEW.onboarding_complete IS TRUE
     AND OLD.onboarding_complete IS DISTINCT FROM TRUE
     AND NEW.onboarding_completed_at IS NULL THEN
    NEW.onboarding_completed_at := now();
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_registration_profile_state() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_registration_profile_state() TO service_role;

DROP TRIGGER IF EXISTS sync_registration_profile_state ON public.profiles;
CREATE TRIGGER sync_registration_profile_state
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_registration_profile_state();

DROP POLICY IF EXISTS "Update own profile" ON public.profiles;
CREATE POLICY "Update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND (
    private.has_min_role(auth.uid(), 'admin'::app_role)
    OR (
      membership_tier = (SELECT p.membership_tier FROM public.profiles p WHERE p.id = profiles.id)
      AND is_verified = (SELECT p.is_verified FROM public.profiles p WHERE p.id = profiles.id)
      AND is_featured = (SELECT p.is_featured FROM public.profiles p WHERE p.id = profiles.id)
      AND is_demo_profile = (SELECT p.is_demo_profile FROM public.profiles p WHERE p.id = profiles.id)
      AND signup_ip_hash IS NOT DISTINCT FROM (SELECT p.signup_ip_hash FROM public.profiles p WHERE p.id = profiles.id)
      AND signup_user_agent IS NOT DISTINCT FROM (SELECT p.signup_user_agent FROM public.profiles p WHERE p.id = profiles.id)
      AND suspicious_signup_reason IS NOT DISTINCT FROM (SELECT p.suspicious_signup_reason FROM public.profiles p WHERE p.id = profiles.id)
    )
  )
);

CREATE OR REPLACE FUNCTION public.registration_overview(_days integer DEFAULT 30)
RETURNS TABLE(
  total_new bigint,
  completed bigint,
  incomplete bigint,
  suspicious bigint,
  unverified bigint,
  blocked_from_discovery bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
  SELECT
    count(*) FILTER (WHERE p.created_at >= now() - make_interval(days => GREATEST(_days, 1))) AS total_new,
    count(*) FILTER (WHERE p.onboarding_complete AND p.onboarding_completed_at >= now() - make_interval(days => GREATEST(_days, 1))) AS completed,
    count(*) FILTER (WHERE NOT p.onboarding_complete) AS incomplete,
    count(*) FILTER (WHERE p.suspicious_signup_reason IS NOT NULL) AS suspicious,
    count(*) FILTER (WHERE NOT p.is_verified) AS unverified,
    count(*) FILTER (WHERE p.discovery_blocked_reason IS NOT NULL) AS blocked_from_discovery
  FROM public.profiles p
  WHERE private.has_min_role(auth.uid(), 'admin'::app_role)
    AND NOT p.is_demo_profile
$$;

CREATE OR REPLACE FUNCTION public.registration_review(_filter text DEFAULT 'new', _limit integer DEFAULT 100)
RETURNS TABLE(
  id uuid,
  display_name text,
  created_at timestamptz,
  onboarding_complete boolean,
  onboarding_completed_at timestamptz,
  profile_completion_score integer,
  is_verified boolean,
  phone_country_code text,
  phone_number text,
  location_city text,
  location_country text,
  suspicious_signup_reason text,
  discovery_blocked_reason text,
  photo_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
  SELECT
    p.id,
    p.display_name,
    p.created_at,
    p.onboarding_complete,
    p.onboarding_completed_at,
    p.profile_completion_score,
    p.is_verified,
    p.phone_country_code,
    p.phone_number,
    p.location_city,
    p.location_country,
    p.suspicious_signup_reason,
    p.discovery_blocked_reason,
    (SELECT count(*) FROM public.profile_photos pp WHERE pp.user_id = p.id) AS photo_count
  FROM public.profiles p
  WHERE private.has_min_role(auth.uid(), 'admin'::app_role)
    AND NOT p.is_demo_profile
    AND (
      _filter = 'new'
      OR (_filter = 'incomplete' AND NOT p.onboarding_complete)
      OR (_filter = 'suspicious' AND p.suspicious_signup_reason IS NOT NULL)
      OR (_filter = 'unverified' AND NOT p.is_verified)
      OR (_filter = 'recently_verified' AND p.is_verified)
      OR (_filter = 'blocked' AND p.discovery_blocked_reason IS NOT NULL)
    )
  ORDER BY p.created_at DESC
  LIMIT GREATEST(_limit, 1)
$$;

GRANT EXECUTE ON FUNCTION public.registration_overview(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registration_review(text, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.refresh_profile_discovery_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := COALESCE(NEW.user_id, OLD.user_id);
  UPDATE public.profiles p
  SET updated_at = now()
  WHERE p.id = v_user_id;
  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.refresh_profile_discovery_state() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_profile_discovery_state() TO service_role;

DROP TRIGGER IF EXISTS refresh_profile_discovery_state ON public.profile_photos;
CREATE TRIGGER refresh_profile_discovery_state
AFTER INSERT OR UPDATE OR DELETE ON public.profile_photos
FOR EACH ROW EXECUTE FUNCTION public.refresh_profile_discovery_state();

CREATE OR REPLACE FUNCTION public.get_visible_profiles(_ids uuid[])
RETURNS TABLE(
  id uuid,
  display_name text,
  updated_at timestamptz,
  created_at timestamptz,
  last_active timestamptz,
  onboarding_complete boolean,
  is_featured boolean,
  is_verified boolean,
  membership_tier public.membership_tier,
  interests text[],
  bio text,
  location_country text,
  location_city text,
  interested_in text[],
  gender text,
  latitude double precision,
  longitude double precision,
  location_state text,
  location_hidden boolean,
  location_access_suspended boolean,
  languages text[],
  location_updated_at timestamptz,
  religion text,
  education text,
  relationship_goal text,
  birth_date date
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
  SELECT
    p.id,
    p.display_name,
    p.updated_at,
    p.created_at,
    p.last_active,
    p.onboarding_complete,
    p.is_featured,
    p.is_verified,
    p.membership_tier,
    p.interests,
    p.bio,
    p.location_country,
    p.location_city,
    p.interested_in,
    p.gender,
    CASE WHEN p.id = auth.uid() OR private.has_min_role(auth.uid(), 'admin'::app_role)
         THEN p.latitude ELSE NULL END,
    CASE WHEN p.id = auth.uid() OR private.has_min_role(auth.uid(), 'admin'::app_role)
         THEN p.longitude ELSE NULL END,
    p.location_state,
    p.location_hidden,
    p.location_access_suspended,
    p.languages,
    p.location_updated_at,
    p.religion,
    p.education,
    p.relationship_goal,
    CASE WHEN p.id = auth.uid() OR private.has_min_role(auth.uid(), 'admin'::app_role)
         THEN p.birth_date
         ELSE make_date(EXTRACT(YEAR FROM p.birth_date)::int, 1, 1) END
  FROM public.profiles p
  WHERE p.id = ANY(_ids)
    AND (
      p.id = auth.uid()
      OR private.has_min_role(auth.uid(), 'admin'::app_role)
      OR (
        public.profile_is_discoverable(p.id)
        AND NOT private.is_blocked(auth.uid(), p.id)
        AND NOT private.is_banned(p.id)
      )
    )
$$;

REVOKE EXECUTE ON FUNCTION public.get_visible_profiles(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_visible_profiles(uuid[]) TO authenticated, service_role;
