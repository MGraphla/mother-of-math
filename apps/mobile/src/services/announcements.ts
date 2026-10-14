import { supabase } from "../lib/supabase";

export const ANNOUNCEMENT_CATEGORIES = [
  "General",
  "Assignment",
  "Exam",
  "Event",
  "Reminder",
  "Urgent",
] as const;

export interface AnnouncementRow {
  id: string;
  teacher_id: string;
  title: string;
  message: string;
  category: string | null;
  target_grade_level: string | null;
  target_class_name?: string | null;
  is_pinned: boolean;
  expires_at?: string | null;
  created_at: string;
  updated_at?: string | null;
  read_count?: number;
}

export interface AnnouncementReadStats {
  totalStudents: number;
  readCount: number;
  readRate: number;
  readers: { full_name: string }[];
}

export const listAnnouncementsForTeacher = async (
  teacherId: string,
): Promise<AnnouncementRow[]> => {
  const { data, error } = await supabase
    .from("announcements")
    .select("*, announcement_reads(count)")
    .eq("teacher_id", teacherId)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    // Fallback without join if reads relation isn't available.
    const { data: rows, error: e2 } = await supabase
      .from("announcements")
      .select("*")
      .eq("teacher_id", teacherId)
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false });
    if (e2) throw e2;
    return (rows ?? []) as AnnouncementRow[];
  }

  return (data ?? []).map((a: any) => ({
    ...a,
    read_count: a.announcement_reads?.[0]?.count ?? 0,
    announcement_reads: undefined,
  })) as AnnouncementRow[];
};

export const createAnnouncement = async (input: {
  teacher_id: string;
  title: string;
  message: string;
  category?: string;
  target_grade_level?: string | null;
  target_class_name?: string | null;
  is_pinned?: boolean;
  expires_at?: string | null;
}) => {
  const { data, error } = await supabase
    .from("announcements")
    .insert({
      teacher_id: input.teacher_id,
      title: input.title,
      message: input.message,
      category: input.category ?? "General",
      target_grade_level: input.target_grade_level ?? null,
      target_class_name: input.target_class_name ?? null,
      is_pinned: input.is_pinned ?? false,
      expires_at: input.expires_at ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as AnnouncementRow;
};

export const updateAnnouncement = async (
  id: string,
  input: {
    title?: string;
    message?: string;
    category?: string | null;
    target_grade_level?: string | null;
    target_class_name?: string | null;
    is_pinned?: boolean;
    expires_at?: string | null;
  },
) => {
  const { data, error } = await supabase
    .from("announcements")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as AnnouncementRow;
};

export const setAnnouncementPinned = async (id: string, is_pinned: boolean) => {
  const { error } = await supabase.from("announcements").update({ is_pinned }).eq("id", id);
  if (error) throw error;
};

export const deleteAnnouncement = async (id: string) => {
  const { error } = await supabase.from("announcements").delete().eq("id", id);
  if (error) throw error;
};

export const getAnnouncementReadStats = async (
  announcementId: string,
  teacherId: string,
): Promise<AnnouncementReadStats> => {
  const [{ count: totalStudents }, { data: reads }] = await Promise.all([
    supabase
      .from("students")
      .select("*", { count: "exact", head: true })
      .eq("teacher_id", teacherId)
      .eq("account_status", "active"),
    supabase
      .from("announcement_reads")
      .select("student_id, students(full_name)")
      .eq("announcement_id", announcementId),
  ]);

  const readCount = reads?.length ?? 0;
  const total = totalStudents ?? 0;
  return {
    totalStudents: total,
    readCount,
    readRate: total ? Math.round((readCount / total) * 100) : 0,
    readers: (reads ?? []).map((r: any) => {
      const s = Array.isArray(r.students) ? r.students[0] : r.students;
      return { full_name: s?.full_name ?? "Student" };
    }),
  };
};

export const ANNOUNCEMENT_TEMPLATES = [
  {
    id: "exam",
    title: "Upcoming Exam",
    message:
      "Dear learners,\n\nPlease prepare for the upcoming mathematics exam. Review your class notes and practice exercises. Bring your pencils and eraser.\n\nGood luck!",
    category: "Exam",
    is_pinned: true,
  },
  {
    id: "assignment",
    title: "Assignment Due",
    message:
      "Reminder: Your mathematics assignment is due soon. Please complete all questions carefully and submit on time.\n\nIf you need help, ask during class or office hours.",
    category: "Assignment",
    is_pinned: false,
  },
  {
    id: "cancelled",
    title: "Class Cancelled",
    message:
      "Important notice: Today's mathematics class has been cancelled. We will make up the lesson at a later date.\n\nPlease check for updates.",
    category: "Urgent",
    is_pinned: true,
  },
] as const;
