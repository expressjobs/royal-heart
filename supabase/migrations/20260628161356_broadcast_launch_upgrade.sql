-- Broadcast launch operations: scheduling, progress lifecycle, and analytics tracking.
-- Additive and idempotent. Existing broadcasts and delivery records are preserved.

DO $$
DECLARE
  status_constraint text;
BEGIN
  SELECT pg_get_constraintdef(oid)
  INTO status_constraint
  FROM pg_constraint
  WHERE conrelid = 'public.broadcasts'::regclass
    AND conname = 'broadcasts_status_check';

  IF status_constraint IS NULL THEN
    ALTER TABLE public.broadcasts
      ADD CONSTRAINT broadcasts_status_check
      CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'failed'));
  ELSIF status_constraint NOT LIKE '%sending%' THEN
    ALTER TABLE public.broadcasts
      DROP CONSTRAINT broadcasts_status_check;
    ALTER TABLE public.broadcasts
      ADD CONSTRAINT broadcasts_status_check
      CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'failed'));
  END IF;
END;
$$;

ALTER TABLE public.broadcast_deliveries
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS body text,
  ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS broadcasts_due_idx
  ON public.broadcasts(scheduled_for)
  WHERE status = 'scheduled';

CREATE OR REPLACE FUNCTION private.mark_broadcast_delivery_opened()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.read_at IS NULL AND NEW.read_at IS NOT NULL THEN
    UPDATE public.broadcast_deliveries
    SET status = CASE WHEN status = 'clicked' THEN status ELSE 'opened' END,
        opened_at = COALESCE(opened_at, NEW.read_at)
    WHERE notification_id = NEW.id
      AND user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.mark_broadcast_delivery_opened() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.notifications'::regclass
      AND tgname = 'notifications_track_broadcast_open'
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER notifications_track_broadcast_open
      AFTER UPDATE OF read_at ON public.notifications
      FOR EACH ROW
      WHEN (OLD.read_at IS NULL AND NEW.read_at IS NOT NULL)
      EXECUTE FUNCTION private.mark_broadcast_delivery_opened();
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION private.process_due_broadcasts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_broadcast public.broadcasts%ROWTYPE;
  resolved_audience integer;
  delivered integer;
  notification_kind public.notification_type;
BEGIN
  FOR current_broadcast IN
    SELECT *
    FROM public.broadcasts
    WHERE status = 'scheduled'
      AND scheduled_for <= now()
    ORDER BY scheduled_for
    FOR UPDATE SKIP LOCKED
  LOOP
    BEGIN
      UPDATE public.broadcasts
      SET status = 'sending',
          sent_count = 0,
          failed_count = 0,
          updated_at = now()
      WHERE id = current_broadcast.id;

      notification_kind := CASE
        WHEN current_broadcast.broadcast_type IN ('upgrade_offer', 'promotional_message')
          THEN 'promotion'::public.notification_type
        WHEN current_broadcast.broadcast_type = 'safety_notice'
          THEN 'safety'::public.notification_type
        ELSE 'system'::public.notification_type
      END;

      WITH audience AS (
        SELECT p.id AS user_id
        FROM public.profiles p
        WHERE (current_broadcast.audience_filter->>'group') IN
          ('all', 'free', 'gold', 'platinum', 'incomplete', 'inactive', 'verified', 'location')
          AND (
            (current_broadcast.audience_filter->>'group') = 'all'
            OR ((current_broadcast.audience_filter->>'group') = 'free' AND p.membership_tier = 'free')
            OR ((current_broadcast.audience_filter->>'group') = 'gold' AND p.membership_tier = 'gold')
            OR ((current_broadcast.audience_filter->>'group') = 'platinum' AND p.membership_tier = 'platinum')
            OR (
              (current_broadcast.audience_filter->>'group') = 'incomplete'
              AND COALESCE(p.profile_completion_score, 0) < 80
            )
            OR (
              (current_broadcast.audience_filter->>'group') = 'inactive'
              AND p.last_active < now() - interval '30 days'
            )
            OR ((current_broadcast.audience_filter->>'group') = 'verified' AND p.is_verified)
            OR (
              (current_broadcast.audience_filter->>'group') = 'location'
              AND (
                NULLIF(current_broadcast.audience_filter->>'country', '') IS NULL
                OR p.location_country ILIKE current_broadcast.audience_filter->>'country'
              )
              AND (
                NULLIF(current_broadcast.audience_filter->>'city', '') IS NULL
                OR p.location_city ILIKE current_broadcast.audience_filter->>'city'
              )
            )
          )
        UNION
        SELECT current_broadcast.created_by
        WHERE (current_broadcast.audience_filter->>'group') = 'admin_test'
          AND current_broadcast.created_by IS NOT NULL
        UNION
        SELECT m.user_id
        FROM public.marketers m
        WHERE (current_broadcast.audience_filter->>'group') = 'marketers'
          AND m.status = 'active'
          AND m.user_id IS NOT NULL
        UNION
        SELECT selected.value::uuid
        FROM jsonb_array_elements_text(
          COALESCE(current_broadcast.audience_filter->'userIds', '[]'::jsonb)
        ) selected(value)
        WHERE (current_broadcast.audience_filter->>'group') = 'selected'
      ),
      inserted_notifications AS (
        INSERT INTO public.notifications (user_id, type, title, body, data)
        SELECT
          audience.user_id,
          notification_kind,
          current_broadcast.title,
          current_broadcast.message,
          jsonb_build_object(
            'broadcast_id', current_broadcast.id,
            'cta_label', current_broadcast.cta_label,
            'cta_url', current_broadcast.cta_url,
            'image_url', COALESCE(current_broadcast.media_url, current_broadcast.image_url),
            'media_url', current_broadcast.media_url,
            'media_type', current_broadcast.media_type
          )
        FROM audience
        ON CONFLICT DO NOTHING
        RETURNING id, user_id
      ),
      inserted_deliveries AS (
        INSERT INTO public.broadcast_deliveries (
          broadcast_id,
          user_id,
          notification_id,
          media_url,
          media_type,
          status,
          sent_at,
          attempt_count,
          last_attempt_at
        )
        SELECT
          current_broadcast.id,
          inserted_notifications.user_id,
          inserted_notifications.id,
          current_broadcast.media_url,
          current_broadcast.media_type,
          'sent',
          now(),
          1,
          now()
        FROM inserted_notifications
        ON CONFLICT (broadcast_id, user_id) DO UPDATE
        SET notification_id = EXCLUDED.notification_id,
            media_url = EXCLUDED.media_url,
            media_type = EXCLUDED.media_type,
            status = 'sent',
            error = NULL,
            sent_at = EXCLUDED.sent_at,
            attempt_count = public.broadcast_deliveries.attempt_count + 1,
            last_attempt_at = EXCLUDED.last_attempt_at
        RETURNING 1
      )
      SELECT
        (SELECT count(*) FROM audience),
        (SELECT count(*) FROM inserted_deliveries)
      INTO resolved_audience, delivered;

      UPDATE public.broadcasts
      SET status = CASE WHEN delivered = 0 AND resolved_audience > 0 THEN 'failed' ELSE 'sent' END,
          sent_at = now(),
          audience_size = resolved_audience,
          sent_count = delivered,
          failed_count = GREATEST(resolved_audience - delivered, 0),
          updated_at = now()
      WHERE id = current_broadcast.id;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.broadcasts
      SET status = 'failed',
          failed_count = GREATEST(audience_size, 1),
          updated_at = now()
      WHERE id = current_broadcast.id;
    END;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION private.process_due_broadcasts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.process_due_broadcasts() TO service_role;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM cron.job
    WHERE jobname = 'heartconnect-process-due-broadcasts'
  ) THEN
    PERFORM cron.schedule(
      'heartconnect-process-due-broadcasts',
      '* * * * *',
      'SELECT private.process_due_broadcasts();'
    );
  END IF;
END;
$$;
