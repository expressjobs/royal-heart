-- Fix CMS site_content inserts on deployments where site_content has a legacy
-- serial/identity id backed by public.site_content_id_seq.
--
-- Table privileges do not grant sequence privileges. When PostgreSQL evaluates
-- nextval(...) for an id default, the writing role also needs sequence access.
-- This migration is intentionally scoped to the site_content sequence only.

DO $$
DECLARE
  seq_name text;
BEGIN
  IF to_regclass('public.site_content') IS NULL THEN
    RETURN;
  END IF;

  seq_name := pg_get_serial_sequence('public.site_content', 'id');

  IF seq_name IS NULL AND to_regclass('public.site_content_id_seq') IS NOT NULL THEN
    seq_name := 'public.site_content_id_seq';
  END IF;

  IF seq_name IS NULL THEN
    RETURN;
  END IF;

  EXECUTE format('GRANT USAGE, SELECT, UPDATE ON SEQUENCE %s TO service_role', seq_name);

  -- Keep the authenticated direct-write path compatible with the existing
  -- super-admin-only RLS policy. This does not grant table access by itself.
  EXECUTE format('GRANT USAGE, SELECT, UPDATE ON SEQUENCE %s TO authenticated', seq_name);
END $$;
