/**
 * Notification Service
 * Handles in-app notifications for students and teachers
 */

import { supabase } from '@/lib/supabase';
import { getStudentSession } from './studentService';

// ── Types ─────────────────────────────────────────────────

export interface Notification {
  id: string;
  recipient_student_id: string | null;
  recipient_teacher_id: string | null;
  type: 'assignment_due' | 'graded' | 'new_assignment' | 'comment' | 'resubmit_request' | 'announcement' | 'submission' | 'general';
  title: string;
  message: string | null;
  link_url: string | null;
  related_assignment_id: string | null;
  related_submission_id: string | null;
  is_read: boolean;
  created_at: string;
}

// ── Student Notifications (Magic Link) ────────────────────

/** Get notifications for a magic-link student */
export const getStudentNotifications = async (limit = 50): Promise<Notification[]> => {
  const session = getStudentSession();
  if (!session) throw new Error('No student session');

  const { data, error } = await supabase.rpc('get_student_notifications_by_token', {
    p_student_id: session.id,
    p_access_token: session.access_token,
    p_limit: limit,
  });

  if (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }

  return data || [];
};

/** Get unread notification count for student */
export const getStudentUnreadCount = async (): Promise<number> => {
  const notifications = await getStudentNotifications(100);
  return notifications.filter(n => !n.is_read).length;
};

/** Mark a student notification as read */
export const markStudentNotificationRead = async (notificationId: string): Promise<void> => {
  const { error } = await supabase.rpc('mark_notification_read', {
    p_notification_id: notificationId,
  });

  if (error) {
    console.error('Error marking notification read:', error);
  }
};

/** Mark all student notifications as read */
export const markAllStudentNotificationsRead = async (): Promise<void> => {
  const session = getStudentSession();
  if (!session) return;

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('recipient_student_id', session.id)
    .eq('is_read', false);

  if (error) {
    console.error('Error marking all notifications read:', error);
  }
};

// ── Teacher Notifications ─────────────────────────────────

/** Get notifications for authenticated teacher */
export const getTeacherNotifications = async (limit = 50): Promise<Notification[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('recipient_teacher_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching teacher notifications:', error);
    return [];
  }

  return data || [];
};

/** Get unread count for teacher */
export const getTeacherUnreadCount = async (): Promise<number> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('recipient_teacher_id', user.id)
    .eq('is_read', false);

  if (error) {
    console.error('Error getting unread count:', error);
    return 0;
  }

  return count || 0;
};

/** Mark a teacher notification as read */
export const markTeacherNotificationRead = async (notificationId: string): Promise<void> => {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);

  if (error) {
    console.error('Error marking notification read:', error);
  }
};

/** Mark all teacher notifications as read */
export const markAllTeacherNotificationsRead = async (): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('recipient_teacher_id', user.id)
    .eq('is_read', false);

  if (error) {
    console.error('Error marking all notifications read:', error);
  }
};

/** Delete a notification */
export const deleteNotification = async (notificationId: string): Promise<void> => {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId);

  if (error) {
    console.error('Error deleting notification:', error);
    throw new Error('Failed to delete notification');
  }
};

// ── Create Notifications ──────────────────────────────────

/** Create a notification (teacher use) */
export const createNotification = async (params: {
  recipientStudentId?: string;
  recipientTeacherId?: string;
  type: Notification['type'];
  title: string;
  message?: string;
  linkUrl?: string;
  relatedAssignmentId?: string;
  relatedSubmissionId?: string;
}): Promise<Notification | null> => {
  const { data, error } = await supabase.rpc('create_notification', {
    p_recipient_student_id: params.recipientStudentId || null,
    p_recipient_teacher_id: params.recipientTeacherId || null,
    p_type: params.type,
    p_title: params.title,
    p_message: params.message || null,
    p_link_url: params.linkUrl || null,
    p_related_assignment_id: params.relatedAssignmentId || null,
    p_related_submission_id: params.relatedSubmissionId || null,
  });

  if (error) {
    console.error('Error creating notification:', error);
    return null;
  }

  return data;
};

/** Bulk notify all students of a teacher */
export const notifyAllStudents = async (
  teacherId: string,
  type: Notification['type'],
  title: string,
  message?: string,
  linkUrl?: string
): Promise<void> => {
  // Get all students for this teacher
  const { data: students, error } = await supabase
    .from('students')
    .select('id')
    .eq('teacher_id', teacherId)
    .eq('account_status', 'active');

  if (error || !students) {
    console.error('Error fetching students for notification:', error);
    return;
  }

  // Create notifications in bulk
  const notifications = students.map(s => ({
    recipient_student_id: s.id,
    type,
    title,
    message,
    link_url: linkUrl,
  }));

  const { error: insertError } = await supabase
    .from('notifications')
    .insert(notifications);

  if (insertError) {
    console.error('Error creating bulk notifications:', insertError);
  }
};

// ── Notification Type Helpers ─────────────────────────────

export const getNotificationIcon = (type: Notification['type']): string => {
  switch (type) {
    case 'new_assignment': return '📚';
    case 'graded': return '⭐';
    case 'assignment_due': return '⏰';
    case 'comment': return '💬';
    case 'resubmit_request': return '🔄';
    case 'announcement': return '📢';
    case 'submission': return '📤';
    default: return '🔔';
  }
};

export const getNotificationColor = (type: Notification['type']): string => {
  switch (type) {
    case 'new_assignment': return 'bg-blue-100 text-blue-700';
    case 'graded': return 'bg-emerald-100 text-emerald-700';
    case 'assignment_due': return 'bg-amber-100 text-amber-700';
    case 'comment': return 'bg-violet-100 text-violet-700';
    case 'resubmit_request': return 'bg-orange-100 text-orange-700';
    case 'announcement': return 'bg-pink-100 text-pink-700';
    case 'submission': return 'bg-teal-100 text-teal-700';
    default: return 'bg-gray-100 text-gray-700';
  }
};
