-- ===== ENUMS =====
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
CREATE TYPE public.membership_tier AS ENUM ('free', 'gold', 'platinum');
CREATE TYPE public.report_status AS ENUM ('pending', 'reviewed', 'resolved', 'dismissed');

-- ===== UPDATED_AT TRIGGER FN =====
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ===== PROFILES =====
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  birth_date DATE,
  gender TEXT,
  interested_in TEXT[] NOT NULL DEFAULT '{}',
  location_city TEXT,
  location_country TEXT,
  bio TEXT,
  interests TEXT[] NOT NULL DEFAULT '{}',
  membership_tier public.membership_tier NOT NULL DEFAULT 'free',
  is_verified BOOLEAN NOT NULL DEFAULT false,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  onboarding_complete BOOLEAN NOT NULL DEFAULT false,
  last_active TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ===== USER ROLES =====
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- ===== PROFILE PHOTOS =====
CREATE TABLE public.profile_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  position INT NOT NULL DEFAULT 0,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_photos TO authenticated;
GRANT ALL ON public.profile_photos TO service_role;
ALTER TABLE public.profile_photos ENABLE ROW LEVEL SECURITY;

-- ===== BLOCKS =====
CREATE TABLE public.blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  blocker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id)
);
GRANT SELECT, INSERT, DELETE ON public.blocks TO authenticated;
GRANT ALL ON public.blocks TO service_role;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_blocked(_a UUID, _b UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocks
    WHERE (blocker_id = _a AND blocked_id = _b)
       OR (blocker_id = _b AND blocked_id = _a)
  )
$$;

-- ===== LIKES =====
CREATE TABLE public.likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  liker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  liked_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_like BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (liker_id, liked_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.likes TO authenticated;
GRANT ALL ON public.likes TO service_role;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

-- ===== MATCHES =====
CREATE TABLE public.matches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user1_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user2_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user1_id, user2_id)
);
GRANT SELECT, DELETE ON public.matches TO authenticated;
GRANT ALL ON public.matches TO service_role;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

-- ===== MESSAGES =====
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- ===== REPORTS =====
CREATE TABLE public.reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  details TEXT,
  status public.report_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- ===== TRIGGERS: updated_at =====
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_reports_updated BEFORE UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== MUTUAL LIKE -> MATCH =====
CREATE OR REPLACE FUNCTION public.handle_mutual_like()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  u1 UUID;
  u2 UUID;
BEGIN
  IF NEW.is_like = true AND EXISTS (
    SELECT 1 FROM public.likes
    WHERE liker_id = NEW.liked_id AND liked_id = NEW.liker_id AND is_like = true
  ) THEN
    u1 := LEAST(NEW.liker_id, NEW.liked_id);
    u2 := GREATEST(NEW.liker_id, NEW.liked_id);
    INSERT INTO public.matches (user1_id, user2_id)
    VALUES (u1, u2)
    ON CONFLICT (user1_id, user2_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_handle_mutual_like AFTER INSERT ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.handle_mutual_like();

-- ===== DEFAULT ROLE SETUP =====
CREATE OR REPLACE FUNCTION public.assign_default_role()
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), 'user')
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

-- ===== RLS POLICIES =====
-- profiles
CREATE POLICY "View non-blocked profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR NOT public.is_blocked(auth.uid(), id));
CREATE POLICY "Insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins manage profiles" ON public.profiles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- user_roles
CREATE POLICY "View own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- profile_photos
CREATE POLICY "View non-blocked photos" ON public.profile_photos
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR NOT public.is_blocked(auth.uid(), user_id));
CREATE POLICY "Manage own photos" ON public.profile_photos
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- blocks
CREATE POLICY "View own blocks" ON public.blocks
  FOR SELECT TO authenticated USING (blocker_id = auth.uid());
CREATE POLICY "Create own blocks" ON public.blocks
  FOR INSERT TO authenticated WITH CHECK (blocker_id = auth.uid());
CREATE POLICY "Delete own blocks" ON public.blocks
  FOR DELETE TO authenticated USING (blocker_id = auth.uid());

-- likes
CREATE POLICY "View likes involving me" ON public.likes
  FOR SELECT TO authenticated USING (liker_id = auth.uid() OR liked_id = auth.uid());
CREATE POLICY "Create own likes" ON public.likes
  FOR INSERT TO authenticated WITH CHECK (liker_id = auth.uid() AND NOT public.is_blocked(auth.uid(), liked_id));
CREATE POLICY "Update own likes" ON public.likes
  FOR UPDATE TO authenticated USING (liker_id = auth.uid()) WITH CHECK (liker_id = auth.uid());
CREATE POLICY "Delete own likes" ON public.likes
  FOR DELETE TO authenticated USING (liker_id = auth.uid());

-- matches
CREATE POLICY "View own matches" ON public.matches
  FOR SELECT TO authenticated USING (user1_id = auth.uid() OR user2_id = auth.uid());
CREATE POLICY "Delete own matches" ON public.matches
  FOR DELETE TO authenticated USING (user1_id = auth.uid() OR user2_id = auth.uid());

-- messages
CREATE POLICY "View messages in own matches" ON public.messages
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid()))
  );
CREATE POLICY "Send messages in own matches" ON public.messages
  FOR INSERT TO authenticated WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid()))
  );
CREATE POLICY "Update read status in own matches" ON public.messages
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid()))
  );

-- reports
CREATE POLICY "View own reports" ON public.reports
  FOR SELECT TO authenticated USING (reporter_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Create own reports" ON public.reports
  FOR INSERT TO authenticated WITH CHECK (reporter_id = auth.uid());
CREATE POLICY "Admins update reports" ON public.reports
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ===== REALTIME =====
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER TABLE public.matches REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;