-- Add a text status for admin profile repair diagnostics.
-- This is a system label only; it does not fill dating fields, photos, or
-- activity for real users.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS profile_completion_status text NOT NULL DEFAULT 'incomplete';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_profile_completion_status_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_profile_completion_status_check
  CHECK (
    profile_completion_status IN (
      'complete',
      'incomplete',
      'not_discoverable',
      'missing_required_fields'
    )
  );

UPDATE public.profiles p
SET profile_completion_status = CASE
  WHEN public.profile_required_fields_complete(p) IS NOT TRUE THEN 'missing_required_fields'
  WHEN p.is_discoverable IS TRUE
    AND p.is_active IS TRUE
    AND p.incognito IS FALSE
    AND p.suspicious_signup_reason IS NULL
    AND p.is_demo_profile IS FALSE
  THEN 'complete'
  ELSE 'not_discoverable'
END
WHERE EXISTS (
  SELECT 1
  FROM auth.users au
  WHERE au.id = p.id
);
