-- ============ MEDIA LIBRARY ============
CREATE TABLE public.media_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path text NOT NULL UNIQUE,
  file_name text NOT NULL,
  content_type text NOT NULL,
  kind text NOT NULL DEFAULT 'image',
  folder text NOT NULL DEFAULT 'general',
  alt_text text,
  width integer,
  height integer,
  size_bytes integer,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_library TO authenticated;
GRANT ALL ON public.media_library TO service_role;
ALTER TABLE public.media_library ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage media library" ON public.media_library
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));

-- ============ SITE CONTENT (singleton sections) ============
CREATE TABLE public.site_content (
  section text PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.site_content TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_content TO authenticated;
GRANT ALL ON public.site_content TO service_role;
ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read site content" ON public.site_content
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins write site content" ON public.site_content
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));

-- ============ TESTIMONIALS ============
CREATE TABLE public.testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  country text,
  photo_path text,
  rating smallint NOT NULL DEFAULT 5 CHECK (rating BETWEEN 1 AND 5),
  quote text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.testimonials TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.testimonials TO authenticated;
GRANT ALL ON public.testimonials TO service_role;
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads published testimonials" ON public.testimonials
  FOR SELECT TO anon, authenticated
  USING (is_published OR private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage testimonials" ON public.testimonials
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));

-- ============ SUCCESS STORIES ============
CREATE TABLE public.success_stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  couple_names text,
  body text NOT NULL,
  image_path text,
  sort_order integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.success_stories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.success_stories TO authenticated;
GRANT ALL ON public.success_stories TO service_role;
ALTER TABLE public.success_stories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads published stories" ON public.success_stories
  FOR SELECT TO anon, authenticated
  USING (is_published OR private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage stories" ON public.success_stories
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));

-- ============ updated_at triggers ============
CREATE TRIGGER trg_media_updated BEFORE UPDATE ON public.media_library
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_site_content_updated BEFORE UPDATE ON public.site_content
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_testimonials_updated BEFORE UPDATE ON public.testimonials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_stories_updated BEFORE UPDATE ON public.success_stories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Realtime ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.site_content;
ALTER PUBLICATION supabase_realtime ADD TABLE public.testimonials;
ALTER PUBLICATION supabase_realtime ADD TABLE public.success_stories;

-- ============ Storage policies for site-media bucket ============
CREATE POLICY "Public read site media" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'site-media');
CREATE POLICY "Admins upload site media" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'site-media' AND private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update site media" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'site-media' AND private.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'site-media' AND private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete site media" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'site-media' AND private.has_role(auth.uid(), 'admin'));