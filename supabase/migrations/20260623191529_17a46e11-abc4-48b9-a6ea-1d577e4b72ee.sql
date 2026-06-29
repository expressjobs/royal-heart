CREATE OR REPLACE FUNCTION public.location_distribution()
RETURNS TABLE(country text, city text, member_count bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    COALESCE(p.location_country, 'Unknown') AS country,
    COALESCE(p.location_city, 'Unknown') AS city,
    count(*) AS member_count
  FROM public.profiles p
  WHERE private.has_role(auth.uid(), 'admin'::app_role)
  GROUP BY 1, 2
  ORDER BY member_count DESC
$$;