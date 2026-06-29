
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
      (SELECT count(*) FROM unnest(COALESCE(t.interests, '{}')) xi WHERE xi = ANY(COALESCE(v_my_interests, '{}')))
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
