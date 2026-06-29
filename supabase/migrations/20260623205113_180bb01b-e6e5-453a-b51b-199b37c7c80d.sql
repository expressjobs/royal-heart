-- =========================================================
-- PART 1: PROFILES — hide precise GPS coords + exact birth date
-- =========================================================

-- 1a. Restrict the base profiles SELECT policy to the owner and admins.
--     Browsing other members now goes through the masked function below.
DROP POLICY IF EXISTS "View non-blocked profiles" ON public.profiles;

CREATE POLICY "Owner and admins read profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR private.has_role(auth.uid(), 'admin'::app_role)
  );

-- 1b. Masked, visibility-aware reader used by the app to browse other members.
--     Owner/admin see full data; everyone else gets coords/exact DOB stripped
--     (birth date reduced to birth year so age can still be displayed).
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
    CASE WHEN p.id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role)
         THEN p.latitude ELSE NULL END,
    CASE WHEN p.id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role)
         THEN p.longitude ELSE NULL END,
    p.location_state,
    p.location_hidden,
    p.location_access_suspended,
    p.languages,
    p.location_updated_at,
    p.religion,
    p.education,
    p.relationship_goal,
    CASE WHEN p.id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role)
         THEN p.birth_date
         ELSE make_date(EXTRACT(YEAR FROM p.birth_date)::int, 1, 1) END
  FROM public.profiles p
  WHERE p.id = ANY(_ids)
    AND (
      p.id = auth.uid()
      OR private.has_role(auth.uid(), 'admin'::app_role)
      OR (NOT private.is_blocked(auth.uid(), p.id) AND NOT private.is_banned(p.id))
    )
$$;

REVOKE EXECUTE ON FUNCTION public.get_visible_profiles(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_visible_profiles(uuid[]) TO authenticated, service_role;

-- 1c. Discovery reads other members' rows, so it must bypass the now-restricted
--     base policy. Switch it to SECURITY DEFINER and apply block/ban filtering
--     explicitly (previously enforced by the base RLS policy).
CREATE OR REPLACE FUNCTION public.discover_profiles(_max_distance_km double precision DEFAULT NULL::double precision, _min_age integer DEFAULT NULL::integer, _max_age integer DEFAULT NULL::integer, _country text DEFAULT NULL::text, _city text DEFAULT NULL::text, _online_minutes integer DEFAULT NULL::integer, _verified_only boolean DEFAULT false, _has_bio boolean DEFAULT false, _interests text[] DEFAULT NULL::text[], _languages text[] DEFAULT NULL::text[], _religion text DEFAULT NULL::text, _education text DEFAULT NULL::text, _relationship_goal text DEFAULT NULL::text, _limit integer DEFAULT 60)
 RETURNS TABLE(id uuid, distance_m double precision)
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'private'
AS $function$
DECLARE
  v_geog extensions.geography;
  v_gender text;
  v_interested text[];
  v_uid uuid := auth.uid();
BEGIN
  SELECT p.location_geog, p.gender, p.interested_in
    INTO v_geog, v_gender, v_interested
  FROM public.profiles p
  WHERE p.id = v_uid;

  RETURN QUERY
  SELECT q.id, q.distance_m
  FROM (
    SELECT
      t.id,
      CASE
        WHEN v_geog IS NOT NULL AND t.location_geog IS NOT NULL AND NOT t.location_access_suspended
        THEN extensions.st_distance(v_geog, t.location_geog)
        ELSE NULL
      END AS distance_m,
      t.is_featured,
      t.membership_tier,
      t.last_active
    FROM public.profiles t
    WHERE t.id <> v_uid
      AND t.onboarding_complete = true
      AND NOT private.is_blocked(v_uid, t.id)
      AND NOT private.is_banned(t.id)
      AND NOT EXISTS (
        SELECT 1 FROM public.likes l
        WHERE l.liker_id = v_uid AND l.liked_id = t.id
      )
      AND public.pref_match(v_interested, t.gender)
      AND public.pref_match(t.interested_in, v_gender)
      AND (_verified_only IS NOT TRUE OR t.is_verified)
      AND (_has_bio IS NOT TRUE OR (t.bio IS NOT NULL AND length(btrim(t.bio)) > 0))
      AND (_country IS NULL OR t.location_country ILIKE _country)
      AND (_city IS NULL OR t.location_city ILIKE '%' || _city || '%')
      AND (_online_minutes IS NULL OR t.last_active >= now() - make_interval(mins => _online_minutes))
      AND (_min_age IS NULL OR t.birth_date IS NULL OR t.birth_date <= (current_date - (_min_age || ' years')::interval))
      AND (_max_age IS NULL OR (t.birth_date IS NOT NULL AND t.birth_date > (current_date - ((_max_age + 1) || ' years')::interval)))
      AND (_interests IS NULL OR t.interests && _interests)
      AND (_languages IS NULL OR t.languages && _languages)
      AND (_religion IS NULL OR t.religion = _religion)
      AND (_education IS NULL OR t.education = _education)
      AND (_relationship_goal IS NULL OR t.relationship_goal = _relationship_goal)
      AND (
        _max_distance_km IS NULL
        OR (
          v_geog IS NOT NULL AND t.location_geog IS NOT NULL AND NOT t.location_access_suspended
          AND extensions.st_dwithin(v_geog, t.location_geog, _max_distance_km * 1000)
        )
      )
  ) q
  ORDER BY
    q.is_featured DESC,
    q.membership_tier DESC,
    (q.distance_m IS NULL),
    q.distance_m ASC NULLS LAST,
    q.last_active DESC
  LIMIT _limit;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.discover_profiles(double precision, integer, integer, text, text, integer, boolean, boolean, text[], text[], text, text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.discover_profiles(double precision, integer, integer, text, text, integer, boolean, boolean, text[], text[], text, text, text, integer) TO authenticated, service_role;

-- =========================================================
-- PART 2: VERIFICATION — move fraud/biometric fields to an admin-only table
-- =========================================================

CREATE TABLE public.verification_review (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id uuid NOT NULL UNIQUE REFERENCES public.verification_requests(id) ON DELETE CASCADE,
  fraud_score integer NOT NULL DEFAULT 0,
  fraud_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  selfie_hash text,
  id_photo_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.verification_review TO authenticated;
GRANT ALL ON public.verification_review TO service_role;

ALTER TABLE public.verification_review ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage verification review"
  ON public.verification_review
  FOR ALL
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_verification_review_updated_at
  BEFORE UPDATE ON public.verification_review
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Migrate existing sensitive data out of verification_requests.
INSERT INTO public.verification_review (request_id, fraud_score, fraud_flags, selfie_hash, id_photo_path, created_at)
SELECT id, COALESCE(fraud_score, 0), COALESCE(fraud_flags, '[]'::jsonb), selfie_hash, id_photo_path, created_at
FROM public.verification_requests;

-- Drop the sensitive columns from the user-readable table.
ALTER TABLE public.verification_requests
  DROP COLUMN fraud_score,
  DROP COLUMN fraud_flags,
  DROP COLUMN selfie_hash,
  DROP COLUMN id_photo_path;