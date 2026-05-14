/**
 * Monitor Data Service — Nigeria scope
 * ────────────────────────────────────
 * Every getter exposed here returns data that has been filtered down to
 * teachers whose `profiles.country` resolves to Nigeria (and to all
 * children of those teachers — students, lesson plans, assignments,
 * submissions, chats, images, uploads, etc.).
 *
 * The whole platform is fetched **once** via the existing read-only
 * SECURITY DEFINER RPC functions (in `adminService`), filtered, and then
 * cached for the lifetime of the page. This keeps Supabase load minimal
 * while still rebuilding aggregates (overview totals, activity trends,
 * comparison metrics) entirely from the Nigeria-only subset so the
 * partner never sees a single non-Nigerian count.
 *
 * Read-only by design — nothing in this module imports anything from
 * adminService that mutates state.
 */

import * as admin from '@/services/adminService';
import { isNigerianCountry } from '../utils/scope';
import type {
  TeacherStats,
  StudentStats,
  LessonPlanStats,
  AssignmentStats,
  SubmissionStats,
  ChatbotStats,
  ConversationMessageStats,
  StudentWorkStats,
  AnnouncementStats,
  ResourceStats,
  NotificationStats,
  CommentStats,
  DashboardOverview,
  ComparisonData,
  SchoolInfo,
  TeachersByCountry,
} from '@/types/admin';

export type { ActivityItem } from '@/services/adminService';
import type { ActivityItem } from '@/services/adminService';

/* ── Cached, pre-filtered Nigeria scope ─────────────────────── */

interface ImageRow {
  id: string;
  user_id: string;
  user_name: string;
  prompt: string;
  enhanced_prompt?: string;
  aspect_ratio: string;
  style?: string;
  image_url: string;
  is_favorite: boolean;
  created_at: string;
}

interface NigeriaScope {
  teachers: TeacherStats[];
  teacherIds: Set<string>;
  students: StudentStats[];
  studentIds: Set<string>;
  plans: LessonPlanStats[];
  assignments: AssignmentStats[];
  assignmentIds: Set<string>;
  submissions: SubmissionStats[];
  conversations: ChatbotStats[];
  conversationIds: Set<string>;
  messages: ConversationMessageStats[];
  works: StudentWorkStats[];
  resources: ResourceStats[];
  announcements: AnnouncementStats[];
  notifications: NotificationStats[];
  comments: CommentStats[];
  images: ImageRow[];
  schools: SchoolInfo[];
}

let scopePromise: Promise<NigeriaScope> | null = null;

const buildScope = async (): Promise<NigeriaScope> => {
  const [
    teachersAll,
    studentsAll,
    plansAll,
    assignmentsAll,
    submissionsAll,
    conversationsAll,
    messagesAll,
    worksAll,
    resourcesAll,
    announcementsAll,
    notificationsAll,
    commentsAll,
    imagesAll,
    schoolsAll,
  ] = await Promise.all([
    admin.getAllTeachers(),
    admin.getAllStudents(),
    admin.getAllLessonPlans(),
    admin.getAllAssignments(),
    admin.getAllSubmissions(),
    admin.getAllChatConversations(),
    admin.getAllConversationMessages(),
    admin.getAllStudentWorks(),
    admin.getAllResources(),
    admin.getAllAnnouncements(),
    admin.getAllNotifications(),
    admin.getAllComments(),
    admin.getAllImages(),
    admin.getAllSchools(),
  ]);

  // Nigerian teachers
  const teachers = teachersAll.filter((t) => isNigerianCountry(t.country));
  const teacherIds = new Set(teachers.map((t) => t.id));

  // Children — filter by teacher_id ownership
  const students = studentsAll.filter((s) => teacherIds.has(s.teacher_id));
  const studentIds = new Set(students.map((s) => s.id));

  const plans = plansAll.filter((p) => teacherIds.has(p.teacher_id));

  const assignments = assignmentsAll.filter((a) => teacherIds.has(a.teacher_id));
  const assignmentIds = new Set(assignments.map((a) => a.id));

  const submissions = submissionsAll.filter((s) => assignmentIds.has(s.assignment_id));

  const conversations = conversationsAll.filter((c) => teacherIds.has(c.user_id));
  const conversationIds = new Set(conversations.map((c) => c.id));

  const messages = messagesAll.filter((m) => conversationIds.has(m.conversation_id));

  const works = worksAll.filter((w) => teacherIds.has(w.teacher_id));
  const resources = resourcesAll.filter((r) => teacherIds.has(r.teacher_id));
  const announcements = announcementsAll.filter((a) => teacherIds.has(a.teacher_id));

  const notifications = notificationsAll.filter(
    (n) =>
      (n.recipient_teacher_id && teacherIds.has(n.recipient_teacher_id)) ||
      (n.recipient_student_id && studentIds.has(n.recipient_student_id))
  );

  const comments = commentsAll.filter(
    (c) => teacherIds.has(c.teacher_id) || studentIds.has(c.student_id)
  );

  const images = (imagesAll as unknown as ImageRow[]).filter((i) => teacherIds.has(i.user_id));

  const schools = schoolsAll.filter((s) => isNigerianCountry(s.country));

  return {
    teachers,
    teacherIds,
    students,
    studentIds,
    plans,
    assignments,
    assignmentIds,
    submissions,
    conversations,
    conversationIds,
    messages,
    works,
    resources,
    announcements,
    notifications,
    comments,
    images,
    schools,
  };
};

const loadScope = (): Promise<NigeriaScope> => {
  if (!scopePromise) scopePromise = buildScope();
  return scopePromise;
};

/** Force a re-fetch on next call (used by manual refresh buttons). */
export const refreshMonitorScope = (): void => {
  scopePromise = null;
};

/* ── Helpers used by the recomputed aggregates ─────────────── */

const DAY_MS = 86_400_000;

const countSince = (rows: { created_at: string }[], days: number): number => {
  const cutoff = Date.now() - days * DAY_MS;
  return rows.filter((r) => new Date(r.created_at).getTime() > cutoff).length;
};

const countActiveSince = (
  teachers: TeacherStats[],
  field: 'updated_at' | 'created_at',
  days: number
): number => {
  const cutoff = Date.now() - days * DAY_MS;
  return teachers.filter((t) => {
    const value = (t as TeacherStats)[field] ?? t.created_at;
    return value && new Date(value).getTime() > cutoff;
  }).length;
};

/* ── Public, Nigeria-scoped getters ─────────────────────────── */

export const getAllTeachers = async (): Promise<TeacherStats[]> => (await loadScope()).teachers;
export const getAllStudents = async (): Promise<StudentStats[]> => (await loadScope()).students;
export const getAllLessonPlans = async (): Promise<LessonPlanStats[]> => (await loadScope()).plans;
export const getAllAssignments = async (): Promise<AssignmentStats[]> => (await loadScope()).assignments;
export const getAllSubmissions = async (): Promise<SubmissionStats[]> => (await loadScope()).submissions;
export const getAllChatConversations = async (): Promise<ChatbotStats[]> => (await loadScope()).conversations;
export const getAllConversationMessages = async (): Promise<ConversationMessageStats[]> => (await loadScope()).messages;
export const getAllStudentWorks = async (): Promise<StudentWorkStats[]> => (await loadScope()).works;
export const getAllResources = async (): Promise<ResourceStats[]> => (await loadScope()).resources;
export const getAllAnnouncements = async (): Promise<AnnouncementStats[]> => (await loadScope()).announcements;
export const getAllNotifications = async (): Promise<NotificationStats[]> => (await loadScope()).notifications;
export const getAllComments = async (): Promise<CommentStats[]> => (await loadScope()).comments;
export const getAllImages = async () => (await loadScope()).images;

/* ── Aggregate getters — recomputed from Nigeria scope only ── */

export const getAdminDashboardOverview = async (): Promise<DashboardOverview> => {
  const s = await loadScope();
  const userMessages = s.messages.filter((m) => m.role === 'user');
  const aiMessages = s.messages.filter((m) => m.role === 'assistant');
  const aiWords = aiMessages.reduce(
    (sum, m) => sum + (m.content?.trim().split(/\s+/).filter(Boolean).length || 0),
    0
  );

  return {
    totalTeachers: s.teachers.length,
    totalStudents: s.students.length,
    totalLessonPlans: s.plans.length,
    totalAssignments: s.assignments.length,
    totalSubmissions: s.submissions.length,
    totalChatConversations: s.conversations.length,
    totalChatMessages: s.messages.length,
    totalResources: s.resources.length,
    totalAnnouncements: s.announcements.length,
    totalNotifications: s.notifications.length,
    totalComments: s.comments.length,
    activeTeachersToday: countActiveSince(s.teachers, 'updated_at', 1),
    activeTeachersThisWeek: countActiveSince(s.teachers, 'updated_at', 7),
    activeTeachersThisMonth: countActiveSince(s.teachers, 'updated_at', 30),
    newTeachersThisWeek: countSince(s.teachers, 7),
    newStudentsThisWeek: countSince(s.students, 7),
    newLessonPlansThisWeek: countSince(s.plans, 7),
    newAssignmentsThisWeek: countSince(s.assignments, 7),
    newSubmissionsThisWeek: s.submissions.filter(
      (sb) => sb.submitted_at && new Date(sb.submitted_at).getTime() > Date.now() - 7 * DAY_MS
    ).length,
    totalImagesGenerated: s.images.length,
    totalChatInputs: userMessages.length,
    totalChatResponses: aiMessages.length,
    dailyActiveUsers: countActiveSince(s.teachers, 'updated_at', 1),
    weeklyActiveUsers: countActiveSince(s.teachers, 'updated_at', 7),
    monthlyActiveUsers: countActiveSince(s.teachers, 'updated_at', 30),
    aiWordsGenerated: aiWords,
  };
};

export const getActivityTrends = async (): Promise<
  { date: string; lessonPlans: number; assignments: number; submissions: number; messages: number }[]
> => {
  const s = await loadScope();
  const out = new Map<string, { lessonPlans: number; assignments: number; submissions: number; messages: number }>();

  // Pre-fill the last 30 days
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * DAY_MS);
    out.set(d.toISOString().slice(0, 10), { lessonPlans: 0, assignments: 0, submissions: 0, messages: 0 });
  }

  const bump = (
    iso: string,
    key: 'lessonPlans' | 'assignments' | 'submissions' | 'messages'
  ) => {
    const day = iso.slice(0, 10);
    const row = out.get(day);
    if (row) row[key] += 1;
  };

  s.plans.forEach((p) => bump(p.created_at, 'lessonPlans'));
  s.assignments.forEach((a) => bump(a.created_at, 'assignments'));
  s.submissions.forEach((sb) => sb.submitted_at && bump(sb.submitted_at, 'submissions'));
  s.messages.forEach((m) => bump(m.created_at, 'messages'));

  return Array.from(out.entries())
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date));
};

export const getComparisonMetrics = async (periodDays: number = 7): Promise<ComparisonData[]> => {
  const s = await loadScope();
  const now = Date.now();
  const cutNow = now - periodDays * DAY_MS;
  const cutPrev = now - 2 * periodDays * DAY_MS;

  const metric = (rows: { created_at: string }[], name: string): ComparisonData => {
    const current = rows.filter((r) => new Date(r.created_at).getTime() > cutNow).length;
    const previous = rows.filter((r) => {
      const t = new Date(r.created_at).getTime();
      return t > cutPrev && t <= cutNow;
    }).length;
    const change = previous > 0 ? ((current - previous) / previous) * 100 : current > 0 ? 100 : 0;
    return {
      metric_name: name,
      current_value: current,
      previous_value: previous,
      change_percent: Math.round(change * 10) / 10,
      change_direction: current > previous ? 'up' : current < previous ? 'down' : 'stable',
    };
  };

  return [
    metric(s.teachers, 'New teachers'),
    metric(s.students, 'New students'),
    metric(s.plans, 'New lesson plans'),
    metric(s.assignments, 'New assignments'),
  ];
};

export const getStudentsPerTeacher = async () => {
  const s = await loadScope();
  return s.teachers
    .map((t) => ({
      teacherId: t.id,
      teacherName: t.full_name ?? '',
      schoolName: t.school_name ?? null,
      studentCount: s.students.filter((st) => st.teacher_id === t.id).length,
    }))
    .sort((a, b) => b.studentCount - a.studentCount);
};

export const getLessonPlansByTeacher = async () => {
  const s = await loadScope();
  return s.teachers
    .map((t) => ({
      teacherId: t.id,
      teacherName: t.full_name ?? '',
      lessonPlanCount: s.plans.filter((p) => p.teacher_id === t.id).length,
    }))
    .sort((a, b) => b.lessonPlanCount - a.lessonPlanCount);
};

export const getImagesGeneratedByTeacher = async () => {
  const s = await loadScope();
  return s.teachers
    .map((t) => ({
      teacherId: t.id,
      teacherName: t.full_name ?? '',
      imageCount: s.images.filter((i) => i.user_id === t.id).length,
    }))
    .sort((a, b) => b.imageCount - a.imageCount);
};

export const getTotalImagesGenerated = async (): Promise<number> => (await loadScope()).images.length;

export const getAllSchools = async (): Promise<SchoolInfo[]> => {
  const s = await loadScope();
  // Recompute teacher / student counts using only Nigerian children
  const map = new Map<string, SchoolInfo>();
  s.teachers.forEach((t) => {
    const key = `${t.school_name || '—'}|${t.city || ''}|${t.country || ''}`;
    const entry =
      map.get(key) ??
      ({
        name: t.school_name || '—',
        type: t.school_type ?? null,
        city: t.city ?? null,
        country: t.country ?? null,
        teacherCount: 0,
        studentCount: 0,
      } as SchoolInfo);
    entry.teacherCount += 1;
    entry.studentCount += s.students.filter((st) => st.teacher_id === t.id).length;
    map.set(key, entry);
  });
  return Array.from(map.values()).sort((a, b) => b.teacherCount - a.teacherCount);
};

export const getTeachersByCountry = async (): Promise<TeachersByCountry[]> => {
  const s = await loadScope();
  return s.teachers.length > 0 ? [{ country: 'Nigeria', count: s.teachers.length }] : [];
};

/** Re-derived recent activity feed restricted to Nigeria. */
export const getUserActivity = async (): Promise<ActivityItem[]> => {
  const s = await loadScope();
  const teacherName = (id: string) => s.teachers.find((t) => t.id === id)?.full_name ?? 'Unknown';
  const out: ActivityItem[] = [];

  s.teachers.forEach((t) =>
    out.push({
      id: `teacher-${t.id}`,
      type: 'teacher_signup',
      description: `${t.full_name || 'A teacher'} joined the platform`,
      user_name: t.full_name,
      created_at: t.created_at,
    })
  );

  s.students.forEach((st) =>
    out.push({
      id: `student-${st.id}`,
      type: 'student_created',
      description: `Created learner: ${st.full_name}${st.grade_level ? ` (${st.grade_level})` : ''}`,
      user_name: teacherName(st.teacher_id),
      created_at: st.created_at,
    })
  );

  s.plans.forEach((p) =>
    out.push({
      id: `plan-${p.id}`,
      type: 'lesson_plan',
      description: `Generated lesson plan: ${p.title}`,
      user_name: p.teacher_name ?? teacherName(p.teacher_id),
      created_at: p.created_at,
    })
  );

  s.assignments.forEach((a) =>
    out.push({
      id: `assignment-${a.id}`,
      type: 'assignment',
      description: `Created assignment: ${a.title}`,
      user_name: a.teacher_name ?? teacherName(a.teacher_id),
      created_at: a.created_at,
    })
  );

  s.submissions.forEach((sb) =>
    out.push({
      id: `submission-${sb.id}`,
      type: 'submission',
      description: `Submission: ${sb.assignment_title || 'assignment'}${sb.student_name ? ` by ${sb.student_name}` : ''}`,
      user_name: sb.student_name,
      created_at: sb.submitted_at,
    })
  );

  return out
    .filter((a) => !!a.created_at)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 200);
};

/* getGrowthMetrics & getUsageAnalytics are not currently used by any
 * monitor page, but exporting stubs keeps the module surface compatible
 * with possible future use without ever leaking non-Nigerian data. */
export const getGrowthMetrics = async () => {
  const trends = await getActivityTrends();
  return trends.map((t) => ({
    metric_date: t.date,
    new_teachers: 0,
    new_students: 0,
    new_lesson_plans: t.lessonPlans,
    new_conversations: 0,
    new_messages: t.messages,
    new_assignments: t.assignments,
    new_images: 0,
  }));
};

export const getUsageAnalytics = async () => {
  const overview = await getAdminDashboardOverview();
  return overview;
};
