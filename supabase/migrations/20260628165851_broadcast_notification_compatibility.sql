-- Compatibility for production projects that still have the legacy
-- notifications.message/link_url shape. No existing rows are rewritten.
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS body text,
  ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '{}'::jsonb;
