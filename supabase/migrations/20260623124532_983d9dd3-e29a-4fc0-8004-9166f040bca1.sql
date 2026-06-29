-- 1. Private schema for RLS-helper SECURITY DEFINER functions (not exposed via Data API)
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

-- 2. Move RLS helper functions out of the API-exposed public schema.
--    OIDs are preserved, so existing RLS policies that reference them keep working.
ALTER FUNCTION public.has_role(uuid, public.app_role) SET SCHEMA private;
ALTER FUNCTION public.is_blocked(uuid, uuid) SET SCHEMA private;

-- keep execute available to the roles RLS evaluates as, deny everyone else
REVOKE EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION private.is_blocked(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_blocked(uuid, uuid) TO authenticated, service_role;

-- 3. Trigger functions must never be callable directly via the API.
REVOKE EXECUTE ON FUNCTION public.handle_mutual_like() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_verification_approval() FROM PUBLIC, anon, authenticated;

-- 4. Replace the self-assign-role SECURITY DEFINER RPC with an RLS-scoped insert.
CREATE POLICY "Users can self-assign default role"
  ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND role = 'user');

DROP FUNCTION IF EXISTS public.assign_default_role();

-- 5. Enforce block relationship on direct storage reads of profile photos,
--    mirroring the profile_photos table RLS so blocked users cannot bypass it.
DROP POLICY IF EXISTS "Authenticated can view profile photos" ON storage.objects;
CREATE POLICY "Authenticated can view profile photos"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'profile-photos'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR NOT private.is_blocked(auth.uid(), NULLIF((storage.foldername(name))[1], '')::uuid)
    )
  );