-- Launch security hardening: owner-only role assignment, login history, and
-- stricter role checks for admin/super_admin.

CREATE TABLE IF NOT EXISTS public.app_security_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.app_security_settings TO authenticated;
GRANT ALL ON public.app_security_settings TO service_role;
ALTER TABLE public.app_security_settings ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION private.is_owner(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.app_security_settings
    WHERE id = true
      AND owner_user_id = _user_id
  );
$$;

REVOKE EXECUTE ON FUNCTION private.is_owner(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_owner(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Owner reads security settings" ON public.app_security_settings;
CREATE POLICY "Owner reads security settings"
ON public.app_security_settings
FOR SELECT
TO authenticated
USING (private.is_owner(auth.uid()));

DROP POLICY IF EXISTS "Super admins manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Owner manages roles" ON public.user_roles;
CREATE POLICY "Owner manages roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (private.is_owner(auth.uid()))
WITH CHECK (private.is_owner(auth.uid()));

CREATE OR REPLACE FUNCTION public.bootstrap_super_admin()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
BEGIN
  RAISE EXCEPTION 'Bootstrap is disabled. Assign the owner and staff roles directly in Supabase.';
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_assign_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
BEGIN
  IF NOT private.is_owner(auth.uid()) THEN
    RAISE EXCEPTION 'Only the configured owner can assign roles.';
  END IF;
  IF _role NOT IN ('admin'::app_role, 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Only admin or super_admin roles can be assigned here.';
  END IF;
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'A target user is required.';
  END IF;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, _role)
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_revoke_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
BEGIN
  IF NOT private.is_owner(auth.uid()) THEN
    RAISE EXCEPTION 'Only the configured owner can revoke roles.';
  END IF;
  IF _role NOT IN ('admin'::app_role, 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Only admin or super_admin roles can be revoked here.';
  END IF;
  DELETE FROM public.user_roles WHERE user_id = _user_id AND role = _role;
  RETURN true;
END;
$$;

CREATE TABLE IF NOT EXISTS public.login_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL DEFAULT 'login' CHECK (event_type IN ('login')),
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.login_history TO authenticated;
GRANT ALL ON public.login_history TO service_role;
ALTER TABLE public.login_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own login history" ON public.login_history;
CREATE POLICY "Users read own login history"
ON public.login_history
FOR SELECT
TO authenticated
USING (user_id = auth.uid());
