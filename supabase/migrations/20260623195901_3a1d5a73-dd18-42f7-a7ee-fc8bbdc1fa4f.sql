-- 1) Convert location_heatmap from SECURITY DEFINER to SECURITY INVOKER.
-- Admins retain full read access to profiles through existing RLS, and the
-- internal has_role() check keeps non-admins from getting any data.
CREATE OR REPLACE FUNCTION public.location_heatmap(
  _start_date timestamp with time zone DEFAULT NULL::timestamp with time zone,
  _end_date timestamp with time zone DEFAULT NULL::timestamp with time zone,
  _verified_only boolean DEFAULT false
)
RETURNS TABLE(country text, city text, member_count bigint, verified_count bigint)
LANGUAGE sql
STABLE SECURITY INVOKER
SET search_path TO 'public', 'private'
AS $function$
  SELECT
    COALESCE(p.location_country, 'Unknown') AS country,
    COALESCE(p.location_city, 'Unknown') AS city,
    count(*) AS member_count,
    count(*) FILTER (WHERE p.is_verified) AS verified_count
  FROM public.profiles p
  WHERE private.has_role(auth.uid(), 'admin'::app_role)
    AND (_start_date IS NULL OR p.created_at >= _start_date)
    AND (_end_date IS NULL OR p.created_at < _end_date)
    AND (_verified_only IS NOT TRUE OR p.is_verified)
  GROUP BY 1, 2
  ORDER BY member_count DESC
$function$;

-- Lock down execute: only signed-in (admin-gated) users may call it; anon cannot.
REVOKE EXECUTE ON FUNCTION public.location_heatmap(timestamp with time zone, timestamp with time zone, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.location_heatmap(timestamp with time zone, timestamp with time zone, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.location_heatmap(timestamp with time zone, timestamp with time zone, boolean) TO authenticated;

-- 2) Server-side guard for admin-managed CTA links: reject any cta_href whose
-- scheme could execute code (javascript:, data:, vbscript:, etc.). Only
-- http(s)/mailto/tel and relative/anchor links are permitted.
ALTER TABLE public.hero_slides
  ADD CONSTRAINT hero_slides_cta_href_safe
  CHECK (
    cta_href IS NULL
    OR btrim(cta_href) = ''
    OR cta_href ~* '^(https?:|mailto:|tel:|/|#|\.{1,2}/)'
  );
