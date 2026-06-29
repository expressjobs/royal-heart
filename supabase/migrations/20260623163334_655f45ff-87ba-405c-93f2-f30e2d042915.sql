REVOKE EXECUTE ON FUNCTION public.log_moderation_changes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_privileged_profile_changes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_privileged_profile_changes() FROM PUBLIC, anon, authenticated;