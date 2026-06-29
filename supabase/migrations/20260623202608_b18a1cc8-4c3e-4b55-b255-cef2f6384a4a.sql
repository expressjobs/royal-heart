-- Remove broad public read access to provider settings (config could include sensitive fields).
DROP POLICY IF EXISTS "Anyone can view provider settings" ON public.payment_provider_settings;
REVOKE SELECT ON public.payment_provider_settings FROM anon;

-- Admins retain full access via the existing "Admins manage provider settings" policy.
-- Expose only non-sensitive columns to members through a security-definer function.
CREATE OR REPLACE FUNCTION public.list_payment_providers()
RETURNS TABLE(provider text, display_name text, is_enabled boolean, sort_order integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT provider, display_name, is_enabled, sort_order
  FROM public.payment_provider_settings
  ORDER BY sort_order
$$;

REVOKE EXECUTE ON FUNCTION public.list_payment_providers() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_payment_providers() TO authenticated;