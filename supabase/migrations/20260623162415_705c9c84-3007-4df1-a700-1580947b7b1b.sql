-- 1. Reports: link a report to a conversation (match) for "report conversation" flow
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS match_id uuid REFERENCES public.matches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_reports_match_id ON public.reports(match_id);

-- 2. Profiles: moderation / ban fields (admin-controlled only)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_banned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS banned_until timestamptz,
  ADD COLUMN IF NOT EXISTS ban_reason text;

-- 3. Helper: is a user currently banned/suspended?
CREATE OR REPLACE FUNCTION private.is_banned(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _uid
      AND is_banned = true
      AND (banned_until IS NULL OR banned_until > now())
  );
$$;

-- 4. Protect new privileged fields: only admins may change ban status
CREATE OR REPLACE FUNCTION public.prevent_privileged_profile_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF private.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.membership_tier IS DISTINCT FROM OLD.membership_tier
     OR NEW.is_verified IS DISTINCT FROM OLD.is_verified
     OR NEW.is_featured IS DISTINCT FROM OLD.is_featured
     OR NEW.is_banned IS DISTINCT FROM OLD.is_banned
     OR NEW.banned_until IS DISTINCT FROM OLD.banned_until
     OR NEW.ban_reason IS DISTINCT FROM OLD.ban_reason THEN
    RAISE EXCEPTION 'You are not allowed to change membership tier, verification, featured, or ban status.';
  END IF;

  RETURN NEW;
END;
$$;

-- 5. Audit ban changes alongside existing privileged-field logging
CREATE OR REPLACE FUNCTION public.log_privileged_profile_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.membership_tier IS DISTINCT FROM OLD.membership_tier THEN
    INSERT INTO public.profile_audit_log (profile_id, field_name, old_value, new_value, changed_by)
    VALUES (NEW.id, 'membership_tier', OLD.membership_tier::text, NEW.membership_tier::text, auth.uid());
  END IF;

  IF NEW.is_featured IS DISTINCT FROM OLD.is_featured THEN
    INSERT INTO public.profile_audit_log (profile_id, field_name, old_value, new_value, changed_by)
    VALUES (NEW.id, 'is_featured', OLD.is_featured::text, NEW.is_featured::text, auth.uid());
  END IF;

  IF NEW.is_verified IS DISTINCT FROM OLD.is_verified THEN
    INSERT INTO public.profile_audit_log (profile_id, field_name, old_value, new_value, changed_by)
    VALUES (NEW.id, 'is_verified', OLD.is_verified::text, NEW.is_verified::text, auth.uid());
  END IF;

  IF NEW.is_banned IS DISTINCT FROM OLD.is_banned THEN
    INSERT INTO public.profile_audit_log (profile_id, field_name, old_value, new_value, changed_by)
    VALUES (NEW.id, 'is_banned', OLD.is_banned::text, NEW.is_banned::text, auth.uid());
  END IF;

  RETURN NEW;
END;
$$;

-- 6. Block banned users from sending messages
CREATE OR REPLACE FUNCTION public.enforce_message_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  sent_count integer;
BEGIN
  IF private.is_banned(NEW.sender_id) THEN
    RAISE EXCEPTION 'Your account is suspended and cannot send messages.'
      USING ERRCODE = 'check_violation';
  END IF;

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

-- 7. Block banned users from liking
CREATE OR REPLACE FUNCTION public.enforce_like_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  today_count integer;
BEGIN
  IF private.is_banned(NEW.liker_id) THEN
    RAISE EXCEPTION 'Your account is suspended.'
      USING ERRCODE = 'check_violation';
  END IF;

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

-- 8. Let admins read messages ONLY for conversations that have been reported (read-only review, no impersonation)
DROP POLICY IF EXISTS "Admins view reported messages" ON public.messages;
CREATE POLICY "Admins view reported messages"
ON public.messages FOR SELECT
TO authenticated
USING (
  private.has_role(auth.uid(), 'admin'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.reports r WHERE r.match_id = messages.match_id
  )
);