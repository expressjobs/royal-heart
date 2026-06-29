-- 1) Server-side authoritative age (18+) enforcement on profiles.
-- Use a trigger (not a CHECK constraint) because the rule depends on current_date.
CREATE OR REPLACE FUNCTION public.enforce_min_age()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.birth_date IS NOT NULL
     AND NEW.birth_date > (current_date - interval '18 years') THEN
    RAISE EXCEPTION 'You must be at least 18 years old to use this platform.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_min_age_trigger ON public.profiles;
CREATE TRIGGER enforce_min_age_trigger
  BEFORE INSERT OR UPDATE OF birth_date ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_min_age();

-- 2) Revoke EXECUTE on SECURITY DEFINER functions from public API roles.
-- These are all trigger functions or internal helpers and must never be
-- directly callable through the Data API by anon or authenticated users.
REVOKE EXECUTE ON FUNCTION public.create_notification(uuid, notification_type, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_like_limit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_message_limit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_mutual_like() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_verification_approval() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_moderation_changes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_privileged_profile_changes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_new_like() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_new_match() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_new_message() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_verification_approved() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_privileged_profile_changes() FROM PUBLIC, anon, authenticated;