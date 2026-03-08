-- ============================================================
-- Mother of Math — Assignment Enhancements Migration
-- Run this AFTER supabase-features-migration.sql
-- Adds: extended_due_date, realtime, resubmission fix
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- 1. ADD extended_due_date TO assignment_students
-- Allows per-student deadline extensions
-- ════════════════════════════════════════════════════════════

ALTER TABLE assignment_students
  ADD COLUMN IF NOT EXISTS extended_due_date TIMESTAMPTZ;

COMMENT ON COLUMN assignment_students.extended_due_date IS
  'Per-student deadline extension. If set, overrides assignments.due_date for this student.';

-- Index for efficient lookups of extended deadlines
CREATE INDEX IF NOT EXISTS idx_assignment_students_extended
  ON assignment_students(student_id, assignment_id)
  WHERE extended_due_date IS NOT NULL;

-- ════════════════════════════════════════════════════════════
-- 2. ENABLE REALTIME ON assignment_submissions
-- Needed for live submission updates in teacher grading dialog
-- ════════════════════════════════════════════════════════════

-- Add the table to the supabase_realtime publication if not already added
-- (This enables Supabase Realtime channel subscriptions)
DO $$
BEGIN
  -- Check if the table is already in the publication
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'assignment_submissions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE assignment_submissions;
  END IF;
END;
$$;

-- Also enable realtime on notifications for live notification updates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
END;
$$;

-- ════════════════════════════════════════════════════════════
-- 3. UPDATE submit_assignment_by_token TO SUPPORT RESUBMISSION
-- When status is 'returned', allow the student to submit again
-- by updating the existing row instead of blocking
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION submit_assignment_by_token(
  p_student_id UUID,
  p_access_token TEXT,
  p_assignment_id UUID,
  p_notes TEXT DEFAULT NULL,
  p_file_url TEXT DEFAULT NULL
)
RETURNS assignment_submissions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_submission assignment_submissions;
  v_existing assignment_submissions;
BEGIN
  -- Verify student identity
  IF NOT EXISTS (
    SELECT 1 FROM students
    WHERE id = p_student_id
      AND access_token = p_access_token
      AND account_status = 'active'
  ) THEN
    RAISE EXCEPTION 'Invalid or inactive student credentials';
  END IF;

  -- Verify the student is assigned to this assignment
  IF NOT EXISTS (
    SELECT 1 FROM assignment_students
    WHERE student_id = p_student_id
      AND assignment_id = p_assignment_id
  ) THEN
    RAISE EXCEPTION 'You are not assigned to this assignment';
  END IF;

  -- Check for existing submission
  SELECT * INTO v_existing
  FROM assignment_submissions
  WHERE student_id = p_student_id
    AND assignment_id = p_assignment_id
  ORDER BY submitted_at DESC
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    -- If status is 'returned', allow resubmission by updating the existing row
    IF v_existing.status = 'returned' THEN
      UPDATE assignment_submissions
      SET
        file_url = COALESCE(p_file_url, file_url),
        notes = COALESCE(p_notes, notes),
        status = 'submitted',
        submitted_at = now(),
        score = NULL,
        teacher_feedback = NULL,
        graded_at = NULL,
        ai_score = NULL,
        ai_feedback = NULL,
        ai_graded_at = NULL,
        resubmission_count = COALESCE(resubmission_count, 0) + 1
      WHERE id = v_existing.id
      RETURNING * INTO v_submission;

      RETURN v_submission;
    ELSE
      RAISE EXCEPTION 'You have already submitted this assignment';
    END IF;
  END IF;

  -- New submission
  INSERT INTO assignment_submissions (assignment_id, student_id, notes, file_url, status)
  VALUES (p_assignment_id, p_student_id, p_notes, p_file_url, 'submitted')
  RETURNING * INTO v_submission;

  RETURN v_submission;
END;
$$;

-- ════════════════════════════════════════════════════════════
-- 4. HELPER: Get effective due date for a student
-- Returns extended_due_date if set, otherwise assignments.due_date
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_effective_due_date(
  p_assignment_id UUID,
  p_student_id UUID
)
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT extended_due_date
     FROM assignment_students
     WHERE assignment_id = p_assignment_id
       AND student_id = p_student_id
       AND extended_due_date IS NOT NULL),
    (SELECT due_date
     FROM assignments
     WHERE id = p_assignment_id)
  );
$$;

-- ════════════════════════════════════════════════════════════
-- 5. UPDATE get_published_assignments_by_token
-- Include extended_due_date awareness (still returns assignments
-- type, but teacher/student code can call get_effective_due_date)
-- ════════════════════════════════════════════════════════════

-- No changes needed to the function itself — the extension is
-- stored on assignment_students and resolved client-side or
-- via the get_effective_due_date helper above.

-- ════════════════════════════════════════════════════════════
-- DONE
-- ════════════════════════════════════════════════════════════
