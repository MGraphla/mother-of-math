import * as FileSystem from "expo-file-system/legacy";
import { supabase } from "../lib/supabase";
import type { StudentRow } from "./students";

export type AssignmentStatus = "active" | "draft" | "closed" | "published";

export interface Assignment {
  id: string;
  teacher_id: string;
  title: string;
  description: string | null;
  subject: string | null;
  grade_level: string | null;
  due_date: string | null;
  status: AssignmentStatus | string | null;
  max_score: number | null;
  instructions: string | null;
  attachment_url: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface AssignmentWithMeta extends Assignment {
  assignedStudentIds: string[];
  submissionCount: number;
  gradedCount: number;
}

export interface AssignmentSubmission {
  id: string;
  assignment_id: string;
  student_id: string;
  status: string | null;
  score: number | null;
  ai_score: number | null;
  teacher_feedback: string | null;
  ai_feedback: string | null;
  ai_graded_at: string | null;
  notes: string | null;
  file_url: string | null;
  submitted_at: string | null;
  graded_at: string | null;
  student_name?: string;
}

export interface AssignmentStats {
  totalAssignments: number;
  activeAssignments: number;
  draftAssignments: number;
  closedAssignments: number;
  totalSubmissions: number;
  gradedSubmissions: number;
  pendingGrades: number;
  overdueAssignments: number;
}

const normalizeStatus = (status: string | null | undefined): string => {
  if (status === "published") return "active";
  return status ?? "draft";
};

const decodeBase64ToBytes = (base64: string) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

export const listAssignmentsForTeacher = async (teacherId: string): Promise<AssignmentWithMeta[]> => {
  const { data, error } = await supabase
    .from("assignments")
    .select("*")
    .eq("teacher_id", teacherId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const assignments = (data ?? []) as Assignment[];
  if (!assignments.length) return [];

  const ids = assignments.map((a) => a.id);
  const [{ data: links }, { data: subs }] = await Promise.all([
    supabase.from("assignment_students").select("assignment_id, student_id").in("assignment_id", ids),
    supabase.from("assignment_submissions").select("assignment_id, status").in("assignment_id", ids),
  ]);

  const byAssign = new Map<string, string[]>();
  for (const link of links ?? []) {
    const list = byAssign.get(link.assignment_id) ?? [];
    list.push(link.student_id);
    byAssign.set(link.assignment_id, list);
  }

  const subCounts = new Map<string, { total: number; graded: number }>();
  for (const sub of subs ?? []) {
    const cur = subCounts.get(sub.assignment_id) ?? { total: 0, graded: 0 };
    cur.total += 1;
    if (sub.status === "graded" || sub.status === "returned") cur.graded += 1;
    subCounts.set(sub.assignment_id, cur);
  }

  return assignments.map((a) => ({
    ...a,
    status: normalizeStatus(a.status),
    assignedStudentIds: byAssign.get(a.id) ?? [],
    submissionCount: subCounts.get(a.id)?.total ?? 0,
    gradedCount: subCounts.get(a.id)?.graded ?? 0,
  }));
};

export const getAssignmentStatsForTeacher = async (teacherId: string): Promise<AssignmentStats> => {
  const items = await listAssignmentsForTeacher(teacherId);
  const now = Date.now();
  return {
    totalAssignments: items.length,
    activeAssignments: items.filter((a) => normalizeStatus(a.status) === "active").length,
    draftAssignments: items.filter((a) => normalizeStatus(a.status) === "draft").length,
    closedAssignments: items.filter((a) => normalizeStatus(a.status) === "closed").length,
    totalSubmissions: items.reduce((n, a) => n + a.submissionCount, 0),
    gradedSubmissions: items.reduce((n, a) => n + a.gradedCount, 0),
    pendingGrades: items.reduce((n, a) => n + Math.max(0, a.submissionCount - a.gradedCount), 0),
    overdueAssignments: items.filter(
      (a) =>
        normalizeStatus(a.status) === "active" &&
        !!a.due_date &&
        new Date(a.due_date).getTime() < now,
    ).length,
  };
};

export const createAssignment = async (input: {
  teacher_id: string;
  title: string;
  description?: string | null;
  subject?: string | null;
  grade_level?: string | null;
  due_date?: string | null;
  max_score?: number | null;
  instructions?: string | null;
  attachment_url?: string | null;
  status?: AssignmentStatus;
  studentIds?: string[];
}): Promise<Assignment> => {
  const status = input.status ?? "active";
  const { data, error } = await supabase
    .from("assignments")
    .insert({
      teacher_id: input.teacher_id,
      title: input.title,
      description: input.description ?? null,
      subject: input.subject ?? "Mathematics",
      grade_level: input.grade_level ?? null,
      due_date: input.due_date ?? null,
      status,
      max_score: input.max_score ?? 10,
      instructions: input.instructions ?? null,
      attachment_url: input.attachment_url ?? null,
    })
    .select()
    .single();
  if (error) throw error;

  const assignment = data as Assignment;
  if (input.studentIds?.length) {
    await replaceAssignmentStudents(assignment.id, input.studentIds);
  }
  return { ...assignment, status: normalizeStatus(assignment.status) };
};

export const updateAssignment = async (
  id: string,
  updates: Partial<
    Pick<
      Assignment,
      | "title"
      | "description"
      | "subject"
      | "grade_level"
      | "due_date"
      | "status"
      | "max_score"
      | "instructions"
      | "attachment_url"
    >
  >,
) => {
  const { error } = await supabase
    .from("assignments")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
};

export const replaceAssignmentStudents = async (assignmentId: string, studentIds: string[]) => {
  await supabase.from("assignment_students").delete().eq("assignment_id", assignmentId);
  if (!studentIds.length) return;
  const { error } = await supabase.from("assignment_students").insert(
    studentIds.map((student_id) => ({ assignment_id: assignmentId, student_id })),
  );
  if (error) throw error;
};

export const deleteAssignment = async (id: string) => {
  await supabase.from("assignment_submissions").delete().eq("assignment_id", id);
  await supabase.from("assignment_students").delete().eq("assignment_id", id);
  const { error } = await supabase.from("assignments").delete().eq("id", id);
  if (error) throw error;
};

export const duplicateAssignment = async (
  source: AssignmentWithMeta,
  teacherId: string,
): Promise<Assignment> =>
  createAssignment({
    teacher_id: teacherId,
    title: `${source.title} (Copy)`,
    description: source.description,
    subject: source.subject,
    grade_level: source.grade_level,
    due_date: source.due_date,
    max_score: source.max_score,
    instructions: source.instructions,
    attachment_url: source.attachment_url,
    status: "draft",
    studentIds: source.assignedStudentIds,
  });

export const listSubmissionsForAssignment = async (
  assignmentId: string,
): Promise<AssignmentSubmission[]> => {
  const { data, error } = await supabase
    .from("assignment_submissions")
    .select(
      "id, assignment_id, student_id, status, score, ai_score, teacher_feedback, ai_feedback, ai_graded_at, notes, file_url, submitted_at, graded_at, students ( full_name )",
    )
    .eq("assignment_id", assignmentId)
    .order("submitted_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row: any) => {
    const student = Array.isArray(row.students) ? row.students[0] : row.students;
    const { students: _s, ...rest } = row;
    return {
      ...rest,
      student_name: student?.full_name ?? undefined,
    } as AssignmentSubmission;
  });
};

export const getUnsubmittedStudents = async (
  assignment: AssignmentWithMeta,
  students: StudentRow[],
): Promise<StudentRow[]> => {
  const assigned = new Set(assignment.assignedStudentIds);
  const { data } = await supabase
    .from("assignment_submissions")
    .select("student_id")
    .eq("assignment_id", assignment.id);
  const submitted = new Set((data ?? []).map((s) => s.student_id));
  return students.filter((s) => assigned.has(s.id) && !submitted.has(s.id));
};

export const gradeSubmission = async (id: string, score: number, feedback: string) => {
  const { error } = await supabase
    .from("assignment_submissions")
    .update({
      score,
      teacher_feedback: feedback,
      status: "graded",
      graded_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
};

export const returnSubmission = async (
  id: string,
  score: number | null,
  feedback: string,
) => {
  const { error } = await supabase
    .from("assignment_submissions")
    .update({
      score,
      teacher_feedback: feedback,
      status: "returned",
      graded_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
};

export const grantStudentExtension = async (
  assignmentId: string,
  studentId: string,
  extendedDueDate: string,
) => {
  const { error } = await supabase
    .from("assignment_students")
    .update({ extended_due_date: extendedDueDate })
    .eq("assignment_id", assignmentId)
    .eq("student_id", studentId);
  if (error) throw error;
};

export const uploadAssignmentAttachment = async (input: {
  teacherId: string;
  assignmentId: string;
  uri: string;
  fileName: string;
  mimeType?: string;
}): Promise<string> => {
  const info = await FileSystem.getInfoAsync(input.uri);
  if (!info.exists) throw new Error("That file is no longer available. Please pick it again.");

  const base64 = await FileSystem.readAsStringAsync(input.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const safeName = input.fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
  const path = `attachments/${input.teacherId}/${input.assignmentId}/${Date.now()}-${safeName}`;

  const { error } = await supabase.storage
    .from("assignment-files")
    .upload(path, decodeBase64ToBytes(base64), {
      contentType: input.mimeType || "application/octet-stream",
      upsert: false,
    });
  if (error) throw error;

  return supabase.storage.from("assignment-files").getPublicUrl(path).data.publicUrl;
};

export const notifyStudent = async (params: {
  recipientStudentId: string;
  type: string;
  title: string;
  message?: string;
  relatedAssignmentId?: string;
  relatedSubmissionId?: string;
}) => {
  try {
    await supabase.rpc("create_notification", {
      p_recipient_student_id: params.recipientStudentId,
      p_recipient_teacher_id: null,
      p_type: params.type,
      p_title: params.title,
      p_message: params.message || null,
      p_link_url: "/student/assignments",
      p_related_assignment_id: params.relatedAssignmentId || null,
      p_related_submission_id: params.relatedSubmissionId || null,
    });
  } catch {
    // Non-fatal — assignment flow continues even if notifications are unavailable.
  }
};

export const buildAssignmentsCsv = (rows: AssignmentWithMeta[]) => {
  const headers = [
    "Title",
    "Subject",
    "Grade",
    "Status",
    "Due",
    "MaxScore",
    "Assigned",
    "Submissions",
    "Graded",
  ];
  const lines = [
    headers.join(","),
    ...rows.map((a) =>
      [
        a.title,
        a.subject || "Mathematics",
        a.grade_level || "",
        normalizeStatus(a.status),
        a.due_date || "",
        a.max_score ?? "",
        a.assignedStudentIds.length,
        a.submissionCount,
        a.gradedCount,
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    ),
  ];
  return lines.join("\n");
};
