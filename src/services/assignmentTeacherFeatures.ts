/**
 * Teacher assignment workflow helpers: templates, rubric library, versions,
 * engagement, peer reviews, moderation signals, analytics, gradebook export.
 */
import { supabase } from "@/lib/supabase";
import type { RubricCriterion } from "@/utils/grading";
import type { AssignmentSubmission, StudentAssignment } from "@/services/studentService";

// ── Types ─────────────────────────────────────────────────

export interface AssignmentTemplateRow {
  id: string;
  teacher_id: string;
  name: string;
  title_template: string;
  description: string | null;
  instructions: string | null;
  subject: string;
  grade_level: string;
  max_score: number | null;
  rubric_criteria: RubricCriterion[] | null;
  created_at: string;
  updated_at: string;
}

export interface SavedRubricRow {
  id: string;
  teacher_id: string;
  name: string;
  criteria: RubricCriterion[];
  created_at: string;
}

export interface InstructionVersionRow {
  id: string;
  assignment_id: string;
  teacher_id: string;
  snapshot: {
    title?: string;
    instructions?: string | null;
    max_score?: number | null;
    rubric_criteria?: RubricCriterion[];
  };
  created_at: string;
}

export interface EngagementRow {
  assignment_id: string;
  student_id: string;
  first_opened_at: string;
  last_opened_at: string;
  has_draft: boolean;
}

export interface PeerReviewRow {
  id: string;
  assignment_id: string;
  student_id: string;
  criterion_id: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export type LearnerEngagementState =
  | "not_opened"
  | "draft"
  | "submitted"
  | "graded"
  | "returned";

export interface ModerationFlag {
  kind: "duplicate_filename" | "duplicate_hash" | "short_submission";
  message: string;
  student_ids: string[];
}

export interface AssignmentModerationReport {
  flags: ModerationFlag[];
}

export interface AssignmentListAnalytics {
  avgScore: number | null;
  avgAiTeacherDelta: number | null;
  /** Normalized 0–100 submission progress spark points (binned hours-before-due) */
  spark: number[];
}

export function parseRubricFromDb(raw: unknown): RubricCriterion[] {
  if (!raw) return [];
  if (typeof raw === "string") {
    try {
      return parseRubricFromDb(JSON.parse(raw));
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => x as Record<string, unknown>)
    .filter((x) => x && typeof x.id === "string" && typeof x.name === "string")
    .map((x) => ({
      id: String(x.id),
      name: String(x.name),
      maxScore: typeof x.maxScore === "number" ? x.maxScore : Number(x.maxScore) || 0,
      description: typeof x.description === "string" ? x.description : undefined,
    }));
}

// ── Templates ────────────────────────────────────────────

export async function listAssignmentTemplates(teacherId: string): Promise<AssignmentTemplateRow[]> {
  const { data, error } = await supabase
    .from("assignment_templates")
    .select("*")
    .eq("teacher_id", teacherId)
    .order("updated_at", { ascending: false });
  if (error) {
    console.warn("assignment_templates:", error.message);
    return [];
  }
  return (data || []).map((row) => ({
    ...row,
    rubric_criteria: parseRubricFromDb(row.rubric_criteria),
  })) as AssignmentTemplateRow[];
}

export async function saveAssignmentTemplate(input: {
  teacherId: string;
  name: string;
  title_template: string;
  description: string | null;
  instructions: string | null;
  subject: string;
  grade_level: string;
  max_score: number | null;
  rubric_criteria: RubricCriterion[];
}): Promise<void> {
  const { error } = await supabase.from("assignment_templates").insert({
    teacher_id: input.teacherId,
    name: input.name,
    title_template: input.title_template,
    description: input.description,
    instructions: input.instructions,
    subject: input.subject,
    grade_level: input.grade_level,
    max_score: input.max_score,
    rubric_criteria: input.rubric_criteria,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function deleteAssignmentTemplate(id: string): Promise<void> {
  const { error } = await supabase.from("assignment_templates").delete().eq("id", id);
  if (error) throw error;
}

// ── Saved rubrics ─────────────────────────────────────────

export async function listSavedRubrics(teacherId: string): Promise<SavedRubricRow[]> {
  const { data, error } = await supabase
    .from("saved_rubrics")
    .select("*")
    .eq("teacher_id", teacherId)
    .order("created_at", { ascending: false });
  if (error) {
    console.warn("saved_rubrics:", error.message);
    return [];
  }
  return (data || []).map((row) => ({
    ...row,
    criteria: parseRubricFromDb(row.criteria),
  })) as SavedRubricRow[];
}

export async function saveRubricToLibrary(teacherId: string, name: string, criteria: RubricCriterion[]): Promise<void> {
  const { error } = await supabase.from("saved_rubrics").insert({
    teacher_id: teacherId,
    name,
    criteria,
  });
  if (error) throw error;
}

export async function deleteSavedRubric(id: string): Promise<void> {
  const { error } = await supabase.from("saved_rubrics").delete().eq("id", id);
  if (error) throw error;
}

// ── Instruction versions ─────────────────────────────────

export async function recordInstructionVersion(input: {
  assignmentId: string;
  teacherId: string;
  snapshot: InstructionVersionRow["snapshot"];
}): Promise<void> {
  const { error } = await supabase.from("assignment_instruction_versions").insert({
    assignment_id: input.assignmentId,
    teacher_id: input.teacherId,
    snapshot: input.snapshot,
  });
  if (error) throw error;
}

export async function listInstructionVersions(assignmentId: string): Promise<InstructionVersionRow[]> {
  const { data, error } = await supabase
    .from("assignment_instruction_versions")
    .select("*")
    .eq("assignment_id", assignmentId)
    .order("created_at", { ascending: false });
  if (error) {
    console.warn("assignment_instruction_versions:", error.message);
    return [];
  }
  return (data || []) as InstructionVersionRow[];
}

// ── Engagement ───────────────────────────────────────────

export async function fetchEngMap(assignmentId: string): Promise<Map<string, EngagementRow>> {
  const { data, error } = await supabase
    .from("assignment_student_engagement")
    .select("*")
    .eq("assignment_id", assignmentId);
  if (error) {
    console.warn("assignment_student_engagement:", error.message);
    return new Map();
  }
  const m = new Map<string, EngagementRow>();
  (data || []).forEach((row: EngagementRow) => m.set(row.student_id, row));
  return m;
}

export function deriveLearnerState(
  studentId: string,
  engagement: EngagementRow | undefined,
  submission: AssignmentSubmission | undefined,
): LearnerEngagementState {
  if (!submission) {
    if (engagement?.has_draft) return "draft";
    if (engagement?.first_opened_at) return "draft"; // opened but no submit → treat as in progress
    return "not_opened";
  }
  if (submission.status === "graded") return "graded";
  if (submission.status === "returned") return "returned";
  return "submitted";
}

// ── Peer reviews (teacher read) ─────────────────────────

export async function fetchPeerReviewsForAssignment(assignmentId: string): Promise<PeerReviewRow[]> {
  const { data, error } = await supabase
    .from("assignment_peer_reviews")
    .select("*")
    .eq("assignment_id", assignmentId)
    .order("updated_at", { ascending: false });
  if (error) {
    console.warn("assignment_peer_reviews:", error.message);
    return [];
  }
  return (data || []) as PeerReviewRow[];
}

// ── Bulk submissions for teacher analytics ───────────────

type SubmissionLite = Pick<
  AssignmentSubmission,
  "assignment_id" | "student_id" | "submitted_at" | "score" | "ai_score" | "status"
> & { file_url?: string | null; notes?: string | null; file_content_hash?: string | null };

export async function fetchSubmissionsForTeacherAssignments(
  assignmentIds: string[],
): Promise<SubmissionLite[]> {
  if (assignmentIds.length === 0) return [];
  const { data, error } = await supabase
    .from("assignment_submissions")
    .select("assignment_id, student_id, submitted_at, score, ai_score, status, file_url, notes, file_content_hash")
    .in("assignment_id", assignmentIds);
  if (error) {
    console.warn("bulk submissions:", error.message);
    return [];
  }
  return (data || []) as SubmissionLite[];
}

export function computeModerationReport(
  submissions: (SubmissionLite & { student_name?: string })[],
): AssignmentModerationReport {
  const flags: ModerationFlag[] = [];
  const byName = new Map<string, string[]>();
  const byHash = new Map<string, string[]>();
  const shortLearners: string[] = [];

  for (const s of submissions) {
    const fname = s.file_url ? extractFilename(s.file_url) : "";
    if (fname) {
      const key = fname.toLowerCase();
      const arr = byName.get(key) || [];
      arr.push(s.student_id);
      byName.set(key, arr);
    }
    if (s.file_content_hash) {
      const arr = byHash.get(s.file_content_hash) || [];
      arr.push(s.student_id);
      byHash.set(s.file_content_hash, arr);
    }
    const n = (s.notes || "").trim().length;
    const hasFile = !!s.file_url;
    if (!hasFile && n > 0 && n < 12) shortLearners.push(s.student_id);
    if (hasFile && n > 0 && n < 8) shortLearners.push(s.student_id);
  }

  for (const [name, ids] of byName) {
    if (ids.length >= 2) {
      flags.push({
        kind: "duplicate_filename",
        message: `Same file name "${name}" across ${ids.length} submissions`,
        student_ids: [...new Set(ids)],
      });
    }
  }
  for (const [hash, ids] of byHash) {
    if (ids.length >= 2) {
      flags.push({
        kind: "duplicate_hash",
        message: `Identical file fingerprint (${hash.slice(0, 8)}…) — possible copies`,
        student_ids: [...new Set(ids)],
      });
    }
  }
  const uniqShort = [...new Set(shortLearners)];
  if (uniqShort.length > 0) {
    flags.push({
      kind: "short_submission",
      message: "Very short student note — check for rushed or placeholder work",
      student_ids: uniqShort,
    });
  }
  return { flags };
}

function extractFilename(url: string): string {
  try {
    const path = url.split("?")[0];
    const seg = path.split("/").filter(Boolean);
    return seg.length ? seg[seg.length - 1] : url;
  } catch {
    return url;
  }
}

/** Latest submission per student for one assignment */
export function latestSubmissionByStudent(
  subs: SubmissionLite[],
): Map<string, SubmissionLite> {
  const m = new Map<string, SubmissionLite>();
  for (const s of subs) {
    const prev = m.get(s.student_id);
    if (!prev || new Date(s.submitted_at) > new Date(prev.submitted_at)) m.set(s.student_id, s);
  }
  return m;
}

export function computeAssignmentListAnalytics(
  assignment: StudentAssignment,
  subs: SubmissionLite[],
): AssignmentListAnalytics {
  const latest = [...latestSubmissionByStudent(subs).values()];
  const graded = latest.filter((s) => s.status === "graded" && s.score != null);
  const avgScore =
    graded.length > 0 ? graded.reduce((a, s) => a + (s.score || 0), 0) / graded.length : null;

  const deltas: number[] = [];
  for (const s of latest) {
    if (s.score != null && s.ai_score != null) deltas.push(s.score - s.ai_score);
  }
  const avgAiTeacherDelta =
    deltas.length > 0 ? deltas.reduce((a, b) => a + b, 0) / deltas.length : null;

  const due = new Date(assignment.due_date).getTime();
  const buckets = [0, 0, 0, 0, 0];
  for (const s of latest) {
    const t = new Date(s.submitted_at).getTime();
    const h = (due - t) / (3600 * 1000); // hours before due (negative = late)
    let idx: number;
    if (h >= 72) idx = 0;
    else if (h >= 24) idx = 1;
    else if (h >= 0) idx = 2;
    else if (h >= -24) idx = 3;
    else idx = 4;
    buckets[idx]++;
  }
  const max = Math.max(1, ...buckets);
  const spark = buckets.map((c) => Math.round((c / max) * 100));

  return { avgScore, avgAiTeacherDelta, spark };
}

// ── Gradebook CSV ─────────────────────────────────────────

export interface GradebookStudentRow {
  id: string;
  full_name: string;
  student_code: string | null;
}

export function buildGradebookMatrixCsv(
  students: GradebookStudentRow[],
  assignments: Pick<StudentAssignment, "id" | "title" | "due_date" | "max_score">[],
  submissions: SubmissionLite[],
): string {
  const latestMap = new Map<string, Map<string, SubmissionLite>>();
  for (const a of assignments) {
    const forA = submissions.filter((s) => s.assignment_id === a.id);
    latestMap.set(a.id, latestSubmissionByStudent(forA));
  }

  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const headers = [
    "Student",
    "LearnerCode",
    ...assignments.map((a) => `${a.title.replace(/\s+/g, " ")} (${formatShortDue(a.due_date)})`),
  ];
  const lines = [headers.map(esc).join(",")];

  for (const st of students) {
    const row: string[] = [esc(st.full_name), esc(st.student_code || "")];
    for (const a of assignments) {
      const sub = latestMap.get(a.id)?.get(st.id);
      let cell = "";
      if (sub) {
        if (sub.status === "graded" && sub.score != null) cell = String(sub.score);
        else if (sub.ai_score != null) cell = `AI:${sub.ai_score}`;
        else cell = sub.status;
      }
      row.push(esc(cell));
    }
    lines.push(row.join(","));
  }
  return lines.join("\n");
}

/** Wider Google Classroom–style export: one row per student, columns per assignment */
export function buildGoogleClassroomStyleCsv(
  students: GradebookStudentRow[],
  assignments: Pick<StudentAssignment, "id" | "title">[],
  submissions: SubmissionLite[],
): string {
  return buildGradebookMatrixCsv(students, assignments, submissions);
}

function formatShortDue(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  } catch {
    return iso;
  }
}
