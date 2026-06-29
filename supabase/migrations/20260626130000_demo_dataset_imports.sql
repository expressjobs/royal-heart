-- Demo dataset import system.
-- Admin-only dataset metadata and reusable values used by the demo profile generator.

CREATE TABLE IF NOT EXISTS public.demo_dataset_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  dataset_type text NOT NULL CHECK (
    dataset_type IN (
      'photo_library',
      'names',
      'cities',
      'occupations',
      'education',
      'interests',
      'bio_templates'
    )
  ),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'completed_with_warnings', 'failed')),
  enabled boolean NOT NULL DEFAULT true,
  total_rows integer NOT NULL DEFAULT 0,
  valid_rows integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.demo_dataset_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid REFERENCES public.demo_dataset_imports(id) ON DELETE CASCADE,
  dataset_type text NOT NULL CHECK (
    dataset_type IN (
      'photo_library',
      'names',
      'cities',
      'occupations',
      'education',
      'interests',
      'bio_templates'
    )
  ),
  country text,
  gender text CHECK (gender IS NULL OR gender IN ('male', 'female')),
  value text NOT NULL,
  label text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

CREATE INDEX IF NOT EXISTS demo_dataset_imports_type_idx
  ON public.demo_dataset_imports (dataset_type, enabled, created_at DESC);

CREATE INDEX IF NOT EXISTS demo_dataset_items_lookup_idx
  ON public.demo_dataset_items (dataset_type, enabled, country, gender);

CREATE UNIQUE INDEX IF NOT EXISTS demo_dataset_items_unique_value_idx
  ON public.demo_dataset_items (dataset_type, country, gender, value);

GRANT SELECT ON public.demo_dataset_imports TO authenticated;
GRANT SELECT ON public.demo_dataset_items TO authenticated;
GRANT ALL ON public.demo_dataset_imports TO service_role;
GRANT ALL ON public.demo_dataset_items TO service_role;

ALTER TABLE public.demo_dataset_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demo_dataset_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view demo dataset imports" ON public.demo_dataset_imports;
CREATE POLICY "Admins view demo dataset imports"
  ON public.demo_dataset_imports
  FOR SELECT
  TO authenticated
  USING (private.has_min_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins view demo dataset items" ON public.demo_dataset_items;
CREATE POLICY "Admins view demo dataset items"
  ON public.demo_dataset_items
  FOR SELECT
  TO authenticated
  USING (private.has_min_role(auth.uid(), 'admin'::public.app_role));
