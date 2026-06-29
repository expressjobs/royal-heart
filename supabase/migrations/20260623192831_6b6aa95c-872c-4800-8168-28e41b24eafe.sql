CREATE OR REPLACE FUNCTION public.location_heatmap(
  _start_date timestamptz DEFAULT NULL,
  _end_date timestamptz DEFAULT NULL,
  _verified_only boolean DEFAULT false
)
RETURNS TABLE(country text, city text, member_count bigint, verified_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
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

GRANT EXECUTE ON FUNCTION public.location_heatmap(timestamptz, timestamptz, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.location_heatmap(timestamptz, timestamptz, boolean) TO service_role;