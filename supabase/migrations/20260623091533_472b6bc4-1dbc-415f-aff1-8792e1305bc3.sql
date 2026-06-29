-- Trigger-only functions: no direct execute needed
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_mutual_like() FROM PUBLIC, anon, authenticated;

-- Helpers used by RLS / app: signed-in users only
REVOKE ALL ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;

REVOKE ALL ON FUNCTION public.is_blocked(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_blocked(UUID, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.assign_default_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_default_role() TO authenticated;