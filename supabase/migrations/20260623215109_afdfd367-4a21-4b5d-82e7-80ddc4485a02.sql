
DROP FUNCTION IF EXISTS public.discover_profiles(double precision, integer, integer, text, text, integer, boolean, boolean, text[], text[], text, text, text, integer);

CREATE OR REPLACE FUNCTION public.discover_profiles(
  _max_distance_km double precision DEFAULT NULL,
  _min_age integer DEFAULT NULL,
  _max_age integer DEFAULT NULL,
  _country text DEFAULT NULL,
  _city text DEFAULT NULL,
  _online_minutes integer DEFAULT NULL,
  _verified_only boolean DEFAULT false,
  _has_bio boolean DEFAULT false,
  _interests text[] DEFAULT NULL,
  _languages text[] DEFAULT NULL,
  _religion text DEFAULT NULL,
  _education text DEFAULT NULL,
  _relationship_goal text DEFAULT NULL,
  _state text DEFAULT NULL,
  _premium_only boolean DEFAULT false,
  _recently_active_minutes integer DEFAULT NULL,
  _profession text DEFAULT NULL,
  _smoking text DEFAULT NULL,
  _drinking text DEFAULT NULL,
  _workout text DEFAULT NULL,
  _family_plans text DEFAULT NULL,
  _pets text DEFAULT NULL,
  _limit integer DEFAULT 60
)
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
      AND t.incognito = false
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

-- ============ Paginated advanced search ============
CREATE OR REPLACE FUNCTION public.search_profiles(
  _max_distance_km double precision DEFAULT NULL,
  _min_age integer DEFAULT NULL,
  _max_age integer DEFAULT NULL,
  _country text DEFAULT NULL,
  _city text DEFAULT NULL,
  _online_minutes integer DEFAULT NULL,
  _verified_only boolean DEFAULT false,
  _has_bio boolean DEFAULT false,
  _interests text[] DEFAULT NULL,
  _languages text[] DEFAULT NULL,
  _religion text DEFAULT NULL,
  _education text DEFAULT NULL,
  _relationship_goal text DEFAULT NULL,
  _state text DEFAULT NULL,
  _premium_only boolean DEFAULT false,
  _recently_active_minutes integer DEFAULT NULL,
  _profession text DEFAULT NULL,
  _smoking text DEFAULT NULL,
  _drinking text DEFAULT NULL,
  _workout text DEFAULT NULL,
  _family_plans text DEFAULT NULL,
  _pets text DEFAULT NULL,
  _limit integer DEFAULT 24,
  _offset integer DEFAULT 0
)
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
        WHEN v_geog IS NOT NULL AND t.location_geog IS NOT NULL AND NOT t.location_access_suspended
        THEN extensions.st_distance(v_geog, t.location_geog)
        ELSE NULL
      END AS distance_m,
      t.is_featured, t.membership_tier, t.last_active
    FROM public.profiles t
    WHERE t.id <> v_uid
      AND t.onboarding_complete = true
      AND t.incognito = false
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

-- ============ Curated discovery sections ============
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
        WHEN v_geog IS NOT NULL AND t.location_geog IS NOT NULL AND NOT t.location_access_suspended
        THEN extensions.st_distance(v_geog, t.location_geog) ELSE NULL
      END AS distance_m,
      t.is_featured, t.membership_tier, t.last_active, t.created_at, t.is_verified,
      COALESCE(array_length(t.interests & v_my_interests, 1), 0)
        + CASE WHEN v_goal IS NOT NULL AND t.relationship_goal = v_goal THEN 2 ELSE 0 END AS rec_score,
      (SELECT count(*) FROM public.likes l
        WHERE l.liked_id = t.id AND l.is_like AND l.created_at >= now() - interval '7 days') AS recent_likes
    FROM public.profiles t
    WHERE t.id <> v_uid
      AND t.onboarding_complete = true
      AND t.incognito = false
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
    CASE WHEN _kind = 'nearby' THEN q.distance_m END ASC NULLS LAST,
    q.is_featured DESC, q.last_active DESC
  LIMIT GREATEST(_limit, 1);
END;
$function$;

-- ============ Admin search analytics ============
CREATE OR REPLACE FUNCTION public.search_analytics(_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $function$
  SELECT CASE WHEN NOT private.has_role(auth.uid(), 'admin'::app_role) THEN '{}'::jsonb
  ELSE jsonb_build_object(
    'total_searches', (SELECT count(*) FROM public.search_events WHERE created_at >= now() - make_interval(days => _days)),
    'searchers', (SELECT count(DISTINCT user_id) FROM public.search_events WHERE created_at >= now() - make_interval(days => _days)),
    'avg_results', (SELECT COALESCE(round(avg(result_count), 1), 0) FROM public.search_events WHERE created_at >= now() - make_interval(days => _days)),
    'zero_result_rate', (SELECT CASE WHEN count(*) = 0 THEN 0
        ELSE round(100.0 * count(*) FILTER (WHERE result_count = 0) / count(*), 1) END
      FROM public.search_events WHERE created_at >= now() - make_interval(days => _days)),
    'by_day', (SELECT COALESCE(jsonb_agg(jsonb_build_object('day', d, 'count', c) ORDER BY d), '[]'::jsonb)
      FROM (SELECT date_trunc('day', created_at)::date AS d, count(*) AS c
            FROM public.search_events WHERE created_at >= now() - make_interval(days => _days)
            GROUP BY 1) s),
    'top_filters', (SELECT COALESCE(jsonb_object_agg(k, c), '{}'::jsonb)
      FROM (SELECT key AS k, count(*) AS c
            FROM public.search_events e, jsonb_each(e.filters)
            WHERE e.created_at >= now() - make_interval(days => _days)
              AND jsonb_typeof(value) <> 'null'
              AND value <> '""'::jsonb AND value <> 'false'::jsonb AND value <> '[]'::jsonb
            GROUP BY key ORDER BY count(*) DESC LIMIT 15) f)
  ) END
$function$;
