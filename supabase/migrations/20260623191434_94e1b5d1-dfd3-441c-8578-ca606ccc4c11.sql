-- ============================================================
-- Location & Discovery System — geolocation foundation (PostGIS)
-- ============================================================

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;

-- ---- New profile columns -----------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS location_state text,
  ADD COLUMN IF NOT EXISTS location_hidden boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS location_access_suspended boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS location_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS languages text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS religion text,
  ADD COLUMN IF NOT EXISTS education text,
  ADD COLUMN IF NOT EXISTS relationship_goal text;

-- Generated geography point (lon, lat). Immutable PostGIS fns => valid for STORED.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS location_geog extensions.geography(Point, 4326)
  GENERATED ALWAYS AS (
    CASE
      WHEN latitude IS NOT NULL AND longitude IS NOT NULL
      THEN (extensions.st_setsrid(extensions.st_makepoint(longitude, latitude), 4326))::extensions.geography
      ELSE NULL
    END
  ) STORED;

-- ---- Indexes for fast nearby discovery ---------------------
CREATE INDEX IF NOT EXISTS profiles_location_geog_gix
  ON public.profiles USING gist (location_geog);
CREATE INDEX IF NOT EXISTS profiles_location_country_idx
  ON public.profiles (lower(location_country));
CREATE INDEX IF NOT EXISTS profiles_location_city_idx
  ON public.profiles (lower(location_city));
CREATE INDEX IF NOT EXISTS profiles_last_active_idx
  ON public.profiles (last_active DESC);

-- ---- Gender-preference matcher (mirrors client logic) ------
CREATE OR REPLACE FUNCTION public.pref_match(_interested text[], _gender text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _interested IS NULL OR array_length(_interested, 1) IS NULL THEN true
    WHEN 'everyone' = ANY(_interested) THEN true
    WHEN _gender IS NULL THEN false
    ELSE (CASE _gender
            WHEN 'woman' THEN 'women'
            WHEN 'man' THEN 'men'
            WHEN 'nonbinary' THEN 'nonbinary'
            ELSE NULL
          END) = ANY(_interested)
  END
$$;

-- ---- Location-based discovery query ------------------------
-- SECURITY INVOKER: existing RLS still hides banned/blocked profiles.
CREATE OR REPLACE FUNCTION public.discover_profiles(
  _max_distance_km double precision DEFAULT NULL,
  _min_age int DEFAULT NULL,
  _max_age int DEFAULT NULL,
  _country text DEFAULT NULL,
  _city text DEFAULT NULL,
  _online_minutes int DEFAULT NULL,
  _verified_only boolean DEFAULT false,
  _has_bio boolean DEFAULT false,
  _interests text[] DEFAULT NULL,
  _languages text[] DEFAULT NULL,
  _religion text DEFAULT NULL,
  _education text DEFAULT NULL,
  _relationship_goal text DEFAULT NULL,
  _limit int DEFAULT 60
)
RETURNS TABLE(id uuid, distance_m double precision)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, extensions
AS $$
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
$$;

GRANT EXECUTE ON FUNCTION public.pref_match(text[], text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.discover_profiles(double precision, int, int, text, text, int, boolean, boolean, text[], text[], text, text, text, int) TO authenticated;

-- ---- Admin city/country aggregation (heatmap analytics) ----
CREATE OR REPLACE FUNCTION public.location_distribution()
RETURNS TABLE(country text, city text, member_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(p.location_country, 'Unknown') AS country,
    COALESCE(p.location_city, 'Unknown') AS city,
    count(*) AS member_count
  FROM public.profiles p
  WHERE private.has_role(auth.uid(), 'admin'::app_role)
  GROUP BY 1, 2
  ORDER BY member_count DESC
$$;

GRANT EXECUTE ON FUNCTION public.location_distribution() TO authenticated;