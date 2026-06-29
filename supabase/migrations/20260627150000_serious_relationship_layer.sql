-- Serious relationship profile fields and system-derived trust/compatibility.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS marriage_intention text,
  ADD COLUMN IF NOT EXISTS marriage_timeline text,
  ADD COLUMN IF NOT EXISTS wants_children text,
  ADD COLUMN IF NOT EXISTS has_children text,
  ADD COLUMN IF NOT EXISTS faith_or_values_importance text,
  ADD COLUMN IF NOT EXISTS family_values text,
  ADD COLUMN IF NOT EXISTS relocation_openness text,
  ADD COLUMN IF NOT EXISTS communication_style text,
  ADD COLUMN IF NOT EXISTS dealbreakers text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS long_distance_openness text,
  ADD COLUMN IF NOT EXISTS trust_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trust_level text NOT NULL DEFAULT 'low';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_marriage_intention_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_marriage_intention_check
      CHECK (marriage_intention IS NULL OR marriage_intention IN ('marriage','lifelong_partnership','open_to_marriage'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_marriage_timeline_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_marriage_timeline_check
      CHECK (marriage_timeline IS NULL OR marriage_timeline IN ('within_1_year','1_to_2_years','3_to_5_years','when_right'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_wants_children_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_wants_children_check
      CHECK (wants_children IS NULL OR wants_children IN ('yes','no','open'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_has_children_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_has_children_check
      CHECK (has_children IS NULL OR has_children IN ('no','yes_at_home','yes_not_at_home'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_faith_values_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_faith_values_check
      CHECK (faith_or_values_importance IS NULL OR faith_or_values_importance IN ('essential','important','somewhat','not_important'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_family_values_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_family_values_check
      CHECK (family_values IS NULL OR family_values IN ('traditional','balanced','independent','community_centered'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_relocation_openness_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_relocation_openness_check
      CHECK (relocation_openness IS NULL OR relocation_openness IN ('yes','maybe','no'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_communication_style_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_communication_style_check
      CHECK (communication_style IS NULL OR communication_style IN ('direct','reflective','expressive','calm'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_long_distance_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_long_distance_check
      CHECK (long_distance_openness IS NULL OR long_distance_openness IN ('yes','maybe','no'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_trust_level_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_trust_level_check
      CHECK (trust_level IN ('low','medium','high','verified'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_trust_score_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_trust_score_check
      CHECK (trust_score BETWEEN 0 AND 100);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.calculate_serious_profile_completion(_profile public.profiles)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT 10 * (
    (_profile.marriage_intention IS NOT NULL)::integer +
    (_profile.marriage_timeline IS NOT NULL)::integer +
    (_profile.wants_children IS NOT NULL)::integer +
    (_profile.has_children IS NOT NULL)::integer +
    (_profile.faith_or_values_importance IS NOT NULL)::integer +
    (_profile.family_values IS NOT NULL)::integer +
    (_profile.relocation_openness IS NOT NULL)::integer +
    (_profile.communication_style IS NOT NULL)::integer +
    (COALESCE(array_length(_profile.dealbreakers, 1), 0) > 0)::integer +
    (_profile.long_distance_openness IS NOT NULL)::integer
  )
$$;

CREATE OR REPLACE FUNCTION private.profile_trust_score(_profile public.profiles)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE
  score integer := 0;
  risk integer := 0;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.profile_photos pp
    WHERE pp.user_id = _profile.id AND pp.is_private IS NOT TRUE
  ) THEN score := score + 15; END IF;
  score := score + round(public.calculate_serious_profile_completion(_profile) * 0.30);
  IF _profile.email_verified THEN score := score + 10; END IF;
  IF _profile.is_verified THEN score := score + 15; END IF;
  IF _profile.safety_agreement_accepted_at IS NOT NULL THEN score := score + 10; END IF;
  score := score + CASE
    WHEN _profile.created_at <= now() - interval '180 days' THEN 10
    WHEN _profile.created_at <= now() - interval '30 days' THEN 5
    ELSE 0
  END;
  SELECT LEAST(
    COALESCE((SELECT count(*) * 8 FROM public.reports r WHERE r.reported_id = _profile.id), 0) +
    COALESCE((SELECT count(*) * 3 FROM public.blocks b WHERE b.blocked_id = _profile.id), 0),
    25
  )::integer INTO risk;
  RETURN GREATEST(0, LEAST(100, score - risk));
END;
$$;

CREATE OR REPLACE FUNCTION private.trust_level_for(_profile public.profiles, _score integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public', 'private'
AS $$
  SELECT CASE
    WHEN _profile.is_verified AND _score >= 75 THEN 'verified'
    WHEN _score >= 70 THEN 'high'
    WHEN _score >= 40 THEN 'medium'
    ELSE 'low'
  END
$$;

CREATE OR REPLACE FUNCTION public.sync_serious_relationship_scores()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE
  next_trust integer;
BEGIN
  NEW.profile_completion_score := round(
    public.calculate_profile_completion(NEW) * 0.70 +
    public.calculate_serious_profile_completion(NEW) * 0.30
  );
  next_trust := private.profile_trust_score(NEW);
  NEW.trust_score := next_trust;
  NEW.trust_level := private.trust_level_for(NEW, next_trust);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_serious_relationship_scores ON public.profiles;
CREATE TRIGGER sync_serious_relationship_scores
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_serious_relationship_scores();

CREATE OR REPLACE FUNCTION private.refresh_profile_trust()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE
  affected_id uuid;
BEGIN
  affected_id := CASE TG_TABLE_NAME
    WHEN 'profile_photos' THEN COALESCE(NEW.user_id, OLD.user_id)
    WHEN 'reports' THEN COALESCE(NEW.reported_id, OLD.reported_id)
    WHEN 'blocks' THEN COALESCE(NEW.blocked_id, OLD.blocked_id)
  END;
  IF affected_id IS NOT NULL THEN
    UPDATE public.profiles SET updated_at = updated_at WHERE id = affected_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS refresh_trust_from_photos ON public.profile_photos;
CREATE TRIGGER refresh_trust_from_photos AFTER INSERT OR UPDATE OR DELETE ON public.profile_photos
FOR EACH ROW EXECUTE FUNCTION private.refresh_profile_trust();
DROP TRIGGER IF EXISTS refresh_trust_from_reports ON public.reports;
CREATE TRIGGER refresh_trust_from_reports AFTER INSERT OR UPDATE OR DELETE ON public.reports
FOR EACH ROW EXECUTE FUNCTION private.refresh_profile_trust();
DROP TRIGGER IF EXISTS refresh_trust_from_blocks ON public.blocks;
CREATE TRIGGER refresh_trust_from_blocks AFTER INSERT OR UPDATE OR DELETE ON public.blocks
FOR EACH ROW EXECUTE FUNCTION private.refresh_profile_trust();

-- Demo data may be generated; real members intentionally remain unanswered.
UPDATE public.profiles
SET marriage_intention = COALESCE(marriage_intention, 'marriage'),
    marriage_timeline = COALESCE(marriage_timeline, '1_to_2_years'),
    wants_children = COALESCE(wants_children, 'open'),
    has_children = COALESCE(has_children, 'no'),
    faith_or_values_importance = COALESCE(faith_or_values_importance, 'important'),
    family_values = COALESCE(family_values, 'balanced'),
    relocation_openness = COALESCE(relocation_openness, 'maybe'),
    communication_style = COALESCE(communication_style, 'direct'),
    dealbreakers = CASE WHEN cardinality(dealbreakers) = 0 THEN ARRAY['dishonesty','disrespect'] ELSE dealbreakers END,
    long_distance_openness = COALESCE(long_distance_openness, 'maybe')
WHERE is_demo_profile IS TRUE;

CREATE OR REPLACE FUNCTION public.serious_compatibility_breakdown(
  viewer_profile public.profiles,
  target_profile public.profiles,
  distance_m double precision DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  goal_score numeric; timeline_score numeric; children_score numeric;
  faith_score numeric; relocation_score numeric; communication_score numeric;
  dealbreaker_score numeric; distance_score numeric; total numeric;
  conflict boolean := false;
BEGIN
  goal_score := CASE WHEN viewer_profile.relationship_goal IS NULL OR target_profile.relationship_goal IS NULL THEN .5
    WHEN viewer_profile.relationship_goal = target_profile.relationship_goal THEN 1 ELSE 0 END;
  timeline_score := CASE WHEN viewer_profile.marriage_timeline IS NULL OR target_profile.marriage_timeline IS NULL THEN .5
    WHEN viewer_profile.marriage_timeline = target_profile.marriage_timeline THEN 1 ELSE .35 END;
  children_score := CASE WHEN viewer_profile.wants_children IS NULL OR target_profile.wants_children IS NULL THEN .5
    WHEN viewer_profile.wants_children = target_profile.wants_children THEN 1
    WHEN 'open' IN (viewer_profile.wants_children, target_profile.wants_children) THEN .65 ELSE 0 END;
  faith_score := CASE WHEN viewer_profile.faith_or_values_importance IS NULL OR target_profile.faith_or_values_importance IS NULL THEN .5
    WHEN viewer_profile.faith_or_values_importance = target_profile.faith_or_values_importance THEN 1 ELSE .4 END;
  relocation_score := CASE WHEN viewer_profile.relocation_openness IS NULL OR target_profile.relocation_openness IS NULL THEN .5
    WHEN viewer_profile.relocation_openness = target_profile.relocation_openness THEN 1
    WHEN 'maybe' IN (viewer_profile.relocation_openness, target_profile.relocation_openness) THEN .65 ELSE .2 END;
  communication_score := CASE WHEN viewer_profile.communication_style IS NULL OR target_profile.communication_style IS NULL THEN .5
    WHEN viewer_profile.communication_style = target_profile.communication_style THEN 1 ELSE .55 END;
  conflict :=
    ('different_children_goals' = ANY(COALESCE(viewer_profile.dealbreakers, '{}')) AND children_score = 0)
    OR ('different_faith_values' = ANY(COALESCE(viewer_profile.dealbreakers, '{}')) AND faith_score < .5);
  dealbreaker_score := CASE WHEN conflict THEN 0 ELSE 1 END;
  distance_score := CASE WHEN distance_m IS NULL THEN .5 ELSE GREATEST(0, 1 - distance_m / 250000.0) END;
  total := 20*goal_score + 15*timeline_score + 18*children_score + 12*faith_score +
    10*relocation_score + 10*communication_score + 10*dealbreaker_score + 5*distance_score;
  RETURN jsonb_build_object(
    'score', round(total),
    'shared_interests', '[]'::jsonb,
    'shared_goal', goal_score = 1,
    'dealbreaker_conflict', conflict,
    'factors', jsonb_build_array(
      jsonb_build_object('key','goal','label','Relationship goal','weight',20,'pct',round(goal_score*100)),
      jsonb_build_object('key','marriage_timeline','label','Marriage timeline','weight',15,'pct',round(timeline_score*100)),
      jsonb_build_object('key','children','label','Children preference','weight',18,'pct',round(children_score*100)),
      jsonb_build_object('key','faith_values','label','Faith and values','weight',12,'pct',round(faith_score*100)),
      jsonb_build_object('key','relocation','label','Relocation openness','weight',10,'pct',round(relocation_score*100)),
      jsonb_build_object('key','communication','label','Communication style','weight',10,'pct',round(communication_score*100)),
      jsonb_build_object('key','dealbreakers','label','Dealbreaker alignment','weight',10,'pct',round(dealbreaker_score*100)),
      jsonb_build_object('key','distance','label','Distance','weight',5,'pct',round(distance_score*100))
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.compatibility_scores(_ids uuid[])
RETURNS TABLE(id uuid, score integer, breakdown jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'private'
AS $$
DECLARE v public.profiles%ROWTYPE; v_uid uuid := auth.uid();
BEGIN
  SELECT * INTO v FROM public.profiles WHERE profiles.id = v_uid;
  RETURN QUERY
  SELECT t.id, (b.bd->>'score')::integer, b.bd
  FROM public.profiles t
  CROSS JOIN LATERAL (
    SELECT public.serious_compatibility_breakdown(
      v, t,
      CASE WHEN v.location_geog IS NOT NULL AND t.location_geog IS NOT NULL
        THEN extensions.st_distance(v.location_geog, t.location_geog) ELSE NULL END
    ) bd
  ) b
  WHERE t.id = ANY(_ids) AND t.id <> v_uid
    AND NOT private.is_blocked(v_uid, t.id) AND NOT private.is_banned(t.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.recommended_matches(_kind text DEFAULT 'recommended', _limit integer DEFAULT 30)
RETURNS TABLE(id uuid, distance_m double precision, score integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'private'
AS $$
DECLARE v public.profiles%ROWTYPE; v_uid uuid := auth.uid();
BEGIN
  SELECT * INTO v FROM public.profiles WHERE profiles.id = v_uid;
  RETURN QUERY
  SELECT q.id, q.distance_m, q.score
  FROM (
    SELECT t.id,
      CASE WHEN v.location_geog IS NOT NULL AND t.location_geog IS NOT NULL AND NOT t.hide_distance
        THEN extensions.st_distance(v.location_geog, t.location_geog) ELSE NULL END distance_m,
      (public.serious_compatibility_breakdown(
        v, t,
        CASE WHEN v.location_geog IS NOT NULL AND t.location_geog IS NOT NULL
          THEN extensions.st_distance(v.location_geog, t.location_geog) ELSE NULL END
      )->>'score')::integer score
    FROM public.profiles t
    WHERE t.id <> v_uid
      AND ((t.is_demo_profile AND public.demo_profile_is_discoverable(t.id))
        OR (NOT t.is_demo_profile AND public.profile_is_discoverable(t.id)))
      AND NOT private.is_blocked(v_uid, t.id) AND NOT private.is_banned(t.id)
      AND public.pref_match(v.interested_in, t.gender)
      AND (t.is_demo_profile OR public.pref_match(t.interested_in, v.gender))
      AND NOT EXISTS (SELECT 1 FROM public.likes l WHERE l.liker_id = v_uid AND l.liked_id = t.id)
  ) q
  WHERE _kind <> 'compatible' OR q.score >= 55
  ORDER BY q.score DESC, q.distance_m ASC NULLS LAST
  LIMIT GREATEST(_limit, 1);
END;
$$;

DROP FUNCTION IF EXISTS public.get_visible_profiles(uuid[]);
CREATE FUNCTION public.get_visible_profiles(_ids uuid[])
RETURNS TABLE(
  id uuid, display_name text, updated_at timestamptz, created_at timestamptz,
  last_active timestamptz, onboarding_complete boolean, is_featured boolean,
  is_verified boolean, is_demo_profile boolean, membership_tier public.membership_tier,
  interests text[], bio text, location_country text, location_city text,
  interested_in text[], gender text, latitude double precision, longitude double precision,
  location_state text, location_hidden boolean, location_access_suspended boolean,
  languages text[], location_updated_at timestamptz, religion text, education text,
  relationship_goal text, birth_date date, marriage_intention text, marriage_timeline text,
  wants_children text, has_children text, faith_or_values_importance text, family_values text,
  relocation_openness text, communication_style text, dealbreakers text[],
  long_distance_openness text, profile_completion_score integer, trust_score integer,
  trust_level text
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
  SELECT
    p.id, p.display_name, p.updated_at, p.created_at, p.last_active,
    p.onboarding_complete, p.is_featured, p.is_verified, p.is_demo_profile,
    p.membership_tier, p.interests, p.bio, p.location_country, p.location_city,
    p.interested_in, p.gender,
    CASE WHEN p.id = auth.uid() OR private.has_min_role(auth.uid(), 'admin'::app_role) THEN p.latitude ELSE NULL END,
    CASE WHEN p.id = auth.uid() OR private.has_min_role(auth.uid(), 'admin'::app_role) THEN p.longitude ELSE NULL END,
    p.location_state, p.location_hidden, p.location_access_suspended, p.languages,
    p.location_updated_at, p.religion, p.education, p.relationship_goal,
    CASE WHEN p.id = auth.uid() OR private.has_min_role(auth.uid(), 'admin'::app_role)
      THEN p.birth_date ELSE make_date(EXTRACT(YEAR FROM p.birth_date)::integer, 1, 1) END,
    p.marriage_intention, p.marriage_timeline, p.wants_children, p.has_children,
    p.faith_or_values_importance, p.family_values, p.relocation_openness,
    p.communication_style, p.dealbreakers, p.long_distance_openness,
    p.profile_completion_score, p.trust_score, p.trust_level
  FROM public.profiles p
  WHERE p.id = ANY(_ids)
    AND (p.id = auth.uid() OR private.has_min_role(auth.uid(), 'admin'::app_role)
      OR (NOT private.is_blocked(auth.uid(), p.id) AND NOT private.is_banned(p.id)
        AND ((p.is_demo_profile AND public.demo_profile_is_discoverable(p.id))
          OR (NOT p.is_demo_profile AND public.profile_is_discoverable(p.id)))))
$$;

REVOKE EXECUTE ON FUNCTION private.profile_trust_score(public.profiles) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION private.refresh_profile_trust() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_serious_relationship_scores() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_visible_profiles(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.compatibility_scores(uuid[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.recommended_matches(text, integer) TO authenticated, service_role;

UPDATE public.profiles SET updated_at = updated_at;
