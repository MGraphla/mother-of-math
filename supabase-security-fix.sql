-- ============================================================
-- SECURITY FIX: Revoke anonymous access from admin RPC functions
-- Run this in the Supabase SQL Editor immediately.
-- Safe to run even if some functions don't exist yet.
-- ============================================================

-- Step 1: Create a helper function to check if the caller is an admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;

-- Step 2: Revoke anon access from all admin functions.
-- Each statement is wrapped in its own block so a missing function
-- is silently skipped rather than aborting the whole migration.

DO $$ BEGIN
  BEGIN REVOKE EXECUTE ON FUNCTION get_all_teachers() FROM anon; EXCEPTION WHEN others THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION get_all_students() FROM anon; EXCEPTION WHEN others THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION get_admin_counts() FROM anon; EXCEPTION WHEN others THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION get_teacher_stats(UUID) FROM anon; EXCEPTION WHEN others THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION get_all_students_full() FROM anon; EXCEPTION WHEN others THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION get_all_lesson_plans() FROM anon; EXCEPTION WHEN others THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION get_all_conversations() FROM anon; EXCEPTION WHEN others THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION get_all_assignments() FROM anon; EXCEPTION WHEN others THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION get_all_submissions() FROM anon; EXCEPTION WHEN others THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION get_all_resources() FROM anon; EXCEPTION WHEN others THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION get_all_announcements() FROM anon; EXCEPTION WHEN others THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION get_all_comments() FROM anon; EXCEPTION WHEN others THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION get_all_messages() FROM anon; EXCEPTION WHEN others THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION get_user_activity() FROM anon; EXCEPTION WHEN others THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION get_all_images() FROM anon; EXCEPTION WHEN others THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION get_all_student_works() FROM anon; EXCEPTION WHEN others THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION get_comprehensive_admin_counts() FROM anon; EXCEPTION WHEN others THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION get_students_per_teacher() FROM anon; EXCEPTION WHEN others THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION get_lesson_plans_per_teacher() FROM anon; EXCEPTION WHEN others THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION get_all_schools() FROM anon; EXCEPTION WHEN others THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION get_teachers_by_country() FROM anon; EXCEPTION WHEN others THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION get_images_per_teacher() FROM anon; EXCEPTION WHEN others THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION get_growth_metrics(INTEGER) FROM anon; EXCEPTION WHEN others THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION get_comparison_metrics(INTEGER) FROM anon; EXCEPTION WHEN others THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION get_api_usage_stats(INTEGER) FROM anon; EXCEPTION WHEN others THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION get_all_support_tickets() FROM anon; EXCEPTION WHEN others THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION get_support_ticket_stats() FROM anon; EXCEPTION WHEN others THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION get_all_content_flags() FROM anon; EXCEPTION WHEN others THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION get_moderation_stats() FROM anon; EXCEPTION WHEN others THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION get_admin_audit_logs(INTEGER) FROM anon; EXCEPTION WHEN others THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION get_admin_notifications(BOOLEAN) FROM anon; EXCEPTION WHEN others THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION get_data_requests() FROM anon; EXCEPTION WHEN others THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION get_system_health() FROM anon; EXCEPTION WHEN others THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION get_grade_distribution() FROM anon; EXCEPTION WHEN others THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION get_ai_vs_human_grading() FROM anon; EXCEPTION WHEN others THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION insert_audit_log(TEXT, TEXT, TEXT, UUID, JSONB, JSONB, TEXT) FROM anon; EXCEPTION WHEN others THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION create_support_ticket(UUID, TEXT, TEXT, TEXT, TEXT) FROM anon; EXCEPTION WHEN others THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION update_ticket_status(UUID, TEXT, TEXT, TEXT) FROM anon; EXCEPTION WHEN others THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION create_content_flag(TEXT, UUID, TEXT, TEXT, TEXT, TEXT) FROM anon; EXCEPTION WHEN others THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION review_content_flag(UUID, TEXT, TEXT, TEXT) FROM anon; EXCEPTION WHEN others THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION create_admin_notification(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) FROM anon; EXCEPTION WHEN others THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION mark_notification_read(UUID) FROM anon; EXCEPTION WHEN others THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION get_engagement_metrics(INTEGER) FROM anon; EXCEPTION WHEN others THEN NULL; END;
  -- Overloads from supabase-admin-enhanced.sql
  BEGIN REVOKE EXECUTE ON FUNCTION get_api_usage_stats(TIMESTAMPTZ, TIMESTAMPTZ) FROM anon; EXCEPTION WHEN others THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION get_api_usage_by_user(UUID, TIMESTAMPTZ, TIMESTAMPTZ) FROM anon; EXCEPTION WHEN others THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION get_admin_audit_logs(INTEGER, INTEGER) FROM anon; EXCEPTION WHEN others THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION get_moderation_queue(TEXT) FROM anon; EXCEPTION WHEN others THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION get_activity_trends(INTEGER) FROM anon; EXCEPTION WHEN others THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION get_schools_detailed() FROM anon; EXCEPTION WHEN others THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION get_student_progress_summary() FROM anon; EXCEPTION WHEN others THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION get_chatbot_performance() FROM anon; EXCEPTION WHEN others THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION get_grading_analytics() FROM anon; EXCEPTION WHEN others THEN NULL; END;
  BEGIN REVOKE EXECUTE ON FUNCTION get_comparison_metrics() FROM anon; EXCEPTION WHEN others THEN NULL; END;
END $$;

-- Step 3: Grant authenticated access (silently skip missing functions too)
DO $$ BEGIN
  BEGIN GRANT EXECUTE ON FUNCTION get_all_teachers() TO authenticated; EXCEPTION WHEN others THEN NULL; END;
  BEGIN GRANT EXECUTE ON FUNCTION get_all_students() TO authenticated; EXCEPTION WHEN others THEN NULL; END;
  BEGIN GRANT EXECUTE ON FUNCTION get_admin_counts() TO authenticated; EXCEPTION WHEN others THEN NULL; END;
  BEGIN GRANT EXECUTE ON FUNCTION get_teacher_stats(UUID) TO authenticated; EXCEPTION WHEN others THEN NULL; END;
  BEGIN GRANT EXECUTE ON FUNCTION get_all_students_full() TO authenticated; EXCEPTION WHEN others THEN NULL; END;
  BEGIN GRANT EXECUTE ON FUNCTION get_all_lesson_plans() TO authenticated; EXCEPTION WHEN others THEN NULL; END;
  BEGIN GRANT EXECUTE ON FUNCTION get_all_conversations() TO authenticated; EXCEPTION WHEN others THEN NULL; END;
  BEGIN GRANT EXECUTE ON FUNCTION get_all_assignments() TO authenticated; EXCEPTION WHEN others THEN NULL; END;
  BEGIN GRANT EXECUTE ON FUNCTION get_all_submissions() TO authenticated; EXCEPTION WHEN others THEN NULL; END;
  BEGIN GRANT EXECUTE ON FUNCTION get_all_resources() TO authenticated; EXCEPTION WHEN others THEN NULL; END;
  BEGIN GRANT EXECUTE ON FUNCTION get_all_announcements() TO authenticated; EXCEPTION WHEN others THEN NULL; END;
  BEGIN GRANT EXECUTE ON FUNCTION get_all_comments() TO authenticated; EXCEPTION WHEN others THEN NULL; END;
  BEGIN GRANT EXECUTE ON FUNCTION get_all_messages() TO authenticated; EXCEPTION WHEN others THEN NULL; END;
  BEGIN GRANT EXECUTE ON FUNCTION get_user_activity() TO authenticated; EXCEPTION WHEN others THEN NULL; END;
  BEGIN GRANT EXECUTE ON FUNCTION get_all_images() TO authenticated; EXCEPTION WHEN others THEN NULL; END;
  BEGIN GRANT EXECUTE ON FUNCTION get_all_student_works() TO authenticated; EXCEPTION WHEN others THEN NULL; END;
  BEGIN GRANT EXECUTE ON FUNCTION get_comprehensive_admin_counts() TO authenticated; EXCEPTION WHEN others THEN NULL; END;
  BEGIN GRANT EXECUTE ON FUNCTION get_students_per_teacher() TO authenticated; EXCEPTION WHEN others THEN NULL; END;
  BEGIN GRANT EXECUTE ON FUNCTION get_lesson_plans_per_teacher() TO authenticated; EXCEPTION WHEN others THEN NULL; END;
  BEGIN GRANT EXECUTE ON FUNCTION get_all_schools() TO authenticated; EXCEPTION WHEN others THEN NULL; END;
  BEGIN GRANT EXECUTE ON FUNCTION get_teachers_by_country() TO authenticated; EXCEPTION WHEN others THEN NULL; END;
  BEGIN GRANT EXECUTE ON FUNCTION get_images_per_teacher() TO authenticated; EXCEPTION WHEN others THEN NULL; END;
  BEGIN GRANT EXECUTE ON FUNCTION get_growth_metrics(INTEGER) TO authenticated; EXCEPTION WHEN others THEN NULL; END;
  BEGIN GRANT EXECUTE ON FUNCTION get_comparison_metrics(INTEGER) TO authenticated; EXCEPTION WHEN others THEN NULL; END;
  BEGIN GRANT EXECUTE ON FUNCTION get_api_usage_stats(INTEGER) TO authenticated; EXCEPTION WHEN others THEN NULL; END;
  BEGIN GRANT EXECUTE ON FUNCTION get_all_support_tickets() TO authenticated; EXCEPTION WHEN others THEN NULL; END;
  BEGIN GRANT EXECUTE ON FUNCTION get_support_ticket_stats() TO authenticated; EXCEPTION WHEN others THEN NULL; END;
  BEGIN GRANT EXECUTE ON FUNCTION get_all_content_flags() TO authenticated; EXCEPTION WHEN others THEN NULL; END;
  BEGIN GRANT EXECUTE ON FUNCTION get_moderation_stats() TO authenticated; EXCEPTION WHEN others THEN NULL; END;
  BEGIN GRANT EXECUTE ON FUNCTION get_admin_audit_logs(INTEGER) TO authenticated; EXCEPTION WHEN others THEN NULL; END;
  BEGIN GRANT EXECUTE ON FUNCTION get_admin_notifications(BOOLEAN) TO authenticated; EXCEPTION WHEN others THEN NULL; END;
  BEGIN GRANT EXECUTE ON FUNCTION get_data_requests() TO authenticated; EXCEPTION WHEN others THEN NULL; END;
  BEGIN GRANT EXECUTE ON FUNCTION get_system_health() TO authenticated; EXCEPTION WHEN others THEN NULL; END;
  BEGIN GRANT EXECUTE ON FUNCTION get_grade_distribution() TO authenticated; EXCEPTION WHEN others THEN NULL; END;
  BEGIN GRANT EXECUTE ON FUNCTION get_ai_vs_human_grading() TO authenticated; EXCEPTION WHEN others THEN NULL; END;
  BEGIN GRANT EXECUTE ON FUNCTION insert_audit_log(TEXT, TEXT, TEXT, UUID, JSONB, JSONB, TEXT) TO authenticated; EXCEPTION WHEN others THEN NULL; END;
  BEGIN GRANT EXECUTE ON FUNCTION create_support_ticket(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated; EXCEPTION WHEN others THEN NULL; END;
  BEGIN GRANT EXECUTE ON FUNCTION update_ticket_status(UUID, TEXT, TEXT, TEXT) TO authenticated; EXCEPTION WHEN others THEN NULL; END;
  BEGIN GRANT EXECUTE ON FUNCTION create_content_flag(TEXT, UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated; EXCEPTION WHEN others THEN NULL; END;
  BEGIN GRANT EXECUTE ON FUNCTION review_content_flag(UUID, TEXT, TEXT, TEXT) TO authenticated; EXCEPTION WHEN others THEN NULL; END;
  BEGIN GRANT EXECUTE ON FUNCTION create_admin_notification(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO authenticated; EXCEPTION WHEN others THEN NULL; END;
  BEGIN GRANT EXECUTE ON FUNCTION mark_notification_read(UUID) TO authenticated; EXCEPTION WHEN others THEN NULL; END;
  BEGIN GRANT EXECUTE ON FUNCTION get_engagement_metrics(INTEGER) TO authenticated; EXCEPTION WHEN others THEN NULL; END;
  BEGIN GRANT EXECUTE ON FUNCTION get_api_usage_stats(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated; EXCEPTION WHEN others THEN NULL; END;
  BEGIN GRANT EXECUTE ON FUNCTION get_api_usage_by_user(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated; EXCEPTION WHEN others THEN NULL; END;
  BEGIN GRANT EXECUTE ON FUNCTION get_admin_audit_logs(INTEGER, INTEGER) TO authenticated; EXCEPTION WHEN others THEN NULL; END;
  BEGIN GRANT EXECUTE ON FUNCTION get_moderation_queue(TEXT) TO authenticated; EXCEPTION WHEN others THEN NULL; END;
  BEGIN GRANT EXECUTE ON FUNCTION get_activity_trends(INTEGER) TO authenticated; EXCEPTION WHEN others THEN NULL; END;
  BEGIN GRANT EXECUTE ON FUNCTION get_schools_detailed() TO authenticated; EXCEPTION WHEN others THEN NULL; END;
  BEGIN GRANT EXECUTE ON FUNCTION get_student_progress_summary() TO authenticated; EXCEPTION WHEN others THEN NULL; END;
  BEGIN GRANT EXECUTE ON FUNCTION get_chatbot_performance() TO authenticated; EXCEPTION WHEN others THEN NULL; END;
  BEGIN GRANT EXECUTE ON FUNCTION get_grading_analytics() TO authenticated; EXCEPTION WHEN others THEN NULL; END;
  BEGIN GRANT EXECUTE ON FUNCTION get_comparison_metrics() TO authenticated; EXCEPTION WHEN others THEN NULL; END;
END $$;

-- ============================================================
-- IMPORTANT: After running this migration, create an admin user:
-- 
-- 1. Go to Supabase Dashboard > Authentication > Users > Add user
--    Use email e.g. admin@motherofmath.com, set a strong password,
--    check "Auto Confirm User".
-- 2. Then run this SQL to set their role to 'admin':
--
--    UPDATE profiles SET role = 'admin' 
--    WHERE email = 'admin@motherofmath.com';
--
-- ============================================================
