
-- 1. New enums for report classification
CREATE TYPE public.report_category AS ENUM (
  'profile','photo','message','scam','fake_profile','harassment','abuse','spam','underage','other'
);
CREATE TYPE public.report_severity AS ENUM ('low','medium','high','critical');

-- 2. Extend reports with classification, assignment and resolution metadata
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS category public.report_category NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS severity public.report_severity NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolution_note text,
  ADD COLUMN IF NOT EXISTS content_type text,
  ADD COLUMN IF NOT EXISTS content_id text;

-- Best-effort backfill of category/severity from the original free-text reason
UPDATE public.reports SET
  category = (CASE
    WHEN reason ILIKE '%underage%' THEN 'underage'
    WHEN reason ILIKE '%fake%' OR reason ILIKE '%scam%' THEN 'scam'
    WHEN reason ILIKE '%photo%' THEN 'photo'
    WHEN reason ILIKE '%harass%' OR reason ILIKE '%abuse%' THEN 'harassment'
    WHEN reason ILIKE '%message%' OR reason ILIKE '%offensive%' THEN 'message'
    WHEN reason ILIKE '%spam%' OR reason ILIKE '%solicit%' THEN 'spam'
    ELSE 'other' END)::public.report_category,
  severity = (CASE
    WHEN reason ILIKE '%underage%' THEN 'critical'
    WHEN reason ILIKE '%scam%' OR reason ILIKE '%fake%' OR reason ILIKE '%harass%' OR reason ILIKE '%abuse%' THEN 'high'
    ELSE 'medium' END)::public.report_severity
WHERE category = 'other';

UPDATE public.reports SET content_type = 'conversation', content_id = match_id::text
WHERE match_id IS NOT NULL AND content_type IS NULL;

CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_reported ON public.reports(reported_id);

-- 3. User warnings
CREATE TABLE public.user_warnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  issued_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  report_id uuid REFERENCES public.reports(id) ON DELETE SET NULL,
  reason text NOT NULL,
  severity public.report_severity NOT NULL DEFAULT 'low',
  acknowledged boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_warnings TO authenticated;
GRANT ALL ON public.user_warnings TO service_role;

ALTER TABLE public.user_warnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own or moderated warnings" ON public.user_warnings
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_min_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Members acknowledge own warnings" ON public.user_warnings
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Moderators issue warnings" ON public.user_warnings
  FOR INSERT TO authenticated
  WITH CHECK (private.has_min_role(auth.uid(), 'moderator'::app_role) AND issued_by = auth.uid());

CREATE POLICY "Moderators remove warnings" ON public.user_warnings
  FOR DELETE TO authenticated
  USING (private.has_min_role(auth.uid(), 'moderator'::app_role));

CREATE INDEX idx_user_warnings_user ON public.user_warnings(user_id);

-- 4. Allow moderators (not only admins) to work the queue
DROP POLICY IF EXISTS "View own reports" ON public.reports;
CREATE POLICY "View own or moderated reports" ON public.reports
  FOR SELECT TO authenticated
  USING (reporter_id = auth.uid() OR private.has_min_role(auth.uid(), 'moderator'::app_role));

DROP POLICY IF EXISTS "Admins update reports" ON public.reports;
CREATE POLICY "Moderators update reports" ON public.reports
  FOR UPDATE TO authenticated
  USING (private.has_min_role(auth.uid(), 'moderator'::app_role))
  WITH CHECK (private.has_min_role(auth.uid(), 'moderator'::app_role));

DROP POLICY IF EXISTS "Admins manage moderation" ON public.user_moderation;
CREATE POLICY "Moderators manage moderation" ON public.user_moderation
  FOR ALL TO authenticated
  USING (private.has_min_role(auth.uid(), 'moderator'::app_role))
  WITH CHECK (private.has_min_role(auth.uid(), 'moderator'::app_role));

-- 5. Enriched report queue for moderators
CREATE OR REPLACE FUNCTION public.moderation_reports()
RETURNS TABLE(
  id uuid, reporter_id uuid, reported_id uuid,
  reporter_name text, reported_name text,
  reason text, details text,
  category public.report_category, severity public.report_severity,
  status public.report_status, match_id uuid,
  content_type text, content_id text,
  assigned_to uuid, assignee_name text,
  resolution_note text, resolved_at timestamptz, created_at timestamptz,
  reported_is_banned boolean, reported_banned_until timestamptz,
  reported_total_reports bigint, reported_distinct_reporters bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private
AS $$
  SELECT r.id, r.reporter_id, r.reported_id,
    COALESCE(rp.display_name, 'Member'), COALESCE(rd.display_name, 'Member'),
    r.reason, r.details, r.category, r.severity, r.status, r.match_id,
    r.content_type, r.content_id,
    r.assigned_to, asg.display_name,
    r.resolution_note, r.resolved_at, r.created_at,
    COALESCE(um.is_banned, false), um.banned_until,
    agg.total_reports, agg.distinct_reporters
  FROM public.reports r
  LEFT JOIN public.profiles rp ON rp.id = r.reporter_id
  LEFT JOIN public.profiles rd ON rd.id = r.reported_id
  LEFT JOIN public.profiles asg ON asg.id = r.assigned_to
  LEFT JOIN public.user_moderation um ON um.user_id = r.reported_id
  LEFT JOIN LATERAL (
    SELECT count(*) AS total_reports, count(DISTINCT r2.reporter_id) AS distinct_reporters
    FROM public.reports r2 WHERE r2.reported_id = r.reported_id
  ) agg ON true
  WHERE private.has_min_role(auth.uid(), 'moderator'::app_role)
  ORDER BY r.created_at DESC
$$;
GRANT EXECUTE ON FUNCTION public.moderation_reports() TO authenticated;

-- 6. Dashboard statistics
CREATE OR REPLACE FUNCTION public.moderation_stats()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private
AS $$
  SELECT CASE WHEN NOT private.has_min_role(auth.uid(), 'moderator'::app_role) THEN '{}'::jsonb
  ELSE jsonb_build_object(
    'pending',   (SELECT count(*) FROM public.reports WHERE status = 'pending'),
    'reviewing', (SELECT count(*) FROM public.reports WHERE status = 'reviewed'),
    'resolved',  (SELECT count(*) FROM public.reports WHERE status = 'resolved'),
    'dismissed', (SELECT count(*) FROM public.reports WHERE status = 'dismissed'),
    'critical',  (SELECT count(*) FROM public.reports WHERE severity = 'critical' AND status IN ('pending','reviewed')),
    'resolved_today', (SELECT count(*) FROM public.reports WHERE resolved_at >= date_trunc('day', now())),
    'suspended', (SELECT count(*) FROM public.user_moderation WHERE is_banned AND banned_until IS NOT NULL AND banned_until > now()),
    'banned',    (SELECT count(*) FROM public.user_moderation WHERE is_banned AND banned_until IS NULL),
    'warnings_7d', (SELECT count(*) FROM public.user_warnings WHERE created_at >= now() - interval '7 days'),
    'by_category', (SELECT COALESCE(jsonb_object_agg(cat, c), '{}'::jsonb)
                    FROM (SELECT category::text AS cat, count(*) AS c FROM public.reports GROUP BY category) s)
  ) END
$$;
GRANT EXECUTE ON FUNCTION public.moderation_stats() TO authenticated;

-- 7. Recent moderator activity feed
CREATE OR REPLACE FUNCTION public.moderation_activity(_limit integer DEFAULT 50)
RETURNS TABLE(
  id uuid, actor_id uuid, actor_name text, action text,
  entity_type text, entity_id text, details jsonb, created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private
AS $$
  SELECT a.id, a.actor_id, COALESCE(p.display_name, 'Staff'), a.action,
         a.entity_type, a.entity_id, a.details, a.created_at
  FROM public.admin_audit_log a
  LEFT JOIN public.profiles p ON p.id = a.actor_id
  WHERE private.has_min_role(auth.uid(), 'moderator'::app_role)
  ORDER BY a.created_at DESC
  LIMIT GREATEST(COALESCE(_limit, 50), 1)
$$;
GRANT EXECUTE ON FUNCTION public.moderation_activity(integer) TO authenticated;

-- 8. Remove reported content (photo or message)
CREATE OR REPLACE FUNCTION public.moderation_delete_content(_content_type text, _content_id text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private
AS $$
DECLARE removed boolean := false;
BEGIN
  IF NOT private.has_min_role(auth.uid(), 'moderator'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _content_type = 'photo' THEN
    DELETE FROM public.profile_photos WHERE id = _content_id::uuid;
    removed := true;
  ELSIF _content_type = 'message' THEN
    DELETE FROM public.messages WHERE id = _content_id::uuid;
    removed := true;
  END IF;
  RETURN removed;
END
$$;
GRANT EXECUTE ON FUNCTION public.moderation_delete_content(text, text) TO authenticated;
