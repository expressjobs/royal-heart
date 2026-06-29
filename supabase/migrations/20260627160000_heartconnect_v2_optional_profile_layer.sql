-- HeartConnect v2 optional serious relationship layer.
-- Adds optional profile dimensions, privacy controls, and deterministic explanations
-- without backfilling real-user answers.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS parenting_preferences text,
  ADD COLUMN IF NOT EXISTS conflict_resolution_style text,
  ADD COLUMN IF NOT EXISTS love_language text,
  ADD COLUMN IF NOT EXISTS work_life_balance text,
  ADD COLUMN IF NOT EXISTS education_importance text,
  ADD COLUMN IF NOT EXISTS faith text,
  ADD COLUMN IF NOT EXISTS faith_importance text,
  ADD COLUMN IF NOT EXISTS culture_background text,
  ADD COLUMN IF NOT EXISTS languages_spoken text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS personality_type text,
  ADD COLUMN IF NOT EXISTS hobbies text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS partner_expectations text,
  ADD COLUMN IF NOT EXISTS future_plans text,
  ADD COLUMN IF NOT EXISTS serious_profile_visibility jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS phone_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS identity_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS photo_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trust_explanation jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_conflict_resolution_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_conflict_resolution_check
      CHECK (conflict_resolution_style IS NULL OR conflict_resolution_style IN ('talk_it_through','pause_then_discuss','mediated','solution_focused'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_love_language_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_love_language_check
      CHECK (love_language IS NULL OR love_language IN ('quality_time','words','acts','gifts','touch'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_work_life_balance_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_work_life_balance_check
      CHECK (work_life_balance IS NULL OR work_life_balance IN ('career_focused','balanced','family_first','flexible'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_education_importance_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_education_importance_check
      CHECK (education_importance IS NULL OR education_importance IN ('essential','important','flexible','not_important'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_faith_importance_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_faith_importance_check
      CHECK (faith_importance IS NULL OR faith_importance IN ('essential','important','somewhat','not_important'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_culture_background_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_culture_background_check
      CHECK (culture_background IS NULL OR culture_background IN ('african','diaspora','multicultural','western','asian','middle_eastern','latin','prefer_not'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_personality_type_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_personality_type_check
      CHECK (personality_type IS NULL OR personality_type IN ('introvert','ambivert','extrovert','analytical','empathetic','adventurous'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_partner_expectations_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_partner_expectations_check
      CHECK (partner_expectations IS NULL OR partner_expectations IN ('intentional_courtship','shared_values','family_alignment','emotional_maturity','financial_responsibility'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_future_plans_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_future_plans_check
      CHECK (future_plans IS NULL OR future_plans IN ('build_family','career_and_family','travel_together','settle_locally','open_to_paths'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_serious_visibility_object_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_serious_visibility_object_check
      CHECK (jsonb_typeof(serious_profile_visibility) = 'object');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.calculate_serious_profile_completion(_profile public.profiles)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT round(100.0 * (
    (_profile.marriage_intention IS NOT NULL)::integer +
    (_profile.marriage_timeline IS NOT NULL)::integer +
    (_profile.wants_children IS NOT NULL)::integer +
    (_profile.has_children IS NOT NULL)::integer +
    (_profile.faith_or_values_importance IS NOT NULL)::integer +
    (_profile.family_values IS NOT NULL)::integer +
    (_profile.relocation_openness IS NOT NULL)::integer +
    (_profile.communication_style IS NOT NULL)::integer +
    (COALESCE(array_length(_profile.dealbreakers, 1), 0) > 0)::integer +
    (_profile.long_distance_openness IS NOT NULL)::integer +
    (_profile.parenting_preferences IS NOT NULL)::integer +
    (_profile.conflict_resolution_style IS NOT NULL)::integer +
    (_profile.love_language IS NOT NULL)::integer +
    (_profile.work_life_balance IS NOT NULL)::integer +
    (_profile.education_importance IS NOT NULL)::integer +
    (COALESCE(_profile.faith_importance, _profile.faith_or_values_importance) IS NOT NULL)::integer +
    (_profile.culture_background IS NOT NULL)::integer +
    (_profile.personality_type IS NOT NULL)::integer +
    (COALESCE(array_length(_profile.hobbies, 1), 0) > 0)::integer +
    (_profile.partner_expectations IS NOT NULL)::integer +
    (_profile.future_plans IS NOT NULL)::integer
  ) / 21.0)::integer
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
  good_conversations integer := 0;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.profile_photos pp
    WHERE pp.user_id = _profile.id AND pp.is_private IS NOT TRUE
  ) THEN score := score + 12; END IF;
  score := score + round(public.calculate_serious_profile_completion(_profile) * 0.20);
  score := score + round(COALESCE(_profile.profile_completion_score, 0) * 0.10);
  IF _profile.email_verified THEN score := score + 8; END IF;
  IF _profile.phone_verified THEN score := score + 8; END IF;
  IF _profile.photo_verified OR _profile.is_verified THEN score := score + 12; END IF;
  IF _profile.identity_verified OR _profile.is_verified THEN score := score + 12; END IF;
  IF _profile.safety_agreement_accepted_at IS NOT NULL THEN score := score + 8; END IF;
  score := score + CASE
    WHEN _profile.created_at <= now() - interval '180 days' THEN 8
    WHEN _profile.created_at <= now() - interval '30 days' THEN 4
    ELSE 0
  END;
  SELECT count(DISTINCT m.match_id)::integer INTO good_conversations
  FROM public.messages m
  WHERE m.sender_id = _profile.id;
  score := score + LEAST(good_conversations * 2, 8);
  SELECT LEAST(
    COALESCE((SELECT count(*) * 8 FROM public.reports r WHERE r.reported_id = _profile.id AND r.status IN ('pending','reviewed')), 0) +
    COALESCE((SELECT count(*) * 3 FROM public.blocks b WHERE b.blocked_id = _profile.id), 0),
    30
  )::integer INTO risk;
  RETURN GREATEST(0, LEAST(100, score - risk));
END;
$$;

CREATE OR REPLACE FUNCTION private.profile_trust_explanation(_profile public.profiles, _score integer)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
  SELECT jsonb_build_object(
    'score', _score,
    'positives', jsonb_strip_nulls(jsonb_build_array(
      CASE WHEN EXISTS (SELECT 1 FROM public.profile_photos pp WHERE pp.user_id = _profile.id AND pp.is_private IS NOT TRUE) THEN 'Profile photo added' END,
      CASE WHEN public.calculate_serious_profile_completion(_profile) >= 70 THEN 'Serious relationship profile is detailed' END,
      CASE WHEN _profile.email_verified THEN 'Email verified' END,
      CASE WHEN _profile.phone_verified THEN 'Phone verified' END,
      CASE WHEN _profile.photo_verified OR _profile.is_verified THEN 'Photo/profile verification approved' END,
      CASE WHEN _profile.identity_verified OR _profile.is_verified THEN 'Identity verification approved' END,
      CASE WHEN _profile.safety_agreement_accepted_at IS NOT NULL THEN 'Safety agreement accepted' END,
      CASE WHEN _profile.created_at <= now() - interval '30 days' THEN 'Account has history' END
    )),
    'risks', jsonb_strip_nulls(jsonb_build_array(
      CASE WHEN EXISTS (SELECT 1 FROM public.reports r WHERE r.reported_id = _profile.id AND r.status IN ('pending','reviewed')) THEN 'Open report risk' END,
      CASE WHEN EXISTS (SELECT 1 FROM public.blocks b WHERE b.blocked_id = _profile.id) THEN 'Block history' END
    ))
  )
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
  NEW.languages_spoken := COALESCE(NULLIF(NEW.languages_spoken, '{}'), NEW.languages, '{}');
  NEW.faith := COALESCE(NULLIF(NEW.faith, ''), NEW.religion);
  NEW.faith_importance := COALESCE(NULLIF(NEW.faith_importance, ''), NEW.faith_or_values_importance);
  NEW.profile_completion_score := round(
    public.calculate_profile_completion(NEW) * 0.60 +
    public.calculate_serious_profile_completion(NEW) * 0.40
  );
  next_trust := private.profile_trust_score(NEW);
  NEW.trust_score := next_trust;
  NEW.trust_level := private.trust_level_for(NEW, next_trust);
  NEW.trust_explanation := private.profile_trust_explanation(NEW, next_trust);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.serious_field_visible(_profile_id uuid, _visibility jsonb, _field text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
  SELECT CASE
    WHEN _profile_id = auth.uid() THEN true
    WHEN private.has_min_role(auth.uid(), 'admin'::public.app_role) THEN true
    WHEN COALESCE(_visibility ->> _field, 'public') = 'public' THEN true
    WHEN COALESCE(_visibility ->> _field, 'public') = 'matches' THEN EXISTS (
      SELECT 1 FROM public.matches m
      WHERE (m.user1_id = auth.uid() AND m.user2_id = _profile_id)
         OR (m.user2_id = auth.uid() AND m.user1_id = _profile_id)
    )
    ELSE false
  END
$$;

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
  dealbreaker_score numeric; personality_score numeric; lifestyle_score numeric;
  education_score numeric; long_distance_score numeric; interests_score numeric;
  distance_score numeric; activity_score numeric; total numeric;
  shared_interests text[];
  conflict boolean := false;
  explanation text[];
BEGIN
  SELECT ARRAY(
    SELECT unnest(COALESCE(viewer_profile.interests, '{}'))
    INTERSECT
    SELECT unnest(COALESCE(target_profile.interests, '{}'))
  ) INTO shared_interests;
  goal_score := CASE WHEN viewer_profile.relationship_goal IS NULL OR target_profile.relationship_goal IS NULL THEN .5
    WHEN viewer_profile.relationship_goal = target_profile.relationship_goal THEN 1 ELSE .25 END;
  timeline_score := CASE WHEN viewer_profile.marriage_timeline IS NULL OR target_profile.marriage_timeline IS NULL THEN .5
    WHEN viewer_profile.marriage_timeline = target_profile.marriage_timeline THEN 1 ELSE .35 END;
  children_score := CASE WHEN viewer_profile.wants_children IS NULL OR target_profile.wants_children IS NULL THEN .5
    WHEN viewer_profile.wants_children = target_profile.wants_children THEN 1
    WHEN 'open' IN (viewer_profile.wants_children, target_profile.wants_children) THEN .65 ELSE 0 END;
  faith_score := CASE WHEN COALESCE(viewer_profile.faith_importance, viewer_profile.faith_or_values_importance) IS NULL
      OR COALESCE(target_profile.faith_importance, target_profile.faith_or_values_importance) IS NULL THEN .5
    WHEN COALESCE(viewer_profile.faith_importance, viewer_profile.faith_or_values_importance) = COALESCE(target_profile.faith_importance, target_profile.faith_or_values_importance) THEN 1 ELSE .4 END;
  relocation_score := CASE WHEN viewer_profile.relocation_openness IS NULL OR target_profile.relocation_openness IS NULL THEN .5
    WHEN viewer_profile.relocation_openness = target_profile.relocation_openness THEN 1
    WHEN 'maybe' IN (viewer_profile.relocation_openness, target_profile.relocation_openness) THEN .65 ELSE .2 END;
  communication_score := CASE WHEN viewer_profile.communication_style IS NULL OR target_profile.communication_style IS NULL THEN .5
    WHEN viewer_profile.communication_style = target_profile.communication_style THEN 1 ELSE .55 END;
  personality_score := CASE WHEN viewer_profile.personality_type IS NULL OR target_profile.personality_type IS NULL THEN .5
    WHEN viewer_profile.personality_type = target_profile.personality_type THEN 1 ELSE .6 END;
  lifestyle_score := CASE WHEN viewer_profile.work_life_balance IS NULL OR target_profile.work_life_balance IS NULL THEN .5
    WHEN viewer_profile.work_life_balance = target_profile.work_life_balance THEN 1 ELSE .6 END;
  education_score := CASE WHEN viewer_profile.education_importance IS NULL OR target_profile.education_importance IS NULL THEN .5
    WHEN viewer_profile.education_importance = target_profile.education_importance THEN 1 ELSE .55 END;
  long_distance_score := CASE WHEN viewer_profile.long_distance_openness IS NULL OR target_profile.long_distance_openness IS NULL THEN .5
    WHEN viewer_profile.long_distance_openness = target_profile.long_distance_openness THEN 1
    WHEN 'maybe' IN (viewer_profile.long_distance_openness, target_profile.long_distance_openness) THEN .7 ELSE .25 END;
  interests_score := LEAST(COALESCE(array_length(shared_interests, 1), 0)::numeric / 3.0, 1);
  conflict :=
    ('different_children_goals' = ANY(COALESCE(viewer_profile.dealbreakers, '{}')) AND children_score = 0)
    OR ('different_faith_values' = ANY(COALESCE(viewer_profile.dealbreakers, '{}')) AND faith_score < .5);
  dealbreaker_score := CASE WHEN conflict THEN 0 ELSE 1 END;
  distance_score := CASE WHEN distance_m IS NULL THEN .5 ELSE GREATEST(0, 1 - distance_m / 250000.0) END;
  activity_score := CASE
    WHEN target_profile.last_active >= now() - interval '1 day' THEN 1
    WHEN target_profile.last_active >= now() - interval '7 days' THEN .7
    ELSE .35
  END;
  total := 14*goal_score + 12*timeline_score + 13*children_score + 10*faith_score +
    8*relocation_score + 8*communication_score + 8*dealbreaker_score + 6*personality_score +
    5*lifestyle_score + 5*education_score + 5*long_distance_score + 3*interests_score +
    2*distance_score + 1*activity_score;
  explanation := ARRAY_REMOVE(ARRAY[
    CASE WHEN goal_score = 1 THEN 'Matching relationship goals' END,
    CASE WHEN timeline_score = 1 THEN 'Aligned marriage timeline' END,
    CASE WHEN children_score >= .65 THEN 'Compatible children preference' END,
    CASE WHEN communication_score >= .55 THEN 'Compatible communication style' END,
    CASE WHEN relocation_score >= .65 THEN 'Relocation openness is workable' END,
    CASE WHEN long_distance_score >= .7 THEN 'Long-distance expectations are aligned' END,
    CASE WHEN COALESCE(array_length(shared_interests, 1), 0) > 0 THEN 'Shared interests' END,
    CASE WHEN NOT conflict THEN 'No declared dealbreaker conflict' END
  ], NULL);
  RETURN jsonb_build_object(
    'score', round(total),
    'shared_interests', COALESCE(to_jsonb(shared_interests), '[]'::jsonb),
    'shared_goal', goal_score = 1,
    'dealbreaker_conflict', conflict,
    'explanation', COALESCE(to_jsonb(explanation), '[]'::jsonb),
    'factors', jsonb_build_array(
      jsonb_build_object('key','goal','label','Relationship goal','weight',14,'pct',round(goal_score*100)),
      jsonb_build_object('key','marriage_timeline','label','Marriage timeline','weight',12,'pct',round(timeline_score*100)),
      jsonb_build_object('key','children','label','Children preference','weight',13,'pct',round(children_score*100)),
      jsonb_build_object('key','faith_values','label','Faith and values','weight',10,'pct',round(faith_score*100)),
      jsonb_build_object('key','relocation','label','Relocation openness','weight',8,'pct',round(relocation_score*100)),
      jsonb_build_object('key','communication','label','Communication style','weight',8,'pct',round(communication_score*100)),
      jsonb_build_object('key','dealbreakers','label','Dealbreaker alignment','weight',8,'pct',round(dealbreaker_score*100)),
      jsonb_build_object('key','personality','label','Personality','weight',6,'pct',round(personality_score*100)),
      jsonb_build_object('key','lifestyle','label','Lifestyle','weight',5,'pct',round(lifestyle_score*100)),
      jsonb_build_object('key','education','label','Education','weight',5,'pct',round(education_score*100)),
      jsonb_build_object('key','long_distance','label','Long distance','weight',5,'pct',round(long_distance_score*100)),
      jsonb_build_object('key','interests','label','Shared interests','weight',3,'pct',round(interests_score*100)),
      jsonb_build_object('key','distance','label','Distance','weight',2,'pct',round(distance_score*100)),
      jsonb_build_object('key','activity','label','Activity','weight',1,'pct',round(activity_score*100))
    )
  );
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
  trust_level text, parenting_preferences text, conflict_resolution_style text,
  love_language text, work_life_balance text, education_importance text, faith text,
  faith_importance text, culture_background text, languages_spoken text[],
  personality_type text, hobbies text[], partner_expectations text, future_plans text,
  phone_verified boolean, identity_verified boolean, photo_verified boolean,
  trust_explanation jsonb
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
    CASE WHEN private.serious_field_visible(p.id, p.serious_profile_visibility, 'marriage_intention') THEN p.marriage_intention ELSE NULL END,
    CASE WHEN private.serious_field_visible(p.id, p.serious_profile_visibility, 'marriage_timeline') THEN p.marriage_timeline ELSE NULL END,
    CASE WHEN private.serious_field_visible(p.id, p.serious_profile_visibility, 'wants_children') THEN p.wants_children ELSE NULL END,
    CASE WHEN private.serious_field_visible(p.id, p.serious_profile_visibility, 'has_children') THEN p.has_children ELSE NULL END,
    CASE WHEN private.serious_field_visible(p.id, p.serious_profile_visibility, 'faith_or_values_importance') THEN p.faith_or_values_importance ELSE NULL END,
    CASE WHEN private.serious_field_visible(p.id, p.serious_profile_visibility, 'family_values') THEN p.family_values ELSE NULL END,
    CASE WHEN private.serious_field_visible(p.id, p.serious_profile_visibility, 'relocation_openness') THEN p.relocation_openness ELSE NULL END,
    CASE WHEN private.serious_field_visible(p.id, p.serious_profile_visibility, 'communication_style') THEN p.communication_style ELSE NULL END,
    CASE WHEN private.serious_field_visible(p.id, p.serious_profile_visibility, 'dealbreakers') THEN p.dealbreakers ELSE '{}'::text[] END,
    CASE WHEN private.serious_field_visible(p.id, p.serious_profile_visibility, 'long_distance_openness') THEN p.long_distance_openness ELSE NULL END,
    p.profile_completion_score, p.trust_score, p.trust_level,
    CASE WHEN private.serious_field_visible(p.id, p.serious_profile_visibility, 'parenting_preferences') THEN p.parenting_preferences ELSE NULL END,
    CASE WHEN private.serious_field_visible(p.id, p.serious_profile_visibility, 'conflict_resolution_style') THEN p.conflict_resolution_style ELSE NULL END,
    CASE WHEN private.serious_field_visible(p.id, p.serious_profile_visibility, 'love_language') THEN p.love_language ELSE NULL END,
    CASE WHEN private.serious_field_visible(p.id, p.serious_profile_visibility, 'work_life_balance') THEN p.work_life_balance ELSE NULL END,
    CASE WHEN private.serious_field_visible(p.id, p.serious_profile_visibility, 'education_importance') THEN p.education_importance ELSE NULL END,
    CASE WHEN private.serious_field_visible(p.id, p.serious_profile_visibility, 'faith') THEN p.faith ELSE NULL END,
    CASE WHEN private.serious_field_visible(p.id, p.serious_profile_visibility, 'faith_importance') THEN p.faith_importance ELSE NULL END,
    CASE WHEN private.serious_field_visible(p.id, p.serious_profile_visibility, 'culture_background') THEN p.culture_background ELSE NULL END,
    CASE WHEN private.serious_field_visible(p.id, p.serious_profile_visibility, 'languages_spoken') THEN p.languages_spoken ELSE '{}'::text[] END,
    CASE WHEN private.serious_field_visible(p.id, p.serious_profile_visibility, 'personality_type') THEN p.personality_type ELSE NULL END,
    CASE WHEN private.serious_field_visible(p.id, p.serious_profile_visibility, 'hobbies') THEN p.hobbies ELSE '{}'::text[] END,
    CASE WHEN private.serious_field_visible(p.id, p.serious_profile_visibility, 'partner_expectations') THEN p.partner_expectations ELSE NULL END,
    CASE WHEN private.serious_field_visible(p.id, p.serious_profile_visibility, 'future_plans') THEN p.future_plans ELSE NULL END,
    p.phone_verified, p.identity_verified, p.photo_verified, p.trust_explanation
  FROM public.profiles p
  WHERE p.id = ANY(_ids)
    AND (p.id = auth.uid() OR private.has_min_role(auth.uid(), 'admin'::app_role)
      OR (NOT private.is_blocked(auth.uid(), p.id) AND NOT private.is_banned(p.id)
        AND ((p.is_demo_profile AND public.demo_profile_is_discoverable(p.id))
          OR (NOT p.is_demo_profile AND public.profile_is_discoverable(p.id)))))
$$;

REVOKE EXECUTE ON FUNCTION private.profile_trust_score(public.profiles) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION private.profile_trust_explanation(public.profiles, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION private.serious_field_visible(uuid, jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_serious_relationship_scores() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_visible_profiles(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.compatibility_scores(uuid[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.recommended_matches(text, integer) TO authenticated, service_role;

-- Demo profiles may receive generated v2 answers. Real users remain null until
-- they complete the fields themselves.
UPDATE public.profiles
SET parenting_preferences = COALESCE(parenting_preferences, 'shared_parenting'),
    conflict_resolution_style = COALESCE(conflict_resolution_style, 'pause_then_discuss'),
    love_language = COALESCE(love_language, 'quality_time'),
    work_life_balance = COALESCE(work_life_balance, 'balanced'),
    education_importance = COALESCE(education_importance, 'important'),
    faith = COALESCE(faith, religion),
    faith_importance = COALESCE(faith_importance, faith_or_values_importance),
    culture_background = COALESCE(culture_background, 'multicultural'),
    languages_spoken = COALESCE(NULLIF(languages_spoken, '{}'), languages, '{}'),
    personality_type = COALESCE(personality_type, 'ambivert'),
    hobbies = CASE WHEN cardinality(hobbies) = 0 THEN ARRAY['travel','cooking'] ELSE hobbies END,
    partner_expectations = COALESCE(partner_expectations, 'shared_values'),
    future_plans = COALESCE(future_plans, 'career_and_family')
WHERE is_demo_profile IS TRUE;

UPDATE public.profiles SET updated_at = updated_at;
