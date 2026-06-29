CREATE OR REPLACE FUNCTION private.tier_rank(_tier public.membership_tier)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $$
  SELECT CASE _tier
    WHEN 'free' THEN 0
    WHEN 'premium' THEN 1
    WHEN 'gold' THEN 2
    WHEN 'platinum' THEN 3
    ELSE 0
  END
$$;