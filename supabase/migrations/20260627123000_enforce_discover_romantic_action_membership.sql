-- Enforce Discover romantic action gates below the frontend.

INSERT INTO public.site_content (section, data)
VALUES (
  'settings',
  '{
    "free_users_can_browse": true,
    "free_users_can_like": false,
    "free_users_can_message": false,
    "discover_global_mode": true
  }'::jsonb
)
ON CONFLICT (section) DO UPDATE
SET data = public.site_content.data
  || '{
    "free_users_can_browse": true,
    "free_users_can_like": false,
    "free_users_can_message": false,
    "discover_global_mode": true
  }'::jsonb
  || public.site_content.data,
  updated_at = now();

CREATE OR REPLACE FUNCTION private.discover_access_setting(_key text, _fallback boolean)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
  SELECT COALESCE(
    (
      SELECT (sc.data ->> _key)::boolean
      FROM public.site_content sc
      WHERE sc.section = 'settings'
        AND sc.data ? _key
    ),
    _fallback
  )
$$;

CREATE OR REPLACE FUNCTION private.can_create_romantic_action(
  _user_id uuid,
  _setting_key text,
  _free_fallback boolean DEFAULT false
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = _user_id
      AND (
        p.membership_tier IN (
          'premium'::public.membership_tier,
          'gold'::public.membership_tier,
          'platinum'::public.membership_tier
        )
        OR private.discover_access_setting(_setting_key, _free_fallback)
      )
  )
$$;

CREATE OR REPLACE FUNCTION private.enforce_like_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
BEGIN
  IF NEW.is_like IS TRUE
     AND NOT private.can_create_romantic_action(NEW.liker_id, 'free_users_can_like', false) THEN
    RAISE EXCEPTION 'Upgrade required before liking profiles.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.enforce_message_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
BEGIN
  IF NOT private.can_create_romantic_action(NEW.sender_id, 'free_users_can_message', false) THEN
    RAISE EXCEPTION 'Upgrade required before messaging members.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_like_membership ON public.likes;
CREATE TRIGGER trg_enforce_like_membership
BEFORE INSERT ON public.likes
FOR EACH ROW
EXECUTE FUNCTION private.enforce_like_membership();

DROP TRIGGER IF EXISTS trg_enforce_message_membership ON public.messages;
CREATE TRIGGER trg_enforce_message_membership
BEFORE INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION private.enforce_message_membership();
