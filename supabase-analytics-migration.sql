-- ============================================================
-- Analytics Functions for Mother of Math Admin Dashboard
-- Run this in Supabase SQL Editor
-- ============================================================

-- Function to get usage analytics (bypasses RLS)
CREATE OR REPLACE FUNCTION get_usage_analytics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  lesson_plans_data jsonb;
  assignments_data jsonb;
  submissions_data jsonb;
  messages_data jsonb;
  teachers_country_data jsonb;
  students_grade_data jsonb;
BEGIN
  -- Get monthly counts for lesson plans (last 12 months)
  SELECT jsonb_agg(row_to_json(t)) INTO lesson_plans_data
  FROM (
    SELECT 
      to_char(date_trunc('month', d), 'Mon YY') as month,
      count(lp.id) as count
    FROM generate_series(
      date_trunc('month', current_date) - interval '11 months',
      date_trunc('month', current_date),
      interval '1 month'
    ) d
    LEFT JOIN lesson_plans lp ON date_trunc('month', lp.created_at) = d
    GROUP BY d
    ORDER BY d
  ) t;

  -- Get monthly counts for assignments
  SELECT jsonb_agg(row_to_json(t)) INTO assignments_data
  FROM (
    SELECT 
      to_char(date_trunc('month', d), 'Mon YY') as month,
      count(a.id) as count
    FROM generate_series(
      date_trunc('month', current_date) - interval '11 months',
      date_trunc('month', current_date),
      interval '1 month'
    ) d
    LEFT JOIN assignments a ON date_trunc('month', a.created_at) = d
    GROUP BY d
    ORDER BY d
  ) t;

  -- Get monthly counts for submissions
  SELECT jsonb_agg(row_to_json(t)) INTO submissions_data
  FROM (
    SELECT 
      to_char(date_trunc('month', d), 'Mon YY') as month,
      count(s.id) as count
    FROM generate_series(
      date_trunc('month', current_date) - interval '11 months',
      date_trunc('month', current_date),
      interval '1 month'
    ) d
    LEFT JOIN assignment_submissions s ON date_trunc('month', s.submitted_at) = d
    GROUP BY d
    ORDER BY d
  ) t;

  -- Get monthly counts for chat messages
  SELECT jsonb_agg(row_to_json(t)) INTO messages_data
  FROM (
    SELECT 
      to_char(date_trunc('month', d), 'Mon YY') as month,
      count(m.id) as count
    FROM generate_series(
      date_trunc('month', current_date) - interval '11 months',
      date_trunc('month', current_date),
      interval '1 month'
    ) d
    LEFT JOIN conversation_messages m ON date_trunc('month', m.created_at) = d
    GROUP BY d
    ORDER BY d
  ) t;

  -- Get teachers by country
  SELECT jsonb_agg(row_to_json(t)) INTO teachers_country_data
  FROM (
    SELECT COALESCE(country, 'Unknown') as country, count(*) as count
    FROM profiles
    WHERE role = 'teacher'
    GROUP BY country
    ORDER BY count DESC
    LIMIT 15
  ) t;
  
  -- Get students by grade
  SELECT jsonb_agg(row_to_json(t)) INTO students_grade_data
  FROM (
    SELECT COALESCE(grade_level, 'Unknown') as grade, count(*) as count
    FROM students
    GROUP BY grade_level
    ORDER BY count DESC
  ) t;

  -- Combine everything
  result = jsonb_build_object(
    'lessonPlansByMonth', COALESCE(lesson_plans_data, '[]'::jsonb),
    'assignmentsByMonth', COALESCE(assignments_data, '[]'::jsonb),
    'submissionsByMonth', COALESCE(submissions_data, '[]'::jsonb),
    'chatMessagesByMonth', COALESCE(messages_data, '[]'::jsonb),
    'teachersByCountry', COALESCE(teachers_country_data, '[]'::jsonb),
    'studentsByGrade', COALESCE(students_grade_data, '[]'::jsonb),
    'dailyActiveUsers', '[]'::jsonb,
    'weeklyActiveUsers', '[]'::jsonb,
    'monthlyActiveUsers', '[]'::jsonb
  );
  
  RETURN result;
END;
$$;
