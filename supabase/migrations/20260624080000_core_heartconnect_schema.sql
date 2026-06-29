-- Core HeartConnect application schema.
-- Safe for live projects that already have auth/security tables: this migration
-- only creates missing objects, adds missing columns, and replaces app-table RLS
-- policies. It does not delete security tables, owner settings, or role rows.

CREATE SCHEMA IF NOT EXISTS private;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.app_role AS ENUM ('user', 'moderator', 'admin', 'super_admin');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'membership_tier' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.membership_tier AS ENUM ('free', 'premium', 'gold', 'platinum');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_category' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.report_category AS ENUM ('profile', 'photo', 'message', 'scam', 'fake_profile', 'harassment', 'abuse', 'spam', 'underage', 'other');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.report_status AS ENUM ('pending', 'reviewed', 'resolved', 'dismissed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_severity' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.report_severity AS ENUM ('low', 'medium', 'high', 'critical');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'verification_status' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.verification_status AS ENUM ('pending', 'approved', 'rejected');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.notification_type AS ENUM ('message', 'match', 'verification', 'like', 'payment');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE TABLE IF NOT EXISTS public.app_security_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_security_settings
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.user_moderation (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_banned boolean NOT NULL DEFAULT false,
  banned_until timestamptz,
  ban_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_moderation
  ADD COLUMN IF NOT EXISTS is_banned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS banned_until timestamptz,
  ADD COLUMN IF NOT EXISTS ban_reason text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
GRANT SELECT ON public.app_security_settings TO authenticated;
GRANT ALL ON public.app_security_settings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_moderation TO authenticated;
GRANT ALL ON public.user_moderation TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_security_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_moderation ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION private.role_rank(_role public.app_role)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE _role
    WHEN 'super_admin'::public.app_role THEN 3
    WHEN 'admin'::public.app_role THEN 2
    WHEN 'moderator'::public.app_role THEN 1
    ELSE 0
  END
$$;

CREATE OR REPLACE FUNCTION private.has_min_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND private.role_rank(ur.role) >= private.role_rank(_role)
  )
$$;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id AND ur.role = _role
  )
$$;

CREATE OR REPLACE FUNCTION private.is_owner(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.app_security_settings
    WHERE id = true
      AND owner_user_id = _user_id
  )
$$;

REVOKE EXECUTE ON FUNCTION private.role_rank(public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION private.has_min_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION private.is_owner(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_min_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_owner(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Users read own roles" ON public.user_roles;
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users create own user role only" ON public.user_roles;

CREATE OR REPLACE FUNCTION public.ensure_default_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ensure_default_user_role() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_default_user_role() TO service_role;

DROP TRIGGER IF EXISTS on_auth_user_created_default_role ON auth.users;
CREATE TRIGGER on_auth_user_created_default_role
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.ensure_default_user_role();

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'user'::public.app_role
FROM auth.users u
ON CONFLICT (user_id, role) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  username text UNIQUE,
  bio text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_active timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  is_verified boolean NOT NULL DEFAULT false,
  is_featured boolean NOT NULL DEFAULT false,
  is_demo_profile boolean NOT NULL DEFAULT false,
  membership_tier public.membership_tier NOT NULL DEFAULT 'free',
  onboarding_complete boolean NOT NULL DEFAULT false,
  onboarding_completed_at timestamptz,
  profile_completion_score integer NOT NULL DEFAULT 0,
  date_of_birth date,
  birth_date date,
  gender text,
  interested_in text[] NOT NULL DEFAULT '{}',
  relationship_goal text,
  country text,
  city text,
  location_country text,
  location_city text,
  location_state text,
  latitude double precision,
  longitude double precision,
  location_geog extensions.geography(Point, 4326),
  location_updated_at timestamptz,
  location_hidden boolean NOT NULL DEFAULT false,
  location_access_suspended boolean NOT NULL DEFAULT false,
  hide_distance boolean NOT NULL DEFAULT false,
  hide_age boolean NOT NULL DEFAULT false,
  hide_online_status boolean NOT NULL DEFAULT false,
  incognito boolean NOT NULL DEFAULT false,
  interests text[] NOT NULL DEFAULT '{}',
  languages text[] NOT NULL DEFAULT '{}',
  religion text,
  education text,
  profession text,
  smoking text,
  drinking text,
  workout text,
  family_plans text,
  pets text,
  phone_country_code text,
  phone_number text,
  terms_accepted_at timestamptz,
  privacy_accepted_at timestamptz,
  age_attested_at timestamptz,
  safety_agreement_accepted_at timestamptz,
  signup_ip_hash text,
  signup_user_agent text,
  suspicious_signup_reason text,
  discovery_blocked_reason text
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_active timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_demo_profile boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS membership_tier public.membership_tier NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS onboarding_complete boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS profile_completion_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS interested_in text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS relationship_goal text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS location_country text,
  ADD COLUMN IF NOT EXISTS location_city text,
  ADD COLUMN IF NOT EXISTS location_state text,
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS location_geog extensions.geography(Point, 4326),
  ADD COLUMN IF NOT EXISTS location_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS location_hidden boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS location_access_suspended boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hide_distance boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hide_age boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hide_online_status boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS incognito boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS interests text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS languages text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS religion text,
  ADD COLUMN IF NOT EXISTS education text,
  ADD COLUMN IF NOT EXISTS profession text,
  ADD COLUMN IF NOT EXISTS smoking text,
  ADD COLUMN IF NOT EXISTS drinking text,
  ADD COLUMN IF NOT EXISTS workout text,
  ADD COLUMN IF NOT EXISTS family_plans text,
  ADD COLUMN IF NOT EXISTS pets text,
  ADD COLUMN IF NOT EXISTS phone_country_code text,
  ADD COLUMN IF NOT EXISTS phone_number text,
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS age_attested_at timestamptz,
  ADD COLUMN IF NOT EXISTS safety_agreement_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS signup_ip_hash text,
  ADD COLUMN IF NOT EXISTS signup_user_agent text,
  ADD COLUMN IF NOT EXISTS suspicious_signup_reason text,
  ADD COLUMN IF NOT EXISTS discovery_blocked_reason text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique_idx ON public.profiles (lower(username)) WHERE username IS NOT NULL;
CREATE INDEX IF NOT EXISTS profiles_location_idx ON public.profiles USING gist (location_geog);
CREATE INDEX IF NOT EXISTS profiles_discovery_idx ON public.profiles (onboarding_complete, is_active, is_verified, membership_tier);

CREATE OR REPLACE FUNCTION public.sync_profile_core_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at := now();
  NEW.birth_date := COALESCE(NEW.birth_date, NEW.date_of_birth);
  NEW.date_of_birth := COALESCE(NEW.date_of_birth, NEW.birth_date);
  NEW.location_country := COALESCE(NULLIF(NEW.location_country, ''), NULLIF(NEW.country, ''));
  NEW.country := COALESCE(NULLIF(NEW.country, ''), NULLIF(NEW.location_country, ''));
  NEW.location_city := COALESCE(NULLIF(NEW.location_city, ''), NULLIF(NEW.city, ''));
  NEW.city := COALESCE(NULLIF(NEW.city, ''), NULLIF(NEW.location_city, ''));
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.location_geog := extensions.ST_SetSRID(extensions.ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::extensions.geography;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_profile_core_fields ON public.profiles;
CREATE TRIGGER sync_profile_core_fields BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.sync_profile_core_fields();

CREATE TABLE IF NOT EXISTS public.profile_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  url text NOT NULL,
  storage_path text,
  is_primary boolean NOT NULL DEFAULT false,
  is_private boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  moderation_status text NOT NULL DEFAULT 'approved',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profile_photos
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'approved';
CREATE INDEX IF NOT EXISTS profile_photos_user_idx ON public.profile_photos (user_id, position);
CREATE INDEX IF NOT EXISTS profile_photos_visibility_idx ON public.profile_photos (user_id, is_private, moderation_status);

CREATE TABLE IF NOT EXISTS public.blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

CREATE OR REPLACE FUNCTION private.is_blocked(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.blocks
    WHERE (blocker_id = _a AND blocked_id = _b)
       OR (blocker_id = _b AND blocked_id = _a)
  )
$$;

CREATE OR REPLACE FUNCTION private.is_banned(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_moderation
    WHERE user_id = _uid
      AND is_banned = true
      AND (banned_until IS NULL OR banned_until > now())
  )
$$;

REVOKE EXECUTE ON FUNCTION private.is_blocked(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION private.is_banned(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_blocked(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_banned(uuid) TO authenticated, service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-photos',
  'profile-photos',
  false,
  8388608,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Authenticated can view profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Visible profile photo files are readable" ON storage.objects;
CREATE POLICY "Visible profile photo files are readable"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'profile-photos'
    AND EXISTS (
      SELECT 1
      FROM public.profile_photos pp
      JOIN public.profiles p ON p.id = pp.user_id
      WHERE (pp.url = storage.objects.name OR pp.storage_path = storage.objects.name)
        AND (
          pp.user_id = auth.uid()
          OR private.has_min_role(auth.uid(), 'admin'::public.app_role)
          OR (
            pp.is_private IS NOT TRUE
            AND pp.moderation_status = 'approved'
            AND p.onboarding_complete IS TRUE
            AND p.is_active IS TRUE
            AND p.is_demo_profile IS NOT TRUE
            AND p.discovery_blocked_reason IS NULL
            AND NOT private.is_blocked(auth.uid(), pp.user_id)
            AND NOT private.is_banned(pp.user_id)
          )
        )
    )
  );

DROP POLICY IF EXISTS "Users upload own profile photos" ON storage.objects;
CREATE POLICY "Users upload own profile photos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'profile-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users update own profile photos" ON storage.objects;
CREATE POLICY "Users update own profile photos"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'profile-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'profile-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users delete own profile photos" ON storage.objects;
CREATE POLICY "Users delete own profile photos"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'profile-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE TABLE IF NOT EXISTS public.likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  liker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  liked_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_like boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (liker_id, liked_id),
  CHECK (liker_id <> liked_id)
);

CREATE TABLE IF NOT EXISTS public.matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user2_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  unmatched_at timestamptz,
  UNIQUE (user1_id, user2_id),
  CHECK (user1_id <> user2_id)
);

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text,
  media_url text,
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  content_type text,
  content_id uuid,
  category public.report_category NOT NULL DEFAULT 'other',
  severity public.report_severity NOT NULL DEFAULT 'medium',
  status public.report_status NOT NULL DEFAULT 'pending',
  details text,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.verification_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status public.verification_status NOT NULL DEFAULT 'pending',
  photo_path text,
  document_url text,
  selfie_url text,
  document_type text,
  notes text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.verification_requests
  ADD COLUMN IF NOT EXISTS photo_path text,
  ADD COLUMN IF NOT EXISTS document_url text,
  ADD COLUMN IF NOT EXISTS selfie_url text,
  ADD COLUMN IF NOT EXISTS document_type text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'verification_document_type_check'
      AND conrelid = 'public.verification_requests'::regclass
  ) THEN
    ALTER TABLE public.verification_requests
      ADD CONSTRAINT verification_document_type_check
      CHECK (document_type IS NULL OR document_type IN ('passport', 'national_id', 'drivers_license'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.verification_review (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL UNIQUE REFERENCES public.verification_requests(id) ON DELETE CASCADE,
  fraud_score integer NOT NULL DEFAULT 0,
  fraud_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  selfie_hash text,
  id_photo_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.verification_review
  ADD COLUMN IF NOT EXISTS fraud_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fraud_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS selfie_hash text,
  ADD COLUMN IF NOT EXISTS id_photo_path text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type public.notification_type NOT NULL,
  title text NOT NULL,
  message text,
  link_url text,
  read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  email_messages boolean NOT NULL DEFAULT true,
  email_matches boolean NOT NULL DEFAULT true,
  email_likes boolean NOT NULL DEFAULT true,
  email_verification boolean NOT NULL DEFAULT true,
  push_messages boolean NOT NULL DEFAULT true,
  push_matches boolean NOT NULL DEFAULT true,
  push_likes boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  tier public.membership_tier NOT NULL,
  price_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  interval text NOT NULL DEFAULT 'month',
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
  tier public.membership_tier NOT NULL DEFAULT 'free',
  status text NOT NULL DEFAULT 'active',
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  amount_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'pending',
  provider text,
  provider_payment_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  amount_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'draft',
  invoice_url text,
  due_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION private.is_match_participant(_match_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = _match_id
      AND m.unmatched_at IS NULL
      AND _user_id IN (m.user1_id, m.user2_id)
  )
$$;

REVOKE EXECUTE ON FUNCTION private.is_match_participant(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_match_participant(uuid, uuid) TO authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.profiles, public.profile_photos, public.blocks, public.likes,
  public.matches, public.messages, public.reports, public.verification_requests,
  public.verification_review,
  public.notifications, public.notification_preferences, public.subscriptions,
  public.payments, public.invoices, public.subscription_plans
TO authenticated;

GRANT ALL ON
  public.profiles, public.profile_photos, public.blocks, public.likes,
  public.matches, public.messages, public.reports, public.verification_requests,
  public.verification_review,
  public.notifications, public.notification_preferences, public.subscriptions,
  public.payments, public.invoices, public.subscription_plans
TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_review ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
DROP POLICY IF EXISTS "Update own profile" ON public.profiles;
CREATE POLICY "Update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
DROP POLICY IF EXISTS "Admins manage profiles" ON public.profiles;
CREATE POLICY "Admins manage profiles" ON public.profiles FOR ALL TO authenticated USING (private.has_min_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_min_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Users read own photos" ON public.profile_photos;
DROP POLICY IF EXISTS "Visible profile photos are readable" ON public.profile_photos;
CREATE POLICY "Visible profile photos are readable" ON public.profile_photos FOR SELECT TO authenticated USING (
  user_id = auth.uid()
  OR private.has_min_role(auth.uid(), 'admin'::public.app_role)
  OR (
    is_private IS NOT TRUE
    AND moderation_status = 'approved'
    AND NOT private.is_blocked(auth.uid(), user_id)
    AND NOT private.is_banned(user_id)
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = profile_photos.user_id
        AND p.onboarding_complete IS TRUE
        AND p.is_active IS TRUE
        AND p.is_demo_profile IS NOT TRUE
        AND p.discovery_blocked_reason IS NULL
    )
  )
);
DROP POLICY IF EXISTS "Users manage own photos" ON public.profile_photos;
CREATE POLICY "Users manage own photos" ON public.profile_photos FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users manage own blocks" ON public.blocks;
CREATE POLICY "Users manage own blocks" ON public.blocks FOR ALL TO authenticated USING (blocker_id = auth.uid() OR private.has_min_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (blocker_id = auth.uid() OR private.has_min_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Users manage own likes" ON public.likes;
CREATE POLICY "Users manage own likes" ON public.likes FOR ALL TO authenticated USING (liker_id = auth.uid() OR liked_id = auth.uid() OR private.has_min_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (liker_id = auth.uid() OR private.has_min_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Match participants read matches" ON public.matches;
CREATE POLICY "Match participants read matches" ON public.matches FOR SELECT TO authenticated USING (auth.uid() IN (user1_id, user2_id) OR private.has_min_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS "Users create own matches" ON public.matches;
CREATE POLICY "Users create own matches" ON public.matches FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (user1_id, user2_id) OR private.has_min_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS "Match participants update matches" ON public.matches;
CREATE POLICY "Match participants update matches" ON public.matches FOR UPDATE TO authenticated USING (auth.uid() IN (user1_id, user2_id) OR private.has_min_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (auth.uid() IN (user1_id, user2_id) OR private.has_min_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Match participants read messages" ON public.messages;
CREATE POLICY "Match participants read messages" ON public.messages FOR SELECT TO authenticated USING (private.is_match_participant(match_id, auth.uid()) OR private.has_min_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS "Match participants send messages" ON public.messages;
CREATE POLICY "Match participants send messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid() AND private.is_match_participant(match_id, auth.uid()));
DROP POLICY IF EXISTS "Message participants update read state" ON public.messages;
CREATE POLICY "Message participants update read state" ON public.messages FOR UPDATE TO authenticated USING (private.is_match_participant(match_id, auth.uid()) OR private.has_min_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.is_match_participant(match_id, auth.uid()) OR private.has_min_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Users create reports" ON public.reports;
CREATE POLICY "Users create reports" ON public.reports FOR INSERT TO authenticated WITH CHECK (reporter_id = auth.uid());
DROP POLICY IF EXISTS "Users read own reports" ON public.reports;
CREATE POLICY "Users read own reports" ON public.reports FOR SELECT TO authenticated USING (reporter_id = auth.uid() OR private.has_min_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS "Admins update reports" ON public.reports;
CREATE POLICY "Admins update reports" ON public.reports FOR UPDATE TO authenticated USING (private.has_min_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_min_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Users manage own verification requests" ON public.verification_requests;
CREATE POLICY "Users manage own verification requests" ON public.verification_requests FOR ALL TO authenticated USING (user_id = auth.uid() OR private.has_min_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (user_id = auth.uid() OR private.has_min_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS "Admins manage verification review" ON public.verification_review;
CREATE POLICY "Admins manage verification review" ON public.verification_review FOR ALL TO authenticated USING (private.has_min_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_min_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Users read own notifications" ON public.notifications;
CREATE POLICY "Users read own notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid() OR private.has_min_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications;
CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Admins create notifications" ON public.notifications;
CREATE POLICY "Admins create notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (private.has_min_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Users manage own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users manage own notification preferences" ON public.notification_preferences FOR ALL TO authenticated USING (user_id = auth.uid() OR private.has_min_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (user_id = auth.uid() OR private.has_min_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Everyone reads active plans" ON public.subscription_plans;
CREATE POLICY "Everyone reads active plans" ON public.subscription_plans FOR SELECT TO authenticated USING (is_active OR private.has_min_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS "Admins manage plans" ON public.subscription_plans;
CREATE POLICY "Admins manage plans" ON public.subscription_plans FOR ALL TO authenticated USING (private.has_min_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_min_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Users read own subscriptions" ON public.subscriptions;
CREATE POLICY "Users read own subscriptions" ON public.subscriptions FOR SELECT TO authenticated USING (user_id = auth.uid() OR private.has_min_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS "Admins manage subscriptions" ON public.subscriptions;
CREATE POLICY "Admins manage subscriptions" ON public.subscriptions FOR ALL TO authenticated USING (private.has_min_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_min_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Users read own payments" ON public.payments;
CREATE POLICY "Users read own payments" ON public.payments FOR SELECT TO authenticated USING (user_id = auth.uid() OR private.has_min_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS "Admins manage payments" ON public.payments;
CREATE POLICY "Admins manage payments" ON public.payments FOR ALL TO authenticated USING (private.has_min_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_min_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Users read own invoices" ON public.invoices;
CREATE POLICY "Users read own invoices" ON public.invoices FOR SELECT TO authenticated USING (user_id = auth.uid() OR private.has_min_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS "Admins manage invoices" ON public.invoices;
CREATE POLICY "Admins manage invoices" ON public.invoices FOR ALL TO authenticated USING (private.has_min_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_min_role(auth.uid(), 'admin'::public.app_role));

INSERT INTO public.subscription_plans (slug, name, tier, price_cents, currency, interval, features, is_active)
VALUES
  ('free', 'Free', 'free', 0, 'USD', 'month', '{"likes_per_day":10}'::jsonb, true),
  ('premium-monthly', 'Premium Monthly', 'premium', 1999, 'USD', 'month', '{"unlimited_likes":true,"advanced_filters":true}'::jsonb, true),
  ('gold-monthly', 'Gold Monthly', 'gold', 2999, 'USD', 'month', '{"unlimited_likes":true,"see_likes":true,"boosts":true}'::jsonb, true),
  ('platinum-monthly', 'Platinum Monthly', 'platinum', 3999, 'USD', 'month', '{"priority_discovery":true,"unlimited_likes":true,"see_likes":true}'::jsonb, true)
ON CONFLICT (slug) DO NOTHING;
