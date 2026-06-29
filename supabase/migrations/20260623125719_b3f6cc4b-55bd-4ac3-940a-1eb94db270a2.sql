-- Fix 1: Prevent privilege escalation via self profile updates.
-- Non-admin users must not change membership_tier, is_verified, or is_featured.
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

REVOKE EXECUTE ON FUNCTION public.prevent_privileged_profile_changes() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS prevent_privileged_profile_changes ON public.profiles;
CREATE TRIGGER prevent_privileged_profile_changes
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_privileged_profile_changes();

-- Fix 2: Gate inbound likes ("who liked me") to premium tiers at the RLS level.
CREATE OR REPLACE FUNCTION private.is_premium(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id
      AND membership_tier IN ('gold'::membership_tier, 'platinum'::membership_tier)
  );
$$;

REVOKE EXECUTE ON FUNCTION private.is_premium(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_premium(uuid) TO authenticated;

DROP POLICY IF EXISTS "View likes involving me" ON public.likes;
CREATE POLICY "View likes involving me"
  ON public.likes
  FOR SELECT
  TO authenticated
  USING (
    liker_id = auth.uid()
    OR (liked_id = auth.uid() AND private.is_premium(auth.uid()))
  );