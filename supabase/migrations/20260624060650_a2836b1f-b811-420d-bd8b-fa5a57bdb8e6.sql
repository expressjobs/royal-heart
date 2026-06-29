-- 1. Restrict role management to super admins only.
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;

CREATE POLICY "Super admins manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (private.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (private.has_role(auth.uid(), 'super_admin'::app_role));

-- Allow admins & super admins (staff) to view all roles for the admin UI.
DROP POLICY IF EXISTS "View own roles" ON public.user_roles;
CREATE POLICY "View own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR private.has_min_role(auth.uid(), 'admin'::app_role));

-- "Users can self-assign default role" (role = 'user' only) policy is kept as-is.

-- 2. Audit every role change.
CREATE OR REPLACE FUNCTION public.log_role_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.admin_audit_log (actor_id, action, entity_type, entity_id, details)
    VALUES (auth.uid(), 'role_granted', 'user_roles', NEW.user_id::text,
            jsonb_build_object('role', NEW.role::text));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.admin_audit_log (actor_id, action, entity_type, entity_id, details)
    VALUES (auth.uid(), 'role_revoked', 'user_roles', OLD.user_id::text,
            jsonb_build_object('role', OLD.role::text));
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_role_changes ON public.user_roles;
CREATE TRIGGER trg_log_role_changes
AFTER INSERT OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.log_role_changes();

-- 3. Secure one-time bootstrap: the existing single admin (project owner) can
--    promote themselves to the first super admin. Fails once any super admin
--    exists, and only works for someone who already holds the admin role
--    (which can never be self-assigned via RLS).
CREATE OR REPLACE FUNCTION public.bootstrap_super_admin()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'You must be signed in.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'super_admin') THEN
    RAISE EXCEPTION 'A super admin already exists.';
  END IF;
  IF NOT private.has_role(uid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only an existing admin can claim the first super admin.';
  END IF;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (uid, 'super_admin')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN 'ok';
END;
$$;

-- 4. Super-admin-only role management for admin/moderator roles.
CREATE OR REPLACE FUNCTION public.admin_assign_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
BEGIN
  IF NOT private.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Only a super admin can assign roles.';
  END IF;
  IF _role NOT IN ('admin'::app_role, 'moderator'::app_role) THEN
    RAISE EXCEPTION 'You can only assign admin or moderator roles here.';
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
  IF NOT private.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Only a super admin can revoke roles.';
  END IF;
  IF _role NOT IN ('admin'::app_role, 'moderator'::app_role) THEN
    RAISE EXCEPTION 'You can only revoke admin or moderator roles here.';
  END IF;
  DELETE FROM public.user_roles WHERE user_id = _user_id AND role = _role;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bootstrap_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_assign_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_role(uuid, app_role) TO authenticated;