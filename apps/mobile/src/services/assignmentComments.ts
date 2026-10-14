import { supabase } from "../lib/supabase";
import { getStudentSession } from "./studentPortal";

export interface AssignmentComment {
  id: string;
  assignment_id: string;
  student_id: string | null;
  teacher_id: string | null;
  parent_comment_id: string | null;
  message: string;
  is_private: boolean;
  created_at: string;
  updated_at?: string | null;
  author_name?: string;
  is_teacher?: boolean;
}

export const listCommentsForTeacher = async (
  assignmentId: string,
): Promise<AssignmentComment[]> => {
  const { data, error } = await supabase
    .from("assignment_comments")
    .select("*, students:student_id ( full_name )")
    .eq("assignment_id", assignmentId)
    .order("created_at", { ascending: true });
  if (error) throw error;

  return (data ?? []).map((c: any) => {
    const student = Array.isArray(c.students) ? c.students[0] : c.students;
    return {
      id: c.id,
      assignment_id: c.assignment_id,
      student_id: c.student_id,
      teacher_id: c.teacher_id,
      parent_comment_id: c.parent_comment_id,
      message: c.message,
      is_private: !!c.is_private,
      created_at: c.created_at,
      updated_at: c.updated_at,
      author_name: c.teacher_id ? "Teacher" : student?.full_name || "Student",
      is_teacher: !!c.teacher_id,
    } as AssignmentComment;
  });
};

export const addTeacherComment = async (
  assignmentId: string,
  message: string,
  parentCommentId?: string | null,
): Promise<AssignmentComment> => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("assignment_comments")
    .insert({
      assignment_id: assignmentId,
      teacher_id: user.id,
      message: message.trim(),
      parent_comment_id: parentCommentId || null,
      is_private: false,
    })
    .select()
    .single();
  if (error) throw error;
  return {
    ...(data as AssignmentComment),
    author_name: "Teacher",
    is_teacher: true,
  };
};

export const deleteComment = async (commentId: string) => {
  const { error } = await supabase.from("assignment_comments").delete().eq("id", commentId);
  if (error) throw error;
};

export const listCommentsForStudent = async (
  assignmentId: string,
  studentId: string,
): Promise<AssignmentComment[]> => {
  const session = await getStudentSession();
  if (session?.access_token) {
    const { data, error } = await supabase.rpc("get_assignment_comments_by_token", {
      p_student_id: studentId,
      p_access_token: session.access_token,
      p_assignment_id: assignmentId,
    });
    if (!error && data) {
      return (data as any[]).map((c) => ({
        ...c,
        author_name: c.teacher_id ? "Teacher" : "You",
        is_teacher: !!c.teacher_id,
      }));
    }
  }

  const { data, error } = await supabase
    .from("assignment_comments")
    .select("*")
    .eq("assignment_id", assignmentId)
    .eq("is_private", false)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((c: any) => ({
    ...c,
    author_name: c.teacher_id ? "Teacher" : c.student_id === studentId ? "You" : "Student",
    is_teacher: !!c.teacher_id,
  }));
};

export const addStudentComment = async (
  assignmentId: string,
  studentId: string,
  message: string,
): Promise<void> => {
  const session = await getStudentSession();
  if (session?.access_token) {
    const { error } = await supabase.rpc("add_comment_by_token", {
      p_student_id: studentId,
      p_access_token: session.access_token,
      p_assignment_id: assignmentId,
      p_message: message.trim(),
      p_parent_comment_id: null,
    });
    if (!error) return;
  }

  const { error } = await supabase.from("assignment_comments").insert({
    assignment_id: assignmentId,
    student_id: studentId,
    message: message.trim(),
    is_private: false,
  });
  if (error) throw error;
};
