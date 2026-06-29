-- Audit log for privileged profile field changes
CREATE TABLE public.profile_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  old_value text,
  new_value text,
  changed_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_profile_audit_log_profile_id ON public.profile_audit_log(profile_id);
CREATE INDEX idx_profile_audit_log_created_at ON public.profile_audit_log(created_at DESC);

GRANT SELECT ON public.profile_audit_log TO authenticated;
GRANT ALL ON public.profile_audit_log TO service_role;

ALTER TABLE public.profile_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins may read the audit log. Inserts happen via the SECURITY DEFINER
-- trigger below; no direct insert/update/delete policies are granted.
CREATE POLICY "Admins can view audit log"
  ON public.profile_audit_log
  FOR SELECT
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

-- Trigger: record changes to privileged profile fields
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

REVOKE EXECUTE ON FUNCTION public.log_privileged_profile_changes() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS log_privileged_profile_changes ON public.profiles;
CREATE TRIGGER log_privileged_profile_changes
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.log_privileged_profile_changes();