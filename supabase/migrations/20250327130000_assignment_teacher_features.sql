-- Assignment teacher workflow: templates, rubrics, engagement, peer review,
-- instruction versions, reminder log, optional file hash on submissions.
-- Apply after supabase-schema.sql and assignment enhancements.

-- ═══════════════════════════════════════════════════════════
-- 1. Extend assignments & submissions
-- ═══════════════════════════════════════════════════════════

ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS rubric_criteria JSONB DEFAULT '[]'::jsonb;

ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS peer_review_enabled BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS reminder_48h BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS reminder_24h BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS reminder_due_day BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS reminder_parent_sms BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE assignment_submissions
  ADD COLUMN IF NOT EXISTS file_content_hash TEXT;

COMMENT ON COLUMN assignments.rubric_criteria IS 'Criteria-based grading JSON array (name, maxScore, id, description).';
COMMENT ON COLUMN assignment_submissions.file_content_hash IS 'SHA-256 of uploaded file for duplicate detection.';

-- ═══════════════════════════════════════════════════════════
-- 2. New tables
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS assignment_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title_template TEXT NOT NULL,
  description TEXT,
  instructions TEXT,
  subject TEXT NOT NULL DEFAULT 'Mathematics',
  grade_level TEXT NOT NULL DEFAULT 'Primary',
  max_score INTEGER,
  rubric_criteria JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assignment_templates_teacher
  ON assignment_templates(teacher_id);

CREATE TABLE IF NOT EXISTS saved_rubrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  criteria JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saved_rubrics_teacher ON saved_rubrics(teacher_id);

CREATE TABLE IF NOT EXISTS assignment_instruction_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assignment_instr_versions_assignment
  ON assignment_instruction_versions(assignment_id, created_at DESC);

CREATE TABLE IF NOT EXISTS assignment_student_engagement (
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  first_opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  has_draft BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (assignment_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_assignment_engagement_student
  ON assignment_student_engagement(student_id);

CREATE TABLE IF NOT EXISTS assignment_peer_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  criterion_id TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(assignment_id, student_id, criterion_id)
);

CREATE INDEX IF NOT EXISTS idx_assignment_peer_reviews_assignment
  ON assignment_peer_reviews(assignment_id);

CREATE TABLE IF NOT EXISTS assignment_reminder_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  reminder_key TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(assignment_id, student_id, reminder_key)
);

CREATE INDEX IF NOT EXISTS idx_assignment_reminder_log_assignment
  ON assignment_reminder_log(assignment_id);

-- ═══════════════════════════════════════════════════════════
-- 3. RLS
-- ═══════════════════════════════════════════════════════════

ALTER TABLE assignment_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_rubrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_instruction_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_student_engagement ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_peer_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_reminder_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teachers manage own templates" ON assignment_templates;
CREATE POLICY "Teachers manage own templates" ON assignment_templates
  FOR ALL USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());

DROP POLICY IF EXISTS "Teachers manage saved rubrics" ON saved_rubrics;
CREATE POLICY "Teachers manage saved rubrics" ON saved_rubrics
  FOR ALL USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());

DROP POLICY IF EXISTS "Teachers read instruction versions" ON assignment_instruction_versions;
DROP POLICY IF EXISTS "Teachers manage instruction versions" ON assignment_instruction_versions;
CREATE POLICY "Teachers manage instruction versions" ON assignment_instruction_versions
  FOR ALL USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());

DROP POLICY IF EXISTS "Teachers see engagement on their assignments" ON assignment_student_engagement;
CREATE POLICY "Teachers see engagement on their assignments" ON assignment_student_engagement
  FOR SELECT USING (
    assignment_id IN (SELECT id FROM assignments WHERE teacher_id = auth.uid())
  );

DROP POLICY IF EXISTS "Teachers see peer reviews on their assignments" ON assignment_peer_reviews;
CREATE POLICY "Teachers see peer reviews on their assignments" ON assignment_peer_reviews
  FOR SELECT USING (
    assignment_id IN (SELECT id FROM assignments WHERE teacher_id = auth.uid())
  );

DROP POLICY IF EXISTS "Teachers see reminder log" ON assignment_reminder_log;
CREATE POLICY "Teachers see reminder log" ON assignment_reminder_log
  FOR SELECT USING (
    assignment_id IN (SELECT id FROM assignments WHERE teacher_id = auth.uid())
  );

-- ═══════════════════════════════════════════════════════════
-- 4. SECURITY DEFINER RPCs (students: magic link + optional auth account)
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION upsert_assignment_engagement(
  p_student_id UUID,
  p_assignment_id UUID,
  p_access_token TEXT,
  p_has_draft BOOLEAN DEFAULT false
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ok BOOLEAN := false;
BEGIN
  IF EXISTS (
    SELECT 1 FROM students
    WHERE id = p_student_id
      AND access_token = p_access_token
      AND account_status = 'active'
  ) THEN
    v_ok := true;
  END IF;

  IF NOT v_ok AND EXISTS (
    SELECT 1 FROM students
    WHERE id = p_student_id
      AND auth_user_id IS NOT NULL
      AND auth_user_id = auth.uid()
      AND account_status = 'active'
  ) THEN
    v_ok := true;
  END IF;

  IF NOT v_ok THEN
    RAISE EXCEPTION 'Unauthorized engagement update';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM assignment_students
    WHERE student_id = p_student_id AND assignment_id = p_assignment_id
  ) THEN
    RAISE EXCEPTION 'Not assigned to this assignment';
  END IF;

  INSERT INTO assignment_student_engagement (
    assignment_id, student_id, first_opened_at, last_opened_at, has_draft
  ) VALUES (
    p_assignment_id, p_student_id, now(), now(), p_has_draft
  )
  ON CONFLICT (assignment_id, student_id) DO UPDATE SET
    last_opened_at = now(),
    has_draft = EXCLUDED.has_draft;
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_assignment_engagement(UUID, UUID, TEXT, BOOLEAN) TO anon;
GRANT EXECUTE ON FUNCTION upsert_assignment_engagement(UUID, UUID, TEXT, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION upsert_peer_review_by_token(
  p_student_id UUID,
  p_access_token TEXT,
  p_assignment_id UUID,
  p_criterion_id TEXT,
  p_body TEXT
)
RETURNS assignment_peer_reviews
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ok BOOLEAN := false;
  v_row assignment_peer_reviews;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM assignments WHERE id = p_assignment_id AND peer_review_enabled = true
  ) THEN
    RAISE EXCEPTION 'Peer review not enabled';
  END IF;

  IF EXISTS (
    SELECT 1 FROM students
    WHERE id = p_student_id
      AND access_token = p_access_token
      AND account_status = 'active'
  ) THEN
    v_ok := true;
  END IF;

  IF NOT v_ok AND EXISTS (
    SELECT 1 FROM students
    WHERE id = p_student_id
      AND auth_user_id IS NOT NULL
      AND auth_user_id = auth.uid()
      AND account_status = 'active'
  ) THEN
    v_ok := true;
  END IF;

  IF NOT v_ok THEN
    RAISE EXCEPTION 'Unauthorized peer review';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM assignment_students
    WHERE student_id = p_student_id AND assignment_id = p_assignment_id
  ) THEN
    RAISE EXCEPTION 'Not assigned';
  END IF;

  INSERT INTO assignment_peer_reviews (
    assignment_id, student_id, criterion_id, body, updated_at
  ) VALUES (
    p_assignment_id, p_student_id, p_criterion_id, COALESCE(p_body, ''), now()
  )
  ON CONFLICT (assignment_id, student_id, criterion_id) DO UPDATE SET
    body = EXCLUDED.body,
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_peer_review_by_token(UUID, TEXT, UUID, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION upsert_peer_review_by_token(UUID, TEXT, UUID, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION get_peer_reviews_by_token(
  p_student_id UUID,
  p_access_token TEXT,
  p_assignment_id UUID
)
RETURNS SETOF assignment_peer_reviews
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
  ) AND NOT EXISTS (
    SELECT 1 FROM students
    WHERE id = p_student_id
      AND auth_user_id IS NOT NULL
      AND auth_user_id = auth.uid()
      AND account_status = 'active'
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT pr.*
  FROM assignment_peer_reviews pr
  WHERE pr.student_id = p_student_id
    AND pr.assignment_id = p_assignment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION get_peer_reviews_by_token(UUID, TEXT, UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_peer_reviews_by_token(UUID, TEXT, UUID) TO authenticated;

-- Student read own peer reviews (auth-linked accounts)
DROP POLICY IF EXISTS "Students read own peer reviews" ON assignment_peer_reviews;
CREATE POLICY "Students read own peer reviews" ON assignment_peer_reviews
  FOR SELECT USING (
    student_id IN (SELECT id FROM students WHERE auth_user_id = auth.uid())
  );

-- Allow students to upsert via RPC only (no direct insert policy for broad anon)

-- ═══════════════════════════════════════════════════════════
-- 5. Submit RPC: optional file hash
-- ═══════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS submit_assignment_by_token(UUID, TEXT, UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION submit_assignment_by_token(
  p_student_id UUID,
  p_access_token TEXT,
  p_assignment_id UUID,
  p_notes TEXT DEFAULT NULL,
  p_file_url TEXT DEFAULT NULL,
  p_file_hash TEXT DEFAULT NULL
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
  IF NOT EXISTS (
    SELECT 1 FROM students
    WHERE id = p_student_id
      AND access_token = p_access_token
      AND account_status = 'active'
  ) THEN
    RAISE EXCEPTION 'Invalid or inactive student credentials';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM assignment_students
    WHERE student_id = p_student_id
      AND assignment_id = p_assignment_id
  ) THEN
    RAISE EXCEPTION 'You are not assigned to this assignment';
  END IF;

  SELECT * INTO v_existing
  FROM assignment_submissions
  WHERE student_id = p_student_id
    AND assignment_id = p_assignment_id
  ORDER BY submitted_at DESC
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
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
        file_content_hash = COALESCE(p_file_hash, file_content_hash)
      WHERE id = v_existing.id
      RETURNING * INTO v_submission;

      RETURN v_submission;
    ELSE
      RAISE EXCEPTION 'You have already submitted this assignment';
    END IF;
  END IF;

  INSERT INTO assignment_submissions (
    assignment_id, student_id, notes, file_url, status, file_content_hash
  )
  VALUES (
    p_assignment_id, p_student_id, p_notes, p_file_url, 'submitted', p_file_hash
  )
  RETURNING * INTO v_submission;

  RETURN v_submission;
END;
$$;

GRANT EXECUTE ON FUNCTION submit_assignment_by_token(UUID, TEXT, UUID, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION submit_assignment_by_token(UUID, TEXT, UUID, TEXT, TEXT, TEXT) TO authenticated;
