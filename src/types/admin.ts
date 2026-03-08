/**
 * Admin Dashboard Types
 * Contains all TypeScript interfaces for the admin dashboard
 */

import type { ReactNode } from 'react';

export interface AdminCredentials {
  username: string;
  password: string;
}

export interface AdminSession {
  isAuthenticated: boolean;
  loginTime: string;
  expiresAt: string;
}

export interface TeacherStats {
  id: string;
  email: string;
  full_name: string;
  // Profile fields
  gender: string | null;
  country: string | null;
  city: string | null;
  school_name: string | null;
  school_address: string | null;
  school_type: string | null;
  number_of_students: number | null;
  subjects_taught: string | null;
  grade_levels: string | null;
  years_of_experience: number | null;
  education_level: string | null;
  phone_number: string | null;
  whatsapp_number: string | null;
  bio: string | null;
  date_of_birth: string | null;
  avatar_url: string | null;
  preferred_language: string | null;
  // Timestamps
  created_at: string;
  updated_at: string | null;
  last_login?: string;
  // Calculated stats
  total_students: number;
  total_lesson_plans: number;
  total_assignments: number;
  total_chatbot_messages: number;
  total_conversations: number;
  total_resources: number;
  total_announcements: number;
  account_status: 'active' | 'paused' | 'suspended';
  login_count: number;
  last_activity?: string;
}

export interface StudentStats {
  id: string;
  full_name: string;
  grade_level: string;
  teacher_id: string;
  teacher_name?: string;
  created_at: string;
  account_status: 'active' | 'paused' | 'suspended';
  total_submissions: number;
  average_score: number | null;
  last_activity?: string;
}

export interface LessonPlanStats {
  id: string;
  title: string;
  grade_level: string;
  subject: string;
  teacher_id: string;
  teacher_name?: string;
  created_at: string;
  topic?: string;
}

export interface ChatbotStats {
  id: string;
  user_id: string;
  user_name?: string;
  title: string;
  grade: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface AssignmentStats {
  id: string;
  title: string;
  description: string | null;
  subject: string;
  grade_level: string;
  teacher_id: string;
  teacher_name?: string;
  due_date: string;
  status: 'active' | 'draft' | 'closed';
  created_at: string;
  total_students: number;
  submitted_count: number;
  graded_count: number;
  average_score: number | null;
}

export interface SubmissionStats {
  id: string;
  assignment_id: string;
  assignment_title?: string;
  student_id: string;
  student_name?: string;
  teacher_name?: string;
  status: 'submitted' | 'graded' | 'returned';
  score: number | null;
  ai_score: number | null;
  file_url?: string | null;
  submitted_at: string;
  graded_at: string | null;
}

export interface DashboardOverview {
  totalTeachers: number;
  totalStudents: number;
  totalLessonPlans: number;
  totalAssignments: number;
  totalSubmissions: number;
  totalChatConversations: number;
  totalChatMessages: number;
  totalResources: number;
  totalAnnouncements: number;
  totalNotifications: number;
  totalComments: number;
  activeTeachersToday: number;
  activeTeachersThisWeek: number;
  activeTeachersThisMonth: number;
  newTeachersThisWeek: number;
  newStudentsThisWeek: number;
  newLessonPlansThisWeek: number;
  newAssignmentsThisWeek: number;
  newSubmissionsThisWeek: number;
  // New comprehensive stats
  totalImagesGenerated: number;
  totalChatInputs: number;
  totalChatResponses: number;
  dailyActiveUsers: number;
  weeklyActiveUsers: number;
  monthlyActiveUsers: number;
  aiWordsGenerated: number;
}

export interface StudentsPerTeacher {
  teacherId: string;
  teacherName: string;
  studentCount: number;
  schoolName: string | null;
}

export interface LessonPlansByTeacher {
  teacherId: string;
  teacherName: string;
  lessonPlanCount: number;
}

export interface SchoolInfo {
  name: string;
  type: string | null;
  city: string | null;
  country: string | null;
  teacherCount: number;
  studentCount: number;
}

export interface TeachersByCountry {
  country: string;
  count: number;
}

export interface StudentWorkStats {
  id: string;
  teacher_id: string;
  teacher_name?: string;
  student_name: string;
  subject?: string;
  image_url: string;
  file_name?: string;
  file_type?: string;
  file_size?: number;
  grade?: string;
  status?: string;
  feedback?: string;
  error_type?: string;
  remediation?: string;
  created_at: string;
}

export interface ActivityTrend {
  date: string;
  lessonPlans: number;
  assignments: number;
  submissions: number;
  messages: number;
}

export interface ComprehensiveAdminStats {
  overview: DashboardOverview;
  studentsPerTeacher: StudentsPerTeacher[];
  lessonPlansByTeacher: LessonPlansByTeacher[];
  schools: SchoolInfo[];
  teachersByCountry: TeachersByCountry[];
  activityTrends: ActivityTrend[];
  imagesGeneratedByTeacher: { teacherId: string; teacherName: string; imageCount: number }[];
}

export interface UsageAnalytics {
  dailyActiveUsers: { date: string; count: number }[];
  weeklyActiveUsers: { week: string; count: number }[];
  monthlyActiveUsers: { month: string; count: number }[];
  lessonPlansByMonth: { month: string; count: number }[];
  assignmentsByMonth: { month: string; count: number }[];
  chatMessagesByMonth: { month: string; count: number }[];
  submissionsByMonth: { month: string; count: number }[];
  teachersByCountry: { country: string; count: number }[];
  studentsByGrade: { grade: string; count: number }[];
}

export interface ActivityLog {
  id: string;
  user_id: string;
  user_name?: string;
  user_email?: string;
  action: string;
  details?: string;
  created_at: string;
  ip_address?: string;
}

export interface AdminNotification {
  id: string;
  type: 'new_teacher' | 'new_student' | 'high_usage' | 'error' | 'warning';
  title: string;
  message: string;
  created_at: string;
  read: boolean;
}

export interface ResourceStats {
  id: string;
  teacher_id: string;
  teacher_name?: string;
  title: string;
  description: string | null;
  file_url: string;
  file_type: string | null;
  topic: string | null;
  grade_level: string | null;
  is_public: boolean;
  download_count: number;
  created_at: string;
}

export interface AnnouncementStats {
  id: string;
  teacher_id: string;
  teacher_name?: string;
  title: string;
  message: string;
  target_grade_level: string | null;
  target_class_name: string | null;
  is_pinned: boolean;
  priority: string;
  category: string | null;
  created_at: string;
  read_count: number;
}

export interface NotificationStats {
  id: string;
  recipient_student_id: string | null;
  recipient_teacher_id: string | null;
  type: string;
  title: string;
  message: string | null;
  is_read: boolean;
  created_at: string;
}

export interface CommentStats {
  id: string;
  assignment_id: string;
  assignment_title?: string;
  student_id: string | null;
  student_name?: string;
  teacher_id: string | null;
  teacher_name?: string;
  message: string;
  is_private: boolean;
  created_at: string;
}

export interface ConversationMessageStats {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  image_url: string | null;
  rating: number | null;
  bookmarked: boolean | null;
  created_at: string;
  user_name?: string;
}

// ============================================================
// ENHANCED ADMIN TYPES
// ============================================================

export interface APIUsageStats {
  total_calls: number;
  total_tokens: number;
  total_cost: number;
  avg_response_time: number;
  error_rate: number;
  calls_by_type: Record<string, number>;
  top_users: APITopUser[];
}

export interface APITopUser {
  user_id: string;
  user_name: string;
  call_count: number;
  total_tokens: number;
  total_cost: number;
}

export interface APIUsageRecord {
  id: string;
  user_id: string;
  user_name?: string;
  api_type: 'openai' | 'image_generation' | 'grading' | 'lesson_plan';
  endpoint?: string;
  tokens_input: number;
  tokens_output: number;
  tokens_total: number;
  cost_usd: number;
  response_time_ms: number;
  status: 'success' | 'error' | 'rate_limited';
  error_message?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface SupportTicket {
  id: string;
  user_id: string | null;
  user_name: string;
  user_email: string;
  subject: string;
  description: string;
  category: 'general' | 'technical' | 'billing' | 'feature_request' | 'bug_report' | 'account' | 'other';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'waiting_response' | 'resolved' | 'closed';
  assigned_to?: string;
  assigned_to_name?: string;
  resolution?: string;
  response_count: number;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
  first_response_at?: string;
  time_to_first_response?: string;
  time_to_resolution?: string;
}

export interface TicketResponse {
  id: string;
  ticket_id?: string;
  user_id?: string;
  user_name: string;
  user_role: 'user' | 'admin' | 'system';
  message: string;
  is_internal: boolean;
  attachments?: string[];
  created_at: string;
}

export interface SupportTicketStats {
  total_tickets: number;
  open_tickets: number;
  in_progress_tickets: number;
  resolved_tickets: number;
  avg_resolution_hours: number;
  avg_first_response_hours: number;
  tickets_by_category: Record<string, number>;
  tickets_by_priority: Record<string, number>;
}

export interface AdminAuditLog {
  id: string;
  admin_user: string;
  action: 'login' | 'logout' | 'view' | 'create' | 'update' | 'delete' | 'export';
  resource_type?: string;
  resource_id?: string;
  details?: Record<string, unknown>;
  ip_address?: string;
  created_at: string;
}

export interface AdminNotificationItem {
  id: string;
  type: 'alert' | 'warning' | 'info' | 'success';
  category: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

export interface ContentModerationItem {
  id: string;
  content_type: 'image' | 'text' | 'resource' | 'announcement';
  content_id?: string;
  user_id?: string;
  user_name: string;
  content_preview?: string;
  content_url?: string;
  flagged_reason?: string;
  auto_flagged: boolean;
  ai_confidence?: number;
  status: 'pending' | 'approved' | 'rejected' | 'escalated';
  created_at: string;
}

export interface SystemHealthMetric {
  metric_type: string;
  metric_name: string;
  current_value: number;
  unit: string;
  recorded_at: string;
}

export interface SystemHealthStatus {
  database: {
    status: 'healthy' | 'degraded' | 'down';
    latency_ms: number;
    connections: number;
    size_mb: number;
  };
  api: {
    status: 'healthy' | 'degraded' | 'down';
    avg_response_ms: number;
    error_rate: number;
    requests_per_minute: number;
  };
  storage: {
    used_mb: number;
    total_mb: number;
    usage_percent: number;
  };
  services: {
    name: string;
    status: 'running' | 'stopped' | 'error';
    uptime_percent: number;
  }[];
}

export interface ReportTemplate {
  id: string;
  name: string;
  description?: string;
  report_type: 'teacher_activity' | 'student_progress' | 'usage_summary' | 'custom';
  config: ReportConfig;
  schedule?: 'daily' | 'weekly' | 'monthly' | null;
  recipients?: string[];
  created_by?: string;
  is_active: boolean;
  last_run_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ReportConfig {
  dateRange?: {
    start: string;
    end: string;
  };
  filters?: Record<string, unknown>;
  columns?: string[];
  charts?: {
    type: 'bar' | 'line' | 'pie' | 'area';
    dataKey: string;
    title: string;
  }[];
  groupBy?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface GeneratedReport {
  id: string;
  template_id?: string;
  name: string;
  report_type: string;
  file_url?: string;
  file_format: 'pdf' | 'xlsx' | 'csv' | 'json';
  parameters?: Record<string, unknown>;
  row_count?: number;
  generated_by?: string;
  share_token?: string;
  expires_at?: string;
  created_at: string;
}

export interface DailyActivitySummary {
  summary_date: string;
  new_teachers: number;
  new_students: number;
  new_lesson_plans: number;
  new_assignments: number;
  new_submissions: number;
  new_conversations: number;
  new_messages: number;
  new_images: number;
  active_teachers: number;
  total_api_calls: number;
  total_api_cost: number;
  error_count: number;
}

export interface StudentProgressSummary {
  student_id: string;
  student_name: string;
  teacher_name: string;
  grade_level: string;
  total_assignments: number;
  completed_assignments: number;
  completion_rate: number;
  average_score: number | null;
  last_activity: string | null;
  days_inactive: number;
  at_risk: boolean;
}

export interface SchoolDetailed {
  school_name: string;
  school_type?: string;
  city?: string;
  country?: string;
  teacher_count: number;
  student_count: number;
  total_lesson_plans: number;
  total_assignments: number;
  total_conversations: number;
  avg_teacher_activity: number;
}

export interface ChatbotPerformance {
  total_conversations: number;
  total_messages: number;
  avg_messages_per_conversation: number;
  avg_response_length: number;
  conversations_by_grade: Record<string, number>;
  hourly_distribution: Record<string, number>;
  avg_user_rating: number | null;
}

export interface GradingAnalytics {
  total_submissions: number;
  graded_count: number;
  ai_graded_count: number;
  human_graded_count: number;
  avg_score: number | null;
  avg_ai_score: number | null;
  score_distribution: Record<string, number>;
  grade_by_subject: Record<string, number>;
}

export interface ComparisonMetric {
  metric_name: string;
  current_value: number;
  previous_value: number;
  change_percent: number;
  trend: 'up' | 'down' | 'stable';
}

export interface DateRangePreset {
  label: string;
  value: string;
  days: number;
}

export interface SparklineData {
  value: number;
  date: string;
}

export interface KPICardData {
  title: string;
  value: number | string;
  change?: number;
  changeLabel?: string;
  trend?: 'up' | 'down' | 'stable';
  sparklineData?: SparklineData[];
  icon?: ReactNode;
  format?: 'number' | 'currency' | 'percent';
}

export interface GeographicData {
  country: string;
  code: string;
  teachers: number;
  students: number;
  lesson_plans: number;
  active_rate: number;
}

export interface ConversationInspectorData {
  conversation: ChatbotStats;
  messages: ConversationMessageStats[];
  ratings: {
    average: number | null;
    count: number;
  };
}

export interface FilterState {
  dateRange: {
    start: Date | null;
    end: Date | null;
    preset: string;
  };
  country?: string;
  school?: string;
  grade?: string;
  status?: string;
}

// ============================================================
// ADDITIONAL ENHANCED ADMIN TYPES
// ============================================================

export interface GrowthMetric {
  metric_date: string;
  new_teachers: number;
  new_students: number;
  new_lesson_plans: number;
  new_conversations: number;
  new_messages: number;
  new_assignments: number;
  new_images: number;
}

export interface ComparisonData {
  metric_name: string;
  current_value: number;
  previous_value: number;
  change_percent: number;
  change_direction: 'up' | 'down' | 'stable';
}

export interface APIUsageSummary {
  service_type: string;
  total_requests: number;
  total_tokens: number;
  total_cost: number;
  avg_duration_ms: number;
  success_rate: number;
  daily_breakdown: { date: string; requests: number; tokens: number }[];
}

export interface ContentFlag {
  id: string;
  content_type: string;
  content_id: string;
  content_preview: string | null;
  flagged_by: string;
  flag_reason: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'approved' | 'removed' | 'dismissed';
  reviewed_by: string | null;
  review_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export interface ModerationStats {
  total_flags: number;
  pending_flags: number;
  approved_flags: number;
  removed_flags: number;
  flags_by_type: Record<string, number>;
  flags_by_reason: Record<string, number>;
  flags_by_severity: Record<string, number>;
}

export interface DataRequest {
  id: string;
  user_id: string | null;
  user_name: string;
  user_email: string | null;
  request_type: 'export' | 'delete' | 'access';
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  requested_by: string | null;
  reason: string | null;
  data_categories: string[];
  download_url: string | null;
  completed_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface EngagementMetric {
  metric_date: string;
  active_users: number;
  conversations_started: number;
  messages_sent: number;
  lessons_created: number;
  assignments_created: number;
  avg_messages_per_conversation: number | null;
}

export interface GradeDistribution {
  grade_range: string;
  count: number;
  percentage: number;
}

export interface AIvsHumanGrading {
  total_submissions: number;
  ai_graded: number;
  human_graded: number;
  both_graded: number;
  avg_ai_score: number | null;
  avg_human_score: number | null;
  avg_difference: number | null;
  correlation_coefficient: number | null;
}

export interface ScheduledReport {
  id: string;
  name: string;
  report_type: string;
  schedule: 'daily' | 'weekly' | 'monthly';
  recipients: string[];
  filters: Record<string, unknown>;
  columns: string[];
  format: 'pdf' | 'excel' | 'csv';
  is_active: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
}

export interface AdminDashboardWidget {
  id: string;
  type: 'stats' | 'chart' | 'table' | 'list';
  title: string;
  position: { x: number; y: number; w: number; h: number };
  config: Record<string, unknown>;
  isVisible: boolean;
}

export interface DashboardLayout {
  id: string;
  name: string;
  widgets: AdminDashboardWidget[];
  is_default: boolean;
  created_at: string;
}
