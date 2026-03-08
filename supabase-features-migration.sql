-- ============================================================
-- Mother of Math — Feature Enhancements Migration
-- Run this AFTER supabase-schema.sql to add new features
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- 1. ASSIGNMENT ENHANCEMENTS (Topics, Practice Mode, Scheduling)
-- ════════════════════════════════════════════════════════════

-- Add new columns to assignments table
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS topic TEXT;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard'));
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS is_practice BOOLEAN DEFAULT false;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS publish_at TIMESTAMPTZ;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS allow_late_submission BOOLEAN DEFAULT true;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS enable_tts BOOLEAN DEFAULT false; -- Text-to-speech for instructions

-- Index for topic filtering
CREATE INDEX IF NOT EXISTS idx_assignments_topic ON assignments(topic);
CREATE INDEX IF NOT EXISTS idx_assignments_is_practice ON assignments(is_practice);

-- ════════════════════════════════════════════════════════════
-- 2. SUBMISSION ENHANCEMENTS (Resubmission, Voice Feedback)
-- ════════════════════════════════════════════════════════════

-- Add resubmission columns
ALTER TABLE assignment_submissions ADD COLUMN IF NOT EXISTS resubmission_allowed BOOLEAN DEFAULT false;
ALTER TABLE assignment_submissions ADD COLUMN IF NOT EXISTS resubmission_count INTEGER DEFAULT 0;
ALTER TABLE assignment_submissions ADD COLUMN IF NOT EXISTS original_submission_id UUID REFERENCES assignment_submissions(id);
ALTER TABLE assignment_submissions ADD COLUMN IF NOT EXISTS teacher_audio_feedback_url TEXT;

-- ════════════════════════════════════════════════════════════
-- 3. COMMENTS / DISCUSSION THREAD
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS assignment_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES assignment_comments(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_private BOOLEAN DEFAULT false,
  file_url TEXT,
  file_name TEXT,
  file_type TEXT,
  reactions JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comments_assignment ON assignment_comments(assignment_id);
CREATE INDEX IF NOT EXISTS idx_comments_student ON assignment_comments(student_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON assignment_comments(parent_comment_id);

-- RLS for comments
ALTER TABLE assignment_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teachers manage comments on their assignments" ON assignment_comments;
DROP POLICY IF EXISTS "Students read public comments" ON assignment_comments;
DROP POLICY IF EXISTS "Students create comments" ON assignment_comments;
DROP POLICY IF EXISTS "Anon read comments" ON assignment_comments;
DROP POLICY IF EXISTS "Anon create comments" ON assignment_comments;

CREATE POLICY "Teachers manage comments on their assignments" ON assignment_comments
  FOR ALL USING (
    assignment_id IN (SELECT * FROM get_teacher_assignment_ids(auth.uid()))
    OR teacher_id = auth.uid()
  );

CREATE POLICY "Students read public comments" ON assignment_comments
  FOR SELECT USING (
    is_private = false 
    OR student_id IN (SELECT * FROM get_student_ids_for_user(auth.uid()))
  );

CREATE POLICY "Students create comments" ON assignment_comments
  FOR INSERT WITH CHECK (
    student_id IN (SELECT * FROM get_student_ids_for_user(auth.uid()))
  );

CREATE POLICY "Anon read comments" ON assignment_comments
  FOR SELECT TO anon USING (is_private = false);

CREATE POLICY "Anon create comments" ON assignment_comments
  FOR INSERT TO anon WITH CHECK (student_id IS NOT NULL);

-- ════════════════════════════════════════════════════════════
-- 3b. COMMENT REACTIONS TABLE (Fix for missing table error)
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS comment_reactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id UUID NOT NULL REFERENCES assignment_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(comment_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_comment_reactions_comment ON comment_reactions(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_reactions_user ON comment_reactions(user_id);

-- RLS for comment_reactions
ALTER TABLE comment_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own reactions" ON comment_reactions;
DROP POLICY IF EXISTS "Everyone reads reactions" ON comment_reactions;
DROP POLICY IF EXISTS "Anon reads reactions" ON comment_reactions;

CREATE POLICY "Users manage own reactions" ON comment_reactions
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Everyone reads reactions" ON comment_reactions
  FOR SELECT USING (true);

CREATE POLICY "Anon reads reactions" ON comment_reactions
  FOR SELECT TO anon USING (true);

-- ════════════════════════════════════════════════════════════
-- 4. NOTIFICATIONS SYSTEM
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  recipient_teacher_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'assignment_due', 'graded', 'new_assignment', 'comment', 'resubmit_request', 'announcement'
  title TEXT NOT NULL,
  message TEXT,
  link_url TEXT,
  related_assignment_id UUID REFERENCES assignments(id) ON DELETE CASCADE,
  related_submission_id UUID REFERENCES assignment_submissions(id) ON DELETE CASCADE,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_student ON notifications(recipient_student_id);
CREATE INDEX IF NOT EXISTS idx_notifications_teacher ON notifications(recipient_teacher_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);

-- RLS for notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own notifications" ON notifications;
DROP POLICY IF EXISTS "Teachers create notifications" ON notifications;
DROP POLICY IF EXISTS "Teachers update notifications" ON notifications;
DROP POLICY IF EXISTS "System creates notifications" ON notifications;
DROP POLICY IF EXISTS "Anon read student notifications" ON notifications;
DROP POLICY IF EXISTS "Anon update notifications" ON notifications;

CREATE POLICY "Users read own notifications" ON notifications
  FOR SELECT USING (
    recipient_teacher_id = auth.uid()
    OR recipient_student_id IN (SELECT * FROM get_student_ids_for_user(auth.uid()))
  );

CREATE POLICY "Teachers create notifications" ON notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Teachers update notifications" ON notifications
  FOR UPDATE USING (
    recipient_teacher_id = auth.uid()
    OR recipient_student_id IN (SELECT * FROM get_student_ids_for_user(auth.uid()))
  );

CREATE POLICY "Anon read student notifications" ON notifications
  FOR SELECT TO anon USING (recipient_student_id IS NOT NULL);

CREATE POLICY "Anon update notifications" ON notifications
  FOR UPDATE TO anon USING (recipient_student_id IS NOT NULL);

-- ════════════════════════════════════════════════════════════
-- 5. ANNOUNCEMENTS
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS announcements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  target_grade_level TEXT, -- NULL = all grades
  target_class_name TEXT, -- NULL = all classes
  is_pinned BOOLEAN DEFAULT false,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  category TEXT DEFAULT 'general',
  scheduled_for TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_announcements_teacher ON announcements(teacher_id);
CREATE INDEX IF NOT EXISTS idx_announcements_pinned ON announcements(is_pinned);

CREATE TABLE IF NOT EXISTS announcement_reads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  is_bookmarked BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(announcement_id, student_id)
);

-- RLS for announcements
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teachers manage own announcements" ON announcements;
DROP POLICY IF EXISTS "Everyone reads announcements" ON announcements;
DROP POLICY IF EXISTS "Anon reads announcements" ON announcements;
DROP POLICY IF EXISTS "Students manage own reads" ON announcement_reads;
DROP POLICY IF EXISTS "Teachers read announcement reads" ON announcement_reads;
DROP POLICY IF EXISTS "Anon manage reads" ON announcement_reads;

CREATE POLICY "Teachers manage own announcements" ON announcements
  FOR ALL USING (teacher_id = auth.uid());

CREATE POLICY "Everyone reads announcements" ON announcements
  FOR SELECT USING (true);

CREATE POLICY "Anon reads announcements" ON announcements
  FOR SELECT TO anon USING (true);

CREATE POLICY "Students manage own reads" ON announcement_reads
  FOR ALL USING (
    student_id IN (SELECT * FROM get_student_ids_for_user(auth.uid()))
  );

CREATE POLICY "Teachers read announcement reads" ON announcement_reads
  FOR SELECT USING (
    announcement_id IN (SELECT id FROM announcements WHERE teacher_id = auth.uid())
  );

CREATE POLICY "Anon manage reads" ON announcement_reads
  FOR ALL TO anon USING (true);

-- ════════════════════════════════════════════════════════════
-- 6. RESOURCE LIBRARY
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS resources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  file_type TEXT, -- 'pdf', 'image', 'video', 'link', 'document'
  thumbnail_url TEXT,
  topic TEXT,
  grade_level TEXT,
  is_public BOOLEAN DEFAULT false, -- Shared across all teachers
  download_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS student_resource_activity (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  is_favorite BOOLEAN DEFAULT false,
  progress INTEGER DEFAULT 0, -- 0-100
  last_viewed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(resource_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_student_resource_activity_student ON student_resource_activity(student_id);

-- RLS for student_resource_activity
ALTER TABLE student_resource_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students manage own resource activity" ON student_resource_activity;
CREATE POLICY "Students manage own resource activity" ON student_resource_activity
  FOR ALL USING (
    student_id IN (SELECT * FROM get_student_ids_for_user(auth.uid()))
  );

CREATE INDEX IF NOT EXISTS idx_resources_teacher ON resources(teacher_id);
CREATE INDEX IF NOT EXISTS idx_resources_topic ON resources(topic);
CREATE INDEX IF NOT EXISTS idx_resources_grade ON resources(grade_level);

-- RLS for resources
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teachers manage own resources" ON resources;
DROP POLICY IF EXISTS "Everyone reads resources" ON resources;
DROP POLICY IF EXISTS "Anon reads resources" ON resources;

CREATE POLICY "Teachers manage own resources" ON resources
  FOR ALL USING (teacher_id = auth.uid());

CREATE POLICY "Everyone reads resources" ON resources
  FOR SELECT USING (true);

CREATE POLICY "Anon reads resources" ON resources
  FOR SELECT TO anon USING (true);

-- ════════════════════════════════════════════════════════════
-- 7. HELPER FUNCTIONS
-- ════════════════════════════════════════════════════════════

-- Function: Create notification (SECURITY DEFINER for anon access)
CREATE OR REPLACE FUNCTION create_notification(
  p_recipient_student_id UUID DEFAULT NULL,
  p_recipient_teacher_id UUID DEFAULT NULL,
  p_type TEXT DEFAULT 'general',
  p_title TEXT DEFAULT '',
  p_message TEXT DEFAULT NULL,
  p_link_url TEXT DEFAULT NULL,
  p_related_assignment_id UUID DEFAULT NULL,
  p_related_submission_id UUID DEFAULT NULL
)
RETURNS notifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification notifications;
BEGIN
  INSERT INTO notifications (
    recipient_student_id,
    recipient_teacher_id,
    type,
    title,
    message,
    link_url,
    related_assignment_id,
    related_submission_id
  ) VALUES (
    p_recipient_student_id,
    p_recipient_teacher_id,
    p_type,
    p_title,
    p_message,
    p_link_url,
    p_related_assignment_id,
    p_related_submission_id
  ) RETURNING * INTO v_notification;
  
  RETURN v_notification;
END;
$$;

-- Function: Mark notification as read
CREATE OR REPLACE FUNCTION mark_notification_read(p_notification_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE notifications SET is_read = true WHERE id = p_notification_id;
END;
$$;

-- Function: Get student notifications by token
CREATE OR REPLACE FUNCTION get_student_notifications_by_token(
  p_student_id UUID,
  p_access_token TEXT,
  p_limit INTEGER DEFAULT 50
)
RETURNS SETOF notifications
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
    SELECT * FROM notifications
    WHERE recipient_student_id = p_student_id
    ORDER BY created_at DESC
    LIMIT p_limit;
END;
$$;

-- Function: Get comments for an assignment (with token verification)
CREATE OR REPLACE FUNCTION get_assignment_comments_by_token(
  p_student_id UUID,
  p_access_token TEXT,
  p_assignment_id UUID
)
RETURNS TABLE (
  id UUID,
  assignment_id UUID,
  student_id UUID,
  teacher_id UUID,
  parent_comment_id UUID,
  message TEXT,
  is_private BOOLEAN,
  created_at TIMESTAMPTZ,
  author_name TEXT,
  is_teacher BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM students
    WHERE students.id = p_student_id
      AND access_token = p_access_token
      AND account_status = 'active'
  ) THEN
    RAISE EXCEPTION 'Invalid or inactive student credentials';
  END IF;

  RETURN QUERY
    SELECT 
      c.id,
      c.assignment_id,
      c.student_id,
      c.teacher_id,
      c.parent_comment_id,
      c.message,
      c.is_private,
      c.created_at,
      CASE 
        WHEN c.student_id IS NOT NULL THEN s.full_name
        ELSE 'Teacher'
      END AS author_name,
      c.teacher_id IS NOT NULL AS is_teacher
    FROM assignment_comments c
    LEFT JOIN students s ON s.id = c.student_id
    WHERE c.assignment_id = p_assignment_id
      AND (c.is_private = false OR c.student_id = p_student_id)
    ORDER BY c.created_at ASC;
END;
$$;

-- Function: Add comment for a magic-link student
CREATE OR REPLACE FUNCTION add_comment_by_token(
  p_student_id UUID,
  p_access_token TEXT,
  p_assignment_id UUID,
  p_message TEXT,
  p_parent_comment_id UUID DEFAULT NULL
)
RETURNS assignment_comments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_comment assignment_comments;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM students
    WHERE id = p_student_id
      AND access_token = p_access_token
      AND account_status = 'active'
  ) THEN
    RAISE EXCEPTION 'Invalid or inactive student credentials';
  END IF;

  INSERT INTO assignment_comments (assignment_id, student_id, message, parent_comment_id)
  VALUES (p_assignment_id, p_student_id, p_message, p_parent_comment_id)
  RETURNING * INTO v_comment;

  RETURN v_comment;
END;
$$;

-- Function: Request resubmission (teacher action)
CREATE OR REPLACE FUNCTION request_resubmission(
  p_submission_id UUID,
  p_feedback TEXT DEFAULT NULL
)
RETURNS assignment_submissions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_submission assignment_submissions;
BEGIN
  UPDATE assignment_submissions
  SET 
    resubmission_allowed = true,
    teacher_feedback = COALESCE(p_feedback, teacher_feedback),
    status = 'returned'
  WHERE id = p_submission_id
  RETURNING * INTO v_submission;

  -- Create notification for student
  INSERT INTO notifications (
    recipient_student_id,
    type,
    title,
    message,
    related_submission_id,
    related_assignment_id
  )
  SELECT 
    v_submission.student_id,
    'resubmit_request',
    'Resubmission Requested',
    'Your teacher has requested you to resubmit your work: ' || COALESCE(p_feedback, ''),
    v_submission.id,
    v_submission.assignment_id;

  RETURN v_submission;
END;
$$;

-- Function: Resubmit assignment by token
CREATE OR REPLACE FUNCTION resubmit_assignment_by_token(
  p_student_id UUID,
  p_access_token TEXT,
  p_original_submission_id UUID,
  p_notes TEXT DEFAULT NULL,
  p_file_url TEXT DEFAULT NULL
)
RETURNS assignment_submissions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_original assignment_submissions;
  v_new_submission assignment_submissions;
BEGIN
  -- Verify student
  IF NOT EXISTS (
    SELECT 1 FROM students
    WHERE id = p_student_id
      AND access_token = p_access_token
      AND account_status = 'active'
  ) THEN
    RAISE EXCEPTION 'Invalid or inactive student credentials';
  END IF;

  -- Get original submission and verify it allows resubmission
  SELECT * INTO v_original FROM assignment_submissions
  WHERE id = p_original_submission_id
    AND student_id = p_student_id
    AND resubmission_allowed = true;

  IF v_original IS NULL THEN
    RAISE EXCEPTION 'Resubmission not allowed for this submission';
  END IF;

  -- Mark original as no longer allowing resubmission
  UPDATE assignment_submissions
  SET resubmission_allowed = false
  WHERE id = p_original_submission_id;

  -- Create new submission linked to original
  INSERT INTO assignment_submissions (
    assignment_id,
    student_id,
    file_url,
    notes,
    status,
    original_submission_id,
    resubmission_count
  ) VALUES (
    v_original.assignment_id,
    p_student_id,
    p_file_url,
    p_notes,
    'submitted',
    p_original_submission_id,
    v_original.resubmission_count + 1
  ) RETURNING * INTO v_new_submission;

  RETURN v_new_submission;
END;
$$;

-- Function: Get published assignments only (respects publish_at)
CREATE OR REPLACE FUNCTION get_published_assignments_by_token(
  p_student_id UUID,
  p_access_token TEXT
)
RETURNS SETOF assignments
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
    SELECT a.*
    FROM assignments a
    JOIN assignment_students ast ON ast.assignment_id = a.id
    WHERE ast.student_id = p_student_id
      AND a.status = 'active'
      AND (a.publish_at IS NULL OR a.publish_at <= now())
    ORDER BY a.due_date ASC;
END;
$$;

-- Function: Mark announcement as read
CREATE OR REPLACE FUNCTION mark_announcement_read_by_token(
  p_student_id UUID,
  p_access_token TEXT,
  p_announcement_id UUID
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
    RAISE EXCEPTION 'Invalid or inactive student credentials';
  END IF;

  INSERT INTO announcement_reads (announcement_id, student_id)
  VALUES (p_announcement_id, p_student_id)
  ON CONFLICT (announcement_id, student_id) DO NOTHING;
END;
$$;

-- ════════════════════════════════════════════════════════════
-- 8. AUTO-NOTIFICATION TRIGGERS
-- ════════════════════════════════════════════════════════════

-- Trigger: Notify students when new assignment is created (Student added to active assignment)
CREATE OR REPLACE FUNCTION notify_new_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_assignment assignments;
BEGIN
  -- Fetch assignment details
  SELECT * INTO v_assignment FROM assignments WHERE id = NEW.assignment_id;

  -- Only notify if assignment is active and published
  IF v_assignment.status = 'active' AND (v_assignment.publish_at IS NULL OR v_assignment.publish_at <= now()) THEN
    INSERT INTO notifications (recipient_student_id, type, title, message, link_url, related_assignment_id)
    VALUES (
      NEW.student_id,
      'new_assignment',
      'New Assignment: ' || v_assignment.title,
      'You have a new assignment in ' || v_assignment.subject || '. Due: ' || to_char(v_assignment.due_date, 'Mon DD, YYYY'),
      '/student/assignments',
      v_assignment.id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_assignment ON assignment_students;
CREATE TRIGGER trg_notify_new_assignment
  AFTER INSERT ON assignment_students
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_assignment();

-- Trigger: Notify students when assignment becomes active/published
CREATE OR REPLACE FUNCTION notify_published_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Notify students if assignment just became active/published
  -- Case 1: Status changed to 'active'
  -- Case 2: publish_at time arrived (handled by cron usually, but if updated manually to now)
  -- Case 3: publish_at was future, now set to NULL or past
  
  IF (NEW.status = 'active' AND (OLD.status IS NULL OR OLD.status != 'active')) 
     OR (NEW.status = 'active' AND OLD.publish_at > now() AND (NEW.publish_at IS NULL OR NEW.publish_at <= now())) THEN
    
    INSERT INTO notifications (recipient_student_id, type, title, message, link_url, related_assignment_id)
    SELECT 
      ast.student_id,
      'new_assignment',
      'New Assignment: ' || NEW.title,
      'You have a new assignment in ' || NEW.subject || '. Due: ' || to_char(NEW.due_date, 'Mon DD, YYYY'),
      '/student/assignments',
      NEW.id
    FROM assignment_students ast
    WHERE ast.assignment_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_assignment_publish ON assignments;
CREATE TRIGGER trg_notify_assignment_publish
  AFTER UPDATE ON assignments
  FOR EACH ROW
  EXECUTE FUNCTION notify_published_assignment();

-- Trigger: Notify student when submission is graded
CREATE OR REPLACE FUNCTION notify_submission_graded()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'graded' AND (OLD.status IS NULL OR OLD.status != 'graded') THEN
    INSERT INTO notifications (recipient_student_id, type, title, message, link_url, related_submission_id, related_assignment_id)
    SELECT 
      NEW.student_id,
      'graded',
      'Assignment Graded!',
      'Your submission has been graded. Score: ' || COALESCE(NEW.score::TEXT, 'N/A'),
      '/student/assignments',
      NEW.id,
      NEW.assignment_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_submission_graded ON assignment_submissions;
CREATE TRIGGER trg_notify_submission_graded
  AFTER UPDATE ON assignment_submissions
  FOR EACH ROW
  EXECUTE FUNCTION notify_submission_graded();

-- Trigger: Notify teacher when student submits
CREATE OR REPLACE FUNCTION notify_teacher_submission()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_teacher_id UUID;
  v_student_name TEXT;
  v_assignment_title TEXT;
BEGIN
  SELECT a.teacher_id, a.title INTO v_teacher_id, v_assignment_title
  FROM assignments a
  WHERE a.id = NEW.assignment_id;

  SELECT full_name INTO v_student_name
  FROM students WHERE id = NEW.student_id;

  INSERT INTO notifications (recipient_teacher_id, type, title, message, link_url, related_submission_id, related_assignment_id)
  VALUES (
    v_teacher_id,
    'submission',
    'New Submission',
    v_student_name || ' submitted "' || v_assignment_title || '"',
    '/dashboard/assignments',
    NEW.id,
    NEW.assignment_id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_teacher_submission ON assignment_submissions;
CREATE TRIGGER trg_notify_teacher_submission
  AFTER INSERT ON assignment_submissions
  FOR EACH ROW
  EXECUTE FUNCTION notify_teacher_submission();

-- Trigger: Notify students when new comment is added
CREATE OR REPLACE FUNCTION notify_new_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- If teacher commented, notify students on that assignment
  IF NEW.teacher_id IS NOT NULL AND NOT NEW.is_private THEN
    INSERT INTO notifications (recipient_student_id, type, title, message, link_url, related_assignment_id)
    SELECT DISTINCT
      ast.student_id,
      'comment',
      'Teacher Commented',
      'Your teacher added a comment on an assignment',
      '/student/assignments',
      NEW.assignment_id
    FROM assignment_students ast
    WHERE ast.assignment_id = NEW.assignment_id
      AND ast.student_id != NEW.student_id;
  END IF;
  
  -- If student commented and teacher should be notified
  IF NEW.student_id IS NOT NULL THEN
    INSERT INTO notifications (recipient_teacher_id, type, title, message, link_url, related_assignment_id)
    SELECT 
      a.teacher_id,
      'comment',
      'Student Question',
      (SELECT full_name FROM students WHERE id = NEW.student_id) || ' commented on "' || a.title || '"',
      '/dashboard/assignments',
      NEW.assignment_id
    FROM assignments a
    WHERE a.id = NEW.assignment_id;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_comment ON assignment_comments;
CREATE TRIGGER trg_notify_new_comment
  AFTER INSERT ON assignment_comments
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_comment();

COMMIT;
