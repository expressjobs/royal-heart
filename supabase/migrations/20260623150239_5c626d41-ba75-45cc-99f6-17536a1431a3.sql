-- Notification type enum
DO $$ BEGIN
  CREATE TYPE public.notification_type AS ENUM ('message', 'match', 'verification', 'like');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- =========================================================
-- notifications table
-- =========================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.notification_type NOT NULL,
  title text NOT NULL,
  body text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users may only ever touch their own notifications. Inserts are performed
-- exclusively by SECURITY DEFINER triggers, so there is no INSERT policy.
CREATE POLICY "View own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Delete own notifications" ON public.notifications
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON public.notifications (user_id) WHERE read_at IS NULL;

-- =========================================================
-- notification_preferences table
-- =========================================================
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  new_messages boolean NOT NULL DEFAULT true,
  new_matches boolean NOT NULL DEFAULT true,
  verification boolean NOT NULL DEFAULT true,
  likes boolean NOT NULL DEFAULT true,
  browser_push boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Manage own notification prefs" ON public.notification_preferences
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_notif_prefs_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- create_notification helper (respects preferences)
-- =========================================================
CREATE OR REPLACE FUNCTION public.create_notification(
  _user_id uuid,
  _type public.notification_type,
  _title text,
  _body text,
  _data jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prefs public.notification_preferences%ROWTYPE;
  allowed boolean := true;
BEGIN
  SELECT * INTO prefs FROM public.notification_preferences WHERE user_id = _user_id;

  IF FOUND THEN
    allowed := CASE _type
      WHEN 'message' THEN prefs.new_messages
      WHEN 'match' THEN prefs.new_matches
      WHEN 'verification' THEN prefs.verification
      WHEN 'like' THEN prefs.likes
      ELSE true
    END;
  END IF;

  IF allowed THEN
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (_user_id, _type, _title, _body, COALESCE(_data, '{}'::jsonb));
  END IF;
END;
$$;

-- =========================================================
-- Trigger: new message -> notify recipient
-- =========================================================
CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recipient uuid;
  sender_name text;
BEGIN
  SELECT CASE WHEN m.user1_id = NEW.sender_id THEN m.user2_id ELSE m.user1_id END
    INTO recipient
  FROM public.matches m WHERE m.id = NEW.match_id;

  IF recipient IS NULL THEN RETURN NEW; END IF;

  SELECT display_name INTO sender_name FROM public.profiles WHERE id = NEW.sender_id;

  PERFORM public.create_notification(
    recipient,
    'message',
    COALESCE(sender_name, 'Someone') || ' sent you a message',
    left(NEW.content, 120),
    jsonb_build_object('match_id', NEW.match_id, 'sender_id', NEW.sender_id)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_new_message
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_message();

-- =========================================================
-- Trigger: new match -> notify both members
-- =========================================================
CREATE OR REPLACE FUNCTION public.notify_new_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  name1 text;
  name2 text;
BEGIN
  SELECT display_name INTO name1 FROM public.profiles WHERE id = NEW.user1_id;
  SELECT display_name INTO name2 FROM public.profiles WHERE id = NEW.user2_id;

  PERFORM public.create_notification(
    NEW.user1_id, 'match', 'New match! 💕',
    'You matched with ' || COALESCE(name2, 'someone new') || '. Say hi!',
    jsonb_build_object('match_id', NEW.id, 'other_id', NEW.user2_id)
  );
  PERFORM public.create_notification(
    NEW.user2_id, 'match', 'New match! 💕',
    'You matched with ' || COALESCE(name1, 'someone new') || '. Say hi!',
    jsonb_build_object('match_id', NEW.id, 'other_id', NEW.user1_id)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_new_match
  AFTER INSERT ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_match();

-- =========================================================
-- Trigger: verification approved -> notify member
-- =========================================================
CREATE OR REPLACE FUNCTION public.notify_verification_approved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    PERFORM public.create_notification(
      NEW.user_id, 'verification', 'You''re verified! ✅',
      'Your profile verification was approved. Your badge is now live.',
      '{}'::jsonb
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_verification_approved
  AFTER UPDATE ON public.verification_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_verification_approved();

-- =========================================================
-- Trigger: new like -> notify liked member (identity NOT revealed)
-- =========================================================
CREATE OR REPLACE FUNCTION public.notify_new_like()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_like IS TRUE THEN
    -- Identity is intentionally omitted to preserve the premium "who liked you" gate.
    PERFORM public.create_notification(
      NEW.liked_id, 'like', 'Someone likes you! ❤️',
      'You have a new admirer. Open your Likes to find out who.',
      '{}'::jsonb
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_new_like
  AFTER INSERT ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_like();

-- =========================================================
-- Realtime
-- =========================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;