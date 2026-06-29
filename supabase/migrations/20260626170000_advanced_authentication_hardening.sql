-- Advanced authentication hardening for registration, login locks, and admin review.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS failed_login_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS account_locked_until timestamptz,
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique_idx
ON public.profiles (lower(username))
WHERE username IS NOT NULL;

CREATE INDEX IF NOT EXISTS profiles_account_locked_until_idx
ON public.profiles (account_locked_until)
WHERE account_locked_until IS NOT NULL;

ALTER TABLE public.login_history
  ADD COLUMN IF NOT EXISTS success boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS failure_reason text,
  ADD COLUMN IF NOT EXISTS identifier_hash text,
  ADD COLUMN IF NOT EXISTS ip_hash text;

ALTER TABLE public.login_history
  DROP CONSTRAINT IF EXISTS login_history_event_type_check;

ALTER TABLE public.login_history
  ADD CONSTRAINT login_history_event_type_check
  CHECK (event_type IN ('login', 'failed_login', 'account_locked', 'password_reset'));

CREATE INDEX IF NOT EXISTS login_history_user_created_idx
ON public.login_history (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS login_history_identifier_created_idx
ON public.login_history (identifier_hash, created_at DESC)
WHERE identifier_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.auth_identifier_locks (
  identifier_hash text PRIMARY KEY,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.auth_identifier_locks TO service_role;
ALTER TABLE public.auth_identifier_locks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages auth identifier locks" ON public.auth_identifier_locks;
CREATE POLICY "Service role manages auth identifier locks"
ON public.auth_identifier_locks
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.auth_user_lookup (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  email_lower text NOT NULL,
  email_confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS auth_user_lookup_email_lower_idx
ON public.auth_user_lookup (email_lower);

GRANT ALL ON public.auth_user_lookup TO service_role;
ALTER TABLE public.auth_user_lookup ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages auth user lookup" ON public.auth_user_lookup;
CREATE POLICY "Service role manages auth user lookup"
ON public.auth_user_lookup
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.sync_auth_user_lookup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.auth_user_lookup WHERE user_id = OLD.id;
    RETURN OLD;
  END IF;

  INSERT INTO public.auth_user_lookup (
    user_id,
    email,
    email_lower,
    email_confirmed_at,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    lower(NEW.email),
    NEW.email_confirmed_at,
    COALESCE(NEW.created_at, now()),
    now()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    email = EXCLUDED.email,
    email_lower = EXCLUDED.email_lower,
    email_confirmed_at = EXCLUDED.email_confirmed_at,
    updated_at = now();

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_auth_user_lookup() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_auth_user_lookup() TO service_role;

DROP TRIGGER IF EXISTS sync_auth_user_lookup ON auth.users;
CREATE TRIGGER sync_auth_user_lookup
AFTER INSERT OR UPDATE OF email, email_confirmed_at OR DELETE ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.sync_auth_user_lookup();

INSERT INTO public.auth_user_lookup (user_id, email, email_lower, email_confirmed_at, created_at, updated_at)
SELECT id, email, lower(email), email_confirmed_at, COALESCE(created_at, now()), now()
FROM auth.users
WHERE email IS NOT NULL
ON CONFLICT (user_id) DO UPDATE
SET
  email = EXCLUDED.email,
  email_lower = EXCLUDED.email_lower,
  email_confirmed_at = EXCLUDED.email_confirmed_at,
  updated_at = now();

DROP POLICY IF EXISTS "Admins read login history" ON public.login_history;
CREATE POLICY "Admins read login history"
ON public.login_history
FOR SELECT
TO authenticated
USING (private.has_min_role(auth.uid(), 'admin'::app_role));
