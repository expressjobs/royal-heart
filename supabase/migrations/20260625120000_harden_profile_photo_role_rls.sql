-- Harden profile-photo visibility and default-role assignment.
-- Idempotent for existing production databases; does not delete owner/admin rows.

ALTER TABLE public.profile_photos
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'approved';

CREATE INDEX IF NOT EXISTS profile_photos_visibility_idx
  ON public.profile_photos (user_id, is_private, moderation_status);

DROP POLICY IF EXISTS "Users read own photos" ON public.profile_photos;
DROP POLICY IF EXISTS "Visible profile photos are readable" ON public.profile_photos;
CREATE POLICY "Visible profile photos are readable"
ON public.profile_photos
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR private.has_min_role(auth.uid(), 'admin'::public.app_role)
  OR (
    is_private IS NOT TRUE
    AND moderation_status = 'approved'
    AND NOT private.is_blocked(auth.uid(), user_id)
    AND NOT private.is_banned(user_id)
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = profile_photos.user_id
        AND p.onboarding_complete IS TRUE
        AND p.is_active IS TRUE
        AND p.is_demo_profile IS NOT TRUE
        AND p.discovery_blocked_reason IS NULL
    )
  )
);

DROP POLICY IF EXISTS "Authenticated can view profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Visible profile photo files are readable" ON storage.objects;
CREATE POLICY "Visible profile photo files are readable"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'profile-photos'
  AND EXISTS (
    SELECT 1
    FROM public.profile_photos pp
    JOIN public.profiles p ON p.id = pp.user_id
    WHERE (pp.url = storage.objects.name OR pp.storage_path = storage.objects.name)
      AND (
        pp.user_id = auth.uid()
        OR private.has_min_role(auth.uid(), 'admin'::public.app_role)
        OR (
          pp.is_private IS NOT TRUE
          AND pp.moderation_status = 'approved'
          AND p.onboarding_complete IS TRUE
          AND p.is_active IS TRUE
          AND p.is_demo_profile IS NOT TRUE
          AND p.discovery_blocked_reason IS NULL
          AND NOT private.is_blocked(auth.uid(), pp.user_id)
          AND NOT private.is_banned(pp.user_id)
        )
      )
  )
);

REVOKE INSERT ON public.user_roles FROM authenticated;

DROP POLICY IF EXISTS "Users create own user role only" ON public.user_roles;

CREATE OR REPLACE FUNCTION public.ensure_default_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ensure_default_user_role() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_default_user_role() TO service_role;

DROP TRIGGER IF EXISTS on_auth_user_created_default_role ON auth.users;
CREATE TRIGGER on_auth_user_created_default_role
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.ensure_default_user_role();

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'user'::public.app_role
FROM auth.users u
ON CONFLICT (user_id, role) DO NOTHING;
