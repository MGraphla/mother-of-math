-- ============================================================
-- Admin Functions for Mother of Math
-- These functions use SECURITY DEFINER to bypass RLS for admin access
-- Run this in Supabase SQL Editor
-- ============================================================

-- Function to get ALL teacher profiles (bypasses RLS)
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
    p.email,
    p.full_name,
    p.gender,
    p.country,
    p.city,
    p.school_name,
    p.school_address,
    p.school_type,
    p.number_of_students,
    p.subjects_taught,
    p.grade_levels,
    p.years_of_experience,
    p.education_level,
    p.phone_number,
    p.whatsapp_number,
    p.bio,
    p.date_of_birth,
    p.avatar_url,
    p.preferred_language,
    p.role,
    p.created_at,
    p.updated_at
  FROM profiles p
  WHERE p.role = 'teacher'
  ORDER BY p.created_at DESC;
END;
$$;

-- Function to get ALL students (bypasses RLS)
CREATE OR REPLACE FUNCTION get_all_students()
RETURNS TABLE (
  id UUID,
  teacher_id UUID,
  full_name TEXT,
  student_code TEXT,
  grade_level TEXT,
  school_name TEXT,
  account_status TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.teacher_id,
    s.full_name,
    s.student_code,
    s.grade_level,
    s.school_name,
    s.account_status,
    s.created_at
  FROM students s
  ORDER BY s.created_at DESC;
END;
$$;

-- Function to get admin dashboard counts (bypasses RLS)
CREATE OR REPLACE FUNCTION get_admin_counts()
RETURNS TABLE (
  teachers_count BIGINT,
  students_count BIGINT,
  lesson_plans_count BIGINT,
  assignments_count BIGINT,
  submissions_count BIGINT,
  conversations_count BIGINT,
  messages_count BIGINT,
  resources_count BIGINT,
  announcements_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM profiles WHERE role = 'teacher'),
    (SELECT COUNT(*) FROM students),
    (SELECT COUNT(*) FROM lesson_plans),
    (SELECT COUNT(*) FROM assignments),
    (SELECT COUNT(*) FROM assignment_submissions),
    (SELECT COUNT(*) FROM conversations),
    (SELECT COUNT(*) FROM conversation_messages),
    (SELECT COUNT(*) FROM resources),
    (SELECT COUNT(*) FROM announcements);
END;
$$;

-- Drop existing function first to update signature
DROP FUNCTION IF EXISTS get_teacher_stats(UUID);

-- Function to get teacher stats by ID (bypasses RLS)
CREATE OR REPLACE FUNCTION get_teacher_stats(teacher_uuid UUID)
RETURNS TABLE (
  total_students BIGINT,
  total_lesson_plans BIGINT,
  total_assignments BIGINT,
  total_conversations BIGINT,
  total_messages BIGINT,
  total_resources BIGINT,
  total_announcements BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM students WHERE teacher_id = teacher_uuid),
    (SELECT COUNT(*) FROM lesson_plans WHERE user_id = teacher_uuid),
    (SELECT COUNT(*) FROM assignments WHERE teacher_id = teacher_uuid),
    (SELECT COUNT(*) FROM conversations WHERE user_id = teacher_uuid),
    (SELECT COALESCE(SUM(cnt), 0)::BIGINT FROM (
      SELECT COUNT(*) as cnt FROM conversation_messages cm
      JOIN conversations c ON cm.conversation_id = c.id
      WHERE c.user_id = teacher_uuid
    ) sub),
    (SELECT COUNT(*) FROM resources WHERE teacher_id = teacher_uuid),
    (SELECT COUNT(*) FROM announcements WHERE teacher_id = teacher_uuid);
END;
$$;

-- Grant execute permissions to authenticated and anon users
GRANT EXECUTE ON FUNCTION get_all_teachers() TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_teachers() TO anon;
GRANT EXECUTE ON FUNCTION get_all_students() TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_students() TO anon;
GRANT EXECUTE ON FUNCTION get_admin_counts() TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_counts() TO anon;
GRANT EXECUTE ON FUNCTION get_teacher_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_teacher_stats(UUID) TO anon;

-- ============================================================
-- Additional Admin Functions for All Data Types
-- ============================================================

-- Function to get ALL students with full details (bypasses RLS)
CREATE OR REPLACE FUNCTION get_all_students_full()
RETURNS TABLE (
  id UUID,
  teacher_id UUID,
  full_name TEXT,
  student_code TEXT,
  grade_level TEXT,
  school_name TEXT,
  account_status TEXT,
  date_of_birth DATE,
  gender TEXT,
  nationality TEXT,
  parent_name TEXT,
  parent_phone TEXT,
  parent_email TEXT,
  class_name TEXT,
  notes TEXT,
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
    s.id,
    s.teacher_id,
    s.full_name,
    s.student_code,
    s.grade_level,
    s.school_name,
    s.account_status,
    s.date_of_birth,
    s.gender,
    s.nationality,
    s.parent_name,
    s.parent_phone,
    s.parent_email,
    s.class_name,
    s.notes,
    s.created_at,
    s.updated_at,
    p.full_name as teacher_name
  FROM students s
  LEFT JOIN profiles p ON s.teacher_id = p.id
  ORDER BY s.created_at DESC;
END;
$$;

-- Drop existing function first (return type changed)
DROP FUNCTION IF EXISTS get_all_lesson_plans();

-- Function to get ALL lesson plans (bypasses RLS)
-- Note: The lesson_plans table stores: id, user_id, title, level, content (JSON), created_at
CREATE OR REPLACE FUNCTION get_all_lesson_plans()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  title TEXT,
  grade_level TEXT,
  content JSONB,
  created_at TIMESTAMPTZ,
  teacher_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    lp.id,
    lp.user_id,
    lp.title,
    lp.level as grade_level,
    lp.content,
    lp.created_at,
    p.full_name as teacher_name
  FROM lesson_plans lp
  LEFT JOIN profiles p ON lp.user_id = p.id
  ORDER BY lp.created_at DESC;
END;
$$;

-- Drop existing function first (return type changed)
DROP FUNCTION IF EXISTS get_all_conversations();

-- Function to get ALL conversations (bypasses RLS)
-- Note: The conversations table has 'grade' column, not 'topic'
CREATE OR REPLACE FUNCTION get_all_conversations()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  title TEXT,
  grade TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  teacher_name TEXT,
  message_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.user_id,
    c.title,
    c.grade,
    c.created_at,
    c.updated_at,
    p.full_name as teacher_name,
    (SELECT COUNT(*) FROM conversation_messages cm WHERE cm.conversation_id = c.id)
  FROM conversations c
  LEFT JOIN profiles p ON c.user_id = p.id
  ORDER BY c.updated_at DESC;
END;
$$;

-- Function to get ALL assignments (bypasses RLS)
CREATE OR REPLACE FUNCTION get_all_assignments()
RETURNS TABLE (
  id UUID,
  teacher_id UUID,
  title TEXT,
  description TEXT,
  subject TEXT,
  grade_level TEXT,
  due_date TIMESTAMPTZ,
  max_score NUMERIC,
  status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  teacher_name TEXT,
  submission_count BIGINT,
  student_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.teacher_id,
    a.title,
    a.description,
    a.subject,
    a.grade_level,
    a.due_date,
    a.max_score,
    a.status,
    a.created_at,
    a.updated_at,
    p.full_name as teacher_name,
    (SELECT COUNT(*) FROM assignment_submissions asub WHERE asub.assignment_id = a.id),
    (SELECT COUNT(*) FROM assignment_students ast WHERE ast.assignment_id = a.id)
  FROM assignments a
  LEFT JOIN profiles p ON a.teacher_id = p.id
  ORDER BY a.created_at DESC;
END;
$$;

-- Function to get ALL submissions (bypasses RLS)
CREATE OR REPLACE FUNCTION get_all_submissions()
RETURNS TABLE (
  id UUID,
  assignment_id UUID,
  student_id UUID,
  content TEXT,
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
    sub.content,
    sub.file_url,
    sub.score,
    sub.feedback,
    sub.ai_score,
    sub.ai_feedback,
    sub.status,
    sub.submitted_at,
    sub.graded_at,
    s.full_name as student_name,
    a.title as assignment_title,
    p.full_name as teacher_name
  FROM assignment_submissions sub
  LEFT JOIN students s ON sub.student_id = s.id
  LEFT JOIN assignments a ON sub.assignment_id = a.id
  LEFT JOIN profiles p ON a.teacher_id = p.id
  ORDER BY sub.submitted_at DESC;
END;
$$;

-- Drop existing function first (return type changed)
DROP FUNCTION IF EXISTS get_all_resources();

-- Function to get ALL resources (bypasses RLS)
CREATE OR REPLACE FUNCTION get_all_resources()
RETURNS TABLE (
  id UUID,
  teacher_id UUID,
  title TEXT,
  description TEXT,
  file_type TEXT,
  file_url TEXT,
  topic TEXT,
  grade_level TEXT,
  is_public BOOLEAN,
  download_count INTEGER,
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
    r.id,
    r.teacher_id,
    r.title,
    r.description,
    r.file_type,
    r.file_url,
    r.topic,
    r.grade_level,
    r.is_public,
    r.download_count,
    r.created_at,
    r.updated_at,
    p.full_name as teacher_name
  FROM resources r
  LEFT JOIN profiles p ON r.teacher_id = p.id
  ORDER BY r.created_at DESC;
END;
$$;

-- Drop existing function first (return type changed)
DROP FUNCTION IF EXISTS get_all_announcements();

-- Function to get ALL announcements (bypasses RLS)
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
    ann.title,
    ann.message,
    ann.target_grade_level,
    ann.target_class_name,
    ann.is_pinned,
    ann.priority,
    ann.category,
    ann.expires_at,
    ann.created_at,
    ann.updated_at,
    p.full_name as teacher_name
  FROM announcements ann
  LEFT JOIN profiles p ON ann.teacher_id = p.id
  ORDER BY ann.created_at DESC;
END;
$$;

-- Drop existing function first (return type changed)
DROP FUNCTION IF EXISTS get_all_comments();

-- Function to get ALL comments (bypasses RLS)
CREATE OR REPLACE FUNCTION get_all_comments()
RETURNS TABLE (
  id UUID,
  assignment_id UUID,
  student_id UUID,
  teacher_id UUID,
  message TEXT,
  is_private BOOLEAN,
  created_at TIMESTAMPTZ,
  student_name TEXT,
  teacher_name TEXT,
  assignment_title TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.assignment_id,
    c.student_id,
    c.teacher_id,
    c.message,
    c.is_private,
    c.created_at,
    s.full_name as student_name,
    p.full_name as teacher_name,
    a.title as assignment_title
  FROM assignment_comments c
  LEFT JOIN students s ON c.student_id = s.id
  LEFT JOIN profiles p ON c.teacher_id = p.id
  LEFT JOIN assignments a ON c.assignment_id = a.id
  ORDER BY c.created_at DESC;
END;
$$;

-- Function to get ALL conversation messages (bypasses RLS)
CREATE OR REPLACE FUNCTION get_all_messages()
RETURNS TABLE (
  id UUID,
  conversation_id UUID,
  role TEXT,
  content TEXT,
  created_at TIMESTAMPTZ,
  conversation_title TEXT,
  teacher_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.conversation_id,
    m.role,
    m.content,
    m.created_at,
    c.title as conversation_title,
    p.full_name as teacher_name
  FROM conversation_messages m
  LEFT JOIN conversations c ON m.conversation_id = c.id
  LEFT JOIN profiles p ON c.user_id = p.id
  ORDER BY m.created_at DESC
  LIMIT 1000;
END;
$$;

-- Function to get user activity/analytics (bypasses RLS)
CREATE OR REPLACE FUNCTION get_user_activity()
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  email TEXT,
  role TEXT,
  last_activity TIMESTAMPTZ,
  total_lesson_plans BIGINT,
  total_assignments BIGINT,
  total_conversations BIGINT,
  total_messages BIGINT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as user_id,
    p.full_name,
    p.email,
    p.role,
    p.updated_at as last_activity,
    (SELECT COUNT(*) FROM lesson_plans WHERE user_id = p.id),
    (SELECT COUNT(*) FROM assignments WHERE teacher_id = p.id),
    (SELECT COUNT(*) FROM conversations WHERE user_id = p.id),
    (SELECT COALESCE(SUM(cnt), 0) FROM (
      SELECT COUNT(*) as cnt FROM conversation_messages cm
      JOIN conversations c ON cm.conversation_id = c.id
      WHERE c.user_id = p.id
    ) sub),
    p.created_at
  FROM profiles p
  WHERE p.role = 'teacher'
  ORDER BY p.updated_at DESC;
END;
$$;

-- Grant execute permissions to authenticated and anon users for new functions
GRANT EXECUTE ON FUNCTION get_all_students_full() TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_students_full() TO anon;
GRANT EXECUTE ON FUNCTION get_all_lesson_plans() TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_lesson_plans() TO anon;
GRANT EXECUTE ON FUNCTION get_all_conversations() TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_conversations() TO anon;
GRANT EXECUTE ON FUNCTION get_all_assignments() TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_assignments() TO anon;
GRANT EXECUTE ON FUNCTION get_all_submissions() TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_submissions() TO anon;
GRANT EXECUTE ON FUNCTION get_all_resources() TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_resources() TO anon;
GRANT EXECUTE ON FUNCTION get_all_announcements() TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_announcements() TO anon;
GRANT EXECUTE ON FUNCTION get_all_comments() TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_comments() TO anon;
GRANT EXECUTE ON FUNCTION get_all_messages() TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_messages() TO anon;
GRANT EXECUTE ON FUNCTION get_user_activity() TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_activity() TO anon;

-- ============================================================
-- Additional Admin Functions for Comprehensive Dashboard
-- ============================================================

-- Function to get ALL generated images (bypasses RLS)
CREATE OR REPLACE FUNCTION get_all_images()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  user_name TEXT,
  prompt TEXT,
  enhanced_prompt TEXT,
  aspect_ratio TEXT,
  style TEXT,
  image_url TEXT,
  storage_path TEXT,
  is_favorite BOOLEAN,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    gi.id,
    gi.user_id,
    COALESCE(p.full_name, 'Unknown') as user_name,
    gi.prompt,
    gi.enhanced_prompt,
    gi.aspect_ratio,
    gi.style,
    gi.image_url,
    gi.storage_path,
    gi.is_favorite,
    gi.created_at
  FROM generated_images gi
  LEFT JOIN profiles p ON gi.user_id = p.id
  ORDER BY gi.created_at DESC;
END;
$$;

-- Function to get ALL student works/uploads (bypasses RLS)
DROP FUNCTION IF EXISTS get_all_student_works();

CREATE OR REPLACE FUNCTION get_all_student_works()
RETURNS TABLE (
  id UUID,
  teacher_id UUID,
  parent_id UUID,
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
    COALESCE(p.full_name, 'Unknown') as teacher_name,
    sw.student_name,
    sw.subject,
    sw.image_url,
    sw.file_name,
    sw.file_type,
    sw.file_size,
    sw.grade,
    sw.status,
    sw.feedback,
    sw.error_type,
    sw.remediation,
    sw.created_at
  FROM student_works sw
  LEFT JOIN profiles p ON sw.teacher_id = p.id OR sw.parent_id = p.id
  ORDER BY sw.created_at DESC;
END;
$$;

-- Drop existing function first (return type changed)
DROP FUNCTION IF EXISTS get_comprehensive_admin_counts();

-- Function to get comprehensive admin counts including new fields
CREATE OR REPLACE FUNCTION get_comprehensive_admin_counts()
RETURNS TABLE (
  teachers_count BIGINT,
  students_count BIGINT,
  lesson_plans_count BIGINT,
  assignments_count BIGINT,
  submissions_count BIGINT,
  conversations_count BIGINT,
  messages_count BIGINT,
  resources_count BIGINT,
  announcements_count BIGINT,
  images_count BIGINT,
  user_messages_count BIGINT,
  assistant_messages_count BIGINT,
  active_today BIGINT,
  active_this_week BIGINT,
  active_this_month BIGINT,
  ai_words_generated BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  week_ago TIMESTAMPTZ := NOW() - INTERVAL '7 days';
  month_ago TIMESTAMPTZ := NOW() - INTERVAL '30 days';
  today_start TIMESTAMPTZ := DATE_TRUNC('day', NOW());
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM profiles WHERE role = 'teacher'),
    (SELECT COUNT(*) FROM students),
    (SELECT COUNT(*) FROM lesson_plans),
    (SELECT COUNT(*) FROM assignments),
    (SELECT COUNT(*) FROM assignment_submissions),
    (SELECT COUNT(*) FROM conversations),
    (SELECT COUNT(*) FROM conversation_messages),
    (SELECT COUNT(*) FROM resources),
    (SELECT COUNT(*) FROM announcements),
    (SELECT COUNT(*) FROM generated_images),
    (SELECT COUNT(*) FROM conversation_messages WHERE role = 'user'),
    (SELECT COUNT(*) FROM conversation_messages WHERE role = 'assistant'),
    (SELECT COUNT(*) FROM profiles WHERE role = 'teacher' AND updated_at >= today_start),
    (SELECT COUNT(*) FROM profiles WHERE role = 'teacher' AND updated_at >= week_ago),
    (SELECT COUNT(*) FROM profiles WHERE role = 'teacher' AND updated_at >= month_ago),
    (SELECT COALESCE(SUM(array_length(regexp_split_to_array(content, '\s+'), 1)), 0) FROM conversation_messages WHERE role = 'assistant');
END;
$$;

-- Function to get students per teacher
CREATE OR REPLACE FUNCTION get_students_per_teacher()
RETURNS TABLE (
  teacher_id UUID,
  teacher_name TEXT,
  school_name TEXT,
  student_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as teacher_id,
    COALESCE(p.full_name, 'Unknown') as teacher_name,
    p.school_name,
    COUNT(s.id) as student_count
  FROM profiles p
  LEFT JOIN students s ON s.teacher_id = p.id
  WHERE p.role = 'teacher'
  GROUP BY p.id, p.full_name, p.school_name
  ORDER BY student_count DESC;
END;
$$;

-- Function to get lesson plans per teacher
CREATE OR REPLACE FUNCTION get_lesson_plans_per_teacher()
RETURNS TABLE (
  teacher_id UUID,
  teacher_name TEXT,
  lesson_plan_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as teacher_id,
    COALESCE(p.full_name, 'Unknown') as teacher_name,
    COUNT(lp.id) as lesson_plan_count
  FROM profiles p
  LEFT JOIN lesson_plans lp ON lp.user_id = p.id
  WHERE p.role = 'teacher'
  GROUP BY p.id, p.full_name
  HAVING COUNT(lp.id) > 0
  ORDER BY lesson_plan_count DESC;
END;
$$;

-- Function to get all unique schools with stats
CREATE OR REPLACE FUNCTION get_all_schools()
RETURNS TABLE (
  school_name TEXT,
  school_type TEXT,
  city TEXT,
  country TEXT,
  teacher_count BIGINT,
  student_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(p.school_name, 'Unknown School') as school_name,
    p.school_type,
    p.city,
    p.country,
    COUNT(DISTINCT p.id) as teacher_count,
    COUNT(DISTINCT s.id) as student_count
  FROM profiles p
  LEFT JOIN students s ON s.teacher_id = p.id
  WHERE p.role = 'teacher' AND p.school_name IS NOT NULL
  GROUP BY p.school_name, p.school_type, p.city, p.country
  ORDER BY teacher_count DESC;
END;
$$;

-- Function to get teachers by country distribution
CREATE OR REPLACE FUNCTION get_teachers_by_country()
RETURNS TABLE (
  country TEXT,
  teacher_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(p.country, 'Unknown') as country,
    COUNT(*) as teacher_count
  FROM profiles p
  WHERE p.role = 'teacher' AND p.country IS NOT NULL
  GROUP BY p.country
  ORDER BY teacher_count DESC;
END;
$$;

-- Function to get images per teacher
CREATE OR REPLACE FUNCTION get_images_per_teacher()
RETURNS TABLE (
  teacher_id UUID,
  teacher_name TEXT,
  image_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as teacher_id,
    COALESCE(p.full_name, 'Unknown') as teacher_name,
    COUNT(gi.id) as image_count
  FROM profiles p
  LEFT JOIN generated_images gi ON gi.user_id = p.id
  WHERE p.role = 'teacher'
  GROUP BY p.id, p.full_name
  HAVING COUNT(gi.id) > 0
  ORDER BY image_count DESC;
END;
$$;

-- Grant execute permissions for new functions
GRANT EXECUTE ON FUNCTION get_all_images() TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_images() TO anon;
GRANT EXECUTE ON FUNCTION get_all_student_works() TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_student_works() TO anon;
GRANT EXECUTE ON FUNCTION get_comprehensive_admin_counts() TO authenticated;
GRANT EXECUTE ON FUNCTION get_comprehensive_admin_counts() TO anon;
GRANT EXECUTE ON FUNCTION get_students_per_teacher() TO authenticated;
GRANT EXECUTE ON FUNCTION get_students_per_teacher() TO anon;
GRANT EXECUTE ON FUNCTION get_lesson_plans_per_teacher() TO authenticated;
GRANT EXECUTE ON FUNCTION get_lesson_plans_per_teacher() TO anon;
GRANT EXECUTE ON FUNCTION get_all_schools() TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_schools() TO anon;
GRANT EXECUTE ON FUNCTION get_teachers_by_country() TO authenticated;
GRANT EXECUTE ON FUNCTION get_teachers_by_country() TO anon;
GRANT EXECUTE ON FUNCTION get_images_per_teacher() TO authenticated;
GRANT EXECUTE ON FUNCTION get_images_per_teacher() TO anon;

-- ============================================================
-- Enhanced Admin Dashboard Functions
-- New tables and functions for comprehensive admin features
-- ============================================================

-- ============================================================
-- Table: admin_api_usage - Track API/Token Usage
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  service_type TEXT NOT NULL, -- 'openai', 'gemini', 'replicate', etc.
  endpoint TEXT,
  tokens_used INTEGER DEFAULT 0,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  cost_estimate NUMERIC(10,6) DEFAULT 0,
  request_duration_ms INTEGER,
  status TEXT DEFAULT 'success', -- 'success', 'error', 'rate_limited'
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_usage_user ON admin_api_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_created ON admin_api_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_api_usage_service ON admin_api_usage(service_type);

-- ============================================================
-- Table: admin_support_tickets - Support Ticket System
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ticket_number TEXT UNIQUE NOT NULL,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT DEFAULT 'general', -- 'bug', 'feature', 'billing', 'general', 'technical'
  priority TEXT DEFAULT 'medium', -- 'low', 'medium', 'high', 'urgent'
  status TEXT DEFAULT 'open', -- 'open', 'in_progress', 'waiting', 'resolved', 'closed'
  assigned_to TEXT,
  resolution TEXT,
  attachments JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  first_response_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tickets_status ON admin_support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON admin_support_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_user ON admin_support_tickets(user_id);

-- ============================================================
-- Table: admin_content_flags - Content Moderation
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_content_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type TEXT NOT NULL, -- 'message', 'image', 'resource', 'assignment', 'comment'
  content_id UUID NOT NULL,
  content_preview TEXT,
  flagged_by TEXT DEFAULT 'ai', -- 'ai', 'user', 'admin'
  flag_reason TEXT NOT NULL, -- 'inappropriate', 'spam', 'harassment', 'copyright', 'other'
  severity TEXT DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'removed', 'dismissed'
  reviewed_by TEXT,
  review_notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_flags_status ON admin_content_flags(status);
CREATE INDEX IF NOT EXISTS idx_flags_severity ON admin_content_flags(severity);
CREATE INDEX IF NOT EXISTS idx_flags_type ON admin_content_flags(content_type);

-- ============================================================
-- Table: admin_audit_logs - Audit Trail
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user TEXT NOT NULL,
  action_type TEXT NOT NULL, -- 'create', 'update', 'delete', 'login', 'export', 'view'
  resource_type TEXT NOT NULL, -- 'teacher', 'student', 'assignment', 'settings', etc.
  resource_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_admin ON admin_audit_logs(admin_user);
CREATE INDEX IF NOT EXISTS idx_audit_action ON admin_audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_created ON admin_audit_logs(created_at);

-- ============================================================
-- Table: admin_notifications - Admin Notification System
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  notification_type TEXT DEFAULT 'info', -- 'info', 'warning', 'error', 'success'
  category TEXT DEFAULT 'system', -- 'system', 'user', 'security', 'usage', 'report'
  priority TEXT DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
  is_read BOOLEAN DEFAULT FALSE,
  is_dismissed BOOLEAN DEFAULT FALSE,
  action_url TEXT,
  metadata JSONB DEFAULT '{}',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_read ON admin_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON admin_notifications(notification_type);

-- ============================================================
-- Table: admin_scheduled_reports - Scheduled Reports
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_scheduled_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  report_type TEXT NOT NULL, -- 'usage', 'growth', 'engagement', 'custom'
  schedule TEXT NOT NULL, -- 'daily', 'weekly', 'monthly'
  recipients JSONB DEFAULT '[]',
  filters JSONB DEFAULT '{}',
  columns JSONB DEFAULT '[]',
  format TEXT DEFAULT 'pdf', -- 'pdf', 'excel', 'csv'
  is_active BOOLEAN DEFAULT TRUE,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Table: admin_data_requests - GDPR/Data Management
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_data_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  request_type TEXT NOT NULL, -- 'export', 'delete', 'access'
  status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'rejected'
  requested_by TEXT,
  reason TEXT,
  data_categories JSONB DEFAULT '[]',
  download_url TEXT,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Functions for Enhanced Admin Dashboard
-- ============================================================

-- Function to get time series data for growth metrics
CREATE OR REPLACE FUNCTION get_growth_metrics(days_back INTEGER DEFAULT 30)
RETURNS TABLE (
  metric_date DATE,
  new_teachers BIGINT,
  new_students BIGINT,
  new_lesson_plans BIGINT,
  new_conversations BIGINT,
  new_messages BIGINT,
  new_assignments BIGINT,
  new_images BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(
      CURRENT_DATE - (days_back || ' days')::INTERVAL,
      CURRENT_DATE,
      '1 day'::INTERVAL
    )::DATE as d
  )
  SELECT 
    ds.d as metric_date,
    COALESCE((SELECT COUNT(*) FROM profiles WHERE role = 'teacher' AND DATE(created_at) = ds.d), 0) as new_teachers,
    COALESCE((SELECT COUNT(*) FROM students WHERE DATE(created_at) = ds.d), 0) as new_students,
    COALESCE((SELECT COUNT(*) FROM lesson_plans WHERE DATE(created_at) = ds.d), 0) as new_lesson_plans,
    COALESCE((SELECT COUNT(*) FROM conversations WHERE DATE(created_at) = ds.d), 0) as new_conversations,
    COALESCE((SELECT COUNT(*) FROM conversation_messages WHERE DATE(created_at) = ds.d), 0) as new_messages,
    COALESCE((SELECT COUNT(*) FROM assignments WHERE DATE(created_at) = ds.d), 0) as new_assignments,
    COALESCE((SELECT COUNT(*) FROM generated_images WHERE DATE(created_at) = ds.d), 0) as new_images
  FROM date_series ds
  ORDER BY ds.d;
END;
$$;

-- Function to get comparison metrics (current vs previous period)
CREATE OR REPLACE FUNCTION get_comparison_metrics(period_days INTEGER DEFAULT 7)
RETURNS TABLE (
  metric_name TEXT,
  current_value BIGINT,
  previous_value BIGINT,
  change_percent NUMERIC,
  change_direction TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_start DATE := CURRENT_DATE - (period_days - 1);
  previous_start DATE := CURRENT_DATE - (period_days * 2 - 1);
  previous_end DATE := CURRENT_DATE - period_days;
BEGIN
  RETURN QUERY
  WITH metrics AS (
    SELECT 'Teachers' as name,
      (SELECT COUNT(*) FROM profiles WHERE role = 'teacher' AND DATE(created_at) >= current_start) as curr,
      (SELECT COUNT(*) FROM profiles WHERE role = 'teacher' AND DATE(created_at) >= previous_start AND DATE(created_at) < current_start) as prev
    UNION ALL
    SELECT 'Students',
      (SELECT COUNT(*) FROM students WHERE DATE(created_at) >= current_start),
      (SELECT COUNT(*) FROM students WHERE DATE(created_at) >= previous_start AND DATE(created_at) < current_start)
    UNION ALL
    SELECT 'Conversations',
      (SELECT COUNT(*) FROM conversations WHERE DATE(created_at) >= current_start),
      (SELECT COUNT(*) FROM conversations WHERE DATE(created_at) >= previous_start AND DATE(created_at) < current_start)
    UNION ALL
    SELECT 'Messages',
      (SELECT COUNT(*) FROM conversation_messages WHERE DATE(created_at) >= current_start),
      (SELECT COUNT(*) FROM conversation_messages WHERE DATE(created_at) >= previous_start AND DATE(created_at) < current_start)
    UNION ALL
    SELECT 'Lesson Plans',
      (SELECT COUNT(*) FROM lesson_plans WHERE DATE(created_at) >= current_start),
      (SELECT COUNT(*) FROM lesson_plans WHERE DATE(created_at) >= previous_start AND DATE(created_at) < current_start)
    UNION ALL
    SELECT 'Assignments',
      (SELECT COUNT(*) FROM assignments WHERE DATE(created_at) >= current_start),
      (SELECT COUNT(*) FROM assignments WHERE DATE(created_at) >= previous_start AND DATE(created_at) < current_start)
    UNION ALL
    SELECT 'Images Generated',
      (SELECT COUNT(*) FROM generated_images WHERE DATE(created_at) >= current_start),
      (SELECT COUNT(*) FROM generated_images WHERE DATE(created_at) >= previous_start AND DATE(created_at) < current_start)
  )
  SELECT 
    m.name,
    m.curr,
    m.prev,
    CASE WHEN m.prev > 0 THEN ROUND(((m.curr - m.prev)::NUMERIC / m.prev) * 100, 1) ELSE 0 END,
    CASE 
      WHEN m.curr > m.prev THEN 'up'
      WHEN m.curr < m.prev THEN 'down'
      ELSE 'stable'
    END
  FROM metrics m;
END;
$$;

-- Function to get API usage statistics
CREATE OR REPLACE FUNCTION get_api_usage_stats(days_back INTEGER DEFAULT 30)
RETURNS TABLE (
  service_type TEXT,
  total_requests BIGINT,
  total_tokens BIGINT,
  total_cost NUMERIC,
  avg_duration_ms NUMERIC,
  success_rate NUMERIC,
  daily_breakdown JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    au.service_type,
    COUNT(*) as total_requests,
    SUM(au.tokens_used)::BIGINT as total_tokens,
    SUM(au.cost_estimate) as total_cost,
    AVG(au.request_duration_ms) as avg_duration_ms,
    ROUND((COUNT(*) FILTER (WHERE au.status = 'success')::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 1) as success_rate,
    (
      SELECT jsonb_agg(jsonb_build_object(
        'date', d.date,
        'requests', d.requests,
        'tokens', d.tokens
      ))
      FROM (
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as requests,
          SUM(tokens_used) as tokens
        FROM admin_api_usage
        WHERE service_type = au.service_type
          AND created_at >= NOW() - (days_back || ' days')::INTERVAL
        GROUP BY DATE(created_at)
        ORDER BY DATE(created_at)
      ) d
    ) as daily_breakdown
  FROM admin_api_usage au
  WHERE au.created_at >= NOW() - (days_back || ' days')::INTERVAL
  GROUP BY au.service_type
  ORDER BY total_requests DESC;
END;
$$;

-- Function to get all support tickets
CREATE OR REPLACE FUNCTION get_all_support_tickets()
RETURNS TABLE (
  id UUID,
  ticket_number TEXT,
  user_id UUID,
  user_name TEXT,
  user_email TEXT,
  subject TEXT,
  description TEXT,
  category TEXT,
  priority TEXT,
  status TEXT,
  assigned_to TEXT,
  resolution TEXT,
  first_response_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
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
    t.id,
    t.ticket_number,
    t.user_id,
    COALESCE(p.full_name, 'Unknown') as user_name,
    p.email as user_email,
    t.subject,
    t.description,
    t.category,
    t.priority,
    t.status,
    t.assigned_to,
    t.resolution,
    t.first_response_at,
    t.resolved_at,
    t.created_at,
    t.updated_at
  FROM admin_support_tickets t
  LEFT JOIN profiles p ON t.user_id = p.id
  ORDER BY 
    CASE t.priority 
      WHEN 'urgent' THEN 1 
      WHEN 'high' THEN 2 
      WHEN 'medium' THEN 3 
      ELSE 4 
    END,
    t.created_at DESC;
END;
$$;

-- Function to get support ticket stats
CREATE OR REPLACE FUNCTION get_support_ticket_stats()
RETURNS TABLE (
  total_tickets BIGINT,
  open_tickets BIGINT,
  in_progress_tickets BIGINT,
  resolved_tickets BIGINT,
  avg_resolution_hours NUMERIC,
  avg_first_response_hours NUMERIC,
  tickets_by_category JSONB,
  tickets_by_priority JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_tickets,
    COUNT(*) FILTER (WHERE status = 'open') as open_tickets,
    COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_tickets,
    COUNT(*) FILTER (WHERE status IN ('resolved', 'closed')) as resolved_tickets,
    ROUND(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600) FILTER (WHERE resolved_at IS NOT NULL), 1) as avg_resolution_hours,
    ROUND(AVG(EXTRACT(EPOCH FROM (first_response_at - created_at))/3600) FILTER (WHERE first_response_at IS NOT NULL), 1) as avg_first_response_hours,
    (SELECT jsonb_object_agg(category, cnt) FROM (SELECT category, COUNT(*) as cnt FROM admin_support_tickets GROUP BY category) c) as tickets_by_category,
    (SELECT jsonb_object_agg(priority, cnt) FROM (SELECT priority, COUNT(*) as cnt FROM admin_support_tickets GROUP BY priority) p) as tickets_by_priority
  FROM admin_support_tickets;
END;
$$;

-- Function to get all content flags
CREATE OR REPLACE FUNCTION get_all_content_flags()
RETURNS TABLE (
  id UUID,
  content_type TEXT,
  content_id UUID,
  content_preview TEXT,
  flagged_by TEXT,
  flag_reason TEXT,
  severity TEXT,
  status TEXT,
  reviewed_by TEXT,
  review_notes TEXT,
  created_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cf.id,
    cf.content_type,
    cf.content_id,
    cf.content_preview,
    cf.flagged_by,
    cf.flag_reason,
    cf.severity,
    cf.status,
    cf.reviewed_by,
    cf.review_notes,
    cf.created_at,
    cf.reviewed_at
  FROM admin_content_flags cf
  ORDER BY 
    CASE cf.severity 
      WHEN 'critical' THEN 1 
      WHEN 'high' THEN 2 
      WHEN 'medium' THEN 3 
      ELSE 4 
    END,
    cf.created_at DESC;
END;
$$;

-- Function to get content moderation stats
CREATE OR REPLACE FUNCTION get_moderation_stats()
RETURNS TABLE (
  total_flags BIGINT,
  pending_flags BIGINT,
  approved_flags BIGINT,
  removed_flags BIGINT,
  flags_by_type JSONB,
  flags_by_reason JSONB,
  flags_by_severity JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'pending'),
    COUNT(*) FILTER (WHERE status = 'approved'),
    COUNT(*) FILTER (WHERE status = 'removed'),
    (SELECT jsonb_object_agg(content_type, cnt) FROM (SELECT content_type, COUNT(*) as cnt FROM admin_content_flags GROUP BY content_type) t),
    (SELECT jsonb_object_agg(flag_reason, cnt) FROM (SELECT flag_reason, COUNT(*) as cnt FROM admin_content_flags GROUP BY flag_reason) r),
    (SELECT jsonb_object_agg(severity, cnt) FROM (SELECT severity, COUNT(*) as cnt FROM admin_content_flags GROUP BY severity) s)
  FROM admin_content_flags;
END;
$$;

-- Function to get admin audit logs
CREATE OR REPLACE FUNCTION get_admin_audit_logs(limit_count INTEGER DEFAULT 100)
RETURNS TABLE (
  id UUID,
  admin_user TEXT,
  action_type TEXT,
  resource_type TEXT,
  resource_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    al.id,
    al.admin_user,
    al.action_type,
    al.resource_type,
    al.resource_id,
    al.old_values,
    al.new_values,
    al.ip_address,
    al.created_at
  FROM admin_audit_logs al
  ORDER BY al.created_at DESC
  LIMIT limit_count;
END;
$$;

-- Function to get admin notifications
CREATE OR REPLACE FUNCTION get_admin_notifications(include_read BOOLEAN DEFAULT FALSE)
RETURNS TABLE (
  id UUID,
  title TEXT,
  message TEXT,
  notification_type TEXT,
  category TEXT,
  priority TEXT,
  is_read BOOLEAN,
  action_url TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    n.id,
    n.title,
    n.message,
    n.notification_type,
    n.category,
    n.priority,
    n.is_read,
    n.action_url,
    n.created_at
  FROM admin_notifications n
  WHERE (include_read = TRUE OR n.is_read = FALSE)
    AND (n.is_dismissed = FALSE)
    AND (n.expires_at IS NULL OR n.expires_at > NOW())
  ORDER BY 
    CASE n.priority 
      WHEN 'urgent' THEN 1 
      WHEN 'high' THEN 2 
      WHEN 'normal' THEN 3 
      ELSE 4 
    END,
    n.created_at DESC;
END;
$$;

-- Function to get data management requests
CREATE OR REPLACE FUNCTION get_data_requests()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  user_name TEXT,
  user_email TEXT,
  request_type TEXT,
  status TEXT,
  requested_by TEXT,
  reason TEXT,
  data_categories JSONB,
  download_url TEXT,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dr.id,
    dr.user_id,
    COALESCE(p.full_name, 'Unknown') as user_name,
    p.email as user_email,
    dr.request_type,
    dr.status,
    dr.requested_by,
    dr.reason,
    dr.data_categories,
    dr.download_url,
    dr.completed_at,
    dr.expires_at,
    dr.created_at
  FROM admin_data_requests dr
  LEFT JOIN profiles p ON dr.user_id = p.id
  ORDER BY dr.created_at DESC;
END;
$$;

-- Function to get system health metrics
CREATE OR REPLACE FUNCTION get_system_health()
RETURNS TABLE (
  metric_name TEXT,
  metric_value TEXT,
  status TEXT,
  details JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM (
    VALUES 
      ('database_size', pg_size_pretty(pg_database_size(current_database())), 'ok', '{}'::JSONB),
      ('total_tables', (SELECT COUNT(*)::TEXT FROM information_schema.tables WHERE table_schema = 'public'), 'ok', '{}'::JSONB),
      ('profiles_count', (SELECT COUNT(*)::TEXT FROM profiles), 'ok', '{}'::JSONB),
      ('active_connections', (SELECT COUNT(*)::TEXT FROM pg_stat_activity WHERE state = 'active'), 'ok', '{}'::JSONB)
  ) AS t(metric_name, metric_value, status, details);
END;
$$;

-- Function to get grade distribution analytics
CREATE OR REPLACE FUNCTION get_grade_distribution()
RETURNS TABLE (
  grade_range TEXT,
  count BIGINT,
  percentage NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_graded BIGINT;
BEGIN
  SELECT COUNT(*) INTO total_graded FROM assignment_submissions WHERE score IS NOT NULL;
  
  RETURN QUERY
  SELECT 
    CASE 
      WHEN score >= 90 THEN 'A (90-100)'
      WHEN score >= 80 THEN 'B (80-89)'
      WHEN score >= 70 THEN 'C (70-79)'
      WHEN score >= 60 THEN 'D (60-69)'
      ELSE 'F (0-59)'
    END as grade_range,
    COUNT(*) as count,
    ROUND((COUNT(*)::NUMERIC / NULLIF(total_graded, 0)) * 100, 1) as percentage
  FROM assignment_submissions
  WHERE score IS NOT NULL
  GROUP BY 
    CASE 
      WHEN score >= 90 THEN 'A (90-100)'
      WHEN score >= 80 THEN 'B (80-89)'
      WHEN score >= 70 THEN 'C (70-79)'
      WHEN score >= 60 THEN 'D (60-69)'
      ELSE 'F (0-59)'
    END
  ORDER BY 
    CASE grade_range
      WHEN 'A (90-100)' THEN 1
      WHEN 'B (80-89)' THEN 2
      WHEN 'C (70-79)' THEN 3
      WHEN 'D (60-69)' THEN 4
      ELSE 5
    END;
END;
$$;

-- Function to get AI vs Human grading comparison
CREATE OR REPLACE FUNCTION get_ai_vs_human_grading()
RETURNS TABLE (
  total_submissions BIGINT,
  ai_graded BIGINT,
  human_graded BIGINT,
  both_graded BIGINT,
  avg_ai_score NUMERIC,
  avg_human_score NUMERIC,
  avg_difference NUMERIC,
  correlation_coefficient NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_submissions,
    COUNT(*) FILTER (WHERE ai_score IS NOT NULL) as ai_graded,
    COUNT(*) FILTER (WHERE score IS NOT NULL) as human_graded,
    COUNT(*) FILTER (WHERE ai_score IS NOT NULL AND score IS NOT NULL) as both_graded,
    ROUND(AVG(ai_score), 1) as avg_ai_score,
    ROUND(AVG(score), 1) as avg_human_score,
    ROUND(AVG(ABS(COALESCE(ai_score, 0) - COALESCE(score, 0))) FILTER (WHERE ai_score IS NOT NULL AND score IS NOT NULL), 1) as avg_difference,
    ROUND(CORR(ai_score, score)::NUMERIC, 3) FILTER (WHERE ai_score IS NOT NULL AND score IS NOT NULL) as correlation_coefficient
  FROM assignment_submissions;
END;
$$;

-- Function to insert audit log
CREATE OR REPLACE FUNCTION insert_audit_log(
  p_admin_user TEXT,
  p_action_type TEXT,
  p_resource_type TEXT,
  p_resource_id UUID DEFAULT NULL,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id UUID;
BEGIN
  INSERT INTO admin_audit_logs (admin_user, action_type, resource_type, resource_id, old_values, new_values, ip_address)
  VALUES (p_admin_user, p_action_type, p_resource_type, p_resource_id, p_old_values, p_new_values, p_ip_address)
  RETURNING id INTO new_id;
  
  RETURN new_id;
END;
$$;

-- Function to create support ticket
CREATE OR REPLACE FUNCTION create_support_ticket(
  p_user_id UUID,
  p_subject TEXT,
  p_description TEXT,
  p_category TEXT DEFAULT 'general',
  p_priority TEXT DEFAULT 'medium'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id UUID;
  new_ticket_number TEXT;
BEGIN
  new_ticket_number := 'TKT-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
  
  INSERT INTO admin_support_tickets (user_id, ticket_number, subject, description, category, priority)
  VALUES (p_user_id, new_ticket_number, p_subject, p_description, p_category, p_priority)
  RETURNING id INTO new_id;
  
  RETURN new_id;
END;
$$;

-- Function to update support ticket status
CREATE OR REPLACE FUNCTION update_ticket_status(
  p_ticket_id UUID,
  p_status TEXT,
  p_resolution TEXT DEFAULT NULL,
  p_assigned_to TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE admin_support_tickets
  SET 
    status = p_status,
    resolution = COALESCE(p_resolution, resolution),
    assigned_to = COALESCE(p_assigned_to, assigned_to),
    resolved_at = CASE WHEN p_status IN ('resolved', 'closed') THEN NOW() ELSE resolved_at END,
    first_response_at = CASE WHEN first_response_at IS NULL AND p_status = 'in_progress' THEN NOW() ELSE first_response_at END,
    updated_at = NOW()
  WHERE id = p_ticket_id;
  
  RETURN FOUND;
END;
$$;

-- Function to create content flag
CREATE OR REPLACE FUNCTION create_content_flag(
  p_content_type TEXT,
  p_content_id UUID,
  p_content_preview TEXT,
  p_flag_reason TEXT,
  p_severity TEXT DEFAULT 'medium',
  p_flagged_by TEXT DEFAULT 'admin'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id UUID;
BEGIN
  INSERT INTO admin_content_flags (content_type, content_id, content_preview, flag_reason, severity, flagged_by)
  VALUES (p_content_type, p_content_id, p_content_preview, p_flag_reason, p_severity, p_flagged_by)
  RETURNING id INTO new_id;
  
  RETURN new_id;
END;
$$;

-- Function to review content flag
CREATE OR REPLACE FUNCTION review_content_flag(
  p_flag_id UUID,
  p_status TEXT,
  p_reviewed_by TEXT,
  p_review_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE admin_content_flags
  SET 
    status = p_status,
    reviewed_by = p_reviewed_by,
    review_notes = p_review_notes,
    reviewed_at = NOW()
  WHERE id = p_flag_id;
  
  RETURN FOUND;
END;
$$;

-- Function to create admin notification
CREATE OR REPLACE FUNCTION create_admin_notification(
  p_title TEXT,
  p_message TEXT,
  p_notification_type TEXT DEFAULT 'info',
  p_category TEXT DEFAULT 'system',
  p_priority TEXT DEFAULT 'normal',
  p_action_url TEXT DEFAULT NULL,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id UUID;
BEGIN
  INSERT INTO admin_notifications (title, message, notification_type, category, priority, action_url, expires_at)
  VALUES (p_title, p_message, p_notification_type, p_category, p_priority, p_action_url, p_expires_at)
  RETURNING id INTO new_id;
  
  RETURN new_id;
END;
$$;

-- Function to mark notification as read
CREATE OR REPLACE FUNCTION mark_notification_read(p_notification_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE admin_notifications SET is_read = TRUE WHERE id = p_notification_id;
  RETURN FOUND;
END;
$$;

-- Function to get engagement metrics
CREATE OR REPLACE FUNCTION get_engagement_metrics(days_back INTEGER DEFAULT 30)
RETURNS TABLE (
  metric_date DATE,
  active_users BIGINT,
  conversations_started BIGINT,
  messages_sent BIGINT,
  lessons_created BIGINT,
  assignments_created BIGINT,
  avg_messages_per_conversation NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(
      CURRENT_DATE - (days_back || ' days')::INTERVAL,
      CURRENT_DATE,
      '1 day'::INTERVAL
    )::DATE as d
  )
  SELECT 
    ds.d as metric_date,
    (SELECT COUNT(DISTINCT user_id) FROM conversations WHERE DATE(created_at) = ds.d OR DATE(updated_at) = ds.d) as active_users,
    (SELECT COUNT(*) FROM conversations WHERE DATE(created_at) = ds.d) as conversations_started,
    (SELECT COUNT(*) FROM conversation_messages WHERE DATE(created_at) = ds.d) as messages_sent,
    (SELECT COUNT(*) FROM lesson_plans WHERE DATE(created_at) = ds.d) as lessons_created,
    (SELECT COUNT(*) FROM assignments WHERE DATE(created_at) = ds.d) as assignments_created,
    (
      SELECT ROUND(AVG(msg_count), 1)
      FROM (
        SELECT conversation_id, COUNT(*) as msg_count
        FROM conversation_messages
        WHERE DATE(created_at) = ds.d
        GROUP BY conversation_id
      ) sub
    ) as avg_messages_per_conversation
  FROM date_series ds
  ORDER BY ds.d;
END;
$$;

-- Grant execute permissions for all new functions
GRANT EXECUTE ON FUNCTION get_growth_metrics(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_growth_metrics(INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION get_comparison_metrics(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_comparison_metrics(INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION get_api_usage_stats(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_api_usage_stats(INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION get_all_support_tickets() TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_support_tickets() TO anon;
GRANT EXECUTE ON FUNCTION get_support_ticket_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION get_support_ticket_stats() TO anon;
GRANT EXECUTE ON FUNCTION get_all_content_flags() TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_content_flags() TO anon;
GRANT EXECUTE ON FUNCTION get_moderation_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION get_moderation_stats() TO anon;
GRANT EXECUTE ON FUNCTION get_admin_audit_logs(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_audit_logs(INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION get_admin_notifications(BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_notifications(BOOLEAN) TO anon;
GRANT EXECUTE ON FUNCTION get_data_requests() TO authenticated;
GRANT EXECUTE ON FUNCTION get_data_requests() TO anon;
GRANT EXECUTE ON FUNCTION get_system_health() TO authenticated;
GRANT EXECUTE ON FUNCTION get_system_health() TO anon;
GRANT EXECUTE ON FUNCTION get_grade_distribution() TO authenticated;
GRANT EXECUTE ON FUNCTION get_grade_distribution() TO anon;
GRANT EXECUTE ON FUNCTION get_ai_vs_human_grading() TO authenticated;
GRANT EXECUTE ON FUNCTION get_ai_vs_human_grading() TO anon;
GRANT EXECUTE ON FUNCTION insert_audit_log(TEXT, TEXT, TEXT, UUID, JSONB, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION insert_audit_log(TEXT, TEXT, TEXT, UUID, JSONB, JSONB, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION create_support_ticket(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_support_ticket(UUID, TEXT, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION update_ticket_status(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION update_ticket_status(UUID, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION create_content_flag(TEXT, UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_content_flag(TEXT, UUID, TEXT, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION review_content_flag(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION review_content_flag(UUID, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION create_admin_notification(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION create_admin_notification(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO anon;
GRANT EXECUTE ON FUNCTION mark_notification_read(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_notification_read(UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_engagement_metrics(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_engagement_metrics(INTEGER) TO anon;
