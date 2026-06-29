-- Add the CMS hero_slides table when production is missing it.
-- Safe/additive: does not replace existing tables or data.

CREATE TABLE IF NOT EXISTS public.hero_slides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_path text,
  headline text,
  subheadline text,
  cta_label text,
  cta_href text,
  sort_order integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hero_slides_window_valid CHECK (
    starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at
  )
);

GRANT SELECT ON public.hero_slides TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hero_slides TO authenticated;
GRANT ALL ON public.hero_slides TO service_role;

ALTER TABLE public.hero_slides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public reads active hero slides" ON public.hero_slides;
CREATE POLICY "Public reads active hero slides"
  ON public.hero_slides
  FOR SELECT
  TO anon, authenticated
  USING (
    is_published
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at > now())
  );

DROP POLICY IF EXISTS "Super admins view all hero slides" ON public.hero_slides;
CREATE POLICY "Super admins view all hero slides"
  ON public.hero_slides
  FOR SELECT
  TO authenticated
  USING (private.has_min_role(auth.uid(), 'super_admin'::public.app_role));

DROP POLICY IF EXISTS "Super admins insert hero slides" ON public.hero_slides;
CREATE POLICY "Super admins insert hero slides"
  ON public.hero_slides
  FOR INSERT
  TO authenticated
  WITH CHECK (private.has_min_role(auth.uid(), 'super_admin'::public.app_role));

DROP POLICY IF EXISTS "Super admins update hero slides" ON public.hero_slides;
CREATE POLICY "Super admins update hero slides"
  ON public.hero_slides
  FOR UPDATE
  TO authenticated
  USING (private.has_min_role(auth.uid(), 'super_admin'::public.app_role))
  WITH CHECK (private.has_min_role(auth.uid(), 'super_admin'::public.app_role));

DROP POLICY IF EXISTS "Super admins delete hero slides" ON public.hero_slides;
CREATE POLICY "Super admins delete hero slides"
  ON public.hero_slides
  FOR DELETE
  TO authenticated
  USING (private.has_min_role(auth.uid(), 'super_admin'::public.app_role));

DROP TRIGGER IF EXISTS trg_hero_slides_updated ON public.hero_slides;
CREATE TRIGGER trg_hero_slides_updated
  BEFORE UPDATE ON public.hero_slides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
