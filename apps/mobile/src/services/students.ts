import { supabase } from "../lib/supabase";

export interface StudentRow {
  id: string;
  teacher_id: string;
  auth_user_id: string | null;
  access_token: string;
  student_code: string | null;
  account_status: "active" | "paused" | "suspended" | string | null;

  full_name: string;
  date_of_birth: string | null;
  gender: string | null;
  nationality: string | null;
  place_of_birth: string | null;
  home_language: string | null;

  parent_name: string | null;
  parent_phone: string | null;
  parent_email: string | null;
  parent_relationship: string | null;
  home_address: string | null;

  school_name: string | null;
  grade_level: string | null;
  class_name: string | null;
  admission_number: string | null;
  academic_year: string | null;

  blood_group: string | null;
  medical_conditions: string | null;
  allergies: string | null;
  special_needs: string | null;
  disability_status: string | null;

  previous_school: string | null;
  profile_photo_url: string | null;
  notes: string | null;

  created_at: string;
  updated_at?: string;
  last_portal_activity_at?: string | null;
  last_submission_at?: string | null;
}

export type Learner = StudentRow;

export type StudentWritable = Partial<
  Omit<
    StudentRow,
    "id" | "created_at" | "updated_at" | "auth_user_id" | "access_token" | "student_code" | "account_status"
  >
> & {
  teacher_id: string;
  full_name: string;
  grade_level: string;
};

/** Same alphabet as web `generateAccessToken`. */
export const generateAccessToken = (): string => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const array = new Uint8Array(32);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else {
    for (let i = 0; i < array.length; i++) array[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(array, (b) => chars[b % chars.length]).join("");
};

/** Web magic-link URL (students open this in browser / student-access deep link). */
export const buildAccessLink = (token: string): string => {
  const origin = (process.env.EXPO_PUBLIC_SITE_URL ?? "https://mamamath.org").replace(/\/$/, "");
  return `${origin}/student-access/${token}`;
};

export const getStudentLastActiveAt = (s: StudentRow): string | null => {
  const a = s.last_portal_activity_at || null;
  const b = s.last_submission_at || null;
  if (a && b) return a > b ? a : b;
  return a || b;
};

export const listStudentsForTeacher = async (teacherId: string): Promise<StudentRow[]> => {
  const { data, error } = await supabase
    .from("students")
    .select("*")
    .eq("teacher_id", teacherId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as StudentRow[];
};

export const createStudent = async (input: StudentWritable): Promise<StudentRow> => {
  const access_token = generateAccessToken();
  const { data, error } = await supabase
    .from("students")
    .insert({
      ...input,
      access_token,
      account_status: "active",
    })
    .select()
    .single();
  if (error) throw error;
  return data as StudentRow;
};

export const updateStudent = async (
  id: string,
  patch: Record<string, string | null>,
): Promise<StudentRow> => {
  const { data, error } = await supabase
    .from("students")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as StudentRow;
};

export const updateStudentStatus = async (id: string, account_status: string) => {
  const { error } = await supabase.from("students").update({ account_status }).eq("id", id);
  if (error) throw error;
};

export const toggleStudentStatus = async (student: StudentRow) => {
  const next = (student.account_status ?? "active") === "active" ? "paused" : "active";
  await updateStudentStatus(student.id, next);
  return next;
};

export const regenerateAccessToken = async (id: string): Promise<string> => {
  const access_token = generateAccessToken();
  const { error } = await supabase.from("students").update({ access_token }).eq("id", id);
  if (error) throw error;
  return access_token;
};

export const deleteStudent = async (id: string) => {
  await supabase.from("assignment_students").delete().eq("student_id", id);
  await supabase.from("assignment_submissions").delete().eq("student_id", id);
  const { error } = await supabase.from("students").delete().eq("id", id);
  if (error) throw error;
};

export const sendStudentCodeSms = async (input: {
  parentPhone: string;
  studentName: string;
  studentCode: string | null;
  accessLink: string;
  country: string;
}): Promise<{ success: boolean; error?: string }> => {
  const first =
    input.studentName.trim().split(/\s+/)[0]?.slice(0, 14) || "Student";
  const msg = `MM ${first} code ${input.studentCode || "—"} ${input.accessLink}`;
  try {
    const { data, error } = await supabase.functions.invoke("send-sms-notification", {
      body: { to: input.parentPhone, message: msg, country: input.country },
    });
    const bodyError =
      data && typeof data === "object" && "error" in data
        ? String((data as { error: string }).error)
        : "";
    if (error) return { success: false, error: bodyError || error.message };
    if (data && typeof data === "object" && "ok" in data && !(data as { ok: boolean }).ok) {
      return { success: false, error: bodyError || "SMS send failed." };
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "SMS failed" };
  }
};
