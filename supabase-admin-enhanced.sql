-- ============================================================
-- Enhanced Admin System for Mother of Math
-- Run this AFTER supabase-admin-functions.sql
-- ============================================================

-- ============================================================
-- NEW TABLES FOR ENHANCED ADMIN FEATURES
-- ============================================================

-- API Usage Tracking Table
CREATE TABLE IF NOT EXISTS api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  api_type TEXT NOT NULL, -- 'openai', 'image_generation', 'grading', 'lesson_plan'
  endpoint TEXT,
  tokens_input INTEGER DEFAULT 0,
  tokens_output INTEGER DEFAULT 0,
  tokens_total INTEGER DEFAULT 0,
  cost_usd DECIMAL(10, 6) DEFAULT 0,
  response_time_ms INTEGER,
  status TEXT DEFAULT 'success', -- 'success', 'error', 'rate_limited'
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for API usage
CREATE INDEX IF NOT EXISTS idx_api_usage_user_id ON api_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_created_at ON api_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_api_usage_api_type ON api_usage(api_type);

-- Support Tickets Table
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT DEFAULT 'general', -- 'technical', 'billing', 'feature_request', 'bug', 'general'
  priority TEXT DEFAULT 'medium', -- 'low', 'medium', 'high', 'urgent'
  status TEXT DEFAULT 'open', -- 'open', 'in_progress', 'waiting_response', 'resolved', 'closed'
  assigned_to TEXT,
  resolution TEXT,
  attachments JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  first_response_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON support_tickets(created_at);

-- Ticket Responses Table
CREATE TABLE IF NOT EXISTS ticket_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES support_tickets(id) ON DELETE CASCADE,
  responder_type TEXT NOT NULL, -- 'user', 'admin', 'system'
  responder_name TEXT,
  message TEXT NOT NULL,
  attachments JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Admin Audit Log Table
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user TEXT NOT NULL,
  action TEXT NOT NULL, -- 'login', 'logout', 'view', 'create', 'update', 'delete', 'export'
  resource_type TEXT, -- 'teacher', 'student', 'assignment', 'ticket', etc.
  resource_id UUID,
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON admin_audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_user ON admin_audit_logs(admin_user);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON admin_audit_logs(action);

-- Admin Notifications Table
CREATE TABLE IF NOT EXISTS admin_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL, -- 'alert', 'warning', 'info', 'success'
  category TEXT NOT NULL, -- 'signup_spike', 'error_rate', 'usage_limit', 'new_teacher', etc.
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT FALSE,
  is_dismissed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_notifications_is_read ON admin_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_created_at ON admin_notifications(created_at);

-- Content Moderation Queue Table
CREATE TABLE IF NOT EXISTS content_moderation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type TEXT NOT NULL, -- 'image', 'text', 'resource', 'announcement'
  content_id UUID,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  content_preview TEXT,
  content_url TEXT,
  flagged_reason TEXT,
  auto_flagged BOOLEAN DEFAULT FALSE,
  ai_confidence DECIMAL(5, 4),
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'escalated'
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  action_taken TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_moderation_status ON content_moderation_queue(status);
CREATE INDEX IF NOT EXISTS idx_moderation_created_at ON content_moderation_queue(created_at);

-- System Health Metrics Table
CREATE TABLE IF NOT EXISTS system_health_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type TEXT NOT NULL, -- 'api_latency', 'error_rate', 'db_size', 'storage_usage'
  metric_name TEXT NOT NULL,
  metric_value DECIMAL(20, 6) NOT NULL,
  unit TEXT, -- 'ms', 'percent', 'bytes', 'count'
  metadata JSONB DEFAULT '{}',
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_health_metrics_type ON system_health_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_health_metrics_recorded_at ON system_health_metrics(recorded_at);

-- Report Templates Table
CREATE TABLE IF NOT EXISTS report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  report_type TEXT NOT NULL, -- 'teacher_activity', 'student_progress', 'usage_summary', 'custom'
  config JSONB NOT NULL DEFAULT '{}', -- filters, columns, charts config
  schedule TEXT, -- 'daily', 'weekly', 'monthly', null for manual
  recipients JSONB DEFAULT '[]', -- email addresses
  created_by TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Generated Reports Table
CREATE TABLE IF NOT EXISTS generated_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES report_templates(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  report_type TEXT NOT NULL,
  file_url TEXT,
  file_format TEXT, -- 'pdf', 'xlsx', 'csv', 'json'
  parameters JSONB DEFAULT '{}',
  row_count INTEGER,
  generated_by TEXT,
  share_token TEXT UNIQUE,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Student Progress Tracking Table (for at-risk flagging)
CREATE TABLE IF NOT EXISTS student_progress_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  total_assignments INTEGER DEFAULT 0,
  completed_assignments INTEGER DEFAULT 0,
  average_score DECIMAL(5, 2),
  improvement_score DECIMAL(5, 2), -- positive = improving, negative = declining
  engagement_score DECIMAL(5, 2), -- 0-100
  at_risk_flag BOOLEAN DEFAULT FALSE,
  at_risk_reasons JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_progress_student ON student_progress_snapshots(student_id);
CREATE INDEX IF NOT EXISTS idx_progress_date ON student_progress_snapshots(snapshot_date);

-- Conversation Quality Ratings Table
CREATE TABLE IF NOT EXISTS conversation_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID,
  message_id UUID,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT,
  rating_type TEXT DEFAULT 'helpfulness', -- 'helpfulness', 'accuracy', 'clarity'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily Activity Summary (for trends & sparklines)
CREATE TABLE IF NOT EXISTS daily_activity_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  summary_date DATE NOT NULL UNIQUE,
  new_teachers INTEGER DEFAULT 0,
  new_students INTEGER DEFAULT 0,
  new_lesson_plans INTEGER DEFAULT 0,
  new_assignments INTEGER DEFAULT 0,
  new_submissions INTEGER DEFAULT 0,
  new_conversations INTEGER DEFAULT 0,
  new_messages INTEGER DEFAULT 0,
  new_images INTEGER DEFAULT 0,
  active_teachers INTEGER DEFAULT 0,
  total_api_calls INTEGER DEFAULT 0,
  total_tokens_used BIGINT DEFAULT 0,
  total_api_cost DECIMAL(10, 4) DEFAULT 0,
  avg_response_time_ms INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_summary_date ON daily_activity_summary(summary_date);

-- ============================================================
-- ADMIN FUNCTIONS FOR NEW TABLES
-- ============================================================

-- Get API Usage Statistics
DROP FUNCTION IF EXISTS get_api_usage_stats(TIMESTAMPTZ, TIMESTAMPTZ);
CREATE OR REPLACE FUNCTION get_api_usage_stats(
  start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  total_calls BIGINT,
  total_tokens BIGINT,
  total_cost DECIMAL(12, 4),
  avg_response_time DECIMAL(10, 2),
  error_rate DECIMAL(5, 2),
  calls_by_type JSONB,
  top_users JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_calls,
    COALESCE(SUM(tokens_total), 0)::BIGINT as total_tokens,
    COALESCE(SUM(cost_usd), 0)::DECIMAL(12, 4) as total_cost,
    COALESCE(AVG(response_time_ms), 0)::DECIMAL(10, 2) as avg_response_time,
    (COALESCE(SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END)::DECIMAL / NULLIF(COUNT(*), 0) * 100, 0))::DECIMAL(5, 2) as error_rate,
    (
      SELECT jsonb_object_agg(api_type, cnt)
      FROM (
        SELECT api_type, COUNT(*) as cnt
        FROM api_usage
        WHERE created_at BETWEEN start_date AND end_date
        GROUP BY api_type
      ) sub
    ) as calls_by_type,
    (
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT 
          au.user_id,
          p.full_name as user_name,
          COUNT(*) as call_count,
          SUM(au.tokens_total) as total_tokens,
          SUM(au.cost_usd) as total_cost
        FROM api_usage au
        LEFT JOIN profiles p ON au.user_id = p.id
        WHERE au.created_at BETWEEN start_date AND end_date
        GROUP BY au.user_id, p.full_name
        ORDER BY call_count DESC
        LIMIT 10
      ) t
    ) as top_users
  FROM api_usage
  WHERE created_at BETWEEN start_date AND end_date;
END;
$$;

-- Get API Usage by User
DROP FUNCTION IF EXISTS get_api_usage_by_user(UUID, TIMESTAMPTZ, TIMESTAMPTZ);
CREATE OR REPLACE FUNCTION get_api_usage_by_user(
  p_user_id UUID,
  start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  total_calls BIGINT,
  total_tokens BIGINT,
  total_cost DECIMAL(12, 4),
  avg_response_time DECIMAL(10, 2),
  daily_usage JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT,
    COALESCE(SUM(tokens_total), 0)::BIGINT,
    COALESCE(SUM(cost_usd), 0)::DECIMAL(12, 4),
    COALESCE(AVG(response_time_ms), 0)::DECIMAL(10, 2),
    (
      SELECT jsonb_agg(row_to_json(d))
      FROM (
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as calls,
          SUM(tokens_total) as tokens,
          SUM(cost_usd) as cost
        FROM api_usage
        WHERE user_id = p_user_id AND created_at BETWEEN start_date AND end_date
        GROUP BY DATE(created_at)
        ORDER BY date
      ) d
    )
  FROM api_usage
  WHERE user_id = p_user_id AND created_at BETWEEN start_date AND end_date;
END;
$$;

-- Get Support Tickets
DROP FUNCTION IF EXISTS get_all_support_tickets();
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
  assigned_to TEXT,
  response_count BIGINT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  first_response_at TIMESTAMPTZ,
  time_to_first_response INTERVAL,
  time_to_resolution INTERVAL
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
    COALESCE(p.full_name, 'Unknown') as user_name,
    p.email as user_email,
    t.subject,
    t.description,
    t.category,
    t.priority,
    t.status,
    t.assigned_to,
    (SELECT COUNT(*) FROM ticket_responses tr WHERE tr.ticket_id = t.id) as response_count,
    t.created_at,
    t.updated_at,
    t.resolved_at,
    t.first_response_at,
    t.first_response_at - t.created_at as time_to_first_response,
    t.resolved_at - t.created_at as time_to_resolution
  FROM support_tickets t
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

-- Get Support Ticket Stats
DROP FUNCTION IF EXISTS get_support_ticket_stats();
CREATE OR REPLACE FUNCTION get_support_ticket_stats()
RETURNS TABLE (
  total_tickets BIGINT,
  open_tickets BIGINT,
  in_progress_tickets BIGINT,
  resolved_tickets BIGINT,
  avg_resolution_hours DECIMAL(10, 2),
  avg_first_response_hours DECIMAL(10, 2),
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
    COUNT(*)::BIGINT,
    COUNT(*) FILTER (WHERE status = 'open')::BIGINT,
    COUNT(*) FILTER (WHERE status = 'in_progress')::BIGINT,
    COUNT(*) FILTER (WHERE status IN ('resolved', 'closed'))::BIGINT,
    COALESCE(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600) FILTER (WHERE resolved_at IS NOT NULL), 0)::DECIMAL(10, 2),
    COALESCE(AVG(EXTRACT(EPOCH FROM (first_response_at - created_at)) / 3600) FILTER (WHERE first_response_at IS NOT NULL), 0)::DECIMAL(10, 2),
    (
      SELECT jsonb_object_agg(category, cnt)
      FROM (SELECT category, COUNT(*) as cnt FROM support_tickets GROUP BY category) sub
    ),
    (
      SELECT jsonb_object_agg(priority, cnt)
      FROM (SELECT priority, COUNT(*) as cnt FROM support_tickets GROUP BY priority) sub
    )
  FROM support_tickets;
END;
$$;

-- Get Admin Audit Logs
DROP FUNCTION IF EXISTS get_admin_audit_logs(INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION get_admin_audit_logs(
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  admin_user TEXT,
  action TEXT,
  resource_type TEXT,
  resource_id UUID,
  details JSONB,
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
    a.id,
    a.admin_user,
    a.action,
    a.resource_type,
    a.resource_id,
    a.details,
    a.ip_address,
    a.created_at
  FROM admin_audit_logs a
  ORDER BY a.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Get Admin Notifications
DROP FUNCTION IF EXISTS get_admin_notifications(BOOLEAN);
CREATE OR REPLACE FUNCTION get_admin_notifications(
  unread_only BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  id UUID,
  type TEXT,
  category TEXT,
  title TEXT,
  message TEXT,
  metadata JSONB,
  is_read BOOLEAN,
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
    n.category,
    n.title,
    n.message,
    n.metadata,
    n.is_read,
    n.created_at
  FROM admin_notifications n
  WHERE (NOT unread_only OR NOT n.is_read) AND NOT n.is_dismissed
  ORDER BY n.created_at DESC
  LIMIT 100;
END;
$$;

-- Get Content Moderation Queue
DROP FUNCTION IF EXISTS get_moderation_queue(TEXT);
CREATE OR REPLACE FUNCTION get_moderation_queue(
  p_status TEXT DEFAULT 'pending'
)
RETURNS TABLE (
  id UUID,
  content_type TEXT,
  content_id UUID,
  user_id UUID,
  user_name TEXT,
  content_preview TEXT,
  content_url TEXT,
  flagged_reason TEXT,
  auto_flagged BOOLEAN,
  ai_confidence DECIMAL,
  status TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.content_type,
    m.content_id,
    m.user_id,
    COALESCE(p.full_name, 'Unknown') as user_name,
    m.content_preview,
    m.content_url,
    m.flagged_reason,
    m.auto_flagged,
    m.ai_confidence,
    m.status,
    m.created_at
  FROM content_moderation_queue m
  LEFT JOIN profiles p ON m.user_id = p.id
  WHERE m.status = p_status OR p_status IS NULL
  ORDER BY m.created_at DESC;
END;
$$;

-- Get System Health Metrics
DROP FUNCTION IF EXISTS get_system_health();
CREATE OR REPLACE FUNCTION get_system_health()
RETURNS TABLE (
  metric_type TEXT,
  metric_name TEXT,
  current_value DECIMAL,
  unit TEXT,
  recorded_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (m.metric_type, m.metric_name)
    m.metric_type,
    m.metric_name,
    m.metric_value as current_value,
    m.unit,
    m.recorded_at
  FROM system_health_metrics m
  ORDER BY m.metric_type, m.metric_name, m.recorded_at DESC;
END;
$$;

-- Get Daily Activity Trends
DROP FUNCTION IF EXISTS get_activity_trends(INTEGER);
CREATE OR REPLACE FUNCTION get_activity_trends(
  days INTEGER DEFAULT 30
)
RETURNS TABLE (
  summary_date DATE,
  new_teachers INTEGER,
  new_students INTEGER,
  new_lesson_plans INTEGER,
  new_assignments INTEGER,
  new_submissions INTEGER,
  new_conversations INTEGER,
  new_messages INTEGER,
  new_images INTEGER,
  active_teachers INTEGER,
  total_api_calls INTEGER,
  total_api_cost DECIMAL,
  error_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.summary_date,
    d.new_teachers,
    d.new_students,
    d.new_lesson_plans,
    d.new_assignments,
    d.new_submissions,
    d.new_conversations,
    d.new_messages,
    d.new_images,
    d.active_teachers,
    d.total_api_calls,
    d.total_api_cost,
    d.error_count
  FROM daily_activity_summary d
  WHERE d.summary_date >= CURRENT_DATE - days
  ORDER BY d.summary_date ASC;
END;
$$;

-- Get Schools with Full Stats
DROP FUNCTION IF EXISTS get_schools_detailed();
CREATE OR REPLACE FUNCTION get_schools_detailed()
RETURNS TABLE (
  school_name TEXT,
  school_type TEXT,
  city TEXT,
  country TEXT,
  teacher_count BIGINT,
  student_count BIGINT,
  total_lesson_plans BIGINT,
  total_assignments BIGINT,
  total_conversations BIGINT,
  avg_teacher_activity DECIMAL
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
    COUNT(DISTINCT s.id) as student_count,
    COALESCE(SUM(lp_count.cnt), 0)::BIGINT as total_lesson_plans,
    COALESCE(SUM(assign_count.cnt), 0)::BIGINT as total_assignments,
    COALESCE(SUM(conv_count.cnt), 0)::BIGINT as total_conversations,
    COALESCE(AVG(lp_count.cnt + assign_count.cnt + conv_count.cnt), 0)::DECIMAL as avg_teacher_activity
  FROM profiles p
  LEFT JOIN students s ON s.teacher_id = p.id
  LEFT JOIN LATERAL (
    SELECT COUNT(*) as cnt FROM lesson_plans WHERE user_id = p.id
  ) lp_count ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*) as cnt FROM assignments WHERE teacher_id = p.id
  ) assign_count ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*) as cnt FROM conversations WHERE user_id = p.id
  ) conv_count ON true
  WHERE p.role = 'teacher' AND p.school_name IS NOT NULL
  GROUP BY p.school_name, p.school_type, p.city, p.country
  ORDER BY teacher_count DESC;
END;
$$;

-- Get Student Progress (for at-risk detection)
DROP FUNCTION IF EXISTS get_student_progress_summary();
CREATE OR REPLACE FUNCTION get_student_progress_summary()
RETURNS TABLE (
  student_id UUID,
  student_name TEXT,
  teacher_name TEXT,
  grade_level TEXT,
  total_assignments BIGINT,
  completed_assignments BIGINT,
  completion_rate DECIMAL,
  average_score DECIMAL,
  last_activity TIMESTAMPTZ,
  days_inactive INTEGER,
  at_risk BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id as student_id,
    s.full_name as student_name,
    p.full_name as teacher_name,
    s.grade_level,
    (SELECT COUNT(*) FROM assignment_students ast WHERE ast.student_id = s.id)::BIGINT as total_assignments,
    (SELECT COUNT(*) FROM assignment_submissions sub WHERE sub.student_id = s.id)::BIGINT as completed_assignments,
    CASE 
      WHEN (SELECT COUNT(*) FROM assignment_students ast WHERE ast.student_id = s.id) = 0 THEN 0
      ELSE ((SELECT COUNT(*) FROM assignment_submissions sub WHERE sub.student_id = s.id)::DECIMAL / 
            (SELECT COUNT(*) FROM assignment_students ast WHERE ast.student_id = s.id) * 100)
    END as completion_rate,
    (SELECT AVG(sub.score) FROM assignment_submissions sub WHERE sub.student_id = s.id AND sub.score IS NOT NULL) as average_score,
    (SELECT MAX(sub.submitted_at) FROM assignment_submissions sub WHERE sub.student_id = s.id) as last_activity,
    EXTRACT(DAY FROM NOW() - COALESCE(
      (SELECT MAX(sub.submitted_at) FROM assignment_submissions sub WHERE sub.student_id = s.id),
      s.created_at
    ))::INTEGER as days_inactive,
    (
      EXTRACT(DAY FROM NOW() - COALESCE(
        (SELECT MAX(sub.submitted_at) FROM assignment_submissions sub WHERE sub.student_id = s.id),
        s.created_at
      )) > 14
      OR 
      (SELECT AVG(sub.score) FROM assignment_submissions sub WHERE sub.student_id = s.id AND sub.score IS NOT NULL) < 60
    ) as at_risk
  FROM students s
  LEFT JOIN profiles p ON s.teacher_id = p.id
  ORDER BY at_risk DESC, days_inactive DESC;
END;
$$;

-- Get Chatbot Performance Metrics
DROP FUNCTION IF EXISTS get_chatbot_performance();
CREATE OR REPLACE FUNCTION get_chatbot_performance()
RETURNS TABLE (
  total_conversations BIGINT,
  total_messages BIGINT,
  avg_messages_per_conversation DECIMAL,
  avg_response_length DECIMAL,
  conversations_by_grade JSONB,
  hourly_distribution JSONB,
  avg_user_rating DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM conversations)::BIGINT,
    (SELECT COUNT(*) FROM conversation_messages)::BIGINT,
    (SELECT AVG(message_count) FROM (
      SELECT COUNT(*) as message_count FROM conversation_messages GROUP BY conversation_id
    ) sub)::DECIMAL,
    (SELECT AVG(LENGTH(content)) FROM conversation_messages WHERE role = 'assistant')::DECIMAL,
    (
      SELECT jsonb_object_agg(grade, cnt)
      FROM (SELECT grade, COUNT(*) as cnt FROM conversations GROUP BY grade) sub
    ),
    (
      SELECT jsonb_object_agg(hour::TEXT, cnt)
      FROM (
        SELECT EXTRACT(HOUR FROM created_at)::INTEGER as hour, COUNT(*) as cnt 
        FROM conversation_messages 
        GROUP BY hour
      ) sub
    ),
    (SELECT AVG(rating) FROM conversation_ratings)::DECIMAL;
END;
$$;

-- Get Grading Analytics
DROP FUNCTION IF EXISTS get_grading_analytics();
CREATE OR REPLACE FUNCTION get_grading_analytics()
RETURNS TABLE (
  total_submissions BIGINT,
  graded_count BIGINT,
  ai_graded_count BIGINT,
  human_graded_count BIGINT,
  avg_score DECIMAL,
  avg_ai_score DECIMAL,
  score_distribution JSONB,
  grade_by_subject JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_submissions,
    COUNT(*) FILTER (WHERE score IS NOT NULL OR ai_score IS NOT NULL)::BIGINT as graded_count,
    COUNT(*) FILTER (WHERE ai_score IS NOT NULL)::BIGINT as ai_graded_count,
    COUNT(*) FILTER (WHERE score IS NOT NULL AND graded_at IS NOT NULL)::BIGINT as human_graded_count,
    AVG(score)::DECIMAL as avg_score,
    AVG(ai_score)::DECIMAL as avg_ai_score,
    (
      SELECT jsonb_object_agg(bucket, cnt)
      FROM (
        SELECT 
          CASE 
            WHEN score >= 90 THEN 'A (90-100)'
            WHEN score >= 80 THEN 'B (80-89)'
            WHEN score >= 70 THEN 'C (70-79)'
            WHEN score >= 60 THEN 'D (60-69)'
            ELSE 'F (0-59)'
          END as bucket,
          COUNT(*) as cnt
        FROM assignment_submissions
        WHERE score IS NOT NULL
        GROUP BY bucket
      ) sub
    ),
    (
      SELECT jsonb_object_agg(subject, avg_score)
      FROM (
        SELECT a.subject, AVG(s.score) as avg_score
        FROM assignment_submissions s
        JOIN assignments a ON s.assignment_id = a.id
        WHERE s.score IS NOT NULL
        GROUP BY a.subject
      ) sub
    )
  FROM assignment_submissions;
END;
$$;

-- Function to calculate comparison metrics (vs last period)
DROP FUNCTION IF EXISTS get_comparison_metrics();
CREATE OR REPLACE FUNCTION get_comparison_metrics()
RETURNS TABLE (
  metric_name TEXT,
  current_value BIGINT,
  previous_value BIGINT,
  change_percent DECIMAL,
  trend TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  week_ago TIMESTAMPTZ := NOW() - INTERVAL '7 days';
  two_weeks_ago TIMESTAMPTZ := NOW() - INTERVAL '14 days';
BEGIN
  RETURN QUERY
  SELECT * FROM (
    -- Teachers
    SELECT 
      'new_teachers'::TEXT,
      (SELECT COUNT(*) FROM profiles WHERE role = 'teacher' AND created_at >= week_ago)::BIGINT,
      (SELECT COUNT(*) FROM profiles WHERE role = 'teacher' AND created_at >= two_weeks_ago AND created_at < week_ago)::BIGINT,
      0::DECIMAL,
      ''::TEXT
    UNION ALL
    -- Students
    SELECT 
      'new_students'::TEXT,
      (SELECT COUNT(*) FROM students WHERE created_at >= week_ago)::BIGINT,
      (SELECT COUNT(*) FROM students WHERE created_at >= two_weeks_ago AND created_at < week_ago)::BIGINT,
      0::DECIMAL,
      ''::TEXT
    UNION ALL
    -- Lesson Plans
    SELECT 
      'new_lesson_plans'::TEXT,
      (SELECT COUNT(*) FROM lesson_plans WHERE created_at >= week_ago)::BIGINT,
      (SELECT COUNT(*) FROM lesson_plans WHERE created_at >= two_weeks_ago AND created_at < week_ago)::BIGINT,
      0::DECIMAL,
      ''::TEXT
    UNION ALL
    -- Assignments
    SELECT 
      'new_assignments'::TEXT,
      (SELECT COUNT(*) FROM assignments WHERE created_at >= week_ago)::BIGINT,
      (SELECT COUNT(*) FROM assignments WHERE created_at >= two_weeks_ago AND created_at < week_ago)::BIGINT,
      0::DECIMAL,
      ''::TEXT
    UNION ALL
    -- Submissions
    SELECT 
      'new_submissions'::TEXT,
      (SELECT COUNT(*) FROM assignment_submissions WHERE submitted_at >= week_ago)::BIGINT,
      (SELECT COUNT(*) FROM assignment_submissions WHERE submitted_at >= two_weeks_ago AND submitted_at < week_ago)::BIGINT,
      0::DECIMAL,
      ''::TEXT
    UNION ALL
    -- Conversations
    SELECT 
      'new_conversations'::TEXT,
      (SELECT COUNT(*) FROM conversations WHERE created_at >= week_ago)::BIGINT,
      (SELECT COUNT(*) FROM conversations WHERE created_at >= two_weeks_ago AND created_at < week_ago)::BIGINT,
      0::DECIMAL,
      ''::TEXT
  ) metrics;
END;
$$;

-- ============================================================
-- GRANT PERMISSIONS
-- ============================================================

GRANT EXECUTE ON FUNCTION get_api_usage_stats(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION get_api_usage_stats(TIMESTAMPTZ, TIMESTAMPTZ) TO anon;
GRANT EXECUTE ON FUNCTION get_api_usage_by_user(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION get_api_usage_by_user(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO anon;
GRANT EXECUTE ON FUNCTION get_all_support_tickets() TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_support_tickets() TO anon;
GRANT EXECUTE ON FUNCTION get_support_ticket_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION get_support_ticket_stats() TO anon;
GRANT EXECUTE ON FUNCTION get_admin_audit_logs(INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_audit_logs(INTEGER, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION get_admin_notifications(BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_notifications(BOOLEAN) TO anon;
GRANT EXECUTE ON FUNCTION get_moderation_queue(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_moderation_queue(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_system_health() TO authenticated;
GRANT EXECUTE ON FUNCTION get_system_health() TO anon;
GRANT EXECUTE ON FUNCTION get_activity_trends(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_activity_trends(INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION get_schools_detailed() TO authenticated;
GRANT EXECUTE ON FUNCTION get_schools_detailed() TO anon;
GRANT EXECUTE ON FUNCTION get_student_progress_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION get_student_progress_summary() TO anon;
GRANT EXECUTE ON FUNCTION get_chatbot_performance() TO authenticated;
GRANT EXECUTE ON FUNCTION get_chatbot_performance() TO anon;
GRANT EXECUTE ON FUNCTION get_grading_analytics() TO authenticated;
GRANT EXECUTE ON FUNCTION get_grading_analytics() TO anon;
GRANT EXECUTE ON FUNCTION get_comparison_metrics() TO authenticated;
GRANT EXECUTE ON FUNCTION get_comparison_metrics() TO anon;

-- Enable RLS on new tables (with SECURITY DEFINER functions to bypass)
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_moderation_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_health_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_progress_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_activity_summary ENABLE ROW LEVEL SECURITY;
