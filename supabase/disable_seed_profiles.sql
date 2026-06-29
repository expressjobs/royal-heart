-- Hide HeartConnect seed/demo profiles without deleting them.
-- This preserves auditability and any real users' pass/unavailable rows.

UPDATE public.profiles
SET is_active = false,
    updated_at = now()
WHERE is_demo_profile = true;
