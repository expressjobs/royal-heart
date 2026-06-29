-- Keep Discover global by default while improving relevance and rotation.
-- Eligibility, moderation, blocking, and explicit filters remain unchanged.
CREATE OR REPLACE FUNCTION public.discover_profiles(
  _max_distance_km double precision DEFAULT NULL::double precision,
  _limit integer DEFAULT 60,
  _min_age integer DEFAULT NULL::integer,
  _max_age integer DEFAULT NULL::integer,
  _country text DEFAULT NULL::text,
  _city text DEFAULT NULL::text,
  _online_minutes integer DEFAULT NULL::integer,
  _verified_only boolean DEFAULT false,
  _has_bio boolean DEFAULT false,
  _interests text[] DEFAULT NULL::text[],
  _languages text[] DEFAULT NULL::text[],
  _religion text DEFAULT NULL::text,
  _education text DEFAULT NULL::text,
  _relationship_goal text DEFAULT NULL::text,
  _state text DEFAULT NULL::text,
  _premium_only boolean DEFAULT false,
  _recently_active_minutes integer DEFAULT NULL::integer,
  _profession text DEFAULT NULL::text,
  _smoking text DEFAULT NULL::text,
  _drinking text DEFAULT NULL::text,
  _workout text DEFAULT NULL::text,
  _family_plans text DEFAULT NULL::text,
  _pets text DEFAULT NULL::text
)
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
  v_relationship_goal text;
  v_uid uuid := auth.uid();
BEGIN
  SELECT p.location_geog, p.gender, p.interested_in, p.relationship_goal
    INTO v_geog, v_gender, v_interested, v_relationship_goal
  FROM public.profiles p
  WHERE p.id = v_uid;

  RETURN QUERY
  SELECT q.id, q.distance_m
  FROM (
    SELECT
      t.id,
      CASE
        WHEN v_geog IS NOT NULL
          AND t.location_geog IS NOT NULL
          AND NOT t.location_access_suspended
          AND NOT t.hide_distance
        THEN extensions.st_distance(v_geog, t.location_geog)
        ELSE NULL
      END AS distance_m,
      t.is_featured,
      CASE t.membership_tier
        WHEN 'platinum'::public.membership_tier THEN 2
        WHEN 'gold'::public.membership_tier THEN 1
        ELSE 0
      END AS priority_rank,
      t.is_verified,
      CASE
        WHEN v_relationship_goal IS NOT NULL
          AND t.relationship_goal = v_relationship_goal THEN 1
        ELSE 0
      END AS goal_match,
      COALESCE(t.profile_completion_score, 0) AS completion_score,
      t.last_active,
      md5(current_date::text || ':' || v_uid::text || ':' || t.id::text) AS rotation_key
    FROM public.profiles t
    WHERE t.id <> v_uid
      AND (
        (t.is_demo_profile IS TRUE AND public.demo_profile_is_discoverable(t.id))
        OR (t.is_demo_profile IS NOT TRUE AND public.profile_is_discoverable(t.id))
      )
      AND NOT private.is_blocked(v_uid, t.id)
      AND NOT private.is_banned(t.id)
      AND NOT EXISTS (
        SELECT 1 FROM public.likes l
        WHERE l.liker_id = v_uid AND l.liked_id = t.id
      )
      AND public.pref_match(v_interested, t.gender)
      AND (
        t.is_demo_profile IS TRUE
        OR public.pref_match(t.interested_in, v_gender)
      )
      AND (_verified_only IS NOT TRUE OR t.is_verified)
      AND (_premium_only IS NOT TRUE OR t.membership_tier <> 'free'::public.membership_tier)
      AND (_has_bio IS NOT TRUE OR (t.bio IS NOT NULL AND length(btrim(t.bio)) > 0))
      AND (_country IS NULL OR t.location_country ILIKE _country)
      AND (_state IS NULL OR t.location_state ILIKE '%' || _state || '%')
      AND (_city IS NULL OR t.location_city ILIKE '%' || _city || '%')
      AND (_online_minutes IS NULL OR (
        t.hide_online_status = false
        AND t.last_active >= now() - make_interval(mins => _online_minutes)
      ))
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
          v_geog IS NOT NULL
          AND t.location_geog IS NOT NULL
          AND NOT t.location_access_suspended
          AND extensions.st_dwithin(v_geog, t.location_geog, _max_distance_km * 1000)
        )
      )
  ) q
  ORDER BY
    q.is_featured DESC,
    q.priority_rank DESC,
    q.is_verified DESC,
    q.goal_match DESC,
    q.completion_score DESC,
    q.last_active DESC NULLS LAST,
    q.rotation_key
  LIMIT GREATEST(LEAST(_limit, 240), 1);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.discover_profiles(
  double precision, integer, integer, integer, text, text, integer, boolean, boolean,
  text[], text[], text, text, text, text, boolean, integer, text, text, text, text, text, text
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.discover_profiles(
  double precision, integer, integer, integer, text, text, integer, boolean, boolean,
  text[], text[], text, text, text, text, boolean, integer, text, text, text, text, text, text
) TO authenticated, service_role;
