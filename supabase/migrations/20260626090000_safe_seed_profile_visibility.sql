-- Safe seed-profile visibility.
-- Demo profiles may appear in discovery/search while the launch toggle is on,
-- but remain internally marked and are not treated as verified real users.

DROP POLICY IF EXISTS "Visible profile photos are readable" ON public.profile_photos;
CREATE POLICY "Visible profile photos are readable"
ON public.profile_photos
FOR SELECT
TO authenticated
USING (
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
        AND (p.is_demo_profile IS NOT TRUE OR public.demo_profiles_visible())
        AND p.discovery_blocked_reason IS NULL
    )
  )
);

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
          AND (p.is_demo_profile IS NOT TRUE OR public.demo_profiles_visible())
          AND p.discovery_blocked_reason IS NULL
          AND NOT private.is_blocked(auth.uid(), pp.user_id)
          AND NOT private.is_banned(pp.user_id)
        )
      )
  )
);

DROP FUNCTION IF EXISTS public.get_visible_profiles(uuid[]);
CREATE OR REPLACE FUNCTION public.get_visible_profiles(_ids uuid[])
RETURNS TABLE(
  id uuid,
  display_name text,
  updated_at timestamptz,
  created_at timestamptz,
  last_active timestamptz,
  onboarding_complete boolean,
  is_featured boolean,
  is_verified boolean,
  is_demo_profile boolean,
  membership_tier public.membership_tier,
  interests text[],
  bio text,
  location_country text,
  location_city text,
  interested_in text[],
  gender text,
  latitude double precision,
  longitude double precision,
  location_state text,
  location_hidden boolean,
  location_access_suspended boolean,
  languages text[],
  location_updated_at timestamptz,
  religion text,
  education text,
  relationship_goal text,
  birth_date date
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
  SELECT
    p.id,
    p.display_name,
    p.updated_at,
    p.created_at,
    p.last_active,
    p.onboarding_complete,
    p.is_featured,
    p.is_verified,
    p.is_demo_profile,
    p.membership_tier,
    p.interests,
    p.bio,
    p.location_country,
    p.location_city,
    p.interested_in,
    p.gender,
    CASE WHEN p.id = auth.uid() OR private.has_min_role(auth.uid(), 'admin'::app_role)
         THEN p.latitude ELSE NULL END,
    CASE WHEN p.id = auth.uid() OR private.has_min_role(auth.uid(), 'admin'::app_role)
         THEN p.longitude ELSE NULL END,
    p.location_state,
    p.location_hidden,
    p.location_access_suspended,
    p.languages,
    p.location_updated_at,
    p.religion,
    p.education,
    p.relationship_goal,
    CASE WHEN p.id = auth.uid() OR private.has_min_role(auth.uid(), 'admin'::app_role)
         THEN p.birth_date
         ELSE make_date(EXTRACT(YEAR FROM p.birth_date)::int, 1, 1) END
  FROM public.profiles p
  WHERE p.id = ANY(_ids)
    AND (
      p.id = auth.uid()
      OR private.has_min_role(auth.uid(), 'admin'::app_role)
      OR (
        public.profile_is_discoverable(p.id)
        AND (p.is_demo_profile IS NOT TRUE OR public.demo_profiles_visible())
        AND NOT private.is_blocked(auth.uid(), p.id)
        AND NOT private.is_banned(p.id)
      )
    )
$$;

GRANT EXECUTE ON FUNCTION public.get_visible_profiles(uuid[]) TO authenticated;
