-- ============================================================
-- Mother of Math — Student Management Schema
-- Run this in Supabase SQL Editor to create all required tables
-- ============================================================

-- Drop existing constraints if re-running (fix for old CHECK constraints)
ALTER TABLE IF EXISTS students DROP CONSTRAINT IF EXISTS students_gender_check;
ALTER TABLE IF EXISTS students DROP CONSTRAINT IF EXISTS students_account_status_check;

-- 1. STUDENTS TABLE — comprehensive student records
CREATE TABLE IF NOT EXISTS students (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Authentication & Identification
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  access_token TEXT UNIQUE NOT NULL,
  student_code TEXT UNIQUE,  -- Auto-generated coded ID (e.g. MOM-2026-0001)
  account_status TEXT NOT NULL DEFAULT 'active' CHECK (account_status IN ('active', 'paused', 'suspended')),

  -- Basic Information
  full_name TEXT NOT NULL,
  date_of_birth DATE,
  gender TEXT,
  nationality TEXT,
  place_of_birth TEXT,
  home_language TEXT,

  -- Contact & Guardian
  parent_name TEXT,
  parent_phone TEXT,
  parent_email TEXT,
  parent_relationship TEXT,
  home_address TEXT,

  -- School Information
  school_name TEXT,
  grade_level TEXT NOT NULL,
  class_name TEXT,
  admission_number TEXT,
  academic_year TEXT,

  -- Health & Needs
  blood_group TEXT,
  medical_conditions TEXT,
  allergies TEXT,
  special_needs TEXT,
  disability_status TEXT,

  -- Additional
  previous_school TEXT,
  profile_photo_url TEXT,
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── Migration: add columns that may not exist on older installs ──────────────
DO $$
BEGIN
  -- student_code (unique coded ID, e.g. MOM-2026-0001)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'students' AND column_name = 'student_code'
  ) THEN
    ALTER TABLE students ADD COLUMN student_code TEXT UNIQUE;
  END IF;

  -- AI grading fields on assignment_submissions
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assignment_submissions' AND column_name = 'ai_score'
  ) THEN
    ALTER TABLE assignment_submissions ADD COLUMN ai_score NUMERIC;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assignment_submissions' AND column_name = 'ai_feedback'
  ) THEN
    ALTER TABLE assignment_submissions ADD COLUMN ai_feedback TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assignment_submissions' AND column_name = 'ai_graded_at'
  ) THEN
    ALTER TABLE assignment_submissions ADD COLUMN ai_graded_at TIMESTAMPTZ;
  END IF;
END;
$$;

-- Index for fast teacher lookups
CREATE INDEX IF NOT EXISTS idx_students_teacher_id ON students(teacher_id);
CREATE INDEX IF NOT EXISTS idx_students_access_token ON students(access_token);
CREATE INDEX IF NOT EXISTS idx_students_auth_user_id ON students(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_students_student_code ON students(student_code);

-- Sequence for auto-incrementing student codes
CREATE SEQUENCE IF NOT EXISTS student_code_seq START 1;

-- Trigger: auto-generate student_code on INSERT if not provided
CREATE OR REPLACE FUNCTION generate_student_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_year TEXT;
  v_seq INT;
BEGIN
  IF NEW.student_code IS NULL OR NEW.student_code = '' THEN
    v_year := to_char(now(), 'YYYY');
    v_seq  := nextval('student_code_seq');
    NEW.student_code := 'MOM-' || v_year || '-' || lpad(v_seq::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_student_code ON students;
CREATE TRIGGER trg_student_code
  BEFORE INSERT ON students
  FOR EACH ROW
  EXECUTE FUNCTION generate_student_code();

-- Backfill existing students that have no student_code
DO $$
DECLARE
  r RECORD;
  v_year TEXT;
  v_seq INT;
BEGIN
  v_year := to_char(now(), 'YYYY');
  FOR r IN SELECT id FROM students WHERE student_code IS NULL ORDER BY created_at ASC
  LOOP
    v_seq := nextval('student_code_seq');
    UPDATE students SET student_code = 'MOM-' || v_year || '-' || lpad(v_seq::TEXT, 4, '0') WHERE id = r.id;
  END LOOP;
END;
$$;

-- 2. ASSIGNMENTS TABLE
CREATE TABLE IF NOT EXISTS assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  subject TEXT NOT NULL DEFAULT 'Mathematics',
  grade_level TEXT NOT NULL,
  due_date TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft', 'closed')),
  max_score NUMERIC,
  instructions TEXT,
  attachment_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assignments_teacher_id ON assignments(teacher_id);

-- 3. ASSIGNMENT-STUDENT LINK (which students an assignment is assigned to)
CREATE TABLE IF NOT EXISTS assignment_students (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  UNIQUE(assignment_id, student_id)
);

-- 4. ASSIGNMENT SUBMISSIONS
CREATE TABLE IF NOT EXISTS assignment_submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  file_url TEXT,
  notes TEXT,
  score NUMERIC,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'graded', 'returned')),
  teacher_feedback TEXT,
  submitted_at TIMESTAMPTZ DEFAULT now(),
  graded_at TIMESTAMPTZ,

  -- AI auto-grading fields (populated by Gemini vision analysis)
  ai_score NUMERIC,
  ai_feedback TEXT,
  ai_graded_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_submissions_assignment ON assignment_submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student ON assignment_submissions(student_id);

-- 5. ROW LEVEL SECURITY
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_submissions ENABLE ROW LEVEL SECURITY;

-- ── SECURITY DEFINER HELPERS (break RLS recursion) ───────────────────────────
-- These functions bypass RLS so that policies on table A can safely
-- look up IDs in table B without triggering B's policies (which would
-- look back at A, causing infinite recursion and a 500 error).

-- Returns assignment IDs owned by a given teacher (used by assignment_students policies)
CREATE OR REPLACE FUNCTION get_teacher_assignment_ids(p_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT id FROM assignments WHERE teacher_id = p_user_id;
$$;

-- Returns student IDs that belong to a given auth user (used by assignment_students policies)
CREATE OR REPLACE FUNCTION get_student_ids_for_user(p_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT id FROM students WHERE auth_user_id = p_user_id;
$$;

-- Returns assignment IDs that a given auth-user's student records are linked to
-- (used by assignments "Students read assigned work" policy)
CREATE OR REPLACE FUNCTION get_student_assignment_ids_for_user(p_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT ast.assignment_id
  FROM assignment_students ast
  JOIN students s ON s.id = ast.student_id
  WHERE s.auth_user_id = p_user_id;
$$;

-- Drop existing policies if they exist (for re-running)
DROP POLICY IF EXISTS "Allow read access for authenticated" ON students;
DROP POLICY IF EXISTS "Anon read students" ON students;
DROP POLICY IF EXISTS "Teachers manage own students" ON students;
DROP POLICY IF EXISTS "Teachers update own students" ON students;
DROP POLICY IF EXISTS "Teachers delete own students" ON students;
DROP POLICY IF EXISTS "Students read own record" ON students;
DROP POLICY IF EXISTS "Teachers manage own assignments" ON assignments;
DROP POLICY IF EXISTS "Students read assigned work" ON assignments;
DROP POLICY IF EXISTS "Anon read assignments" ON assignments;
DROP POLICY IF EXISTS "Teachers manage assignment links" ON assignment_students;
DROP POLICY IF EXISTS "Students read own links" ON assignment_students;
DROP POLICY IF EXISTS "Anon read assignment_students" ON assignment_students;
DROP POLICY IF EXISTS "Teachers manage submissions" ON assignment_submissions;
DROP POLICY IF EXISTS "Students manage own submissions" ON assignment_submissions;
DROP POLICY IF EXISTS "Anon read submissions" ON assignment_submissions;
DROP POLICY IF EXISTS "Anon insert submissions" ON assignment_submissions;

-- ── STUDENTS TABLE POLICIES ──────────────────────────

-- Anyone can read students (needed for token-based magic link access)
CREATE POLICY "Allow read access for authenticated" ON students
  FOR SELECT USING (true);

-- Anon can also read students (magic link students aren't authenticated)
CREATE POLICY "Anon read students" ON students
  FOR SELECT TO anon USING (true);

-- Teachers can insert/update/delete their own students
CREATE POLICY "Teachers manage own students" ON students
  FOR INSERT WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Teachers update own students" ON students
  FOR UPDATE USING (teacher_id = auth.uid());

CREATE POLICY "Teachers delete own students" ON students
  FOR DELETE USING (teacher_id = auth.uid());

-- ── ASSIGNMENTS TABLE POLICIES ───────────────────────

-- Teachers full CRUD on their own assignments
CREATE POLICY "Teachers manage own assignments" ON assignments
  FOR ALL USING (teacher_id = auth.uid());

-- Authenticated students can read assignments assigned to them
-- Uses a SECURITY DEFINER helper to avoid infinite recursion with assignment_students policies
CREATE POLICY "Students read assigned work" ON assignments
  FOR SELECT USING (
    id IN (SELECT * FROM get_student_assignment_ids_for_user(auth.uid()))
  );

-- Anon users (magic link students) can read active assignments
CREATE POLICY "Anon read assignments" ON assignments
  FOR SELECT TO anon USING (status = 'active');

-- ── ASSIGNMENT-STUDENT LINK POLICIES ─────────────────

-- Teachers manage links for their assignments
-- Uses a SECURITY DEFINER helper to avoid infinite recursion with assignments policies
CREATE POLICY "Teachers manage assignment links" ON assignment_students
  FOR ALL USING (
    assignment_id IN (SELECT * FROM get_teacher_assignment_ids(auth.uid()))
  );

-- Authenticated students read their assignment links
-- Uses a SECURITY DEFINER helper to avoid infinite recursion
CREATE POLICY "Students read own links" ON assignment_students
  FOR SELECT USING (
    student_id IN (SELECT * FROM get_student_ids_for_user(auth.uid()))
  );

-- Anon users (magic link students) can read their assignment links
CREATE POLICY "Anon read assignment_students" ON assignment_students
  FOR SELECT TO anon USING (true);

-- ── SUBMISSION POLICIES ──────────────────────────────

-- Teachers manage submissions for their assignments (uses helper to avoid recursion)
CREATE POLICY "Teachers manage submissions" ON assignment_submissions
  FOR ALL USING (
    assignment_id IN (SELECT * FROM get_teacher_assignment_ids(auth.uid()))
  );

-- Authenticated students manage their own submissions (uses helper to avoid recursion)
CREATE POLICY "Students manage own submissions" ON assignment_submissions
  FOR ALL USING (
    student_id IN (SELECT * FROM get_student_ids_for_user(auth.uid()))
  );

-- Anon users (magic link students) can read submissions
CREATE POLICY "Anon read submissions" ON assignment_submissions
  FOR SELECT TO anon USING (true);

-- Anon users (magic link students) can submit assignments
-- Only if the student exists and is active
CREATE POLICY "Anon insert submissions" ON assignment_submissions
  FOR INSERT TO anon
  WITH CHECK (
    student_id IN (SELECT id FROM students WHERE account_status = 'active')
  );

-- ============================================================
-- 6. SECURE RPC FUNCTIONS (for magic-link student operations)
-- These use SECURITY DEFINER to bypass RLS when the student
-- verifies their identity via access_token.
-- ============================================================

-- Function: Get assignments for a magic-link student (verified by token)
CREATE OR REPLACE FUNCTION get_student_assignments_by_token(
  p_student_id UUID,
  p_access_token TEXT
)
RETURNS SETOF assignments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  RETURN QUERY
    SELECT a.*
    FROM assignments a
    JOIN assignment_students ast ON ast.assignment_id = a.id
    WHERE ast.student_id = p_student_id
      AND a.status = 'active'
    ORDER BY a.due_date ASC;
END;
$$;

-- Function: Get submissions for a magic-link student (verified by token)
CREATE OR REPLACE FUNCTION get_student_submissions_by_token(
  p_student_id UUID,
  p_access_token TEXT
)
RETURNS SETOF assignment_submissions
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
    RAISE EXCEPTION 'Invalid or inactive student credentials';
  END IF;

  RETURN QUERY
    SELECT *
    FROM assignment_submissions
    WHERE student_id = p_student_id
    ORDER BY submitted_at DESC;
END;
$$;

-- Function: Submit an assignment for a magic-link student (verified by token)
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

  -- Check for duplicate submission
  IF EXISTS (
    SELECT 1 FROM assignment_submissions
    WHERE student_id = p_student_id
      AND assignment_id = p_assignment_id
  ) THEN
    RAISE EXCEPTION 'You have already submitted this assignment';
  END IF;

  INSERT INTO assignment_submissions (assignment_id, student_id, notes, file_url, status)
  VALUES (p_assignment_id, p_student_id, p_notes, p_file_url, 'submitted')
  RETURNING * INTO v_submission;

  RETURN v_submission;
END;
$$;

-- Function: Refresh student session data by token
CREATE OR REPLACE FUNCTION get_student_by_token_secure(p_access_token TEXT)
RETURNS SETOF students
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT * FROM students
    WHERE access_token = p_access_token
      AND account_status != 'suspended'
    LIMIT 1;
END;
$$;
