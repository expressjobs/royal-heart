-- Lock down SECURITY DEFINER helper functions in the private schema so they are
-- not executable by anon (and not granted to PUBLIC). They remain executable by
-- authenticated (required for RLS policy evaluation) and service_role only.
-- The private schema is not exposed via the Data API, so these are not directly
-- callable through the REST API by any client role.

REVOKE EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION private.is_banned(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION private.is_blocked(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION private.is_premium(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION private.tier_at_least(uuid, public.membership_tier) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_banned(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_blocked(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_premium(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.tier_at_least(uuid, public.membership_tier) TO authenticated, service_role;