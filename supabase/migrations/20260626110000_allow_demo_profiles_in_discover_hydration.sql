-- Allow safe demo profiles to hydrate in Discover.
--
-- discover_profiles can return demo profile ids while demo_profiles_visible()
-- is true, but the Discover page hydrates those ids through get_visible_profiles().
-- Real users still use profile_is_discoverable(); demo profiles use a narrower
-- launch-safe gate so missing real-user terms/safety timestamps do not hide them.

DROP POLICY IF EXISTS "Visible profile photos are readable" ON public.profile_photos;
CREATE POLICY "Visible profile photos are readable"
ON public.profile_photos
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR private.has_min_role(auth.uid(), 'admin'::public.app_role)
  OR (
    is_private IS NOT TRUE
    AND moderation_status = 'approved'
    AND NOT private.is_blocked(auth.uid(), user_id)
    AND NOT private.is_banned(user_id)
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = profile_photos.user_id
        AND p.onboarding_complete IS TRUE
        AND p.is_active IS TRUE
        AND (
          (
            p.is_demo_profile IS NOT TRUE
            AND p.discovery_blocked_reason IS NULL
          )
          OR (
            p.is_demo_profile IS TRUE
            AND public.demo_profiles_visible()
          )
        )
    )
  )
);

CREATE OR REPLACE FUNCTION public.discover_profiles(_max_distance_km double precision DEFAULT NULL::double precision, _min_age integer DEFAULT NULL::integer, _max_age integer DEFAULT NULL::integer, _country text DEFAULT NULL::text, _city text DEFAULT NULL::text, _online_minutes integer DEFAULT NULL::integer, _verified_only boolean DEFAULT false, _has_bio boolean DEFAULT false, _interests text[] DEFAULT NULL::text[], _languages text[] DEFAULT NULL::text[], _religion text DEFAULT NULL::text, _education text DEFAULT NULL::text, _relationship_goal text DEFAULT NULL::text, _state text DEFAULT NULL::text, _premium_only boolean DEFAULT false, _recently_active_minutes integer DEFAULT NULL::integer, _profession text DEFAULT NULL::text, _smoking text DEFAULT NULL::text, _drinking text DEFAULT NULL::text, _workout text DEFAULT NULL::text, _family_plans text DEFAULT NULL::text, _pets text DEFAULT NULL::text, _limit integer DEFAULT 60)
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
      AND t.is_active = true
      AND t.onboarding_complete = true
      AND t.incognito = false
      AND (t.is_demo_profile IS NOT TRUE OR v_show_demo)
      AND NOT private.is_blocked(v_uid, t.id)
      AND NOT private.is_banned(t.id)
      AND NOT EXISTS (
        SELECT 1 FROM public.likes l
        WHERE l.liker_id = v_uid AND l.liked_id = t.id
      )
      AND public.pref_match(v_interested, t.gender)
      AND (
        (t.is_demo_profile IS TRUE AND v_show_demo)
        OR public.pref_match(t.interested_in, v_gender)
      )
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

GRANT EXECUTE ON FUNCTION public.discover_profiles(double precision, integer, integer, text, text, integer, boolean, boolean, text[], text[], text, text, text, text, boolean, integer, text, text, text, text, text, text, integer) TO authenticated;

DROP FUNCTION IF EXISTS public.get_visible_profiles(uuid[]);
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
  is_demo_profile boolean,
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
    p.is_demo_profile,
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
        NOT private.is_blocked(auth.uid(), p.id)
        AND NOT private.is_banned(p.id)
        AND (
          (
            p.is_demo_profile IS NOT TRUE
            AND public.profile_is_discoverable(p.id)
          )
          OR (
            p.is_demo_profile IS TRUE
            AND public.demo_profiles_visible()
            AND p.onboarding_complete IS TRUE
            AND p.is_active IS TRUE
            AND p.incognito IS FALSE
            AND EXISTS (
              SELECT 1
              FROM public.profile_photos pp
              WHERE pp.user_id = p.id
                AND pp.is_private IS NOT TRUE
                AND pp.moderation_status = 'approved'
            )
          )
        )
      )
    )
$$;

GRANT EXECUTE ON FUNCTION public.get_visible_profiles(uuid[]) TO authenticated;
