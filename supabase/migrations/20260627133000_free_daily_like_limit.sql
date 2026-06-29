-- Restore free-user browsing with a safe daily like limit.
-- Free users can create up to 10 successful likes in a rolling 24-hour window.
-- Passes are never counted. Gold and Platinum remain unlimited.

CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.app_settings (key, value)
VALUES
  ('free_users_can_browse', 'true'::jsonb),
  ('free_users_can_like', 'true'::jsonb),
  ('free_users_can_message', 'false'::jsonb),
  ('discover_global_mode', 'true'::jsonb)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();

CREATE OR REPLACE FUNCTION private.enforce_like_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE
  today_count integer;
BEGIN
  IF NEW.is_like IS DISTINCT FROM TRUE THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = NEW.liker_id
      AND p.membership_tier IN (
        'premium'::public.membership_tier,
        'gold'::public.membership_tier,
        'platinum'::public.membership_tier
      )
  ) THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO today_count
  FROM public.likes l
  WHERE l.liker_id = NEW.liker_id
    AND l.is_like IS TRUE
    AND l.created_at >= now() - interval '24 hours';

  IF today_count >= 10 THEN
    RAISE EXCEPTION 'You have used your 10 free likes today. Upgrade to keep connecting.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_like_membership ON public.likes;
CREATE TRIGGER trg_enforce_like_membership
BEFORE INSERT ON public.likes
FOR EACH ROW
EXECUTE FUNCTION private.enforce_like_membership();

DROP TRIGGER IF EXISTS trg_enforce_like_limit ON public.likes;

REVOKE EXECUTE ON FUNCTION private.enforce_like_membership() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.enforce_like_membership() TO service_role;
