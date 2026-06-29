-- Keep CMS page/content saves working for super admins.
-- Narrow scope: only public.site_content grants/RLS policies.

DO $$
BEGIN
  IF to_regclass('public.site_content') IS NOT NULL THEN
    GRANT SELECT ON public.site_content TO anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_content TO authenticated;
    GRANT ALL ON public.site_content TO service_role;

    DROP POLICY IF EXISTS "Anyone can read site content" ON public.site_content;
    CREATE POLICY "Anyone can read site content"
      ON public.site_content
      FOR SELECT
      TO anon, authenticated
      USING (true);

    DROP POLICY IF EXISTS "Admins write site content" ON public.site_content;
    DROP POLICY IF EXISTS "Super admins write site content" ON public.site_content;
    CREATE POLICY "Super admins write site content"
      ON public.site_content
      FOR ALL
      TO authenticated
      USING (private.has_min_role(auth.uid(), 'super_admin'::public.app_role))
      WITH CHECK (private.has_min_role(auth.uid(), 'super_admin'::public.app_role));
  END IF;
END $$;
