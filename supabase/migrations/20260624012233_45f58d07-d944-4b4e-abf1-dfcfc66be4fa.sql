-- 1. Demo profile flag
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_demo_profile boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_profiles_is_demo ON public.profiles (is_demo_profile) WHERE is_demo_profile;

-- 2. Admin-controlled public visibility of demo profiles (default: visible during launch)
CREATE OR REPLACE FUNCTION public.demo_profiles_visible()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT (data->>'showDemoProfiles')::boolean
     FROM public.site_content WHERE section = 'settings'),
    true
  )
$$;

-- 3. Discovery functions: hide demo profiles when the toggle is off
CREATE OR REPLACE FUNCTION public.discover_profiles(_max_distance_km double precision DEFAULT NULL::double precision, _min_age integer DEFAULT NULL::integer, _max_age integer DEFAULT NULL::integer, _country text DEFAULT NULL::text, _city text DEFAULT NULL::text, _online_minutes integer DEFAULT NULL::integer, _verified_only boolean DEFAULT false, _has_bio boolean DEFAULT false, _interests text[] DEFAULT NULL::text[], _languages text[] DEFAULT NULL::text[], _religion text DEFAULT NULL::text, _education text DEFAULT NULL::text, _relationship_goal text DEFAULT NULL::text, _state text DEFAULT NULL::text, _premium_only boolean DEFAULT false, _recently_active_minutes integer DEFAULT NULL::integer, _profession text DEFAULT NULL::text, _smoking text DEFAULT NULL::text, _drinking text DEFAULT NULL::text, _workout text DEFAULT NULL::text, _family_plans text DEFAULT NULL::text, _pets text DEFAULT NULL::text, _limit integer DEFAULT 60)
 RETURNS TABLE(id uuid, distance_m double precision)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'private'
AS $function$
DECLARE
  v_geog extensions.geography;
  v_gender text;
  v_interested text[];
  v_uid uuid := auth.uid();
  v_show_demo boolean := public.demo_profiles_visible();
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
        WHEN v_geog IS NOT NULL AND t.location_geog IS NOT NULL AND NOT t.location_access_suspended AND NOT t.hide_distance
        THEN extensions.st_distance(v_geog, t.location_geog)
        ELSE NULL
      END AS distance_m,
      t.is_featured,
      t.membership_tier,
      t.last_active
    FROM public.profiles t
    WHERE t.id <> v_uid
      AND t.onboarding_complete = true
      AND t.incognito = false
      AND (NOT t.is_demo_profile OR v_show_demo)
      AND NOT private.is_blocked(v_uid, t.id)
      AND NOT private.is_banned(t.id)
      AND NOT EXISTS (
        SELECT 1 FROM public.likes l
        WHERE l.liker_id = v_uid AND l.liked_id = t.id
      )
      AND public.pref_match(v_interested, t.gender)
      AND public.pref_match(t.interested_in, v_gender)
      AND (_verified_only IS NOT TRUE OR t.is_verified)
      AND (_premium_only IS NOT TRUE OR t.membership_tier <> 'free'::public.membership_tier)
      AND (_has_bio IS NOT TRUE OR (t.bio IS NOT NULL AND length(btrim(t.bio)) > 0))
      AND (_country IS NULL OR t.location_country ILIKE _country)
      AND (_state IS NULL OR t.location_state ILIKE '%' || _state || '%')
      AND (_city IS NULL OR t.location_city ILIKE '%' || _city || '%')
      AND (_online_minutes IS NULL OR (t.hide_online_status = false AND t.last_active >= now() - make_interval(mins => _online_minutes)))
      AND (_recently_active_minutes IS NULL OR t.last_active >= now() - make_interval(mins => _recently_active_minutes))
      AND (_min_age IS NULL OR t.birth_date IS NULL OR t.birth_date <= (current_date - (_min_age || ' years')::interval))
      AND (_max_age IS NULL OR (t.birth_date IS NOT NULL AND t.birth_date > (current_date - ((_max_age + 1) || ' years')::interval)))
      AND (_interests IS NULL OR t.interests && _interests)
      AND (_languages IS NULL OR t.languages && _languages)
      AND (_religion IS NULL OR t.religion = _religion)
      AND (_education IS NULL OR t.education = _education)
      AND (_relationship_goal IS NULL OR t.relationship_goal = _relationship_goal)
      AND (_profession IS NULL OR t.profession = _profession)
      AND (_smoking IS NULL OR t.smoking = _smoking)
      AND (_drinking IS NULL OR t.drinking = _drinking)
      AND (_workout IS NULL OR t.workout = _workout)
      AND (_family_plans IS NULL OR t.family_plans = _family_plans)
      AND (_pets IS NULL OR t.pets = _pets)
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

CREATE OR REPLACE FUNCTION public.search_profiles(_max_distance_km double precision DEFAULT NULL::double precision, _min_age integer DEFAULT NULL::integer, _max_age integer DEFAULT NULL::integer, _country text DEFAULT NULL::text, _city text DEFAULT NULL::text, _online_minutes integer DEFAULT NULL::integer, _verified_only boolean DEFAULT false, _has_bio boolean DEFAULT false, _interests text[] DEFAULT NULL::text[], _languages text[] DEFAULT NULL::text[], _religion text DEFAULT NULL::text, _education text DEFAULT NULL::text, _relationship_goal text DEFAULT NULL::text, _state text DEFAULT NULL::text, _premium_only boolean DEFAULT false, _recently_active_minutes integer DEFAULT NULL::integer, _profession text DEFAULT NULL::text, _smoking text DEFAULT NULL::text, _drinking text DEFAULT NULL::text, _workout text DEFAULT NULL::text, _family_plans text DEFAULT NULL::text, _pets text DEFAULT NULL::text, _limit integer DEFAULT 24, _offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, distance_m double precision, total_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'private'
AS $function$
DECLARE
  v_geog extensions.geography;
  v_gender text;
  v_interested text[];
  v_uid uuid := auth.uid();
  v_show_demo boolean := public.demo_profiles_visible();
BEGIN
  SELECT p.location_geog, p.gender, p.interested_in
    INTO v_geog, v_gender, v_interested
  FROM public.profiles p
  WHERE p.id = v_uid;

  RETURN QUERY
  SELECT q.id, q.distance_m, count(*) OVER() AS total_count
  FROM (
    SELECT
      t.id,
      CASE
        WHEN v_geog IS NOT NULL AND t.location_geog IS NOT NULL AND NOT t.location_access_suspended AND NOT t.hide_distance
        THEN extensions.st_distance(v_geog, t.location_geog)
        ELSE NULL
      END AS distance_m,
      t.is_featured, t.membership_tier, t.last_active
    FROM public.profiles t
    WHERE t.id <> v_uid
      AND t.onboarding_complete = true
      AND t.incognito = false
      AND (NOT t.is_demo_profile OR v_show_demo)
      AND NOT private.is_blocked(v_uid, t.id)
      AND NOT private.is_banned(t.id)
      AND public.pref_match(v_interested, t.gender)
      AND public.pref_match(t.interested_in, v_gender)
      AND (_verified_only IS NOT TRUE OR t.is_verified)
      AND (_premium_only IS NOT TRUE OR t.membership_tier <> 'free'::public.membership_tier)
      AND (_has_bio IS NOT TRUE OR (t.bio IS NOT NULL AND length(btrim(t.bio)) > 0))
      AND (_country IS NULL OR t.location_country ILIKE _country)
      AND (_state IS NULL OR t.location_state ILIKE '%' || _state || '%')
      AND (_city IS NULL OR t.location_city ILIKE '%' || _city || '%')
      AND (_online_minutes IS NULL OR (t.hide_online_status = false AND t.last_active >= now() - make_interval(mins => _online_minutes)))
      AND (_recently_active_minutes IS NULL OR t.last_active >= now() - make_interval(mins => _recently_active_minutes))
      AND (_min_age IS NULL OR t.birth_date IS NULL OR t.birth_date <= (current_date - (_min_age || ' years')::interval))
      AND (_max_age IS NULL OR (t.birth_date IS NOT NULL AND t.birth_date > (current_date - ((_max_age + 1) || ' years')::interval)))
      AND (_interests IS NULL OR t.interests && _interests)
      AND (_languages IS NULL OR t.languages && _languages)
      AND (_religion IS NULL OR t.religion = _religion)
      AND (_education IS NULL OR t.education = _education)
      AND (_relationship_goal IS NULL OR t.relationship_goal = _relationship_goal)
      AND (_profession IS NULL OR t.profession = _profession)
      AND (_smoking IS NULL OR t.smoking = _smoking)
      AND (_drinking IS NULL OR t.drinking = _drinking)
      AND (_workout IS NULL OR t.workout = _workout)
      AND (_family_plans IS NULL OR t.family_plans = _family_plans)
      AND (_pets IS NULL OR t.pets = _pets)
      AND (
        _max_distance_km IS NULL
        OR (
          v_geog IS NOT NULL AND t.location_geog IS NOT NULL AND NOT t.location_access_suspended
          AND extensions.st_dwithin(v_geog, t.location_geog, _max_distance_km * 1000)
        )
      )
  ) q
  ORDER BY
    q.is_featured DESC, q.membership_tier DESC,
    (q.distance_m IS NULL), q.distance_m ASC NULLS LAST, q.last_active DESC
  LIMIT GREATEST(_limit, 1) OFFSET GREATEST(_offset, 0);
END;
$function$;

CREATE OR REPLACE FUNCTION public.discover_section(_kind text, _limit integer DEFAULT 12)
 RETURNS TABLE(id uuid, distance_m double precision)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'private'
AS $function$
DECLARE
  v_geog extensions.geography;
  v_gender text;
  v_interested text[];
  v_my_interests text[];
  v_goal text;
  v_uid uuid := auth.uid();
  v_show_demo boolean := public.demo_profiles_visible();
BEGIN
  SELECT p.location_geog, p.gender, p.interested_in, p.interests, p.relationship_goal
    INTO v_geog, v_gender, v_interested, v_my_interests, v_goal
  FROM public.profiles p
  WHERE p.id = v_uid;

  RETURN QUERY
  SELECT q.id, q.distance_m FROM (
    SELECT
      t.id,
      CASE
        WHEN v_geog IS NOT NULL AND t.location_geog IS NOT NULL AND NOT t.location_access_suspended AND NOT t.hide_distance
        THEN extensions.st_distance(v_geog, t.location_geog) ELSE NULL
      END AS distance_m,
      t.is_featured, t.membership_tier, t.last_active, t.created_at, t.is_verified,
      CASE
        WHEN v_geog IS NOT NULL AND t.location_geog IS NOT NULL AND NOT t.location_access_suspended
        THEN extensions.st_distance(v_geog, t.location_geog) ELSE NULL
      END AS sort_distance,
      (SELECT count(*) FROM unnest(COALESCE(t.interests, '{}')) xi WHERE xi = ANY(COALESCE(v_my_interests, '{}')))
        + CASE WHEN v_goal IS NOT NULL AND t.relationship_goal = v_goal THEN 2 ELSE 0 END AS rec_score,
      (SELECT count(*) FROM public.likes l
        WHERE l.liked_id = t.id AND l.is_like AND l.created_at >= now() - interval '7 days') AS recent_likes
    FROM public.profiles t
    WHERE t.id <> v_uid
      AND t.onboarding_complete = true
      AND t.incognito = false
      AND (NOT t.is_demo_profile OR v_show_demo)
      AND NOT private.is_blocked(v_uid, t.id)
      AND NOT private.is_banned(t.id)
      AND public.pref_match(v_interested, t.gender)
      AND public.pref_match(t.interested_in, v_gender)
      AND NOT EXISTS (SELECT 1 FROM public.likes l WHERE l.liker_id = v_uid AND l.liked_id = t.id)
      AND (_kind <> 'verified' OR t.is_verified)
      AND (_kind <> 'new_members' OR t.created_at >= now() - interval '14 days')
      AND (_kind <> 'nearby' OR (v_geog IS NOT NULL AND t.location_geog IS NOT NULL AND NOT t.location_access_suspended))
  ) q
  ORDER BY
    CASE WHEN _kind = 'trending' THEN q.recent_likes END DESC NULLS LAST,
    CASE WHEN _kind = 'recommended' THEN q.rec_score END DESC NULLS LAST,
    CASE WHEN _kind = 'new_members' THEN q.created_at END DESC NULLS LAST,
    CASE WHEN _kind = 'nearby' THEN q.sort_distance END ASC NULLS LAST,
    q.is_featured DESC, q.last_active DESC
  LIMIT GREATEST(_limit, 1);
END;
$function$;

CREATE OR REPLACE FUNCTION public.recommended_matches(_kind text DEFAULT 'recommended'::text, _limit integer DEFAULT 30)
 RETURNS TABLE(id uuid, distance_m double precision, score integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'private'
AS $function$
DECLARE
  v public.profiles%ROWTYPE;
  v_geog extensions.geography;
  v_uid uuid := auth.uid();
  v_show_demo boolean := public.demo_profiles_visible();
BEGIN
  SELECT * INTO v FROM public.profiles WHERE profiles.id = v_uid;
  v_geog := v.location_geog;

  RETURN QUERY
  SELECT q.id, q.distance_m, q.score FROM (
    SELECT
      t.id,
      CASE WHEN v_geog IS NOT NULL AND t.location_geog IS NOT NULL AND NOT t.location_access_suspended AND NOT t.hide_distance
           THEN extensions.st_distance(v_geog, t.location_geog) ELSE NULL END AS distance_m,
      CASE WHEN v_geog IS NOT NULL AND t.location_geog IS NOT NULL AND NOT t.location_access_suspended
           THEN extensions.st_distance(v_geog, t.location_geog) ELSE NULL END AS sort_distance,
      (public.compat_breakdown(
        v.interests, t.interests,
        v.relationship_goal, t.relationship_goal,
        v.languages, t.languages,
        v.education, t.education,
        v.religion, t.religion,
        v.smoking, t.smoking,
        v.drinking, t.drinking,
        v.workout, t.workout,
        v.family_plans, t.family_plans,
        v.pets, t.pets,
        v.birth_date, t.birth_date,
        CASE WHEN v_geog IS NOT NULL AND t.location_geog IS NOT NULL AND NOT t.location_access_suspended
             THEN extensions.st_distance(v_geog, t.location_geog) ELSE NULL END,
        t.is_verified,
        ((CASE WHEN t.bio IS NOT NULL AND length(btrim(t.bio)) > 0 THEN 1 ELSE 0 END
          + CASE WHEN COALESCE(array_length(t.interests,1),0) > 0 THEN 1 ELSE 0 END
          + CASE WHEN COALESCE(array_length(t.languages,1),0) > 0 THEN 1 ELSE 0 END
          + CASE WHEN t.religion IS NOT NULL THEN 1 ELSE 0 END
          + CASE WHEN t.education IS NOT NULL THEN 1 ELSE 0 END
          + CASE WHEN t.relationship_goal IS NOT NULL THEN 1 ELSE 0 END
          + CASE WHEN t.profession IS NOT NULL THEN 1 ELSE 0 END
          + CASE WHEN t.birth_date IS NOT NULL THEN 1 ELSE 0 END)::numeric / 8.0)
      )->>'score')::int AS score
    FROM public.profiles t
    WHERE t.id <> v_uid
      AND t.onboarding_complete = true
      AND t.incognito = false
      AND (NOT t.is_demo_profile OR v_show_demo)
      AND NOT private.is_blocked(v_uid, t.id)
      AND NOT private.is_banned(t.id)
      AND public.pref_match(v.interested_in, t.gender)
      AND public.pref_match(t.interested_in, v.gender)
      AND NOT EXISTS (SELECT 1 FROM public.likes l WHERE l.liker_id = v_uid AND l.liked_id = t.id)
      AND (_kind <> 'nearby_compatible' OR (v_geog IS NOT NULL AND t.location_geog IS NOT NULL AND NOT t.location_access_suspended))
  ) q
  WHERE (_kind <> 'compatible' OR q.score >= 55)
  ORDER BY q.score DESC, (q.distance_m IS NULL), q.distance_m ASC NULLS LAST
  LIMIT GREATEST(_limit, 1);
END;
$function$;

-- 4. Keep admin location/statistics tools free of demo profiles
CREATE OR REPLACE FUNCTION public.location_distribution()
 RETURNS TABLE(country text, city text, member_count bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT
    COALESCE(p.location_country, 'Unknown') AS country,
    COALESCE(p.location_city, 'Unknown') AS city,
    count(*) AS member_count
  FROM public.profiles p
  WHERE private.has_role(auth.uid(), 'admin'::app_role)
    AND NOT p.is_demo_profile
  GROUP BY 1, 2
  ORDER BY member_count DESC
$function$;

CREATE OR REPLACE FUNCTION public.location_heatmap(_start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, _end_date timestamp with time zone DEFAULT NULL::timestamp with time zone, _verified_only boolean DEFAULT false)
 RETURNS TABLE(country text, city text, member_count bigint, verified_count bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'private'
AS $function$
  SELECT
    COALESCE(p.location_country, 'Unknown') AS country,
    COALESCE(p.location_city, 'Unknown') AS city,
    count(*) AS member_count,
    count(*) FILTER (WHERE p.is_verified) AS verified_count
  FROM public.profiles p
  WHERE private.has_role(auth.uid(), 'admin'::app_role)
    AND NOT p.is_demo_profile
    AND (_start_date IS NULL OR p.created_at >= _start_date)
    AND (_end_date IS NULL OR p.created_at < _end_date)
    AND (_verified_only IS NOT TRUE OR p.is_verified)
  GROUP BY 1, 2
  ORDER BY member_count DESC
$function$;

CREATE OR REPLACE FUNCTION public.suspicious_locations(_limit integer DEFAULT 100)
 RETURNS TABLE(user_id uuid, display_name text, location_city text, location_country text, latitude double precision, longitude double precision, reason text, shared_count bigint, location_updated_at timestamp with time zone, location_access_suspended boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
  WITH dup AS (
    SELECT round(latitude::numeric, 4) AS la, round(longitude::numeric, 4) AS lo, count(*) AS c
    FROM public.profiles
    WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND NOT is_demo_profile
    GROUP BY 1, 2
    HAVING count(*) >= 3
  )
  SELECT
    p.id, p.display_name, p.location_city, p.location_country,
    p.latitude, p.longitude,
    CASE
      WHEN p.latitude = 0 AND p.longitude = 0 THEN 'Null-island coordinates (0, 0)'
      WHEN d.c IS NOT NULL THEN 'Identical coordinates shared by ' || d.c || ' accounts'
      WHEN p.location_country IS NULL THEN 'GPS coordinates set with no country'
    END AS reason,
    COALESCE(d.c, 0) AS shared_count,
    p.location_updated_at, p.location_access_suspended
  FROM public.profiles p
  LEFT JOIN dup d
    ON round(p.latitude::numeric, 4) = d.la AND round(p.longitude::numeric, 4) = d.lo
  WHERE private.has_role(auth.uid(), 'admin'::app_role)
    AND NOT p.is_demo_profile
    AND p.latitude IS NOT NULL
    AND (
      (p.latitude = 0 AND p.longitude = 0)
      OR d.c IS NOT NULL
      OR p.location_country IS NULL
    )
  ORDER BY COALESCE(d.c, 0) DESC, p.location_updated_at DESC NULLS LAST
  LIMIT GREATEST(_limit, 1)
$function$;