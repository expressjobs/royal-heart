-- Lock down internal functions: only triggers (running as owner) may call them.
REVOKE ALL ON FUNCTION public.create_notification(uuid, public.notification_type, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_new_message() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_new_match() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_verification_approved() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_new_like() FROM PUBLIC, anon, authenticated;