-- Super-admin-only CMS editing. Idempotent and additive/safe:
-- - keeps public reads for published/public website content
-- - removes ordinary admin CMS write paths
-- - backfills site_content from app_settings CMS sections when present

DO $$
BEGIN
  IF to_regclass('public.app_settings') IS NOT NULL
     AND to_regclass('public.site_content') IS NOT NULL THEN
    INSERT INTO public.site_content (section, data, updated_at)
    SELECT key, COALESCE(value, '{}'::jsonb), updated_at
    FROM public.app_settings
    WHERE key IN ('hero', 'stats', 'about', 'features', 'footer')
    ON CONFLICT (section) DO NOTHING;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.media_library') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Admins manage media library" ON public.media_library;
    DROP POLICY IF EXISTS "Super admins manage media library" ON public.media_library;

    CREATE POLICY "Super admins manage media library"
      ON public.media_library
      FOR ALL
      TO authenticated
      USING (private.has_min_role(auth.uid(), 'super_admin'::public.app_role))
      WITH CHECK (private.has_min_role(auth.uid(), 'super_admin'::public.app_role));
  END IF;
END $$;

DROP POLICY IF EXISTS "Admins write site content" ON public.site_content;
DROP POLICY IF EXISTS "Super admins write site content" ON public.site_content;
CREATE POLICY "Super admins write site content"
  ON public.site_content
  FOR ALL
  TO authenticated
  USING (private.has_min_role(auth.uid(), 'super_admin'::public.app_role))
  WITH CHECK (private.has_min_role(auth.uid(), 'super_admin'::public.app_role));

DO $$
BEGIN
  IF to_regclass('public.hero_slides') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Public reads active hero slides" ON public.hero_slides;
    CREATE POLICY "Public reads active hero slides"
      ON public.hero_slides
      FOR SELECT
      TO anon, authenticated
      USING (
        private.has_min_role(auth.uid(), 'super_admin'::public.app_role)
        OR (
          is_published
          AND (starts_at IS NULL OR starts_at <= now())
          AND (ends_at IS NULL OR ends_at > now())
        )
      );

    DROP POLICY IF EXISTS "Admins manage hero slides" ON public.hero_slides;
    DROP POLICY IF EXISTS "Super admins manage hero slides" ON public.hero_slides;
    CREATE POLICY "Super admins manage hero slides"
      ON public.hero_slides
      FOR ALL
      TO authenticated
      USING (private.has_min_role(auth.uid(), 'super_admin'::public.app_role))
      WITH CHECK (private.has_min_role(auth.uid(), 'super_admin'::public.app_role));
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.testimonials') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Anyone reads published testimonials" ON public.testimonials;
    CREATE POLICY "Anyone reads published testimonials"
      ON public.testimonials
      FOR SELECT
      TO anon, authenticated
      USING (is_published OR private.has_min_role(auth.uid(), 'super_admin'::public.app_role));

    DROP POLICY IF EXISTS "Admins manage testimonials" ON public.testimonials;
    DROP POLICY IF EXISTS "Super admins manage testimonials" ON public.testimonials;
    CREATE POLICY "Super admins manage testimonials"
      ON public.testimonials
      FOR ALL
      TO authenticated
      USING (private.has_min_role(auth.uid(), 'super_admin'::public.app_role))
      WITH CHECK (private.has_min_role(auth.uid(), 'super_admin'::public.app_role));
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.success_stories') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Anyone reads published stories" ON public.success_stories;
    CREATE POLICY "Anyone reads published stories"
      ON public.success_stories
      FOR SELECT
      TO anon, authenticated
      USING (is_published OR private.has_min_role(auth.uid(), 'super_admin'::public.app_role));

    DROP POLICY IF EXISTS "Admins manage stories" ON public.success_stories;
    DROP POLICY IF EXISTS "Super admins manage stories" ON public.success_stories;
    CREATE POLICY "Super admins manage stories"
      ON public.success_stories
      FOR ALL
      TO authenticated
      USING (private.has_min_role(auth.uid(), 'super_admin'::public.app_role))
      WITH CHECK (private.has_min_role(auth.uid(), 'super_admin'::public.app_role));
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.blog_posts') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Admins view all posts" ON public.blog_posts;
    DROP POLICY IF EXISTS "Super admins view all posts" ON public.blog_posts;
    CREATE POLICY "Super admins view all posts"
      ON public.blog_posts
      FOR SELECT
      TO authenticated
      USING (private.has_min_role(auth.uid(), 'super_admin'::public.app_role));

    DROP POLICY IF EXISTS "Admins manage posts" ON public.blog_posts;
    DROP POLICY IF EXISTS "Super admins manage posts" ON public.blog_posts;
    CREATE POLICY "Super admins manage posts"
      ON public.blog_posts
      FOR ALL
      TO authenticated
      USING (private.has_min_role(auth.uid(), 'super_admin'::public.app_role))
      WITH CHECK (private.has_min_role(auth.uid(), 'super_admin'::public.app_role));
  END IF;
END $$;

DROP POLICY IF EXISTS "Admins upload site media" ON storage.objects;
DROP POLICY IF EXISTS "Admins update site media" ON storage.objects;
DROP POLICY IF EXISTS "Admins delete site media" ON storage.objects;
DROP POLICY IF EXISTS "Super admins upload site media" ON storage.objects;
DROP POLICY IF EXISTS "Super admins update site media" ON storage.objects;
DROP POLICY IF EXISTS "Super admins delete site media" ON storage.objects;

CREATE POLICY "Super admins upload site media"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'site-media'
    AND private.has_min_role(auth.uid(), 'super_admin'::public.app_role)
  );

CREATE POLICY "Super admins update site media"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'site-media'
    AND private.has_min_role(auth.uid(), 'super_admin'::public.app_role)
  )
  WITH CHECK (
    bucket_id = 'site-media'
    AND private.has_min_role(auth.uid(), 'super_admin'::public.app_role)
  );

CREATE POLICY "Super admins delete site media"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'site-media'
    AND private.has_min_role(auth.uid(), 'super_admin'::public.app_role)
  );
