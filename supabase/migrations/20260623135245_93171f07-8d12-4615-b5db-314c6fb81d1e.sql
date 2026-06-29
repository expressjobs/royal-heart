-- Fix 1: PRIVILEGE_ESCALATION on profiles
-- Harden the "Update own profile" RLS policy so non-admins cannot change
-- membership_tier, is_verified, or is_featured. The WITH CHECK compares the
-- new row against the currently stored values (read via a subquery, which sees
-- the pre-update snapshot within the statement) so these columns are immutable
-- for non-admins at the RLS layer (defense-in-depth alongside the existing trigger).
DROP POLICY IF EXISTS "Update own profile" ON public.profiles;

CREATE POLICY "Update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND (
    private.has_role(auth.uid(), 'admin'::app_role)
    OR (
      membership_tier = (SELECT p.membership_tier FROM public.profiles p WHERE p.id = profiles.id)
      AND is_verified = (SELECT p.is_verified FROM public.profiles p WHERE p.id = profiles.id)
      AND is_featured = (SELECT p.is_featured FROM public.profiles p WHERE p.id = profiles.id)
    )
  )
);

-- Fix 2: LIKES_INFORMATION_LEAK on likes
-- Restrict the "who liked me" branch to genuine likes (is_like = true) so that
-- pass/reject data is never exposed to the liked user. Users can still read all
-- of their own outgoing rows (liker_id = auth.uid()), including passes, which is
-- their own data and is required for discover-deck exclusion.
DROP POLICY IF EXISTS "View likes involving me" ON public.likes;

CREATE POLICY "View likes involving me"
ON public.likes
FOR SELECT
TO authenticated
USING (
  liker_id = auth.uid()
  OR (liked_id = auth.uid() AND is_like = true AND private.is_premium(auth.uid()))
);