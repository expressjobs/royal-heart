-- Prevent any participant from altering message content/sender/match after send.
-- Read receipts only update read_at, which stays allowed.
CREATE OR REPLACE FUNCTION public.prevent_message_tampering()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.content IS DISTINCT FROM OLD.content
     OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
     OR NEW.match_id IS DISTINCT FROM OLD.match_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Message content cannot be modified after it is sent.';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.prevent_message_tampering() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS prevent_message_tampering ON public.messages;
CREATE TRIGGER prevent_message_tampering
  BEFORE UPDATE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_message_tampering();