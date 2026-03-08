/**
 * Announcements Service
 * Teacher broadcasts to students
 */

import { supabase } from '@/lib/supabase';
import { getStudentSession } from './studentService';

// ── Types ─────────────────────────────────────────────────

export interface Announcement {
  id: string;
  teacher_id: string;
  title: string;
  message: string;
  category: string | null;
  target_grade_level: string | null;
  target_class_name: string | null;
  is_pinned: boolean;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  is_read?: boolean;
  read_count?: number;
}

// ── Student Announcements ─────────────────────────────────

/** Get announcements visible to a student */
export const getAnnouncementsForStudent = async (): Promise<Announcement[]> => {
  const session = getStudentSession();
  if (!session) return [];

  const { data, error } = await supabase
    .from('announcements')
    .select(`
      *,
      announcement_reads!left (
        student_id
      )
    `)
    .or(`target_grade_level.is.null,target_grade_level.eq.${session.grade_level}`)
    .or(`target_class_name.is.null,target_class_name.eq.${session.class_name || ''}`)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching announcements:', error);
    return [];
  }

  return (data || []).map(a => ({
    ...a,
    is_read: a.announcement_reads?.some((r: { student_id: string }) => r.student_id === session.id) || false,
    announcement_reads: undefined,
  }));
};

/** Mark announcement as read by student */
export const markAnnouncementRead = async (announcementId: string): Promise<void> => {
  const session = getStudentSession();
  if (!session) return;

  const { error } = await supabase.rpc('mark_announcement_read_by_token', {
    p_student_id: session.id,
    p_access_token: session.access_token,
    p_announcement_id: announcementId,
  });

  if (error) {
    console.error('Error marking announcement read:', error);
  }
};

/** Get unread announcement count for student */
export const getUnreadAnnouncementCount = async (): Promise<number> => {
  const announcements = await getAnnouncementsForStudent();
  return announcements.filter(a => !a.is_read).length;
};

// ── Teacher Announcements ─────────────────────────────────

/** Get all announcements for a teacher */
export const getAnnouncementsForTeacher = async (): Promise<Announcement[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('announcements')
    .select(`
      *,
      announcement_reads (count)
    `)
    .eq('teacher_id', user.id)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching announcements:', error);
    return [];
  }

  return (data || []).map(a => ({
    ...a,
    read_count: a.announcement_reads?.[0]?.count || 0,
    announcement_reads: undefined,
  }));
};

/** Create a new announcement */
export const createAnnouncement = async (params: {
  title: string;
  message: string;
  category?: string;
  targetGradeLevel?: string;
  targetClassName?: string;
  isPinned?: boolean;
  expiresAt?: Date;
}): Promise<Announcement | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('announcements')
    .insert({
      teacher_id: user.id,
      title: params.title,
      message: params.message,
      category: params.category || null,
      target_grade_level: params.targetGradeLevel || null,
      target_class_name: params.targetClassName || null,
      is_pinned: params.isPinned || false,
      expires_at: params.expiresAt?.toISOString() || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating announcement:', error);
    throw new Error('Failed to create announcement');
  }

  return data;
};

/** Update an announcement */
export const updateAnnouncement = async (
  announcementId: string,
  params: {
    title?: string;
    message?: string;
    category?: string | null;
    targetGradeLevel?: string | null;
    targetClassName?: string | null;
    isPinned?: boolean;
    expiresAt?: Date | null;
    is_pinned?: boolean;
  }
): Promise<Announcement | null> => {
  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
  
  if (params.title !== undefined) updateData.title = params.title;
  if (params.message !== undefined) updateData.message = params.message;
  if (params.category !== undefined) updateData.category = params.category;
  if (params.targetGradeLevel !== undefined) updateData.target_grade_level = params.targetGradeLevel;
  if (params.targetClassName !== undefined) updateData.target_class_name = params.targetClassName;
  if (params.isPinned !== undefined) updateData.is_pinned = params.isPinned;
  if (params.is_pinned !== undefined) updateData.is_pinned = params.is_pinned;
  if (params.expiresAt !== undefined) updateData.expires_at = params.expiresAt?.toISOString() || null;

  const { data, error } = await supabase
    .from('announcements')
    .update(updateData)
    .eq('id', announcementId)
    .select()
    .single();

  if (error) {
    console.error('Error updating announcement:', error);
    throw new Error('Failed to update announcement');
  }

  return data;
};

/** Delete an announcement */
export const deleteAnnouncement = async (announcementId: string): Promise<void> => {
  const { error } = await supabase
    .from('announcements')
    .delete()
    .eq('id', announcementId);

  if (error) {
    console.error('Error deleting announcement:', error);
    throw new Error('Failed to delete announcement');
  }
};

/** Toggle pin status */
export const toggleAnnouncementPin = async (
  announcementId: string,
  isPinned: boolean
): Promise<void> => {
  const { error } = await supabase
    .from('announcements')
    .update({ is_pinned: isPinned, updated_at: new Date().toISOString() })
    .eq('id', announcementId);

  if (error) {
    console.error('Error toggling pin:', error);
    throw new Error('Failed to update announcement');
  }
};

/** Get read statistics for an announcement */
export const getAnnouncementReadStats = async (
  announcementId: string
): Promise<{ total: number; read: number; readers: { student_id: string; full_name: string; read_at: string }[] }> => {
  // Get the announcement to check grade/class targeting
  const { data: announcement } = await supabase
    .from('announcements')
    .select('target_grade_level, target_class_name, teacher_id')
    .eq('id', announcementId)
    .single();

  if (!announcement) return { total: 0, read: 0, readers: [] };

  // Get total eligible students
  let query = supabase
    .from('students')
    .select('id', { count: 'exact', head: true })
    .eq('teacher_id', announcement.teacher_id)
    .eq('account_status', 'active');

  if (announcement.target_grade_level) {
    query = query.eq('grade_level', announcement.target_grade_level);
  }
  if (announcement.target_class_name) {
    query = query.eq('class_name', announcement.target_class_name);
  }

  const { count: total } = await query;

  // Get who read it
  const { data: reads } = await supabase
    .from('announcement_reads')
    .select(`
      student_id,
      read_at,
      students:student_id (full_name)
    `)
    .eq('announcement_id', announcementId);

  const readers = (reads || []).map(r => ({
    student_id: r.student_id,
    full_name: (r.students as unknown as { full_name: string })?.full_name || 'Unknown',
    read_at: r.read_at,
  }));

  return {
    total: total || 0,
    read: readers.length,
    readers,
  };
};
