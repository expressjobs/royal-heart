-- ============================================================
-- Server-side enforcement of free/Gold/Platinum like + message limits
-- ============================================================

-- Daily like limit: free users get 10 genuine likes/day; gold+ unlimited.
CREATE OR REPLACE FUNCTION public.enforce_like_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  today_count integer;
BEGIN
  -- Passes (is_like = false) are never limited.
  IF NEW.is_like IS DISTINCT FROM true THEN
    RETURN NEW;
  END IF;

  -- Gold/Platinum members have unlimited likes.
  IF private.is_premium(NEW.liker_id) THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO today_count
  FROM public.likes
  WHERE liker_id = NEW.liker_id
    AND is_like = true
    AND created_at >= date_trunc('day', now());

  IF today_count >= 10 THEN
    RAISE EXCEPTION 'Daily like limit reached. Upgrade for unlimited likes.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_like_limit ON public.likes;
CREATE TRIGGER trg_enforce_like_limit
  BEFORE INSERT ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.enforce_like_limit();

-- Per-conversation message limit: free users get 10 messages per match; gold+ unlimited.
CREATE OR REPLACE FUNCTION public.enforce_message_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  sent_count integer;
BEGIN
  -- Gold/Platinum members have unlimited messaging.
  IF private.is_premium(NEW.sender_id) THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO sent_count
  FROM public.messages
  WHERE match_id = NEW.match_id
    AND sender_id = NEW.sender_id;

  IF sent_count >= 10 THEN
    RAISE EXCEPTION 'Free message limit reached for this conversation. Upgrade for unlimited messaging.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_message_limit ON public.messages;
CREATE TRIGGER trg_enforce_message_limit
  BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.enforce_message_limit();

-- Lock these triggers' functions down (defense in depth).
REVOKE EXECUTE ON FUNCTION public.enforce_like_limit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_message_limit() FROM PUBLIC, anon, authenticated;