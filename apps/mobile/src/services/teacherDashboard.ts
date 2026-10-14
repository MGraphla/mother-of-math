import type { SupabaseClient } from "@supabase/supabase-js";
import { formatAIResponseAsMarkdown } from "./lessonPlan";

export interface TeacherOverviewStats {
  totalStudents: number;
  assignmentsGraded: number;
  averageScore: number;
  lessonPlansCreated: number;
}

export interface MonthlyScorePoint {
  /** Short month name, e.g. "Mar". */
  label: string;
  /** Average score as a percentage, 0 when nothing was graded that month. */
  value: number;
}

export interface RecentSubmission {
  id: string;
  studentName: string;
  assignmentTitle: string;
  status: "graded" | "returned" | "pending";
  score: number | null;
  maxScore: number;
  submittedAt: string | null;
}

export interface TeacherDashboardData {
  stats: TeacherOverviewStats;
  trend: MonthlyScorePoint[];
  recentSubmissions: RecentSubmission[];
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Assignments store raw marks; the dashboard compares them as percentages. */
const toPercentage = (rawScore: number, maxScore: unknown): number => {
  const n = Number(rawScore);
  if (!Number.isFinite(n)) return 0;
  const max = maxScore != null && Number(maxScore) > 0 ? Number(maxScore) : 10;
  return Math.min(100, Math.max(0, (n / max) * 100));
};

const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

/**
 * One-shot loader for the teacher dashboard, matching the queries and the
 * six-month trend window used by src/pages/Dashboard/Overview.tsx on the web.
 */
export const fetchTeacherDashboard = async (
  supabase: SupabaseClient,
  teacherId: string,
): Promise<TeacherDashboardData> => {
  const [{ count: studentsCount }, { count: lessonPlansCount }, { data: assignments }] =
    await Promise.all([
      supabase.from("students").select("*", { count: "exact", head: true }).eq("teacher_id", teacherId),
      supabase.from("lesson_plans").select("*", { count: "exact", head: true }).eq("user_id", teacherId),
      supabase.from("assignments").select("id").eq("teacher_id", teacherId),
    ]);

  let gradedCount = 0;
  let totalScore = 0;
  let scoreCount = 0;
  const monthly: Record<string, { total: number; count: number }> = {};
  let recentSubmissions: RecentSubmission[] = [];

  if (assignments?.length) {
    const { data: submissions } = await supabase
      .from("assignment_submissions")
      .select(
        "id, score, status, submitted_at, graded_at, students ( full_name ), assignments ( title, max_score )",
      )
      .in(
        "assignment_id",
        assignments.map((a) => a.id),
      )
      .order("submitted_at", { ascending: false });

    type SubmissionRow = {
      id: string;
      score: number | null;
      status: string;
      submitted_at: string | null;
      graded_at: string | null;
      students: { full_name?: string } | { full_name?: string }[] | null;
      assignments: { title?: string; max_score?: number } | { title?: string; max_score?: number }[] | null;
    };

    const rows = (submissions ?? []) as SubmissionRow[];
    const first = <T,>(value: T | T[] | null): T | null =>
      Array.isArray(value) ? (value[0] ?? null) : value;

    rows.forEach((row) => {
      if (row.status !== "graded" || row.score == null) return;
      gradedCount++;
      const pct = toPercentage(Number(row.score), first(row.assignments)?.max_score);
      totalScore += pct;
      scoreCount++;

      // Bucket on YYYY-MM so the labels never depend on the device locale.
      const key = monthKey(new Date(row.graded_at ?? row.submitted_at ?? Date.now()));
      monthly[key] = monthly[key] ?? { total: 0, count: 0 };
      monthly[key].total += pct;
      monthly[key].count++;
    });

    recentSubmissions = rows.slice(0, 6).map((row) => ({
      id: row.id,
      studentName: first(row.students)?.full_name ?? "Unknown learner",
      assignmentTitle: first(row.assignments)?.title ?? "Unknown assignment",
      status: row.status === "graded" ? "graded" : row.status === "returned" ? "returned" : "pending",
      score: row.score,
      maxScore: first(row.assignments)?.max_score ?? 10,
      submittedAt: row.submitted_at,
    }));
  }

  const now = new Date();
  const trend: MonthlyScorePoint[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const bucket = monthly[monthKey(d)];
    trend.push({
      label: MONTHS[d.getMonth()],
      value: bucket && bucket.count > 0 ? Math.round(bucket.total / bucket.count) : 0,
    });
  }

  return {
    stats: {
      totalStudents: studentsCount ?? 0,
      lessonPlansCreated: lessonPlansCount ?? 0,
      assignmentsGraded: gradedCount,
      averageScore: scoreCount ? Math.round(totalScore / scoreCount) : 0,
    },
    trend,
    recentSubmissions,
  };
};

export interface LessonPlanRow {
  id: string;
  title: string;
  level: string;
  content: unknown;
  created_at: string;
}

export const fetchTeacherOverviewStats = async (
  supabase: SupabaseClient,
  teacherId: string,
): Promise<TeacherOverviewStats> => {
  const { count: studentsCount } = await supabase
    .from("students")
    .select("*", { count: "exact", head: true })
    .eq("teacher_id", teacherId);

  const { count: lessonPlansCount } = await supabase
    .from("lesson_plans")
    .select("*", { count: "exact", head: true })
    .eq("user_id", teacherId);

  const { data: assignments } = await supabase.from("assignments").select("id").eq("teacher_id", teacherId);

  let gradedCount = 0;
  let totalScore = 0;
  let scoreCount = 0;

  if (assignments?.length) {
    const { data: submissions } = await supabase
      .from("assignment_submissions")
      .select("score, status, assignments ( max_score )")
      .in(
        "assignment_id",
        assignments.map((a) => a.id),
      );

    submissions?.forEach((sub) => {
      const row = sub as {
        score: number | null;
        status: string;
        assignments: { max_score?: number } | { max_score?: number }[] | null;
      };
      if (row.status !== "graded" || row.score == null) return;
      gradedCount++;
      const assignmentMeta = Array.isArray(row.assignments) ? row.assignments[0] : row.assignments;
      const max = assignmentMeta?.max_score && assignmentMeta.max_score > 0 ? assignmentMeta.max_score : 10;
      totalScore += Math.min(100, Math.max(0, (Number(row.score) / max) * 100));
      scoreCount++;
    });
  }

  return {
    totalStudents: studentsCount ?? 0,
    lessonPlansCreated: lessonPlansCount ?? 0,
    assignmentsGraded: gradedCount,
    averageScore: scoreCount ? Math.round(totalScore / scoreCount) : 0,
  };
};

export const fetchTeacherLessonPlans = async (
  supabase: SupabaseClient,
  userId: string,
): Promise<LessonPlanRow[]> => {
  const { data, error } = await supabase
    .from("lesson_plans")
    .select("id,title,level,content,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as LessonPlanRow[];
};

export const lessonPlanContentToText = (content: unknown): string => {
  if (content == null) return "";
  if (typeof content === "string") {
    try {
      JSON.parse(content);
      return formatAIResponseAsMarkdown(content);
    } catch {
      return content;
    }
  }
  if (typeof content === "object") {
    try {
      return formatAIResponseAsMarkdown(JSON.stringify(content));
    } catch {
      return JSON.stringify(content, null, 2);
    }
  }
  return String(content);
};
