-- Roster: portal activity, class join codes, public enrollment requests (approval queue).

-- ═══════════════════════════════════════════════════════════
-- 1. Students: activity timestamps
-- ═══════════════════════════════════════════════════════════

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS last_portal_activity_at TIMESTAMPTZ;

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS last_submission_at TIMESTAMPTZ;

COMMENT ON COLUMN students.last_portal_activity_at IS 'Last time learner opened the portal via magic link / dashboard (RPC ping).';
COMMENT ON COLUMN students.last_submission_at IS 'Latest assignment submission time (maintained by trigger).';

-- ═══════════════════════════════════════════════════════════
-- 2. Teacher class join code (on profiles)
-- ═══════════════════════════════════════════════════════════

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS class_join_code TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_class_join_code
  ON profiles (class_join_code)
  WHERE class_join_code IS NOT NULL;

COMMENT ON COLUMN profiles.class_join_code IS 'Public code for /enroll/:code — pending requests go to approval queue.';

-- ═══════════════════════════════════════════════════════════
-- 3. Enrollment requests
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS enrollment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  full_name TEXT NOT NULL,
  grade_level TEXT NOT NULL,
  class_name TEXT,
  parent_name TEXT,
  parent_phone TEXT,
  parent_email TEXT,
  notes TEXT,
  resolved_student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_enrollment_requests_teacher_status
  ON enrollment_requests(teacher_id, status, created_at DESC);

ALTER TABLE enrollment_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teachers read own enrollment requests" ON enrollment_requests;
CREATE POLICY "Teachers read own enrollment requests" ON enrollment_requests
  FOR SELECT USING (teacher_id = auth.uid());

DROP POLICY IF EXISTS "Teachers update own enrollment requests" ON enrollment_requests;
CREATE POLICY "Teachers update own enrollment requests" ON enrollment_requests
  FOR UPDATE USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());

-- Inserts only via SECURITY DEFINER RPC (public enroll form)

-- ═══════════════════════════════════════════════════════════
-- 4. Submission → last_submission_at
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION sync_student_last_submission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE students
  SET
    last_submission_at = GREATEST(COALESCE(last_submission_at, NEW.submitted_at), NEW.submitted_at),
    updated_at = now()
  WHERE id = NEW.student_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_submission_student_last_active ON assignment_submissions;
CREATE TRIGGER trg_submission_student_last_active
  AFTER INSERT OR UPDATE OF submitted_at ON assignment_submissions
  FOR EACH ROW
  WHEN (NEW.submitted_at IS NOT NULL)
  EXECUTE PROCEDURE sync_student_last_submission();

-- ═══════════════════════════════════════════════════════════
-- 5. RPC: record portal activity (magic link / dashboard ping)
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION record_student_portal_activity(
  p_student_id UUID,
  p_access_token TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM students
    WHERE id = p_student_id
      AND access_token = p_access_token
      AND account_status = 'active'
  ) THEN
    RAISE EXCEPTION 'Invalid or inactive student';
  END IF;

  UPDATE students
  SET
    last_portal_activity_at = now(),
    updated_at = now()
  WHERE id = p_student_id;
END;
$$;

GRANT EXECUTE ON FUNCTION record_student_portal_activity(UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION record_student_portal_activity(UUID, TEXT) TO authenticated;

-- ═══════════════════════════════════════════════════════════
-- 6. RPC: public enrollment by class code
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION submit_enrollment_request(
  p_join_code TEXT,
  p_full_name TEXT,
  p_grade_level TEXT,
  p_class_name TEXT DEFAULT NULL,
  p_parent_name TEXT DEFAULT NULL,
  p_parent_phone TEXT DEFAULT NULL,
  p_parent_email TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_teacher_id UUID;
  v_id UUID;
BEGIN
  IF p_full_name IS NULL OR trim(p_full_name) = '' THEN
    RAISE EXCEPTION 'Full name is required';
  END IF;
  IF p_grade_level IS NULL OR trim(p_grade_level) = '' THEN
    RAISE EXCEPTION 'Grade level is required';
  END IF;

  SELECT id INTO v_teacher_id
  FROM profiles
  WHERE class_join_code IS NOT NULL
    AND upper(trim(class_join_code)) = upper(trim(p_join_code))
    AND role = 'teacher'
  LIMIT 1;

  IF v_teacher_id IS NULL THEN
    RAISE EXCEPTION 'Invalid class code';
  END IF;

  INSERT INTO enrollment_requests (
    teacher_id,
    full_name,
    grade_level,
    class_name,
    parent_name,
    parent_phone,
    parent_email,
    notes
  ) VALUES (
    v_teacher_id,
    trim(p_full_name),
    trim(p_grade_level),
    NULLIF(trim(COALESCE(p_class_name, '')), ''),
    NULLIF(trim(COALESCE(p_parent_name, '')), ''),
    NULLIF(trim(COALESCE(p_parent_phone, '')), ''),
    NULLIF(trim(COALESCE(p_parent_email, '')), ''),
    NULLIF(trim(COALESCE(p_notes, '')), '')
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION submit_enrollment_request(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION submit_enrollment_request(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- Backfill last_submission_at from existing submissions (one-time)
UPDATE students s
SET last_submission_at = sub.mx
FROM (
  SELECT student_id, MAX(submitted_at) AS mx
  FROM assignment_submissions
  WHERE submitted_at IS NOT NULL
  GROUP BY student_id
) sub
WHERE s.id = sub.student_id
  AND (s.last_submission_at IS NULL OR sub.mx > s.last_submission_at);
