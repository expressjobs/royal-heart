-- 1. Dedicated, admin-only moderation table
CREATE TABLE IF NOT EXISTS public.user_moderation (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_banned boolean NOT NULL DEFAULT false,
  banned_until timestamptz,
  ban_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_moderation TO authenticated;
GRANT ALL ON public.user_moderation TO service_role;

ALTER TABLE public.user_moderation ENABLE ROW LEVEL SECURITY;

-- Admins manage all moderation rows
CREATE POLICY "Admins manage moderation"
ON public.user_moderation FOR ALL
TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- A member may read only their own moderation row (to see suspension status)
CREATE POLICY "View own moderation row"
ON public.user_moderation FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE TRIGGER trg_user_moderation_updated
BEFORE UPDATE ON public.user_moderation
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Carry over any existing ban data, then drop the exposed profile columns
INSERT INTO public.user_moderation (user_id, is_banned, banned_until, ban_reason)
SELECT id, is_banned, banned_until, ban_reason
FROM public.profiles
WHERE is_banned = true
ON CONFLICT (user_id) DO NOTHING;

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS is_banned,
  DROP COLUMN IF EXISTS banned_until,
  DROP COLUMN IF EXISTS ban_reason;

-- 3. Point the ban helper at the new table
CREATE OR REPLACE FUNCTION private.is_banned(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_moderation
    WHERE user_id = _uid
      AND is_banned = true
      AND (banned_until IS NULL OR banned_until > now())
  );
$$;

-- 4. Restore profile triggers to their original (ban-free) field set
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
     OR NEW.is_featured IS DISTINCT FROM OLD.is_featured THEN
    RAISE EXCEPTION 'You are not allowed to change membership tier, verification, or featured status.';
  END IF;

  RETURN NEW;
END;
$$;

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

  RETURN NEW;
END;
$$;

-- 5. Log ban changes from the moderation table instead
CREATE OR REPLACE FUNCTION public.log_moderation_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.is_banned)
     OR (TG_OP = 'UPDATE' AND NEW.is_banned IS DISTINCT FROM OLD.is_banned) THEN
    INSERT INTO public.profile_audit_log (profile_id, field_name, old_value, new_value, changed_by)
    VALUES (
      NEW.user_id,
      'is_banned',
      CASE WHEN TG_OP = 'UPDATE' THEN OLD.is_banned::text ELSE 'false' END,
      NEW.is_banned::text,
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_moderation
AFTER INSERT OR UPDATE ON public.user_moderation
FOR EACH ROW EXECUTE FUNCTION public.log_moderation_changes();

-- 6. Hide suspended members from everyone except admins and themselves
DROP POLICY IF EXISTS "View non-blocked profiles" ON public.profiles;
CREATE POLICY "View non-blocked profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR private.has_role(auth.uid(), 'admin'::app_role)
  OR (
    NOT private.is_blocked(auth.uid(), id)
    AND NOT private.is_banned(id)
  )
);

-- 7. Restrict message read-status updates to the recipient only (no content tampering)
DROP POLICY IF EXISTS "Update read status in own matches" ON public.messages;
CREATE POLICY "Recipient marks messages read"
ON public.messages FOR UPDATE
TO authenticated
USING (
  sender_id <> auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = messages.match_id
      AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
  )
)
WITH CHECK (
  sender_id <> auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = messages.match_id
      AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
  )
);