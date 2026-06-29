CREATE TABLE public.hero_slides (
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

CREATE POLICY "Public reads active hero slides" ON public.hero_slides
  FOR SELECT TO anon, authenticated
  USING (
    private.has_role(auth.uid(), 'admin')
    OR (
      is_published
      AND (starts_at IS NULL OR starts_at <= now())
      AND (ends_at IS NULL OR ends_at > now())
    )
  );

CREATE POLICY "Admins manage hero slides" ON public.hero_slides
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_hero_slides_updated BEFORE UPDATE ON public.hero_slides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.hero_slides;