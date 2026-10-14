import AsyncStorage from "@react-native-async-storage/async-storage";
import { Buffer } from "buffer";
import * as FileSystem from "expo-file-system/legacy";
import { supabase } from "../lib/supabase";
import type { StudentRow } from "./students";

const STUDENT_SESSION_KEY = "student_session";

export interface StudentSession {
  id: string;
  teacher_id: string;
  full_name: string;
  grade_level: string | null;
  class_name: string | null;
  access_token: string;
}

export const saveStudentSession = async (student: StudentSession) => {
  await AsyncStorage.setItem(STUDENT_SESSION_KEY, JSON.stringify(student));
};

export const getStudentSession = async (): Promise<StudentSession | null> => {
  const raw = await AsyncStorage.getItem(STUDENT_SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StudentSession;
  } catch {
    return null;
  }
};

export const clearStudentSession = async () => {
  await AsyncStorage.removeItem(STUDENT_SESSION_KEY);
};

/** Token portal first; fall back to students.auth_user_id for email login. */
export const resolveActiveStudentSession = async (): Promise<StudentSession | null> => {
  const tokenSession = await getStudentSession();
  if (tokenSession) return tokenSession;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: student } = await supabase
    .from("students")
    .select("id,teacher_id,full_name,grade_level,class_name,access_token")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!student) return null;

  return {
    id: student.id,
    teacher_id: student.teacher_id,
    full_name: student.full_name,
    grade_level: student.grade_level,
    class_name: student.class_name,
    access_token: student.access_token ?? "",
  };
};

/** Accept a raw token or a pasted /student-access/<token> link. */
export const normalizeStudentToken = (raw: string) => {
  const trimmed = raw.trim();
  const marker = "/student-access/";
  const idx = trimmed.toLowerCase().indexOf(marker);
  if (idx >= 0) {
    const rest = trimmed.slice(idx + marker.length);
    try {
      return decodeURIComponent(rest.split(/[?#/]/)[0] ?? "").trim();
    } catch {
      return rest.split(/[?#/]/)[0]?.trim() ?? "";
    }
  }
  return trimmed;
};

const rowToSession = (row: any, token: string): StudentSession | null => {
  if (!row || typeof row !== "object" || !row.id) return null;
  const status = String(row.account_status ?? "active").toLowerCase();
  if (status === "paused" || status === "suspended") {
    throw new Error("This account has been paused by your teacher.");
  }
  return {
    id: String(row.id),
    teacher_id: String(row.teacher_id ?? ""),
    full_name: String(row.full_name ?? "Student"),
    grade_level: row.grade_level ?? null,
    class_name: row.class_name ?? null,
    access_token: token,
  };
};

export const loginStudentByToken = async (token: string): Promise<StudentSession> => {
  const accessToken = normalizeStudentToken(token);
  if (!accessToken) {
    throw new Error("Enter the access token from your teacher.");
  }

  const { data, error } = await supabase.rpc("get_student_by_token_secure", {
    p_access_token: accessToken,
  });

  // Empty arrays are truthy — never read `.id` until we have a real row.
  const rpcRow = !error && data ? (Array.isArray(data) ? data[0] : data) : null;
  let session = rowToSession(rpcRow, accessToken);

  if (!session) {
    const { data: student } = await supabase
      .from("students")
      .select("id,teacher_id,full_name,grade_level,class_name,access_token,account_status")
      .eq("access_token", accessToken)
      .maybeSingle();
    session = rowToSession(student, accessToken);
  }

  if (!session) {
    throw new Error("This token is not valid. Ask your teacher for the child's access token.");
  }

  await saveStudentSession(session);
  void supabase.rpc("record_student_portal_activity", {
    p_student_id: session.id,
    p_access_token: accessToken,
  });
  return session;
};

export const listStudentAssignments = async (studentId: string) => {
  const { data, error } = await supabase
    .from("assignment_students")
    .select(
      "assignment_id, extended_due_date, assignments ( id, title, due_date, status, max_score, description, instructions, attachment_url, subject, grade_level )",
    )
    .eq("student_id", studentId);
  if (error) throw error;
  return (data ?? [])
    .map((row: any) => {
      const a = Array.isArray(row.assignments) ? row.assignments[0] : row.assignments;
      if (!a) return null;
      const status = a.status === "published" ? "active" : a.status;
      // Match web: students only see active (and already-submitted closed ones via submission merge).
      if (status && status !== "active" && status !== "closed") return null;
      return {
        ...a,
        status,
        due_date: row.extended_due_date || a.due_date,
        extended_due_date: row.extended_due_date ?? null,
      };
    })
    .filter(Boolean);
};

export const listStudentSubmissions = async (studentId: string) => {
  const { data, error } = await supabase
    .from("assignment_submissions")
    .select(
      "id,assignment_id,status,score,ai_score,submitted_at,teacher_feedback,ai_feedback,notes,file_url,assignments ( id, title, max_score )",
    )
    .eq("student_id", studentId)
    .order("submitted_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
};

const LEARNER_SELECT =
  "id,teacher_id,auth_user_id,access_token,student_code,account_status,full_name,date_of_birth,gender,nationality,place_of_birth,home_language,parent_name,parent_phone,parent_email,parent_relationship,home_address,school_name,grade_level,class_name,admission_number,academic_year,blood_group,medical_conditions,allergies,special_needs,disability_status,previous_school,profile_photo_url,notes,created_at,updated_at";

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  pdf: "application/pdf",
  txt: "text/plain",
};

const ALLOWED_MIME = new Set(Object.values(MIME_BY_EXT));

const fail = (error: unknown, fallback: string): never => {
  const record = error as { message?: unknown } | null;
  const message =
    error instanceof Error && error.message && error.message !== "[object Object]"
      ? error.message
      : typeof record?.message === "string" && record.message.trim() && record.message !== "[object Object]"
        ? record.message
        : fallback;
  throw new Error(message);
};

const decodeBase64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const buf = Buffer.from(base64, "base64");
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
};

const resolveUploadMime = (fileName: string, mimeType?: string) => {
  const raw = (mimeType || "").toLowerCase().trim();
  const normalized = raw === "image/jpg" ? "image/jpeg" : raw;
  if (normalized && ALLOWED_MIME.has(normalized)) return normalized;
  const ext = fileName.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
  const fromExt = MIME_BY_EXT[ext];
  if (fromExt) return fromExt;
  throw new Error("Please submit a JPEG, PNG, WebP, GIF, or PDF file.");
};

const uploadToAssignmentFiles = async (input: {
  path: string;
  uri: string;
  fileName: string;
  mimeType?: string;
  maxBytes: number;
}) => {
  const info = await FileSystem.getInfoAsync(input.uri);
  if (!info.exists) throw new Error("That file is no longer available. Please pick it again.");
  if ("size" in info && typeof info.size === "number" && info.size > input.maxBytes) {
    throw new Error(`File is too large (max ${Math.round(input.maxBytes / (1024 * 1024))}MB).`);
  }

  const mime = resolveUploadMime(input.fileName, input.mimeType);
  const base64 = await FileSystem.readAsStringAsync(input.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const { error: uploadError } = await supabase.storage.from("assignment-files").upload(input.path, decodeBase64ToArrayBuffer(base64), {
    contentType: mime,
    upsert: false,
  });
  if (uploadError) fail(uploadError, "Could not upload your file. Please try again.");
  return supabase.storage.from("assignment-files").getPublicUrl(input.path).data.publicUrl;
};

/** Full roster row for the signed-in learner (token portal or email login). */
export const fetchActiveLearner = async (): Promise<StudentRow | null> => {
  const session = await resolveActiveStudentSession();
  if (!session) return null;

  if (session.access_token) {
    const { data, error } = await supabase.rpc("get_student_by_token_secure", {
      p_access_token: session.access_token,
    });
    const row = !error && data ? (Array.isArray(data) ? data[0] : data) : null;
    if (row?.id) return row as StudentRow;
  }

  const { data, error } = await supabase
    .from("students")
    .select(LEARNER_SELECT)
    .eq("id", session.id)
    .maybeSingle();
  if (error) fail(error, "Could not load your profile.");
  return (data as StudentRow | null) ?? null;
};

export const updateLearnerProfilePhoto = async (input: {
  uri: string;
  fileName: string;
  mimeType?: string;
}) => {
  const session = await resolveActiveStudentSession();
  if (!session) throw new Error("Sign in again to update your photo.");

  const ext = input.fileName.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const safeExt = MIME_BY_EXT[ext] ? ext : "jpg";
  const path = `profiles/${session.id}/avatar_${Date.now()}.${safeExt === "jpeg" ? "jpg" : safeExt}`;
  const photoUrl = await uploadToAssignmentFiles({
    path,
    uri: input.uri,
    fileName: input.fileName,
    mimeType: input.mimeType,
    maxBytes: 5 * 1024 * 1024,
  });

  const { error } = await supabase.rpc("update_student_photo_by_token", {
    p_student_id: session.id,
    p_access_token: session.access_token || "",
    p_photo_url: photoUrl,
  });
  if (error) fail(error, "Could not update your profile photo.");
  return photoUrl;
};

/** Uploads the learner's file, then records (or replaces) their submission row. */
export const submitAssignmentFile = async (input: {
  assignmentId: string;
  studentId: string;
  uri: string;
  fileName: string;
  mimeType?: string;
  notes?: string;
}) => {
  const session = await resolveActiveStudentSession();
  if (!session?.id) throw new Error("Sign in again to submit your work.");

  const safeName = input.fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
  const path = `submissions/${input.studentId}/${input.assignmentId}/${Date.now()}-${safeName}`;
  const fileUrl = await uploadToAssignmentFiles({
    path,
    uri: input.uri,
    fileName: input.fileName,
    mimeType: input.mimeType,
    maxBytes: 10 * 1024 * 1024,
  });
  const notes = input.notes?.trim() || null;

  if (session.access_token) {
    const { error: rpcError } = await supabase.rpc("submit_assignment_by_token", {
      p_student_id: input.studentId,
      p_access_token: session.access_token,
      p_assignment_id: input.assignmentId,
      p_notes: notes,
      p_file_url: fileUrl,
      p_file_hash: null,
    });
    if (rpcError) fail(rpcError, "Could not submit your work.");
    return fileUrl;
  }

  const { data: existing } = await supabase
    .from("assignment_submissions")
    .select("id,status")
    .eq("assignment_id", input.assignmentId)
    .eq("student_id", input.studentId)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    if (existing.status !== "returned") {
      throw new Error("You have already submitted this assignment.");
    }
    const { error: updateError } = await supabase
      .from("assignment_submissions")
      .update({
        file_url: fileUrl,
        notes,
        status: "submitted",
        submitted_at: new Date().toISOString(),
        score: null,
        teacher_feedback: null,
        graded_at: null,
      })
      .eq("id", existing.id);
    if (updateError) fail(updateError, "Could not submit your work.");
    return fileUrl;
  }

  const { error: insertError } = await supabase.from("assignment_submissions").insert({
    assignment_id: input.assignmentId,
    student_id: input.studentId,
    file_url: fileUrl,
    notes,
    status: "submitted",
  });
  if (insertError) fail(insertError, "Could not submit your work.");
  return fileUrl;
};

export const listStudentAnnouncements = async (
  teacherId: string,
  gradeLevel?: string | null,
  studentId?: string | null,
  className?: string | null,
) => {
  let query = supabase
    .from("announcements")
    .select("id,title,message,category,is_pinned,created_at,target_grade_level,target_class_name,expires_at,priority,announcement_reads(student_id)")
    .eq("teacher_id", teacherId)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });

  const { data, error } = await query;
  if (error) {
    // Fallback without reads join
    const { data: rows, error: e2 } = await supabase
      .from("announcements")
      .select("id,title,message,category,is_pinned,created_at,target_grade_level,target_class_name,expires_at,priority")
      .eq("teacher_id", teacherId)
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false });
    if (e2) throw e2;
    return (rows ?? []).filter((a) => {
      if (a.expires_at && new Date(a.expires_at).getTime() < Date.now()) return false;
      if (a.target_grade_level && gradeLevel && a.target_grade_level !== gradeLevel) return false;
      if (a.target_class_name && className && a.target_class_name !== className) return false;
      return true;
    });
  }

  return (data ?? [])
    .filter((a: any) => {
      if (a.expires_at && new Date(a.expires_at).getTime() < Date.now()) return false;
      if (a.target_grade_level && gradeLevel && a.target_grade_level !== gradeLevel) return false;
      if (a.target_class_name && className && a.target_class_name !== className) return false;
      return true;
    })
    .map((a: any) => ({
      ...a,
      is_read: studentId
        ? (a.announcement_reads ?? []).some((r: any) => r.student_id === studentId)
        : false,
      announcement_reads: undefined,
    }));
};

export const markStudentAnnouncementRead = async (
  studentId: string,
  accessToken: string,
  announcementId: string,
) => {
  if (accessToken) {
    const { error } = await supabase.rpc("mark_announcement_read_by_token", {
      p_student_id: studentId,
      p_access_token: accessToken,
      p_announcement_id: announcementId,
    });
    if (!error) return;
  }
  await supabase.from("announcement_reads").upsert(
    { announcement_id: announcementId, student_id: studentId },
    { onConflict: "announcement_id,student_id" },
  );
};

export const listStudentResources = async (teacherId: string, gradeLevel?: string | null) => {
  const { data, error } = await supabase
    .from("resources")
    .select("id,title,description,file_url,file_type,topic,grade_level,created_at,thumbnail_url")
    .eq("teacher_id", teacherId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).filter(
    (r) => !r.grade_level || !gradeLevel || r.grade_level === gradeLevel,
  );
};

export const listStudentWorksByName = async (studentName: string) => {
  const { data, error } = await supabase
    .from("student_works")
    .select("id,subject,feedback,error_type,remediation,image_url,created_at")
    .eq("student_name", studentName)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
};
