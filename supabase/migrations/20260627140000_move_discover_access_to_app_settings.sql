-- Move app and Discover access settings to a dedicated key/value table.

CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read app settings" ON public.app_settings;
CREATE POLICY "Anyone can read app settings"
ON public.app_settings
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Admins manage app settings" ON public.app_settings;
CREATE POLICY "Admins manage app settings"
ON public.app_settings
FOR ALL
TO authenticated
USING (private.has_min_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (private.has_min_role(auth.uid(), 'admin'::public.app_role));

GRANT SELECT ON public.app_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

DROP TRIGGER IF EXISTS trg_app_settings_updated_at ON public.app_settings;
CREATE TRIGGER trg_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DO $$
BEGIN
  IF to_regclass('public.site_content') IS NOT NULL THEN
    EXECUTE $migrate$
      INSERT INTO public.app_settings (key, value, updated_at)
      SELECT section, COALESCE(data, '{}'::jsonb), updated_at
      FROM public.site_content
      ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value,
          updated_at = now()
    $migrate$;

    EXECUTE $migrate_settings$
      INSERT INTO public.app_settings (key, value)
      SELECT item.key, item.value
      FROM public.site_content sc
      CROSS JOIN LATERAL jsonb_each(sc.data) AS item(key, value)
      WHERE sc.section = 'settings'
        AND item.key IN (
          'free_users_can_browse',
          'free_users_can_like',
          'free_users_can_message',
          'discover_global_mode'
        )
      ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value,
          updated_at = now()
    $migrate_settings$;
  END IF;
END $$;

INSERT INTO public.app_settings (key, value)
VALUES
  ('free_users_can_browse', 'true'::jsonb),
  ('free_users_can_like', 'true'::jsonb),
  ('free_users_can_message', 'false'::jsonb),
  ('discover_global_mode', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.demo_profiles_visible()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (
      SELECT (value ->> 'showDemoProfiles')::boolean
      FROM public.app_settings
      WHERE key = 'settings'
        AND jsonb_typeof(value) = 'object'
        AND value ? 'showDemoProfiles'
    ),
    true
  )
$$;

CREATE OR REPLACE FUNCTION private.discover_access_setting(_key text, _fallback boolean)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
  SELECT COALESCE(
    (
      SELECT value::boolean
      FROM public.app_settings
      WHERE key = _key
        AND jsonb_typeof(value) = 'boolean'
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
