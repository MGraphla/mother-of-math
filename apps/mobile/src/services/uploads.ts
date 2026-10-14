import * as FileSystem from "expo-file-system/legacy";
import {
  extractGradeFraction,
  parseAiFeedbackSections,
} from "../lib/studentWorkAnalysisPrompt";
import { supabase } from "../lib/supabase";
import { analyzeStudentWorkWithAI } from "./chatbot";

export interface StudentWorkRow {
  id: string;
  teacher_id: string | null;
  parent_id?: string | null;
  student_id?: string | null;
  student_name: string | null;
  subject: string | null;
  grade?: string | null;
  image_url: string;
  feedback: string | null;
  error_type?: string | null;
  remediation?: string | null;
  file_name?: string | null;
  file_type?: string | null;
  file_size?: number | null;
  status: string | null;
  created_at: string;
  feedback_audio_url?: string | null;
  feedback_audio_status?: string | null;
}

const WORK_SELECT =
  "id,teacher_id,parent_id,student_id,student_name,subject,grade,image_url,feedback,error_type,remediation,file_name,file_type,file_size,status,created_at,feedback_audio_url,feedback_audio_status";

const decodeBase64ToBytes = (base64: string) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

export const listStudentWorks = async (teacherId: string): Promise<StudentWorkRow[]> => {
  const { data, error } = await supabase
    .from("student_works")
    .select(WORK_SELECT)
    .eq("teacher_id", teacherId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as StudentWorkRow[];
};

export const listParentWorks = async (parentId: string): Promise<StudentWorkRow[]> => {
  const { data, error } = await supabase
    .from("student_works")
    .select(WORK_SELECT)
    .eq("parent_id", parentId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as StudentWorkRow[];
};

export const uploadStudentWorkFromUri = async (input: {
  teacherId: string;
  uri: string;
  fileName: string;
  mimeType?: string;
  studentName?: string;
  subject?: string;
  grade?: string;
  studentId?: string;
  parentId?: string;
}) => {
  if (!input.uri) throw new Error("No file selected.");
  const info = await FileSystem.getInfoAsync(input.uri);
  if (!info.exists) throw new Error("Selected file is no longer available. Please pick it again.");
  if ("size" in info && typeof info.size === "number" && info.size > 20 * 1024 * 1024) {
    throw new Error("File is too large (max 20MB).");
  }

  const ownerId = input.parentId ?? input.teacherId;
  const base64 = await FileSystem.readAsStringAsync(input.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const ext = input.fileName.split(".").pop()?.toLowerCase() || "bin";
  const path = `${ownerId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const binary = decodeBase64ToBytes(base64);

  const { error: uploadError } = await supabase.storage.from("student-works").upload(path, binary, {
    contentType: input.mimeType || "application/octet-stream",
    upsert: false,
  });
  if (uploadError) throw new Error(uploadError.message || "Upload to storage failed.");

  const { data: urlData } = supabase.storage.from("student-works").getPublicUrl(path);
  const isParentOnly = !!input.parentId && input.parentId === input.teacherId;
  const { data, error } = await supabase
    .from("student_works")
    .insert({
      image_url: urlData.publicUrl,
      teacher_id: isParentOnly ? null : input.teacherId,
      parent_id: input.parentId ?? input.teacherId,
      student_id: input.studentId ?? null,
      // DB requires NOT NULL — web inserts "" until a learner is linked
      student_name: input.studentName?.trim() || "",
      subject: input.subject?.trim() || "Mathematics",
      grade: input.grade ?? null,
      file_name: input.fileName,
      file_type: input.mimeType ?? null,
      file_size: "size" in info ? info.size : null,
      status: "uploaded",
    })
    .select(WORK_SELECT)
    .single();
  if (error) throw new Error(error.message || "Could not save uploaded work.");
  return data as StudentWorkRow;
};

export const updateStudentWorkFields = async (
  id: string,
  updates: Partial<{
    student_name: string | null;
    subject: string | null;
    grade: string | null;
    student_id: string | null;
    feedback: string | null;
    error_type: string | null;
    remediation: string | null;
    status: string | null;
  }>,
) => {
  const { data, error } = await supabase
    .from("student_works")
    .update(updates)
    .eq("id", id)
    .select(WORK_SELECT)
    .single();
  if (error) throw error;
  return data as StudentWorkRow;
};

export const updateStudentWorkFeedback = async (
  id: string,
  feedback: string,
  extras?: { error_type?: string; remediation?: string; status?: string },
) => {
  return updateStudentWorkFields(id, {
    feedback,
    status: extras?.status ?? "reviewed",
    error_type: extras?.error_type ?? null,
    remediation: extras?.remediation ?? null,
  });
};

const deleteStorageForUrl = async (imageUrl: string) => {
  try {
    const match = imageUrl.match(/student-works\/(.+)$/);
    if (match) {
      await supabase.storage.from("student-works").remove([decodeURIComponent(match[1])]);
    }
  } catch {
    // Storage cleanup is best-effort
  }
};

export const deleteStudentWork = async (work: StudentWorkRow) => {
  await deleteStorageForUrl(work.image_url);
  const { error } = await supabase.from("student_works").delete().eq("id", work.id);
  if (error) throw error;
};

/** Resolve a vision-ready image URL (public https preferred; else local → data URL). */
export const resolveVisionImageUrl = async (work: StudentWorkRow, localUri?: string) => {
  if (work.image_url?.startsWith("http")) return work.image_url;
  if (work.image_url?.startsWith("data:")) return work.image_url;
  if (localUri) {
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const mime = work.file_type || "image/jpeg";
    return `data:${mime};base64,${base64}`;
  }
  throw new Error("No image data available for analysis");
};

export const parseWorkFeedbackPanels = (
  text: string,
  stored?: { errorType?: string | null; remediation?: string | null },
) => {
  const sections = parseAiFeedbackSections(text);
  const frac = extractGradeFraction(text);
  const err =
    (sections.error_type || stored?.errorType || "").trim() ||
    "None listed — if the work is strong, use category \"None\"; otherwise see Analysis.";
  const rem =
    (sections.remediation || stored?.remediation || "").trim() ||
    "No separate remediation block — use the bullet ideas in Analysis if present.";
  return {
    analysis: sections.analysis,
    errorType: sections.error_type,
    gradeSection: sections.grade,
    remediation: sections.remediation,
    displayError: err,
    displayRemediation: rem,
    scoreLabel: frac?.label ?? null,
    scorePercent: frac?.percent ?? null,
  };
};

export const analyzeAndSaveStudentWork = async (
  work: StudentWorkRow,
  notes?: string,
  localUri?: string,
) => {
  const imageUrl = await resolveVisionImageUrl(work, localUri);
  const analysis = await analyzeStudentWorkWithAI({
    imageUrl,
    notes: notes || undefined,
    fileName: work.file_name || work.image_url,
    studentName: work.student_name,
    subject: work.subject,
    grade: work.grade,
  });

  const panels = parseWorkFeedbackPanels(analysis);

  const updated = await updateStudentWorkFeedback(work.id, analysis, {
    error_type: panels.errorType?.trim().slice(0, 240) || "AI analysis",
    remediation: panels.remediation?.trim().slice(0, 2000) || undefined,
    status: "analyzed",
  });

  return { analysis, work: updated, panels };
};

export const isWorkAnalyzed = (work: StudentWorkRow) =>
  Boolean(work.feedback?.trim()) &&
  (work.status === "analyzed" || work.status === "reviewed" || work.status === "success");

export const isWorkPending = (work: StudentWorkRow) =>
  !work.feedback?.trim() &&
  work.status !== "error" &&
  work.status !== "analyzing";

export const isWorkError = (work: StudentWorkRow) => work.status === "error";
