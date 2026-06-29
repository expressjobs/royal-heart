
-- ============================================================
-- Phase 6 — AI Matching Engine
-- ============================================================

-- 1. INTERACTION EVENTS (ML signal store + recommendation feedback loop)
CREATE TABLE public.interaction_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  signal_type text NOT NULL CHECK (signal_type IN (
    'view','like','pass','superlike','match','chat_open','message_sent',
    'recommendation_shown','recommendation_clicked','recommendation_dismissed'
  )),
  weight real NOT NULL DEFAULT 1,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.interaction_events TO authenticated;
GRANT ALL ON public.interaction_events TO service_role;

ALTER TABLE public.interaction_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Insert own interaction events" ON public.interaction_events
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "View own interaction events" ON public.interaction_events
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX idx_interaction_events_user ON public.interaction_events (user_id, created_at DESC);
CREATE INDEX idx_interaction_events_target ON public.interaction_events (target_id);
CREATE INDEX idx_interaction_events_type ON public.interaction_events (signal_type, created_at DESC);

-- 2. DAILY RECOMMENDATIONS (cached personalised feed)
CREATE TABLE public.daily_recommendations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score int NOT NULL DEFAULT 0,
  rec_rank int NOT NULL DEFAULT 0,
  rec_date date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, target_id, rec_date)
);

GRANT SELECT ON public.daily_recommendations TO authenticated;
GRANT ALL ON public.daily_recommendations TO service_role;

ALTER TABLE public.daily_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own daily recommendations" ON public.daily_recommendations
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX idx_daily_recs_user_date ON public.daily_recommendations (user_id, rec_date, rec_rank);

-- ============================================================
-- 3. COMPATIBILITY SCORING ENGINE
-- ============================================================
-- Pure, deterministic breakdown builder. Weights sum to 100.
CREATE OR REPLACE FUNCTION public.compat_breakdown(
  v_interests text[], t_interests text[],
  v_goal text, t_goal text,
  v_langs text[], t_langs text[],
  v_education text, t_education text,
  v_religion text, t_religion text,
  v_smoking text, t_smoking text,
  v_drinking text, t_drinking text,
  v_workout text, t_workout text,
  v_family text, t_family text,
  v_pets text, t_pets text,
  v_birth date, t_birth date,
  distance_m double precision,
  t_verified boolean,
  t_completeness numeric
) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE
SET search_path = public
AS $$
DECLARE
  shared_interests text[];
  shared_lang_count int;
  age_diff numeric;
  s_interest numeric; s_goal numeric; s_distance numeric; s_age numeric;
  s_lang numeric; s_family numeric; s_smoking numeric; s_drinking numeric;
  s_workout numeric; s_pets numeric; s_education numeric; s_religion numeric;
  s_verified numeric; s_complete numeric; s_lifestyle numeric; total numeric;
BEGIN
  SELECT array_agg(x) INTO shared_interests
  FROM unnest(COALESCE(v_interests, '{}')) x
  WHERE x = ANY(COALESCE(t_interests, '{}'));
  s_interest := LEAST(COALESCE(array_length(shared_interests, 1), 0)::numeric / 3.0, 1.0);

  s_goal := CASE WHEN v_goal IS NULL OR t_goal IS NULL THEN 0.4
                 WHEN v_goal = t_goal THEN 1.0 ELSE 0.0 END;

  s_distance := CASE WHEN distance_m IS NULL THEN 0.5
                     ELSE GREATEST(0.0, 1.0 - (distance_m / (160.0 * 1000.0))) END;

  IF v_birth IS NULL OR t_birth IS NULL THEN
    s_age := 0.5;
  ELSE
    age_diff := abs(t_birth - v_birth)::numeric / 365.25;
    s_age := GREATEST(0.0, 1.0 - age_diff / 15.0);
  END IF;

  SELECT count(*) INTO shared_lang_count
  FROM unnest(COALESCE(v_langs, '{}')) x WHERE x = ANY(COALESCE(t_langs, '{}'));
  s_lang := LEAST(shared_lang_count::numeric / 2.0, 1.0);

  s_family   := CASE WHEN v_family IS NULL OR t_family IS NULL THEN 0.5 WHEN v_family = t_family THEN 1.0 ELSE 0.0 END;
  s_smoking  := CASE WHEN v_smoking IS NULL OR t_smoking IS NULL THEN 0.5 WHEN v_smoking = t_smoking THEN 1.0 ELSE 0.0 END;
  s_drinking := CASE WHEN v_drinking IS NULL OR t_drinking IS NULL THEN 0.5 WHEN v_drinking = t_drinking THEN 1.0 ELSE 0.0 END;
  s_workout  := CASE WHEN v_workout IS NULL OR t_workout IS NULL THEN 0.5 WHEN v_workout = t_workout THEN 1.0 ELSE 0.0 END;
  s_pets     := CASE WHEN v_pets IS NULL OR t_pets IS NULL THEN 0.5 WHEN v_pets = t_pets THEN 1.0 ELSE 0.0 END;
  s_education:= CASE WHEN v_education IS NULL OR t_education IS NULL THEN 0.5 WHEN v_education = t_education THEN 1.0 ELSE 0.0 END;
  s_religion := CASE WHEN v_religion IS NULL OR t_religion IS NULL THEN 0.5 WHEN v_religion = t_religion THEN 1.0 ELSE 0.0 END;
  s_verified := CASE WHEN t_verified THEN 1.0 ELSE 0.0 END;
  s_complete := COALESCE(t_completeness, 0.0);
  s_lifestyle := (2 * s_smoking + 2 * s_drinking + 1.5 * s_workout + 1.5 * s_pets) / 7.0;

  total := 20 * s_interest + 18 * s_goal + 14 * s_distance + 10 * s_age + 8 * s_lang
         + 5 * s_family + 6 * s_education + 6 * s_religion + 7 * s_lifestyle
         + 3 * s_verified + 3 * s_complete;

  RETURN jsonb_build_object(
    'score', round(total),
    'shared_interests', to_jsonb(COALESCE(shared_interests, '{}')),
    'shared_goal', (v_goal IS NOT NULL AND v_goal = t_goal),
    'factors', jsonb_build_array(
      jsonb_build_object('key','interests','label','Shared interests','weight',20,'pct',round(s_interest*100)),
      jsonb_build_object('key','goal','label','Relationship goals','weight',18,'pct',round(s_goal*100)),
      jsonb_build_object('key','distance','label','Distance','weight',14,'pct',round(s_distance*100)),
      jsonb_build_object('key','age','label','Age compatibility','weight',10,'pct',round(s_age*100)),
      jsonb_build_object('key','languages','label','Languages','weight',8,'pct',round(s_lang*100)),
      jsonb_build_object('key','lifestyle','label','Lifestyle','weight',7,'pct',round(s_lifestyle*100)),
      jsonb_build_object('key','education','label','Education','weight',6,'pct',round(s_education*100)),
      jsonb_build_object('key','religion','label','Beliefs','weight',6,'pct',round(s_religion*100)),
      jsonb_build_object('key','family','label','Family plans','weight',5,'pct',round(s_family*100)),
      jsonb_build_object('key','verified','label','Verified','weight',3,'pct',round(s_verified*100)),
      jsonb_build_object('key','completeness','label','Profile depth','weight',3,'pct',round(s_complete*100))
    )
  );
END;
$$;

-- Per-target completeness expression helper kept inline in callers below.

-- 3a. Live compatibility scores + breakdown for a set of profiles (badges, profile view)
CREATE OR REPLACE FUNCTION public.compatibility_scores(_ids uuid[])
RETURNS TABLE(id uuid, score int, breakdown jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions, private
AS $$
DECLARE
  v public.profiles%ROWTYPE;
  v_geog extensions.geography;
  v_uid uuid := auth.uid();
BEGIN
  SELECT * INTO v FROM public.profiles WHERE profiles.id = v_uid;
  v_geog := v.location_geog;

  RETURN QUERY
  SELECT t.id, (b.bd->>'score')::int, b.bd
  FROM public.profiles t
  CROSS JOIN LATERAL (
    SELECT public.compat_breakdown(
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
      CASE WHEN v_geog IS NOT NULL AND t.location_geog IS NOT NULL AND NOT t.location_access_suspended AND NOT t.hide_distance
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
    ) AS bd
  ) b
  WHERE t.id = ANY(_ids)
    AND t.id <> v_uid
    AND NOT private.is_blocked(v_uid, t.id)
    AND NOT private.is_banned(t.id);
END;
$$;

-- 3b. Ranked recommendation feeds by compatibility
CREATE OR REPLACE FUNCTION public.recommended_matches(_kind text DEFAULT 'recommended', _limit int DEFAULT 30)
RETURNS TABLE(id uuid, distance_m double precision, score int)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions, private
AS $$
DECLARE
  v public.profiles%ROWTYPE;
  v_geog extensions.geography;
  v_uid uuid := auth.uid();
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
$$;

-- 3c. Cached daily recommendations (generates once per day per user)
CREATE OR REPLACE FUNCTION public.get_daily_recommendations(_limit int DEFAULT 12)
RETURNS TABLE(id uuid, distance_m double precision, score int)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public, extensions, private
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_geog extensions.geography;
  v_has boolean;
BEGIN
  SELECT location_geog INTO v_geog FROM public.profiles WHERE profiles.id = v_uid;

  SELECT EXISTS(
    SELECT 1 FROM public.daily_recommendations dr
    WHERE dr.user_id = v_uid AND dr.rec_date = current_date
  ) INTO v_has;

  IF NOT v_has THEN
    INSERT INTO public.daily_recommendations (user_id, target_id, score, rec_rank, rec_date)
    SELECT v_uid, r.id, r.score, row_number() OVER (ORDER BY r.score DESC), current_date
    FROM public.recommended_matches('recommended', _limit) r
    ON CONFLICT (user_id, target_id, rec_date) DO NOTHING;
  END IF;

  RETURN QUERY
  SELECT dr.target_id,
    CASE WHEN v_geog IS NOT NULL AND t.location_geog IS NOT NULL AND NOT t.location_access_suspended AND NOT t.hide_distance
         THEN extensions.st_distance(v_geog, t.location_geog) ELSE NULL END,
    dr.score
  FROM public.daily_recommendations dr
  JOIN public.profiles t ON t.id = dr.target_id
  WHERE dr.user_id = v_uid AND dr.rec_date = current_date
    AND NOT private.is_blocked(v_uid, t.id)
    AND NOT private.is_banned(t.id)
  ORDER BY dr.rec_rank
  LIMIT GREATEST(_limit, 1);
END;
$$;

-- ============================================================
-- 4. ADMIN MATCHING ANALYTICS
-- ============================================================
CREATE OR REPLACE FUNCTION public.matching_analytics(_days int DEFAULT 30)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT CASE WHEN NOT private.has_role(auth.uid(), 'admin'::app_role) THEN '{}'::jsonb
  ELSE jsonb_build_object(
    'total_recommendations', (SELECT count(*) FROM public.daily_recommendations WHERE created_at >= now() - make_interval(days => _days)),
    'recommended_users', (SELECT count(DISTINCT user_id) FROM public.daily_recommendations WHERE created_at >= now() - make_interval(days => _days)),
    'avg_compatibility', (SELECT COALESCE(round(avg(score), 1), 0) FROM public.daily_recommendations WHERE created_at >= now() - make_interval(days => _days)),
    'likes', (SELECT count(*) FROM public.likes WHERE is_like AND created_at >= now() - make_interval(days => _days)),
    'passes', (SELECT count(*) FROM public.likes WHERE NOT is_like AND created_at >= now() - make_interval(days => _days)),
    'matches', (SELECT count(*) FROM public.matches WHERE created_at >= now() - make_interval(days => _days)),
    'match_rate', (SELECT CASE WHEN count(*) FILTER (WHERE is_like) = 0 THEN 0
        ELSE round(100.0 * (SELECT count(*) FROM public.matches WHERE created_at >= now() - make_interval(days => _days))
             / count(*) FILTER (WHERE is_like), 1) END
      FROM public.likes WHERE created_at >= now() - make_interval(days => _days)),
    'rec_shown', (SELECT count(*) FROM public.interaction_events WHERE signal_type = 'recommendation_shown' AND created_at >= now() - make_interval(days => _days)),
    'rec_clicked', (SELECT count(*) FROM public.interaction_events WHERE signal_type = 'recommendation_clicked' AND created_at >= now() - make_interval(days => _days)),
    'rec_ctr', (SELECT CASE WHEN count(*) FILTER (WHERE signal_type = 'recommendation_shown') = 0 THEN 0
        ELSE round(100.0 * count(*) FILTER (WHERE signal_type = 'recommendation_clicked')
             / count(*) FILTER (WHERE signal_type = 'recommendation_shown'), 1) END
      FROM public.interaction_events WHERE created_at >= now() - make_interval(days => _days)),
    'score_distribution', (SELECT COALESCE(jsonb_agg(jsonb_build_object('bucket', bucket, 'count', c) ORDER BY bucket), '[]'::jsonb)
      FROM (SELECT (LEAST(score, 99) / 20) * 20 AS bucket, count(*) AS c
            FROM public.daily_recommendations
            WHERE created_at >= now() - make_interval(days => _days)
            GROUP BY 1) s),
    'signals_by_type', (SELECT COALESCE(jsonb_object_agg(signal_type, c), '{}'::jsonb)
      FROM (SELECT signal_type, count(*) AS c FROM public.interaction_events
            WHERE created_at >= now() - make_interval(days => _days)
            GROUP BY signal_type) t)
  ) END
$$;
