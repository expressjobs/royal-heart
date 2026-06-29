-- Admin Broadcast media upload support.
-- Additive/idempotent: preserves existing text-only broadcasts and deliveries.

ALTER TABLE public.broadcasts
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS media_type text,
  ADD COLUMN IF NOT EXISTS media_path text;

ALTER TABLE public.broadcast_deliveries
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS media_type text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'broadcasts_media_type_check'
      AND conrelid = 'public.broadcasts'::regclass
  ) THEN
    ALTER TABLE public.broadcasts
      ADD CONSTRAINT broadcasts_media_type_check
      CHECK (media_type IS NULL OR media_type IN ('image', 'video'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'broadcast_deliveries_media_type_check'
      AND conrelid = 'public.broadcast_deliveries'::regclass
  ) THEN
    ALTER TABLE public.broadcast_deliveries
      ADD CONSTRAINT broadcast_deliveries_media_type_check
      CHECK (media_type IS NULL OR media_type IN ('image', 'video'));
  END IF;
END $$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'broadcast-media',
  'broadcast-media',
  true,
  52428800,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm']
)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Admins upload broadcast media'
  ) THEN
    CREATE POLICY "Admins upload broadcast media"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'broadcast-media'
        AND private.has_min_role(auth.uid(), 'admin'::public.app_role)
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Admins update broadcast media'
  ) THEN
    CREATE POLICY "Admins update broadcast media"
      ON storage.objects FOR UPDATE TO authenticated
      USING (
        bucket_id = 'broadcast-media'
        AND private.has_min_role(auth.uid(), 'admin'::public.app_role)
      )
      WITH CHECK (
        bucket_id = 'broadcast-media'
        AND private.has_min_role(auth.uid(), 'admin'::public.app_role)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Admins delete broadcast media'
  ) THEN
    CREATE POLICY "Admins delete broadcast media"
      ON storage.objects FOR DELETE TO authenticated
      USING (
        bucket_id = 'broadcast-media'
        AND private.has_min_role(auth.uid(), 'admin'::public.app_role)
      );
  END IF;
END
$$;
