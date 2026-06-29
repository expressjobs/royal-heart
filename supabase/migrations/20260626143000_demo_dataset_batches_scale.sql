-- Extend demo dataset imports and add generation batch metadata.

ALTER TABLE public.demo_dataset_imports
  DROP CONSTRAINT IF EXISTS demo_dataset_imports_dataset_type_check;

ALTER TABLE public.demo_dataset_imports
  ADD CONSTRAINT demo_dataset_imports_dataset_type_check CHECK (
    dataset_type IN (
      'photo_library',
      'names',
      'male_names',
      'female_names',
      'countries',
      'cities',
      'occupations',
      'education',
      'universities',
      'companies',
      'interests',
      'bio_templates',
      'languages',
      'religions'
    )
  );

ALTER TABLE public.demo_dataset_items
  DROP CONSTRAINT IF EXISTS demo_dataset_items_dataset_type_check;

ALTER TABLE public.demo_dataset_items
  ADD CONSTRAINT demo_dataset_items_dataset_type_check CHECK (
    dataset_type IN (
      'photo_library',
      'names',
      'male_names',
      'female_names',
      'countries',
      'cities',
      'occupations',
      'education',
      'universities',
      'companies',
      'interests',
      'bio_templates',
      'languages',
      'religions'
    )
  );

CREATE TABLE IF NOT EXISTS public.demo_generation_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('running', 'completed', 'completed_with_warnings', 'failed', 'cancelled')),
  requested_count integer NOT NULL DEFAULT 0,
  created_count integer NOT NULL DEFAULT 0,
  visible_count integer NOT NULL DEFAULT 0,
  hidden_count integer NOT NULL DEFAULT 0,
  without_photos integer NOT NULL DEFAULT 0,
  duplicate_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  source_datasets jsonb NOT NULL DEFAULT '{}'::jsonb,
  generation_settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS demo_batch_id uuid REFERENCES public.demo_generation_batches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS company text;

CREATE INDEX IF NOT EXISTS profiles_demo_batch_idx
  ON public.profiles (demo_batch_id)
  WHERE demo_batch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS demo_generation_batches_created_idx
  ON public.demo_generation_batches (created_at DESC);

GRANT SELECT ON public.demo_generation_batches TO authenticated;
GRANT ALL ON public.demo_generation_batches TO service_role;

ALTER TABLE public.demo_generation_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view demo generation batches" ON public.demo_generation_batches;
CREATE POLICY "Admins view demo generation batches"
  ON public.demo_generation_batches
  FOR SELECT
  TO authenticated
  USING (private.has_min_role(auth.uid(), 'admin'::public.app_role));
