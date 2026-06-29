
-- ============ 1. Profile lifestyle + privacy columns ============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS profession text,
  ADD COLUMN IF NOT EXISTS smoking text,
  ADD COLUMN IF NOT EXISTS drinking text,
  ADD COLUMN IF NOT EXISTS workout text,
  ADD COLUMN IF NOT EXISTS family_plans text,
  ADD COLUMN IF NOT EXISTS pets text,
  ADD COLUMN IF NOT EXISTS hide_age boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hide_online_status boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS incognito boolean NOT NULL DEFAULT false;

-- ============ 2. Filtering indexes ============
CREATE INDEX IF NOT EXISTS profiles_location_state_idx ON public.profiles USING btree (lower(location_state));
CREATE INDEX IF NOT EXISTS profiles_membership_tier_idx ON public.profiles USING btree (membership_tier);
CREATE INDEX IF NOT EXISTS profiles_profession_idx ON public.profiles USING btree (lower(profession));
CREATE INDEX IF NOT EXISTS profiles_created_at_idx ON public.profiles USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS profiles_interests_gin ON public.profiles USING gin (interests);
CREATE INDEX IF NOT EXISTS profiles_languages_gin ON public.profiles USING gin (languages);

-- ============ 3. filter_presets ============
CREATE TABLE IF NOT EXISTS public.filter_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_quick boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.filter_presets TO authenticated;
GRANT ALL ON public.filter_presets TO service_role;
ALTER TABLE public.filter_presets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own presets" ON public.filter_presets
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_filter_presets_updated_at BEFORE UPDATE ON public.filter_presets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ 4. filter_options (admin-managed lists) ============
CREATE TABLE IF NOT EXISTS public.filter_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  value text NOT NULL,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category, value)
);
GRANT SELECT ON public.filter_options TO anon, authenticated;
GRANT ALL ON public.filter_options TO service_role;
ALTER TABLE public.filter_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read active filter options" ON public.filter_options
  FOR SELECT USING (is_active OR private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage filter options" ON public.filter_options
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER update_filter_options_updated_at BEFORE UPDATE ON public.filter_options
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ 5. search_events (analytics) ============
CREATE TABLE IF NOT EXISTS public.search_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.search_events TO authenticated;
GRANT ALL ON public.search_events TO service_role;
ALTER TABLE public.search_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users insert their own search events" ON public.search_events
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins read search events" ON public.search_events
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX IF NOT EXISTS search_events_created_at_idx ON public.search_events USING btree (created_at DESC);

-- ============ 6. Seed filter_options ============
INSERT INTO public.filter_options (category, value, label, sort_order) VALUES
  ('interest','Travel','Travel',0),('interest','Cooking','Cooking',1),('interest','Fitness','Fitness',2),
  ('interest','Music','Music',3),('interest','Movies','Movies',4),('interest','Reading','Reading',5),
  ('interest','Art','Art',6),('interest','Photography','Photography',7),('interest','Hiking','Hiking',8),
  ('interest','Gaming','Gaming',9),('interest','Coffee','Coffee',10),('interest','Wine','Wine',11),
  ('interest','Dancing','Dancing',12),('interest','Yoga','Yoga',13),('interest','Foodie','Foodie',14),
  ('interest','Pets','Pets',15),('interest','Fashion','Fashion',16),('interest','Tech','Tech',17),
  ('interest','Volunteering','Volunteering',18),('interest','Live Music','Live Music',19),
  ('interest','Camping','Camping',20),('interest','Running','Running',21),('interest','Meditation','Meditation',22),
  ('interest','Writing','Writing',23),('interest','Theatre','Theatre',24),('interest','Football','Football',25),
  ('language','English','English',0),('language','Spanish','Spanish',1),('language','French','French',2),
  ('language','German','German',3),('language','Portuguese','Portuguese',4),('language','Italian','Italian',5),
  ('language','Swahili','Swahili',6),('language','Arabic','Arabic',7),('language','Hindi','Hindi',8),
  ('language','Mandarin','Mandarin',9),('language','Japanese','Japanese',10),('language','Korean','Korean',11),
  ('language','Russian','Russian',12),('language','Dutch','Dutch',13),('language','Turkish','Turkish',14),
  ('language','Yoruba','Yoruba',15),('language','Zulu','Zulu',16),('language','Amharic','Amharic',17),
  ('religion','christian','Christian',0),('religion','muslim','Muslim',1),('religion','jewish','Jewish',2),
  ('religion','hindu','Hindu',3),('religion','buddhist','Buddhist',4),('religion','spiritual','Spiritual',5),
  ('religion','agnostic','Agnostic',6),('religion','atheist','Atheist',7),('religion','other','Other',8),
  ('religion','prefer_not','Prefer not to say',9),
  ('education','high_school','High school',0),('education','in_college','In college',1),
  ('education','associate','Associate degree',2),('education','bachelor','Bachelor''s degree',3),
  ('education','master','Master''s degree',4),('education','doctorate','Doctorate',5),
  ('education','trade','Trade school',6),('education','other','Other',7),
  ('relationship_goal','long_term','Long-term partner',0),('relationship_goal','long_term_open','Long-term, open to short',1),
  ('relationship_goal','short_term','Short-term fun',2),('relationship_goal','short_term_open','Short-term, open to long',3),
  ('relationship_goal','new_friends','New friends',4),('relationship_goal','still_figuring','Still figuring it out',5),
  ('profession','tech','Technology',0),('profession','healthcare','Healthcare',1),('profession','education','Education',2),
  ('profession','finance','Finance',3),('profession','engineering','Engineering',4),('profession','arts','Arts & Media',5),
  ('profession','business','Business',6),('profession','legal','Legal',7),('profession','hospitality','Hospitality',8),
  ('profession','trades','Skilled trades',9),('profession','government','Government',10),('profession','student','Student',11),
  ('profession','entrepreneur','Entrepreneur',12),('profession','other','Other',13)
ON CONFLICT (category, value) DO NOTHING;
