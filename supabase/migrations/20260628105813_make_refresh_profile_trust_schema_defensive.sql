-- Refresh trust without binding the trigger function to one historical column
-- layout. Converting the trigger record to jsonb makes missing keys return NULL
-- instead of raising "record NEW has no field ...".
CREATE OR REPLACE FUNCTION private.refresh_profile_trust()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE
  new_row jsonb := NULL;
  old_row jsonb := NULL;
  affected_id uuid := NULL;
BEGIN
  IF TG_OP <> 'DELETE' THEN
    new_row := to_jsonb(NEW);
  END IF;
  IF TG_OP <> 'INSERT' THEN
    old_row := to_jsonb(OLD);
  END IF;

  CASE TG_TABLE_NAME
    WHEN 'profile_photos' THEN
      affected_id := COALESCE(
        NULLIF(new_row ->> 'user_id', '')::uuid,
        NULLIF(new_row ->> 'profile_id', '')::uuid,
        NULLIF(old_row ->> 'user_id', '')::uuid,
        NULLIF(old_row ->> 'profile_id', '')::uuid
      );
    WHEN 'reports' THEN
      affected_id := COALESCE(
        NULLIF(new_row ->> 'reported_user_id', '')::uuid,
        NULLIF(new_row ->> 'reported_profile_id', '')::uuid,
        NULLIF(new_row ->> 'profile_id', '')::uuid,
        NULLIF(new_row ->> 'target_user_id', '')::uuid,
        NULLIF(new_row ->> 'reported_id', '')::uuid,
        NULLIF(old_row ->> 'reported_user_id', '')::uuid,
        NULLIF(old_row ->> 'reported_profile_id', '')::uuid,
        NULLIF(old_row ->> 'profile_id', '')::uuid,
        NULLIF(old_row ->> 'target_user_id', '')::uuid,
        NULLIF(old_row ->> 'reported_id', '')::uuid
      );
    WHEN 'blocks' THEN
      affected_id := COALESCE(
        NULLIF(new_row ->> 'blocked_id', '')::uuid,
        NULLIF(new_row ->> 'blocked_user_id', '')::uuid,
        NULLIF(old_row ->> 'blocked_id', '')::uuid,
        NULLIF(old_row ->> 'blocked_user_id', '')::uuid
      );
    ELSE
      RETURN COALESCE(NEW, OLD);
  END CASE;

  IF affected_id IS NOT NULL THEN
    BEGIN
      UPDATE public.profiles
      SET updated_at = updated_at
      WHERE id = affected_id;
    EXCEPTION
      WHEN OTHERS THEN
        -- Trust refresh is best-effort. Never roll back the report, block,
        -- photo change, or profile repair that caused this trigger to run.
        NULL;
    END;
  END IF;

  RETURN COALESCE(NEW, OLD);
EXCEPTION
  WHEN OTHERS THEN
    -- Malformed legacy data or an unknown row shape must not block source DML.
    RETURN COALESCE(NEW, OLD);
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.profile_photos') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS refresh_trust_from_photos ON public.profile_photos;
    CREATE TRIGGER refresh_trust_from_photos
      AFTER INSERT OR UPDATE OR DELETE ON public.profile_photos
      FOR EACH ROW EXECUTE FUNCTION private.refresh_profile_trust();
  END IF;

  IF to_regclass('public.reports') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS refresh_trust_from_reports ON public.reports;
    CREATE TRIGGER refresh_trust_from_reports
      AFTER INSERT OR UPDATE OR DELETE ON public.reports
      FOR EACH ROW EXECUTE FUNCTION private.refresh_profile_trust();
  END IF;

  IF to_regclass('public.blocks') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS refresh_trust_from_blocks ON public.blocks;
    CREATE TRIGGER refresh_trust_from_blocks
      AFTER INSERT OR UPDATE OR DELETE ON public.blocks
      FOR EACH ROW EXECUTE FUNCTION private.refresh_profile_trust();
  END IF;
END
$$;
