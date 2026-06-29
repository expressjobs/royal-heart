-- Normalize legacy profile values without removing enum values that older clients may reference.

UPDATE public.profiles
SET gender = CASE lower(trim(gender))
  WHEN 'male' THEN 'man'
  WHEN 'men' THEN 'man'
  WHEN 'female' THEN 'woman'
  WHEN 'women' THEN 'woman'
  WHEN 'non-binary' THEN 'nonbinary'
  WHEN 'non binary' THEN 'nonbinary'
  ELSE lower(trim(gender))
END,
updated_at = now()
WHERE gender IS NOT NULL
  AND gender IS DISTINCT FROM CASE lower(trim(gender))
    WHEN 'male' THEN 'man'
    WHEN 'men' THEN 'man'
    WHEN 'female' THEN 'woman'
    WHEN 'women' THEN 'woman'
    WHEN 'non-binary' THEN 'nonbinary'
    WHEN 'non binary' THEN 'nonbinary'
    ELSE lower(trim(gender))
  END;

UPDATE public.profiles
SET membership_tier = 'gold'::public.membership_tier,
    updated_at = now()
WHERE membership_tier = 'premium'::public.membership_tier;

UPDATE public.subscription_plans
SET tier = 'gold'::public.membership_tier,
    name = replace(name, 'Premium', 'Gold'),
    updated_at = now()
WHERE tier = 'premium'::public.membership_tier;
