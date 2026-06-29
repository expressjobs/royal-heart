-- 1. Role hierarchy helper (private schema, not exposed to the API)
CREATE OR REPLACE FUNCTION private.has_min_role(_user_id uuid, _min public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND (CASE ur.role
             WHEN 'super_admin' THEN 3
             WHEN 'admin' THEN 2
             WHEN 'moderator' THEN 1
             ELSE 0 END)
          >= (CASE _min
                WHEN 'super_admin' THEN 3
                WHEN 'admin' THEN 2
                WHEN 'moderator' THEN 1
                ELSE 0 END)
  )
$$;

-- 2. Banners / advertisements
CREATE TABLE public.banners (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  image_path text,
  link_url text,
  placement text NOT NULL DEFAULT 'home_top',
  is_active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  impressions bigint NOT NULL DEFAULT 0,
  clicks bigint NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.banners TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.banners TO authenticated;
GRANT ALL ON public.banners TO service_role;

ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active banners"
  ON public.banners FOR SELECT
  TO anon, authenticated
  USING (
    is_active
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at >= now())
  );

CREATE POLICY "Admins view all banners"
  ON public.banners FOR SELECT
  TO authenticated
  USING (private.has_min_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins manage banners"
  ON public.banners FOR ALL
  TO authenticated
  USING (private.has_min_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_min_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER trg_banners_updated
  BEFORE UPDATE ON public.banners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Blog posts
CREATE TABLE public.blog_posts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  excerpt text,
  body text,
  cover_path text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  published_at timestamptz,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  seo_title text,
  seo_description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.blog_posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blog_posts TO authenticated;
GRANT ALL ON public.blog_posts TO service_role;

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view published posts"
  ON public.blog_posts FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

CREATE POLICY "Admins view all posts"
  ON public.blog_posts FOR SELECT
  TO authenticated
  USING (private.has_min_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins manage posts"
  ON public.blog_posts FOR ALL
  TO authenticated
  USING (private.has_min_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_min_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER trg_blog_posts_updated
  BEFORE UPDATE ON public.blog_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Moderation notes
CREATE TABLE public.moderation_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id uuid NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.moderation_notes TO authenticated;
GRANT ALL ON public.moderation_notes TO service_role;

ALTER TABLE public.moderation_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Moderators view notes"
  ON public.moderation_notes FOR SELECT
  TO authenticated
  USING (private.has_min_role(auth.uid(), 'moderator'::public.app_role));

CREATE POLICY "Moderators add notes"
  ON public.moderation_notes FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND private.has_min_role(auth.uid(), 'moderator'::public.app_role)
  );

CREATE INDEX idx_moderation_notes_report ON public.moderation_notes(report_id);

-- 5. Admin audit log (written server-side via service role)
CREATE TABLE public.admin_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view audit log"
  ON public.admin_audit_log FOR SELECT
  TO authenticated
  USING (private.has_min_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX idx_admin_audit_created ON public.admin_audit_log(created_at DESC);