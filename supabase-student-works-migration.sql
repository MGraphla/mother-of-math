-- ================================================================
-- Migration: Link student_works to students table
-- Run this SQL in your Supabase dashboard → SQL Editor
-- ================================================================

-- 1. Add student_id column to student_works (if not already present)
ALTER TABLE student_works
  ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES students(id) ON DELETE SET NULL;

-- 2. Index for fast lookups by student
CREATE INDEX IF NOT EXISTS idx_student_works_student_id
  ON student_works (student_id);

-- ================================================================
-- 3. Secure RPC function: students can fetch their own AI feedback
--    using their access_token (magic-link session token).
--    This function runs as SECURITY DEFINER so it bypasses RLS.
-- ================================================================

CREATE OR REPLACE FUNCTION get_works_for_student(p_access_token TEXT)
RETURNS SETOF student_works
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id UUID;
BEGIN
  -- Verify the token and get the student id
  SELECT id INTO v_student_id
  FROM students
  WHERE access_token = p_access_token
    AND account_status = 'active';

  -- If token is invalid or student is inactive, return nothing
  IF v_student_id IS NULL THEN
    RETURN;
  END IF;

  -- Return all works linked to this student, newest first
  RETURN QUERY
    SELECT *
    FROM student_works
    WHERE student_id = v_student_id
    ORDER BY created_at DESC;
END;
$$;

-- 4. Grant execute permission to anonymous and authenticated roles
GRANT EXECUTE ON FUNCTION get_works_for_student(TEXT) TO anon, authenticated;

-- ================================================================
-- Notes:
-- • The application code falls back to querying by student_name
--   if this function is not yet deployed (so it works before migration).
-- • After running this migration, teacher uploads will save student_id
--   when the teacher selects a student from the dropdown.
-- ================================================================
