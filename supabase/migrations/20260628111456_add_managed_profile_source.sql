ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS profile_source text NOT NULL DEFAULT 'user_signup';

UPDATE public.profiles
SET profile_source = 'demo_import'
WHERE is_demo_profile IS TRUE
  AND profile_source = 'user_signup';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_profile_source_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_profile_source_check
  CHECK (profile_source IN ('user_signup', 'demo_import', 'admin_created', 'managed_profile'));

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_managed_profile_not_verified_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_managed_profile_not_verified_check
  CHECK (
    profile_source <> 'managed_profile'
    OR (
      is_verified IS FALSE
      AND email_verified IS FALSE
      AND phone_verified IS FALSE
      AND identity_verified IS FALSE
      AND photo_verified IS FALSE
    )
  );

CREATE INDEX IF NOT EXISTS profiles_managed_discover_idx
  ON public.profiles (profile_source, is_active, is_discoverable, onboarding_complete)
  WHERE profile_source IN ('admin_created', 'managed_profile');

COMMENT ON COLUMN public.profiles.profile_source IS
  'Origin classification only. managed_profile/admin_created rows are admin-controlled and must not imply identity verification.';
