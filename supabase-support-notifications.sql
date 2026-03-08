-- ============================================================
-- Support Tickets & Admin Notifications System
-- Run this migration in Supabase SQL Editor
-- ============================================================

-- =======================
-- ADMIN NOTIFICATIONS TABLE
-- =======================
CREATE TABLE IF NOT EXISTS admin_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'warning', 'success', 'error', 'user', 'system')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  action_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Index for quick filtering
CREATE INDEX IF NOT EXISTS idx_admin_notifications_read ON admin_notifications(read);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_created_at ON admin_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_type ON admin_notifications(type);

-- Enable RLS
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first
DROP POLICY IF EXISTS "Admin can view all notifications" ON admin_notifications;
DROP POLICY IF EXISTS "Admin can update notifications" ON admin_notifications;
DROP POLICY IF EXISTS "System can insert notifications" ON admin_notifications;

-- RLS Policies (Admin only access)
CREATE POLICY "Admin can view all notifications" ON admin_notifications
  FOR SELECT USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'));

CREATE POLICY "Admin can update notifications" ON admin_notifications
  FOR UPDATE USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'));

CREATE POLICY "System can insert notifications" ON admin_notifications
  FOR INSERT WITH CHECK (true);

-- =======================
-- SUPPORT TICKETS TABLE
-- =======================
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name TEXT NOT NULL,
  user_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'technical', 'billing', 'feature_request', 'bug_report', 'account', 'other')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting_response', 'resolved', 'closed')),
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  first_response_at TIMESTAMPTZ,
  attachments TEXT[] DEFAULT '{}'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_priority ON support_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON support_tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned_to ON support_tickets(assigned_to);

-- Enable RLS
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first
DROP POLICY IF EXISTS "Users can view their own tickets" ON support_tickets;
DROP POLICY IF EXISTS "Users can create tickets" ON support_tickets;
DROP POLICY IF EXISTS "Admin can view all tickets" ON support_tickets;
DROP POLICY IF EXISTS "Admin can update all tickets" ON support_tickets;

-- RLS Policies
CREATE POLICY "Users can view their own tickets" ON support_tickets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create tickets" ON support_tickets
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Admin can view all tickets" ON support_tickets
  FOR SELECT USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'));

CREATE POLICY "Admin can update all tickets" ON support_tickets
  FOR UPDATE USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'));

-- =======================
-- TICKET RESPONSES TABLE (for conversation threads)
-- =======================
CREATE TABLE IF NOT EXISTS ticket_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name TEXT NOT NULL,
  user_role TEXT NOT NULL DEFAULT 'user' CHECK (user_role IN ('user', 'admin', 'system')),
  message TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT FALSE,
  attachments TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ticket_responses_ticket_id ON ticket_responses(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_responses_created_at ON ticket_responses(created_at);

-- Enable RLS
ALTER TABLE ticket_responses ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first
DROP POLICY IF EXISTS "Users can view responses to their tickets" ON ticket_responses;
DROP POLICY IF EXISTS "Users can add responses to their tickets" ON ticket_responses;
DROP POLICY IF EXISTS "Admin can view all responses" ON ticket_responses;
DROP POLICY IF EXISTS "Admin can add responses" ON ticket_responses;

-- RLS Policies
CREATE POLICY "Users can view responses to their tickets" ON ticket_responses
  FOR SELECT USING (
    ticket_id IN (SELECT id FROM support_tickets WHERE user_id = auth.uid())
    AND is_internal = FALSE
  );

CREATE POLICY "Users can add responses to their tickets" ON ticket_responses
  FOR INSERT WITH CHECK (
    ticket_id IN (SELECT id FROM support_tickets WHERE user_id = auth.uid())
    AND user_role = 'user'
  );

CREATE POLICY "Admin can view all responses" ON ticket_responses
  FOR SELECT USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'));

CREATE POLICY "Admin can add responses" ON ticket_responses
  FOR INSERT WITH CHECK (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'));

-- =======================
-- FUNCTIONS
-- =======================

-- Drop existing functions first to avoid return type conflicts
DROP FUNCTION IF EXISTS get_admin_notifications(INTEGER);
DROP FUNCTION IF EXISTS mark_notification_read(UUID);
DROP FUNCTION IF EXISTS mark_all_notifications_read();
DROP FUNCTION IF EXISTS delete_notification(UUID);
DROP FUNCTION IF EXISTS create_admin_notification(TEXT, TEXT, TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS get_all_support_tickets();
DROP FUNCTION IF EXISTS get_support_ticket_stats();
DROP FUNCTION IF EXISTS get_user_support_tickets(UUID);
DROP FUNCTION IF EXISTS create_support_ticket(UUID, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS update_ticket_status(UUID, TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS add_ticket_response(UUID, UUID, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS get_ticket_responses(UUID, BOOLEAN);

-- Function: Get admin notifications
CREATE OR REPLACE FUNCTION get_admin_notifications(limit_count INTEGER DEFAULT 50)
RETURNS TABLE (
  id UUID,
  type TEXT,
  title TEXT,
  message TEXT,
  read BOOLEAN,
  action_url TEXT,
  metadata JSONB,
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
    n.type,
    n.title,
    n.message,
    n.read,
    n.action_url,
    n.metadata,
    n.created_at
  FROM admin_notifications n
  WHERE n.expires_at IS NULL OR n.expires_at > NOW()
  ORDER BY n.created_at DESC
  LIMIT limit_count;
END;
$$;

-- Function: Mark notification as read
CREATE OR REPLACE FUNCTION mark_notification_read(notification_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE admin_notifications
  SET read = TRUE
  WHERE id = notification_id;
  
  RETURN TRUE;
END;
$$;

-- Function: Mark all notifications as read
CREATE OR REPLACE FUNCTION mark_all_notifications_read()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE admin_notifications
  SET read = TRUE
  WHERE read = FALSE;
  
  RETURN TRUE;
END;
$$;

-- Function: Delete notification
CREATE OR REPLACE FUNCTION delete_notification(notification_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM admin_notifications
  WHERE id = notification_id;
  
  RETURN TRUE;
END;
$$;

-- Function: Create admin notification (for triggers)
CREATE OR REPLACE FUNCTION create_admin_notification(
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_action_url TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO admin_notifications (type, title, message, action_url, metadata)
  VALUES (p_type, p_title, p_message, p_action_url, p_metadata)
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

-- Function: Get all support tickets (admin)
CREATE OR REPLACE FUNCTION get_all_support_tickets()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  user_name TEXT,
  user_email TEXT,
  subject TEXT,
  description TEXT,
  category TEXT,
  priority TEXT,
  status TEXT,
  assigned_to UUID,
  assigned_to_name TEXT,
  resolution TEXT,
  response_count BIGINT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  first_response_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.user_id,
    t.user_name,
    t.user_email,
    t.subject,
    t.description,
    t.category,
    t.priority,
    t.status,
    t.assigned_to,
    a.full_name AS assigned_to_name,
    t.resolution,
    COUNT(r.id) AS response_count,
    t.created_at,
    t.updated_at,
    t.resolved_at,
    t.first_response_at
  FROM support_tickets t
  LEFT JOIN profiles a ON t.assigned_to = a.id
  LEFT JOIN ticket_responses r ON t.id = r.ticket_id
  GROUP BY t.id, a.full_name
  ORDER BY 
    CASE t.priority 
      WHEN 'urgent' THEN 1 
      WHEN 'high' THEN 2 
      WHEN 'medium' THEN 3 
      ELSE 4 
    END,
    CASE t.status
      WHEN 'open' THEN 1
      WHEN 'in_progress' THEN 2
      WHEN 'waiting_response' THEN 3
      ELSE 4
    END,
    t.created_at DESC;
END;
$$;

-- Function: Get support ticket stats
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
DECLARE
  v_category_json JSONB;
  v_priority_json JSONB;
BEGIN
  -- Get category distribution
  SELECT jsonb_object_agg(category, cnt)
  INTO v_category_json
  FROM (
    SELECT category, COUNT(*) as cnt
    FROM support_tickets
    GROUP BY category
  ) sub;
  
  -- Get priority distribution
  SELECT jsonb_object_agg(priority, cnt)
  INTO v_priority_json
  FROM (
    SELECT priority, COUNT(*) as cnt
    FROM support_tickets
    GROUP BY priority
  ) sub;

  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT AS total_tickets,
    COUNT(*) FILTER (WHERE t.status = 'open')::BIGINT AS open_tickets,
    COUNT(*) FILTER (WHERE t.status = 'in_progress')::BIGINT AS in_progress_tickets,
    COUNT(*) FILTER (WHERE t.status IN ('resolved', 'closed'))::BIGINT AS resolved_tickets,
    COALESCE(
      AVG(EXTRACT(EPOCH FROM (t.resolved_at - t.created_at)) / 3600) 
      FILTER (WHERE t.resolved_at IS NOT NULL), 0
    )::NUMERIC AS avg_resolution_hours,
    COALESCE(
      AVG(EXTRACT(EPOCH FROM (t.first_response_at - t.created_at)) / 3600) 
      FILTER (WHERE t.first_response_at IS NOT NULL), 0
    )::NUMERIC AS avg_first_response_hours,
    COALESCE(v_category_json, '{}'::JSONB) AS tickets_by_category,
    COALESCE(v_priority_json, '{}'::JSONB) AS tickets_by_priority
  FROM support_tickets t;
END;
$$;

-- Function: Get tickets for a specific user
CREATE OR REPLACE FUNCTION get_user_support_tickets(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  subject TEXT,
  description TEXT,
  category TEXT,
  priority TEXT,
  status TEXT,
  resolution TEXT,
  response_count BIGINT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.subject,
    t.description,
    t.category,
    t.priority,
    t.status,
    t.resolution,
    COUNT(r.id) AS response_count,
    t.created_at,
    t.updated_at,
    t.resolved_at
  FROM support_tickets t
  LEFT JOIN ticket_responses r ON t.id = r.ticket_id AND r.is_internal = FALSE
  WHERE t.user_id = p_user_id
  GROUP BY t.id
  ORDER BY t.created_at DESC;
END;
$$;

-- Function: Create support ticket
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
  v_ticket_id UUID;
  v_user_name TEXT;
  v_user_email TEXT;
BEGIN
  -- Get user info
  SELECT full_name, email INTO v_user_name, v_user_email
  FROM profiles
  WHERE id = p_user_id;
  
  IF v_user_name IS NULL THEN
    v_user_name := 'Unknown User';
    v_user_email := '';
  END IF;
  
  -- Create ticket
  INSERT INTO support_tickets (
    user_id, user_name, user_email, subject, description, category, priority
  )
  VALUES (
    p_user_id, v_user_name, v_user_email, p_subject, p_description, p_category, p_priority
  )
  RETURNING id INTO v_ticket_id;
  
  -- Create admin notification
  INSERT INTO admin_notifications (type, title, message, action_url, metadata)
  VALUES (
    CASE p_priority
      WHEN 'urgent' THEN 'error'
      WHEN 'high' THEN 'warning'
      ELSE 'info'
    END,
    'New Support Ticket',
    format('"%s" from %s - %s priority', p_subject, v_user_name, p_priority),
    '/admin/support',
    jsonb_build_object('ticket_id', v_ticket_id, 'user_id', p_user_id, 'category', p_category)
  );
  
  RETURN v_ticket_id;
END;
$$;

-- Function: Update ticket status
CREATE OR REPLACE FUNCTION update_ticket_status(
  p_ticket_id UUID,
  p_status TEXT,
  p_resolution TEXT DEFAULT NULL,
  p_assigned_to UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE support_tickets
  SET 
    status = p_status,
    resolution = COALESCE(p_resolution, resolution),
    assigned_to = COALESCE(p_assigned_to, assigned_to),
    updated_at = NOW(),
    resolved_at = CASE WHEN p_status IN ('resolved', 'closed') THEN NOW() ELSE resolved_at END
  WHERE id = p_ticket_id;
  
  RETURN TRUE;
END;
$$;

-- Function: Add response to ticket
CREATE OR REPLACE FUNCTION add_ticket_response(
  p_ticket_id UUID,
  p_user_id UUID,
  p_message TEXT,
  p_is_internal BOOLEAN DEFAULT FALSE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_response_id UUID;
  v_user_name TEXT;
  v_user_role TEXT;
  v_ticket_user_id UUID;
  v_ticket_subject TEXT;
BEGIN
  -- Get user info and role
  SELECT full_name, role INTO v_user_name, v_user_role
  FROM profiles
  WHERE id = p_user_id;
  
  IF v_user_name IS NULL THEN
    v_user_name := 'System';
    v_user_role := 'system';
  ELSE
    -- Map profile roles to ticket_responses allowed roles
    -- Constraint only allows: 'user', 'admin', 'system'
    IF v_user_role NOT IN ('admin', 'system') THEN
      v_user_role := 'user';  -- Map 'teacher', 'student', etc. to 'user'
    END IF;
  END IF;
  
  -- Get ticket info
  SELECT user_id, subject INTO v_ticket_user_id, v_ticket_subject
  FROM support_tickets
  WHERE id = p_ticket_id;
  
  -- Insert response
  INSERT INTO ticket_responses (ticket_id, user_id, user_name, user_role, message, is_internal)
  VALUES (p_ticket_id, p_user_id, v_user_name, v_user_role, p_message, p_is_internal)
  RETURNING id INTO v_response_id;
  
  -- Update ticket
  UPDATE support_tickets
  SET 
    updated_at = NOW(),
    first_response_at = COALESCE(first_response_at, CASE WHEN v_user_role = 'admin' THEN NOW() ELSE first_response_at END),
    status = CASE 
      WHEN v_user_role = 'admin' AND status = 'open' THEN 'in_progress'
      WHEN v_user_role = 'user' AND status = 'waiting_response' THEN 'in_progress'
      ELSE status
    END
  WHERE id = p_ticket_id;
  
  -- Create notification for the other party
  IF v_user_role = 'admin' AND NOT p_is_internal THEN
    -- Notify user (could implement push notifications here)
    NULL;
  ELSIF v_user_role = 'user' THEN
    -- Notify admin
    INSERT INTO admin_notifications (type, title, message, action_url, metadata)
    VALUES (
      'info',
      'Ticket Response',
      format('New response on ticket: %s', v_ticket_subject),
      '/admin/support',
      jsonb_build_object('ticket_id', p_ticket_id)
    );
  END IF;
  
  RETURN v_response_id;
END;
$$;

-- Function: Add admin response to ticket (always sets role to 'admin')
DROP FUNCTION IF EXISTS add_admin_ticket_response(UUID, UUID, TEXT, BOOLEAN);

CREATE OR REPLACE FUNCTION add_admin_ticket_response(
  p_ticket_id UUID,
  p_user_id UUID,
  p_message TEXT,
  p_is_internal BOOLEAN DEFAULT FALSE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_response_id UUID;
  v_ticket_subject TEXT;
  v_ticket_status TEXT;
  v_first_response TIMESTAMPTZ;
BEGIN
  -- Get ticket info
  SELECT subject, status, first_response_at 
  INTO v_ticket_subject, v_ticket_status, v_first_response
  FROM support_tickets
  WHERE id = p_ticket_id;
  
  -- Insert response with admin role and 'Support' as name
  INSERT INTO ticket_responses (ticket_id, user_id, user_name, user_role, message, is_internal)
  VALUES (p_ticket_id, p_user_id, 'Support', 'admin', p_message, p_is_internal)
  RETURNING id INTO v_response_id;
  
  -- Update ticket
  UPDATE support_tickets
  SET 
    updated_at = NOW(),
    first_response_at = COALESCE(v_first_response, NOW()),
    status = CASE 
      WHEN v_ticket_status = 'open' THEN 'in_progress'
      ELSE v_ticket_status
    END
  WHERE id = p_ticket_id;
  
  RETURN v_response_id;
END;
$$;

-- Function: Get ticket responses
CREATE OR REPLACE FUNCTION get_ticket_responses(
  p_ticket_id UUID,
  p_include_internal BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  user_name TEXT,
  user_role TEXT,
  message TEXT,
  is_internal BOOLEAN,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.user_id,
    r.user_name,
    r.user_role,
    r.message,
    r.is_internal,
    r.created_at
  FROM ticket_responses r
  WHERE r.ticket_id = p_ticket_id
    AND (p_include_internal = TRUE OR r.is_internal = FALSE)
  ORDER BY r.created_at ASC;
END;
$$;

-- =======================
-- TRIGGERS for real-time notifications
-- =======================

-- Trigger: New teacher signup notification
CREATE OR REPLACE FUNCTION notify_new_teacher_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'teacher' THEN
    INSERT INTO admin_notifications (type, title, message, action_url, metadata)
    VALUES (
      'user',
      'New Teacher Signup',
      format('%s just registered as a new teacher', COALESCE(NEW.full_name, 'A new teacher')),
      '/admin/teachers',
      jsonb_build_object('user_id', NEW.id, 'email', NEW.email)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_new_teacher_signup ON profiles;
CREATE TRIGGER trigger_new_teacher_signup
AFTER INSERT ON profiles
FOR EACH ROW
EXECUTE FUNCTION notify_new_teacher_signup();

-- Trigger: New student created notification
CREATE OR REPLACE FUNCTION notify_new_student()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO admin_notifications (type, title, message, action_url, metadata)
  VALUES (
    'success',
    'New Student Added',
    format('%s was added to the platform', NEW.full_name),
    '/admin/students',
    jsonb_build_object('student_id', NEW.id, 'teacher_id', NEW.teacher_id)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_new_student ON students;
CREATE TRIGGER trigger_new_student
AFTER INSERT ON students
FOR EACH ROW
EXECUTE FUNCTION notify_new_student();

-- Enable realtime for notifications (ignore if already added)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE admin_notifications;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE support_tickets;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE ticket_responses;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- =======================
-- GRANT PERMISSIONS
-- =======================
GRANT EXECUTE ON FUNCTION get_admin_notifications TO authenticated;
GRANT EXECUTE ON FUNCTION mark_notification_read TO authenticated;
GRANT EXECUTE ON FUNCTION mark_all_notifications_read TO authenticated;
GRANT EXECUTE ON FUNCTION delete_notification TO authenticated;
GRANT EXECUTE ON FUNCTION create_admin_notification TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_support_tickets TO authenticated;
GRANT EXECUTE ON FUNCTION get_support_ticket_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_support_tickets TO authenticated;
GRANT EXECUTE ON FUNCTION create_support_ticket TO authenticated;
GRANT EXECUTE ON FUNCTION update_ticket_status TO authenticated;
GRANT EXECUTE ON FUNCTION add_ticket_response TO authenticated;
GRANT EXECUTE ON FUNCTION add_admin_ticket_response TO authenticated;
GRANT EXECUTE ON FUNCTION get_ticket_responses TO authenticated;

-- =======================
-- STORAGE BUCKET FOR TICKET ATTACHMENTS
-- =======================
-- Create storage bucket for ticket attachments (run this in Supabase dashboard or via SQL)
INSERT INTO storage.buckets (id, name, public)
VALUES ('ticket-attachments', 'ticket-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for ticket-attachments bucket
-- Allow authenticated users to upload files
CREATE POLICY "Users can upload ticket attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'ticket-attachments');

-- Allow authenticated users to read attachments
CREATE POLICY "Users can read ticket attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'ticket-attachments');

-- Allow users to delete their own attachments
CREATE POLICY "Users can delete own attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'ticket-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
