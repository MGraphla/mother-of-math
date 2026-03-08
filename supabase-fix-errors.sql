-- ================================================================
-- Fix Admin RPC Functions — Run this in Supabase SQL Editor
-- Fixes all 400/404 errors seen in the browser console
-- ================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. Ensure announcements table has all expected columns
-- ────────────────────────────────────────────────────────────────
ALTER TABLE announcements
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS target_class_name TEXT,
  ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- ────────────────────────────────────────────────────────────────
-- 2. Fix get_all_teachers  (type mismatch: years_of_experience cast)
-- ────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS get_all_teachers();
CREATE OR REPLACE FUNCTION get_all_teachers()
RETURNS TABLE (
  id UUID,
  email TEXT,
  full_name TEXT,
  gender TEXT,
  country TEXT,
  city TEXT,
  school_name TEXT,
  school_address TEXT,
  school_type TEXT,
  number_of_students INTEGER,
  subjects_taught TEXT,
  grade_levels TEXT,
  years_of_experience TEXT,
  education_level TEXT,
  phone_number TEXT,
  whatsapp_number TEXT,
  bio TEXT,
  date_of_birth TEXT,
  avatar_url TEXT,
  preferred_language TEXT,
  role TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    COALESCE(p.email, '')::TEXT,
    COALESCE(p.full_name, 'Unknown')::TEXT,
    p.gender::TEXT,
    p.country::TEXT,
    p.city::TEXT,
    p.school_name::TEXT,
    p.school_address::TEXT,
    p.school_type::TEXT,
    p.number_of_students::INTEGER,
    p.subjects_taught::TEXT,
    p.grade_levels::TEXT,
    -- Cast years_of_experience to TEXT regardless of underlying type
    CASE
      WHEN p.years_of_experience IS NULL THEN NULL
      ELSE p.years_of_experience::TEXT
    END,
    p.education_level::TEXT,
    p.phone_number::TEXT,
    p.whatsapp_number::TEXT,
    p.bio::TEXT,
    p.date_of_birth::TEXT,
    p.avatar_url::TEXT,
    p.preferred_language::TEXT,
    p.role::TEXT,
    p.created_at,
    p.updated_at
  FROM profiles p
  WHERE p.role = 'teacher'
  ORDER BY p.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_all_teachers() TO authenticated, anon;

-- ────────────────────────────────────────────────────────────────
-- 3. Fix get_all_submissions  (column sub.content does not exist;
--    table has `notes` and `teacher_feedback`, not `content`/`feedback`)
-- ────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS get_all_submissions();
CREATE OR REPLACE FUNCTION get_all_submissions()
RETURNS TABLE (
  id UUID,
  assignment_id UUID,
  student_id UUID,
  notes TEXT,
  file_url TEXT,
  score NUMERIC,
  feedback TEXT,
  ai_score NUMERIC,
  ai_feedback TEXT,
  status TEXT,
  submitted_at TIMESTAMPTZ,
  graded_at TIMESTAMPTZ,
  student_name TEXT,
  assignment_title TEXT,
  teacher_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sub.id,
    sub.assignment_id,
    sub.student_id,
    sub.notes::TEXT,                     -- was wrongly called "content"
    sub.file_url::TEXT,
    sub.score,
    sub.teacher_feedback::TEXT AS feedback, -- was wrongly called "feedback"
    sub.ai_score,
    sub.ai_feedback::TEXT,
    sub.status::TEXT,
    sub.submitted_at,
    sub.graded_at,
    s.full_name::TEXT AS student_name,
    a.title::TEXT   AS assignment_title,
    p.full_name::TEXT AS teacher_name
  FROM assignment_submissions sub
  LEFT JOIN students s ON sub.student_id = s.id
  LEFT JOIN assignments a ON sub.assignment_id = a.id
  LEFT JOIN profiles p ON a.teacher_id = p.id
  ORDER BY sub.submitted_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_all_submissions() TO authenticated, anon;

-- ────────────────────────────────────────────────────────────────
-- 4. Fix get_all_announcements  (ann.priority may not have existed,
--    now safe because column was added in step 1)
-- ────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS get_all_announcements();
CREATE OR REPLACE FUNCTION get_all_announcements()
RETURNS TABLE (
  id UUID,
  teacher_id UUID,
  title TEXT,
  message TEXT,
  target_grade_level TEXT,
  target_class_name TEXT,
  is_pinned BOOLEAN,
  priority TEXT,
  category TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  teacher_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ann.id,
    ann.teacher_id,
    ann.title::TEXT,
    ann.message::TEXT,
    ann.target_grade_level::TEXT,
    ann.target_class_name::TEXT,
    COALESCE(ann.is_pinned, FALSE),
    COALESCE(ann.priority, 'normal')::TEXT,
    COALESCE(ann.category, 'general')::TEXT,
    ann.expires_at,
    ann.created_at,
    ann.updated_at,
    p.full_name::TEXT AS teacher_name
  FROM announcements ann
  LEFT JOIN profiles p ON ann.teacher_id = p.id
  ORDER BY ann.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_all_announcements() TO authenticated, anon;

-- ────────────────────────────────────────────────────────────────
-- 5. Fix get_all_student_works  (type mismatch — recreate cleanly)
-- ────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS get_all_student_works();
CREATE OR REPLACE FUNCTION get_all_student_works()
RETURNS TABLE (
  id UUID,
  teacher_id UUID,
  parent_id UUID,
  student_id UUID,
  teacher_name TEXT,
  student_name TEXT,
  subject TEXT,
  image_url TEXT,
  file_name TEXT,
  file_type TEXT,
  file_size BIGINT,
  grade TEXT,
  status TEXT,
  feedback TEXT,
  error_type TEXT,
  remediation TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sw.id,
    sw.teacher_id,
    sw.parent_id,
    sw.student_id,
    COALESCE(p.full_name, 'Unknown')::TEXT AS teacher_name,
    COALESCE(sw.student_name, 'Unknown')::TEXT,
    sw.subject::TEXT,
    sw.image_url::TEXT,
    sw.file_name::TEXT,
    sw.file_type::TEXT,
    sw.file_size::BIGINT,
    sw.grade::TEXT,
    sw.status::TEXT,
    sw.feedback::TEXT,
    sw.error_type::TEXT,
    sw.remediation::TEXT,
    sw.created_at
  FROM student_works sw
  LEFT JOIN profiles p ON (sw.teacher_id = p.id OR sw.parent_id = p.id)
  ORDER BY sw.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_all_student_works() TO authenticated, anon;

-- ────────────────────────────────────────────────────────────────
-- 6. get_system_health — returns rows matching adminService.ts mapping
--    { metric_name TEXT, metric_value TEXT, status TEXT }
-- ────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS get_system_health();
CREATE OR REPLACE FUNCTION get_system_health()
RETURNS TABLE (
  metric_name  TEXT,
  metric_value TEXT,
  status       TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Compute live platform health metrics that don't need extra tables
  RETURN QUERY
  SELECT 'Total Teachers'::TEXT,    (SELECT COUNT(*)::TEXT FROM profiles WHERE role = 'teacher'), 'ok'::TEXT
  UNION ALL
  SELECT 'Total Students'::TEXT,    (SELECT COUNT(*)::TEXT FROM students),                        'ok'::TEXT
  UNION ALL
  SELECT 'Total Lesson Plans'::TEXT,(SELECT COUNT(*)::TEXT FROM lesson_plans),                    'ok'::TEXT
  UNION ALL
  SELECT 'Total Assignments'::TEXT, (SELECT COUNT(*)::TEXT FROM assignments),                     'ok'::TEXT
  UNION ALL
  SELECT 'Total Submissions'::TEXT, (SELECT COUNT(*)::TEXT FROM assignment_submissions),          'ok'::TEXT
  UNION ALL
  SELECT 'Total Conversations'::TEXT,(SELECT COUNT(*)::TEXT FROM conversations),                  'ok'::TEXT
  UNION ALL
  SELECT 'Total Messages'::TEXT,    (SELECT COUNT(*)::TEXT FROM conversation_messages),           'ok'::TEXT
  UNION ALL
  SELECT 'Total Resources'::TEXT,   (SELECT COUNT(*)::TEXT FROM resources),                      'ok'::TEXT
  UNION ALL
  SELECT 'Total Announcements'::TEXT,(SELECT COUNT(*)::TEXT FROM announcements),                  'ok'::TEXT
  UNION ALL
  SELECT 'DB Status'::TEXT,         'connected'::TEXT,                                            'ok'::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION get_system_health() TO authenticated, anon;

-- ────────────────────────────────────────────────────────────────
-- 7. get_moderation_stats  (was missing — stub returning zeros)
-- ────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS get_moderation_stats();
CREATE OR REPLACE FUNCTION get_moderation_stats()
RETURNS TABLE (
  total_flags   BIGINT,
  pending_flags BIGINT,
  approved_flags BIGINT,
  removed_flags  BIGINT,
  flags_by_type  JSONB,
  flags_by_reason JSONB,
  flags_by_severity JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Use content_moderation_queue if it exists, otherwise return zeros
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'content_moderation_queue') THEN
    RETURN QUERY
    SELECT
      COUNT(*)::BIGINT,
      COUNT(*) FILTER (WHERE status = 'pending')::BIGINT,
      COUNT(*) FILTER (WHERE status = 'approved')::BIGINT,
      COUNT(*) FILTER (WHERE status = 'rejected')::BIGINT,
      COALESCE((SELECT jsonb_object_agg(content_type, cnt) FROM (SELECT content_type, COUNT(*) as cnt FROM content_moderation_queue GROUP BY content_type) s), '{}'::JSONB),
      COALESCE((SELECT jsonb_object_agg(flagged_reason, cnt) FROM (SELECT flagged_reason, COUNT(*) as cnt FROM content_moderation_queue WHERE flagged_reason IS NOT NULL GROUP BY flagged_reason) s), '{}'::JSONB),
      '{}'::JSONB
    FROM content_moderation_queue;
  ELSE
    RETURN QUERY SELECT 0::BIGINT, 0::BIGINT, 0::BIGINT, 0::BIGINT, '{}'::JSONB, '{}'::JSONB, '{}'::JSONB;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION get_moderation_stats() TO authenticated, anon;

-- ────────────────────────────────────────────────────────────────
-- 8. get_all_content_flags  (was missing)
-- ────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS get_all_content_flags();
CREATE OR REPLACE FUNCTION get_all_content_flags()
RETURNS TABLE (
  id              UUID,
  content_type    TEXT,
  content_id      UUID,
  content_preview TEXT,
  flagged_by      TEXT,
  flag_reason     TEXT,
  severity        TEXT,
  status          TEXT,
  reviewed_by     TEXT,
  review_notes    TEXT,
  created_at      TIMESTAMPTZ,
  reviewed_at     TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'content_moderation_queue') THEN
    RETURN QUERY
    SELECT
      m.id,
      m.content_type,
      m.content_id,
      m.content_preview,
      COALESCE(p.full_name, 'System')::TEXT AS flagged_by,
      m.flagged_reason::TEXT AS flag_reason,
      CASE WHEN m.auto_flagged THEN 'high' ELSE 'medium' END::TEXT AS severity,
      m.status::TEXT,
      m.reviewed_by::TEXT,
      m.notes::TEXT AS review_notes,
      m.created_at,
      m.reviewed_at
    FROM content_moderation_queue m
    LEFT JOIN profiles p ON m.user_id = p.id
    ORDER BY m.created_at DESC;
  ELSE
    -- Return empty result set with correct types
    RETURN;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION get_all_content_flags() TO authenticated, anon;

-- ────────────────────────────────────────────────────────────────
-- 9. get_data_requests  (was missing — GDPR stub)
-- ────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS get_data_requests();
CREATE OR REPLACE FUNCTION get_data_requests()
RETURNS TABLE (
  id              UUID,
  user_id         UUID,
  user_name       TEXT,
  user_email      TEXT,
  request_type    TEXT,
  status          TEXT,
  requested_by    TEXT,
  reason          TEXT,
  data_categories JSONB,
  download_url    TEXT,
  completed_at    TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Return empty — no data_requests table yet; stub to prevent 404
  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION get_data_requests() TO authenticated, anon;

-- ────────────────────────────────────────────────────────────────
-- 10. get_admin_audit_logs  — fix parameter name to match JS call
--     adminService.ts passes { limit_count: limit }
-- ────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS get_admin_audit_logs(INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_admin_audit_logs(INTEGER);
CREATE OR REPLACE FUNCTION get_admin_audit_logs(limit_count INTEGER DEFAULT 100)
RETURNS TABLE (
  id            UUID,
  admin_user    TEXT,
  action_type   TEXT,
  resource_type TEXT,
  resource_id   UUID,
  old_values    JSONB,
  new_values    JSONB,
  ip_address    TEXT,
  created_at    TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'admin_audit_logs') THEN
    RETURN QUERY
    SELECT
      a.id,
      a.admin_user::TEXT,
      a.action::TEXT           AS action_type,
      a.resource_type::TEXT,
      a.resource_id,
      (a.details -> 'old')     AS old_values,
      (a.details -> 'new')     AS new_values,
      a.ip_address::TEXT,
      a.created_at
    FROM admin_audit_logs a
    ORDER BY a.created_at DESC
    LIMIT limit_count;
  ELSE
    RETURN;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION get_admin_audit_logs(INTEGER) TO authenticated, anon;

-- ────────────────────────────────────────────────────────────────
-- 11. get_admin_notifications — fix parameter name
--     adminService.ts calls { include_read: includeRead }
-- ────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS get_admin_notifications(BOOLEAN);
CREATE OR REPLACE FUNCTION get_admin_notifications(include_read BOOLEAN DEFAULT FALSE)
RETURNS TABLE (
  id                  UUID,
  notification_type   TEXT,
  category            TEXT,
  title               TEXT,
  message             TEXT,
  is_read             BOOLEAN,
  created_at          TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'admin_notifications') THEN
    RETURN QUERY
    SELECT
      n.id,
      n.type::TEXT   AS notification_type,
      n.category::TEXT,
      n.title::TEXT,
      n.message::TEXT,
      n.is_read,
      n.created_at
    FROM admin_notifications n
    WHERE (include_read OR NOT n.is_read)
      AND NOT n.is_dismissed
    ORDER BY n.created_at DESC
    LIMIT 100;
  ELSE
    RETURN;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION get_admin_notifications(BOOLEAN) TO authenticated, anon;

-- ────────────────────────────────────────────────────────────────
-- Done!  All functions recreated.
-- ────────────────────────────────────────────────────────────────
