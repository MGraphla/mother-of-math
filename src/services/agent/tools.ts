/**
 * Teacher Agent — tool registry.
 *
 * Each entry maps an MCP-style tool definition (name + JSON schema) to an
 * executor that calls the existing application services. The agent orchestrator
 * selects, validates, and runs these tools on behalf of the LLM.
 *
 * Permission model:
 *   - All Supabase access uses the teacher's session (RLS enforces scope).
 *   - Tool risk levels gate auto-execution vs. user confirmation in the UI.
 */

import { supabase } from '@/lib/supabase';
import {
  Student,
  StudentAssignment,
  createStudent,
  getStudentsByTeacher,
  getStudentById,
  updateStudent,
  toggleStudentStatus,
  regenerateAccessToken,
  buildAccessLink,
  buildEnrollPageLink,
  getTeacherJoinCode,
  regenerateTeacherJoinCode,
  getEnrollmentRequestsForTeacher,
  createAssignment,
  getAssignmentsByTeacher,
  updateAssignment,
  deleteAssignment,
  getAssignmentById,
  getAssignmentStudents,
  updateAssignmentStudents,
  getAssignmentStatsForTeacher,
  getStudentStats,
  getSubmissionsForAssignment,
  getSubmissionsForStudent,
  gradeSubmission,
  returnSubmission,
  getUnsubmittedStudents,
  getSubmissionBreakdown,
} from '@/services/studentService';
import {
  getAnnouncementsForTeacher,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  toggleAnnouncementPin,
  getAnnouncementReadStats,
} from '@/services/announcementService';
import {
  getResourcesForTeacher,
  getTeacherResourceTopics,
  createResource,
  updateResource,
  deleteResource,
} from '@/services/resourceService';
import {
  getAssignmentCommentsForTeacher,
  addTeacherComment,
  deleteComment,
} from '@/services/commentService';
import {
  getTeacherNotifications,
  getTeacherUnreadCount,
  markTeacherNotificationRead,
  markAllTeacherNotificationsRead,
  notifyAllStudents,
  createNotification,
} from '@/services/notificationService';
import {
  getAiGradingSummary,
  regradeSubmissionWithAI,
  saveAiGrading,
} from '@/services/aiGrading';
import { generateLessonPlan } from '@/services/lessonPlan';
import type { TopicItem } from '@/data/curriculumContent';
import {
  getClassLevelsForCountry,
  getCurriculumContent,
  getStrandsForClassLevel,
  getTopicsForClassLevel,
  formatSelectedTopicForPrompt,
} from '@/data/curriculumContent';

import type { RegisteredTool, ToolContext } from './types';

/* ── Helpers ─────────────────────────────────────────── */

const NAVIGATION_ROUTES: Record<string, string> = {
  dashboard: '/dashboard',
  students: '/dashboard/student-accounts',
  student_detail: '/dashboard/students/:studentId',
  assignments: '/dashboard/assignments',
  assignment_detail: '/dashboard/assignments/:assignmentId',
  lesson_plan: '/dashboard/lessons',
  view_lesson_plans: '/dashboard/view-lesson-plans',
  upload: '/dashboard/upload',
  announcements: '/dashboard/announcements',
  resources: '/dashboard/resources',
  generate_images: '/dashboard/generate-images',
  chatbot: '/dashboard/chatbot',
  agent: '/dashboard/agent',
  settings: '/dashboard/settings',
  support: '/dashboard/support',
};

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined;
const boolish = (v: unknown): boolean | undefined =>
  typeof v === 'boolean' ? v : undefined;
const arr = <T = unknown>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

function mustString(args: Record<string, unknown>, key: string): string {
  const v = args[key];
  if (typeof v !== 'string' || !v.trim()) {
    throw new Error(`Missing required argument "${key}".`);
  }
  return v.trim();
}

function redactStudent(s: Student) {
  // Drop access_token + auth_user_id from anything we expose to the model.
  const {
    access_token: _at,
    auth_user_id: _auid,
    ...rest
  } = s;
  return rest;
}

function findTopicWithContext(
  topicId: string,
): { topic: TopicItem; country: 'cameroon' | 'nigeria'; classLevel: string } | null {
  for (const country of ['cameroon', 'nigeria'] as const) {
    for (const level of getClassLevelsForCountry(country)) {
      const topics = getTopicsForClassLevel(country, level);
      const topic = topics.find((t) => t.id === topicId);
      if (topic) return { topic, country, classLevel: level };
    }
  }
  return null;
}

/** Normalise "primary 2", "Primary2", "P3" → "Primary 2" for curriculum lookups. */
function normalizePrimaryLevel(input: string): string {
  const t = input.trim().replace(/\s+/g, ' ');
  const compact = t.replace(/\s/g, '').toLowerCase();
  const m1 = compact.match(/^primary([1-6])$/);
  if (m1) return `Primary ${m1[1]}`;
  const m2 = compact.match(/^p([1-6])$/);
  if (m2) return `Primary ${m2[1]}`;
  if (/^Primary [1-6]$/.test(t)) return t;
  return t;
}

/* ── Tool list ───────────────────────────────────────── */

export function buildToolRegistry(): RegisteredTool[] {
  return [
    /* ===== Teacher / context ===== */
    {
      name: 'get_current_teacher',
      displayName: 'Read teacher profile',
      description:
        "Return the current teacher's profile (name, email, school, country, phone, class join code). Always available; safe.",
      category: 'read',
      risk: 'safe',
      parameters: { type: 'object', properties: {} },
      summarize: () => 'Loading your teacher profile',
      execute: async (_args, ctx) => {
        const { data, error } = await supabase
          .from('profiles')
          .select(
            'id,email,full_name,role,country,school_name,grade_levels,phone_number,class_join_code,preferred_language',
          )
          .eq('id', ctx.teacherId)
          .single();
        if (error) throw error;
        return data;
      },
    },

    {
      name: 'get_teacher_join_code',
      displayName: 'Read class join code',
      description: 'Return the public class join code (used for the /enroll page).',
      category: 'read',
      risk: 'safe',
      parameters: { type: 'object', properties: {} },
      summarize: () => 'Reading class join code',
      execute: async (_args, ctx) => {
        const code = await getTeacherJoinCode(ctx.teacherId);
        return {
          code,
          enroll_url: code ? buildEnrollPageLink(code) : null,
        };
      },
    },

    {
      name: 'list_enrollment_requests',
      displayName: 'List enrollment requests',
      description:
        'List recent guardian enrollment requests for this teacher. Optional status filter: pending, approved, rejected.',
      category: 'read',
      risk: 'safe',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['pending', 'approved', 'rejected'],
            description: 'Optional status filter',
          },
        },
      },
      summarize: (a) =>
        `Listing enrollment requests${a.status ? ` (${a.status})` : ''}`,
      execute: async (args, ctx) => {
        const status = str(args.status) as 'pending' | 'approved' | 'rejected' | '';
        const rows = await getEnrollmentRequestsForTeacher(
          ctx.teacherId,
          (status || undefined) as 'pending' | 'approved' | 'rejected' | undefined,
        );
        return rows.slice(0, 100);
      },
    },

    /* ===== Students ===== */
    {
      name: 'list_students',
      displayName: 'List students',
      description:
        'List learners belonging to this teacher. Optional substring search on full name, grade_level filter, and limit.',
      category: 'read',
      risk: 'safe',
      parameters: {
        type: 'object',
        properties: {
          search: { type: 'string', description: 'Case-insensitive substring of full_name.' },
          grade_level: { type: 'string', description: 'Exact grade level filter (e.g. "Primary 4").' },
          limit: { type: 'integer', description: 'Maximum rows to return (default 50, max 200).' },
        },
      },
      summarize: (a) =>
        `Loading students${a.search ? ` matching "${a.search}"` : ''}${a.grade_level ? ` in ${a.grade_level}` : ''}`,
      execute: async (args, ctx) => {
        const all = await getStudentsByTeacher(ctx.teacherId);
        const search = str(args.search).toLowerCase();
        const grade = str(args.grade_level);
        const limit = Math.min(num(args.limit) ?? 50, 200);
        const filtered = all
          .filter((s) => (search ? s.full_name.toLowerCase().includes(search) : true))
          .filter((s) => (grade ? s.grade_level === grade : true))
          .slice(0, limit)
          .map(redactStudent);
        return { count: filtered.length, total_in_class: all.length, students: filtered };
      },
    },

    {
      name: 'get_student',
      displayName: 'Read student profile',
      description: 'Return a single learner profile by ID.',
      category: 'read',
      risk: 'safe',
      parameters: {
        type: 'object',
        properties: {
          student_id: { type: 'string', description: 'UUID of the student.' },
        },
        required: ['student_id'],
      },
      summarize: (a) => `Loading student ${str(a.student_id).slice(0, 8)}…`,
      execute: async (args) => {
        const id = mustString(args, 'student_id');
        const s = await getStudentById(id);
        return s ? redactStudent(s) : null;
      },
    },

    {
      name: 'get_student_stats',
      displayName: 'Read student stats',
      description:
        'Return assignment / submission stats for one student (totals assigned, submitted, graded, average score, latest submission).',
      category: 'read',
      risk: 'safe',
      parameters: {
        type: 'object',
        properties: {
          student_id: { type: 'string', description: 'UUID of the student.' },
        },
        required: ['student_id'],
      },
      summarize: (a) => `Computing stats for student ${str(a.student_id).slice(0, 8)}…`,
      execute: async (args) => {
        const id = mustString(args, 'student_id');
        return await getStudentStats(id);
      },
    },

    {
      name: 'get_student_submissions',
      displayName: 'List student submissions',
      description: 'Return all assignment submissions for one student (most recent first).',
      category: 'read',
      risk: 'safe',
      parameters: {
        type: 'object',
        properties: {
          student_id: { type: 'string', description: 'UUID of the student.' },
          limit: { type: 'integer', description: 'Max rows to return (default 50).' },
        },
        required: ['student_id'],
      },
      summarize: (a) => `Loading submissions for student ${str(a.student_id).slice(0, 8)}…`,
      execute: async (args) => {
        const id = mustString(args, 'student_id');
        const limit = Math.min(num(args.limit) ?? 50, 200);
        const rows = await getSubmissionsForStudent(id);
        return rows.slice(0, limit);
      },
    },

    {
      name: 'create_student',
      displayName: 'Create student',
      description:
        'Create a new learner under this teacher. Returns the created learner (without the access token).',
      category: 'write',
      risk: 'write',
      parameters: {
        type: 'object',
        properties: {
          full_name: { type: 'string', description: 'Full legal name.' },
          grade_level: { type: 'string', description: 'Grade label (e.g. "Primary 4").' },
          class_name: { type: 'string', description: 'Optional class name.' },
          parent_name: { type: 'string' },
          parent_phone: { type: 'string' },
          parent_email: { type: 'string' },
          gender: { type: 'string' },
          home_language: { type: 'string' },
        },
        required: ['full_name', 'grade_level'],
      },
      summarize: (a) => `Create student "${str(a.full_name)}" (${str(a.grade_level)})`,
      execute: async (args, ctx) => {
        const created = await createStudent({
          teacher_id: ctx.teacherId,
          full_name: mustString(args, 'full_name'),
          grade_level: mustString(args, 'grade_level'),
          class_name: str(args.class_name) || null,
          parent_name: str(args.parent_name) || null,
          parent_phone: str(args.parent_phone) || null,
          parent_email: str(args.parent_email) || null,
          gender: str(args.gender) || null,
          home_language: str(args.home_language) || null,
          // optional / nullable fields — let DB defaults handle it
          date_of_birth: null,
          nationality: null,
          place_of_birth: null,
          parent_relationship: null,
          home_address: null,
          school_name: null,
          admission_number: null,
          academic_year: null,
          blood_group: null,
          medical_conditions: null,
          allergies: null,
          special_needs: null,
          disability_status: null,
          previous_school: null,
          profile_photo_url: null,
          notes: null,
        } as Parameters<typeof createStudent>[0]);
        return redactStudent(created);
      },
    },

    {
      name: 'update_student',
      displayName: 'Update student',
      description: 'Patch one or more fields on a learner profile.',
      category: 'write',
      risk: 'write',
      parameters: {
        type: 'object',
        properties: {
          student_id: { type: 'string' },
          full_name: { type: 'string' },
          grade_level: { type: 'string' },
          class_name: { type: 'string' },
          parent_name: { type: 'string' },
          parent_phone: { type: 'string' },
          parent_email: { type: 'string' },
          notes: { type: 'string' },
        },
        required: ['student_id'],
      },
      summarize: (a) => `Update student ${str(a.student_id).slice(0, 8)}…`,
      execute: async (args) => {
        const id = mustString(args, 'student_id');
        const patch: Partial<Student> = {};
        for (const k of [
          'full_name',
          'grade_level',
          'class_name',
          'parent_name',
          'parent_phone',
          'parent_email',
          'notes',
        ] as const) {
          const v = args[k];
          if (typeof v === 'string') (patch as Record<string, unknown>)[k] = v;
        }
        await updateStudent(id, patch);
        return { ok: true, student_id: id, updated_fields: Object.keys(patch) };
      },
    },

    {
      name: 'toggle_student_status',
      displayName: 'Change student status',
      description: 'Set a learner\'s account status to active, paused, or suspended.',
      category: 'write',
      risk: 'write',
      parameters: {
        type: 'object',
        properties: {
          student_id: { type: 'string' },
          status: {
            type: 'string',
            enum: ['active', 'paused', 'suspended'],
          },
        },
        required: ['student_id', 'status'],
      },
      summarize: (a) =>
        `Set student ${str(a.student_id).slice(0, 8)}… → ${str(a.status)}`,
      execute: async (args) => {
        const id = mustString(args, 'student_id');
        const status = mustString(args, 'status') as 'active' | 'paused' | 'suspended';
        await toggleStudentStatus(id, status);
        return { ok: true, student_id: id, status };
      },
    },

    {
      name: 'regenerate_student_access_link',
      displayName: 'Regenerate student magic link',
      description:
        'Rotate the student\'s access token and return a fresh student-portal link. Use only when the current link is compromised or lost.',
      category: 'write',
      risk: 'destructive',
      parameters: {
        type: 'object',
        properties: { student_id: { type: 'string' } },
        required: ['student_id'],
      },
      summarize: (a) =>
        `Regenerate magic link for student ${str(a.student_id).slice(0, 8)}…`,
      execute: async (args) => {
        const id = mustString(args, 'student_id');
        const newToken = await regenerateAccessToken(id);
        return { ok: true, student_id: id, access_link: buildAccessLink(newToken) };
      },
    },

    /* ===== Assignments ===== */
    {
      name: 'list_assignments',
      displayName: 'List assignments',
      description:
        "List the teacher's assignments. Optional status filter and substring title search.",
      category: 'read',
      risk: 'safe',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['active', 'draft', 'closed'] },
          search: { type: 'string', description: 'Case-insensitive title contains.' },
          limit: { type: 'integer' },
        },
      },
      summarize: (a) =>
        `Listing assignments${a.status ? ` (${a.status})` : ''}${a.search ? ` matching "${a.search}"` : ''}`,
      execute: async (args, ctx) => {
        const all = await getAssignmentsByTeacher(ctx.teacherId);
        const status = str(args.status) as StudentAssignment['status'] | '';
        const search = str(args.search).toLowerCase();
        const limit = Math.min(num(args.limit) ?? 50, 200);
        const filtered = all
          .filter((a) => (status ? a.status === status : true))
          .filter((a) => (search ? a.title.toLowerCase().includes(search) : true))
          .slice(0, limit);
        return { count: filtered.length, assignments: filtered };
      },
    },

    {
      name: 'get_assignment',
      displayName: 'Read assignment',
      description: 'Return a single assignment by ID.',
      category: 'read',
      risk: 'safe',
      parameters: {
        type: 'object',
        properties: { assignment_id: { type: 'string' } },
        required: ['assignment_id'],
      },
      summarize: (a) => `Loading assignment ${str(a.assignment_id).slice(0, 8)}…`,
      execute: async (args) => {
        const id = mustString(args, 'assignment_id');
        return await getAssignmentById(id);
      },
    },

    {
      name: 'get_assignment_students',
      displayName: 'List students assigned',
      description: 'Return the list of student IDs assigned to a given assignment.',
      category: 'read',
      risk: 'safe',
      parameters: {
        type: 'object',
        properties: { assignment_id: { type: 'string' } },
        required: ['assignment_id'],
      },
      summarize: (a) =>
        `Reading roster for assignment ${str(a.assignment_id).slice(0, 8)}…`,
      execute: async (args) => {
        const id = mustString(args, 'assignment_id');
        const ids = await getAssignmentStudents(id);
        return { count: ids.length, student_ids: ids };
      },
    },

    {
      name: 'get_assignment_stats',
      displayName: 'Assignment stats',
      description:
        'Return aggregate stats across all of this teacher\'s assignments (active, drafts, closed, total submissions, pending grades, overdue).',
      category: 'read',
      risk: 'safe',
      parameters: { type: 'object', properties: {} },
      summarize: () => 'Computing assignment stats',
      execute: async (_args, ctx) => {
        return await getAssignmentStatsForTeacher(ctx.teacherId);
      },
    },

    {
      name: 'get_submission_breakdown',
      displayName: 'Submission breakdown',
      description:
        'Return submitted / pending counts and overdue flag for a single assignment.',
      category: 'read',
      risk: 'safe',
      parameters: {
        type: 'object',
        properties: { assignment_id: { type: 'string' } },
        required: ['assignment_id'],
      },
      summarize: (a) =>
        `Submission breakdown for ${str(a.assignment_id).slice(0, 8)}…`,
      execute: async (args) => {
        const id = mustString(args, 'assignment_id');
        return await getSubmissionBreakdown(id);
      },
    },

    {
      name: 'list_submissions_for_assignment',
      displayName: 'List submissions',
      description: 'List submissions for an assignment (most recent first).',
      category: 'read',
      risk: 'safe',
      parameters: {
        type: 'object',
        properties: {
          assignment_id: { type: 'string' },
          status: { type: 'string', enum: ['submitted', 'graded', 'returned'] },
          limit: { type: 'integer' },
        },
        required: ['assignment_id'],
      },
      summarize: (a) =>
        `Listing submissions for ${str(a.assignment_id).slice(0, 8)}…`,
      execute: async (args) => {
        const id = mustString(args, 'assignment_id');
        const status = str(args.status);
        const limit = Math.min(num(args.limit) ?? 100, 300);
        const rows = await getSubmissionsForAssignment(id);
        const filtered = (status ? rows.filter((r) => r.status === status) : rows).slice(0, limit);
        return { count: filtered.length, submissions: filtered };
      },
    },

    {
      name: 'list_unsubmitted_students',
      displayName: 'Who hasn\'t submitted',
      description:
        'Return the list of learners assigned to an assignment but who have NOT yet submitted.',
      category: 'read',
      risk: 'safe',
      parameters: {
        type: 'object',
        properties: { assignment_id: { type: 'string' } },
        required: ['assignment_id'],
      },
      summarize: (a) =>
        `Finding non-submitters for ${str(a.assignment_id).slice(0, 8)}…`,
      execute: async (args, ctx) => {
        const id = mustString(args, 'assignment_id');
        const all = await getStudentsByTeacher(ctx.teacherId);
        const missing = await getUnsubmittedStudents(id, all);
        return {
          count: missing.length,
          students: missing.map((s) => ({
            id: s.id,
            full_name: s.full_name,
            grade_level: s.grade_level,
            parent_phone: s.parent_phone,
          })),
        };
      },
    },

    {
      name: 'create_assignment',
      displayName: 'Create assignment',
      description:
        'Create a new assignment for this teacher. Optionally assign a list of student IDs at the same time.',
      category: 'write',
      risk: 'write',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          subject: { type: 'string', description: 'Default "Mathematics".' },
          grade_level: { type: 'string' },
          due_date: { type: 'string', description: 'ISO datetime, e.g. 2026-05-21T23:59:00Z' },
          status: { type: 'string', enum: ['active', 'draft', 'closed'] },
          max_score: { type: 'number' },
          instructions: { type: 'string' },
          student_ids: {
            type: 'array',
            description: 'Optional learner IDs to assign immediately.',
            items: { type: 'string' },
          },
        },
        required: ['title', 'grade_level', 'due_date'],
      },
      summarize: (a) => `Create assignment "${str(a.title)}" (due ${str(a.due_date)})`,
      execute: async (args, ctx) => {
        const created = await createAssignment(
          {
            teacher_id: ctx.teacherId,
            title: mustString(args, 'title'),
            description: str(args.description) || null,
            subject: str(args.subject) || 'Mathematics',
            grade_level: mustString(args, 'grade_level'),
            due_date: mustString(args, 'due_date'),
            status: (str(args.status) || 'active') as StudentAssignment['status'],
            max_score: num(args.max_score) ?? null,
            instructions: str(args.instructions) || null,
            attachment_url: null,
            rubric_criteria: [],
            peer_review_enabled: false,
            reminder_48h: false,
            reminder_24h: false,
            reminder_due_day: false,
            reminder_parent_sms: false,
          },
          arr<string>(args.student_ids).filter((s) => typeof s === 'string'),
        );
        return created;
      },
    },

    {
      name: 'update_assignment',
      displayName: 'Update assignment',
      description: 'Patch fields on an existing assignment.',
      category: 'write',
      risk: 'write',
      parameters: {
        type: 'object',
        properties: {
          assignment_id: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          due_date: { type: 'string' },
          status: { type: 'string', enum: ['active', 'draft', 'closed'] },
          max_score: { type: 'number' },
          instructions: { type: 'string' },
        },
        required: ['assignment_id'],
      },
      summarize: (a) => `Update assignment ${str(a.assignment_id).slice(0, 8)}…`,
      execute: async (args) => {
        const id = mustString(args, 'assignment_id');
        const patch: Partial<StudentAssignment> = {};
        for (const k of ['title', 'description', 'due_date', 'instructions'] as const) {
          const v = args[k];
          if (typeof v === 'string') (patch as Record<string, unknown>)[k] = v;
        }
        const status = str(args.status);
        if (status) (patch as { status?: StudentAssignment['status'] }).status =
          status as StudentAssignment['status'];
        const ms = num(args.max_score);
        if (ms !== undefined) (patch as { max_score?: number }).max_score = ms;
        await updateAssignment(id, patch);
        return { ok: true, assignment_id: id, updated_fields: Object.keys(patch) };
      },
    },

    {
      name: 'set_assignment_students',
      displayName: 'Reassign students',
      description: 'Replace the list of students assigned to an assignment.',
      category: 'write',
      risk: 'write',
      parameters: {
        type: 'object',
        properties: {
          assignment_id: { type: 'string' },
          student_ids: { type: 'array', items: { type: 'string' } },
        },
        required: ['assignment_id', 'student_ids'],
      },
      summarize: (a) =>
        `Set roster on assignment ${str(a.assignment_id).slice(0, 8)}… (${arr(a.student_ids).length} students)`,
      execute: async (args) => {
        const id = mustString(args, 'assignment_id');
        const ids = arr<string>(args.student_ids).filter((s) => typeof s === 'string');
        await updateAssignmentStudents(id, ids);
        return { ok: true, assignment_id: id, student_count: ids.length };
      },
    },

    {
      name: 'delete_assignment',
      displayName: 'Delete assignment',
      description:
        'Permanently delete an assignment AND its student links and submissions. Cannot be undone.',
      category: 'write',
      risk: 'destructive',
      parameters: {
        type: 'object',
        properties: { assignment_id: { type: 'string' } },
        required: ['assignment_id'],
      },
      summarize: (a) => `DELETE assignment ${str(a.assignment_id).slice(0, 8)}…`,
      execute: async (args) => {
        const id = mustString(args, 'assignment_id');
        await deleteAssignment(id);
        return { ok: true, assignment_id: id };
      },
    },

    /* ===== Grading ===== */
    {
      name: 'grade_submission',
      displayName: 'Grade submission',
      description: 'Set the score and teacher feedback on a submission and mark it as graded.',
      category: 'write',
      risk: 'write',
      parameters: {
        type: 'object',
        properties: {
          submission_id: { type: 'string' },
          score: { type: 'number' },
          feedback: { type: 'string' },
        },
        required: ['submission_id', 'score', 'feedback'],
      },
      summarize: (a) =>
        `Grade submission ${str(a.submission_id).slice(0, 8)}… → ${num(a.score)}`,
      execute: async (args) => {
        const id = mustString(args, 'submission_id');
        const score = num(args.score);
        if (score === undefined) throw new Error('score must be a number');
        const feedback = str(args.feedback);
        await gradeSubmission(id, score, feedback);
        return { ok: true, submission_id: id, score };
      },
    },

    {
      name: 'return_submission',
      displayName: 'Return submission for resubmit',
      description:
        'Return a submission to the learner (status → "returned") with a score (or null) and feedback.',
      category: 'write',
      risk: 'write',
      parameters: {
        type: 'object',
        properties: {
          submission_id: { type: 'string' },
          score: { type: 'number', description: 'Optional score; pass null to omit.' },
          feedback: { type: 'string' },
        },
        required: ['submission_id', 'feedback'],
      },
      summarize: (a) =>
        `Return submission ${str(a.submission_id).slice(0, 8)}… for resubmit`,
      execute: async (args) => {
        const id = mustString(args, 'submission_id');
        const score = typeof args.score === 'number' ? (args.score as number) : null;
        const feedback = str(args.feedback);
        await returnSubmission(id, score, feedback);
        return { ok: true, submission_id: id };
      },
    },

    {
      name: 'get_ai_grading_summary',
      displayName: 'AI grading summary',
      description:
        'Return AI grading summary for an assignment: counts, average AI score and distribution.',
      category: 'read',
      risk: 'safe',
      parameters: {
        type: 'object',
        properties: { assignment_id: { type: 'string' } },
        required: ['assignment_id'],
      },
      summarize: (a) =>
        `AI grading summary for ${str(a.assignment_id).slice(0, 8)}…`,
      execute: async (args) => {
        const id = mustString(args, 'assignment_id');
        return await getAiGradingSummary(id);
      },
    },

    {
      name: 'ai_grade_submission',
      displayName: 'Run AI grading',
      description:
        'Run AI grading on a single submission (vision model). Saves AI score + AI feedback to the submission. Does NOT replace the human grade.',
      category: 'ai',
      risk: 'write',
      parameters: {
        type: 'object',
        properties: {
          submission_id: { type: 'string' },
          assignment_id: { type: 'string' },
          student_name: { type: 'string', description: 'Used for friendlier AI feedback.' },
        },
        required: ['submission_id', 'assignment_id'],
      },
      summarize: (a) =>
        `AI-grade submission ${str(a.submission_id).slice(0, 8)}…`,
      execute: async (args) => {
        const subId = mustString(args, 'submission_id');
        const aId = mustString(args, 'assignment_id');
        const assignment = await getAssignmentById(aId);
        if (!assignment) throw new Error('Assignment not found');
        const result = await regradeSubmissionWithAI(subId, assignment, str(args.student_name) || 'Student');
        if (result.success) {
          // regradeSubmissionWithAI already saves on success, but call again defensively if needed.
          try {
            await saveAiGrading(subId, result.score, result.feedback);
          } catch {
            /* already saved */
          }
        }
        return result;
      },
    },

    /* ===== Announcements ===== */
    {
      name: 'list_announcements',
      displayName: 'List announcements',
      description: "List the teacher's announcements (pinned first, newest first).",
      category: 'read',
      risk: 'safe',
      parameters: {
        type: 'object',
        properties: { limit: { type: 'integer' } },
      },
      summarize: () => 'Loading announcements',
      execute: async (args) => {
        const all = await getAnnouncementsForTeacher();
        const limit = Math.min(num(args.limit) ?? 50, 200);
        return { count: all.length, announcements: all.slice(0, limit) };
      },
    },

    {
      name: 'get_announcement_read_stats',
      displayName: 'Announcement read stats',
      description: 'Return who has read a given announcement and the read ratio.',
      category: 'read',
      risk: 'safe',
      parameters: {
        type: 'object',
        properties: { announcement_id: { type: 'string' } },
        required: ['announcement_id'],
      },
      summarize: (a) =>
        `Reading stats for announcement ${str(a.announcement_id).slice(0, 8)}…`,
      execute: async (args) => {
        const id = mustString(args, 'announcement_id');
        return await getAnnouncementReadStats(id);
      },
    },

    {
      name: 'create_announcement',
      displayName: 'Create announcement',
      description: 'Post a new announcement to learners.',
      category: 'write',
      risk: 'write',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          message: { type: 'string' },
          category: { type: 'string' },
          target_grade_level: { type: 'string' },
          target_class_name: { type: 'string' },
          is_pinned: { type: 'boolean' },
          expires_at: { type: 'string', description: 'Optional ISO datetime' },
        },
        required: ['title', 'message'],
      },
      summarize: (a) => `Post announcement "${str(a.title)}"`,
      execute: async (args) => {
        return await createAnnouncement({
          title: mustString(args, 'title'),
          message: mustString(args, 'message'),
          category: str(args.category) || undefined,
          targetGradeLevel: str(args.target_grade_level) || undefined,
          targetClassName: str(args.target_class_name) || undefined,
          isPinned: boolish(args.is_pinned) ?? false,
          expiresAt: args.expires_at ? new Date(str(args.expires_at)) : undefined,
        });
      },
    },

    {
      name: 'update_announcement',
      displayName: 'Update announcement',
      description: 'Patch fields on an announcement (title, message, pin state, expiry, etc.).',
      category: 'write',
      risk: 'write',
      parameters: {
        type: 'object',
        properties: {
          announcement_id: { type: 'string' },
          title: { type: 'string' },
          message: { type: 'string' },
          category: { type: 'string' },
          target_grade_level: { type: 'string' },
          target_class_name: { type: 'string' },
          is_pinned: { type: 'boolean' },
          expires_at: { type: 'string' },
        },
        required: ['announcement_id'],
      },
      summarize: (a) => `Update announcement ${str(a.announcement_id).slice(0, 8)}…`,
      execute: async (args) => {
        const id = mustString(args, 'announcement_id');
        const patch: Parameters<typeof updateAnnouncement>[1] = {};
        if (typeof args.title === 'string') patch.title = args.title;
        if (typeof args.message === 'string') patch.message = args.message;
        if (typeof args.category === 'string') patch.category = args.category;
        if (typeof args.target_grade_level === 'string')
          patch.targetGradeLevel = args.target_grade_level;
        if (typeof args.target_class_name === 'string')
          patch.targetClassName = args.target_class_name;
        if (typeof args.is_pinned === 'boolean') patch.isPinned = args.is_pinned;
        if (typeof args.expires_at === 'string')
          patch.expiresAt = new Date(args.expires_at);
        return await updateAnnouncement(id, patch);
      },
    },

    {
      name: 'toggle_announcement_pin',
      displayName: 'Pin / unpin announcement',
      description: 'Pin or unpin an announcement at the top of the student feed.',
      category: 'write',
      risk: 'write',
      parameters: {
        type: 'object',
        properties: {
          announcement_id: { type: 'string' },
          is_pinned: { type: 'boolean' },
        },
        required: ['announcement_id', 'is_pinned'],
      },
      summarize: (a) =>
        `${a.is_pinned ? 'Pin' : 'Unpin'} announcement ${str(a.announcement_id).slice(0, 8)}…`,
      execute: async (args) => {
        const id = mustString(args, 'announcement_id');
        const pin = boolish(args.is_pinned) ?? false;
        await toggleAnnouncementPin(id, pin);
        return { ok: true, announcement_id: id, is_pinned: pin };
      },
    },

    {
      name: 'delete_announcement',
      displayName: 'Delete announcement',
      description: 'Permanently delete an announcement.',
      category: 'write',
      risk: 'destructive',
      parameters: {
        type: 'object',
        properties: { announcement_id: { type: 'string' } },
        required: ['announcement_id'],
      },
      summarize: (a) => `DELETE announcement ${str(a.announcement_id).slice(0, 8)}…`,
      execute: async (args) => {
        const id = mustString(args, 'announcement_id');
        await deleteAnnouncement(id);
        return { ok: true, announcement_id: id };
      },
    },

    /* ===== Resources ===== */
    {
      name: 'list_resources',
      displayName: 'List resources',
      description: "List the teacher's resource library entries.",
      category: 'read',
      risk: 'safe',
      parameters: {
        type: 'object',
        properties: { limit: { type: 'integer' } },
      },
      summarize: () => 'Loading resources',
      execute: async (args) => {
        const all = await getResourcesForTeacher();
        const limit = Math.min(num(args.limit) ?? 50, 200);
        return { count: all.length, resources: all.slice(0, limit) };
      },
    },

    {
      name: 'list_resource_topics',
      displayName: 'List resource topics',
      description: "List unique topic tags used in the teacher's resource library.",
      category: 'read',
      risk: 'safe',
      parameters: { type: 'object', properties: {} },
      summarize: () => 'Loading resource topics',
      execute: async () => {
        const topics = await getTeacherResourceTopics();
        return { count: topics.length, topics };
      },
    },

    {
      name: 'create_resource',
      displayName: 'Create resource',
      description:
        'Create a new resource (link or external file). Use after the teacher has uploaded a file (provide its public URL).',
      category: 'write',
      risk: 'write',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          file_url: { type: 'string', description: 'Public URL to the file or link.' },
          topic: { type: 'string' },
          grade_level: { type: 'string' },
          is_public: { type: 'boolean' },
        },
        required: ['title', 'file_url'],
      },
      summarize: (a) => `Create resource "${str(a.title)}"`,
      execute: async (args) => {
        return await createResource({
          title: mustString(args, 'title'),
          description: str(args.description) || undefined,
          fileUrl: mustString(args, 'file_url'),
          topic: str(args.topic) || undefined,
          gradeLevel: str(args.grade_level) || undefined,
          isPublic: boolish(args.is_public) ?? false,
        });
      },
    },

    {
      name: 'update_resource',
      displayName: 'Update resource',
      description: 'Patch fields on a resource entry.',
      category: 'write',
      risk: 'write',
      parameters: {
        type: 'object',
        properties: {
          resource_id: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          topic: { type: 'string' },
          grade_level: { type: 'string' },
          is_public: { type: 'boolean' },
        },
        required: ['resource_id'],
      },
      summarize: (a) => `Update resource ${str(a.resource_id).slice(0, 8)}…`,
      execute: async (args) => {
        const id = mustString(args, 'resource_id');
        return await updateResource(id, {
          title: typeof args.title === 'string' ? args.title : undefined,
          description: typeof args.description === 'string' ? args.description : undefined,
          topic: typeof args.topic === 'string' ? args.topic : undefined,
          gradeLevel: typeof args.grade_level === 'string' ? args.grade_level : undefined,
          isPublic: boolish(args.is_public),
        });
      },
    },

    {
      name: 'delete_resource',
      displayName: 'Delete resource',
      description: 'Permanently delete a resource entry.',
      category: 'write',
      risk: 'destructive',
      parameters: {
        type: 'object',
        properties: { resource_id: { type: 'string' } },
        required: ['resource_id'],
      },
      summarize: (a) => `DELETE resource ${str(a.resource_id).slice(0, 8)}…`,
      execute: async (args) => {
        const id = mustString(args, 'resource_id');
        await deleteResource(id);
        return { ok: true, resource_id: id };
      },
    },

    /* ===== Comments / discussion ===== */
    {
      name: 'list_assignment_comments',
      displayName: 'List discussion',
      description: 'List discussion comments on an assignment.',
      category: 'read',
      risk: 'safe',
      parameters: {
        type: 'object',
        properties: { assignment_id: { type: 'string' } },
        required: ['assignment_id'],
      },
      summarize: (a) =>
        `Loading comments for ${str(a.assignment_id).slice(0, 8)}…`,
      execute: async (args) => {
        const id = mustString(args, 'assignment_id');
        return await getAssignmentCommentsForTeacher(id);
      },
    },

    {
      name: 'add_teacher_comment',
      displayName: 'Post comment',
      description:
        'Post a teacher comment on an assignment. Optionally reply to a parent comment, or address one specific student privately.',
      category: 'write',
      risk: 'write',
      parameters: {
        type: 'object',
        properties: {
          assignment_id: { type: 'string' },
          message: { type: 'string' },
          parent_comment_id: { type: 'string' },
          is_private: { type: 'boolean' },
          target_student_id: { type: 'string' },
        },
        required: ['assignment_id', 'message'],
      },
      summarize: (a) =>
        `Comment on assignment ${str(a.assignment_id).slice(0, 8)}…`,
      execute: async (args) => {
        const id = mustString(args, 'assignment_id');
        const message = mustString(args, 'message');
        return await addTeacherComment(id, message, {
          parentCommentId: str(args.parent_comment_id) || undefined,
          isPrivate: boolish(args.is_private),
          targetStudentId: str(args.target_student_id) || undefined,
        });
      },
    },

    {
      name: 'delete_comment',
      displayName: 'Delete comment',
      description: 'Permanently delete a comment.',
      category: 'write',
      risk: 'destructive',
      parameters: {
        type: 'object',
        properties: { comment_id: { type: 'string' } },
        required: ['comment_id'],
      },
      summarize: (a) => `DELETE comment ${str(a.comment_id).slice(0, 8)}…`,
      execute: async (args) => {
        const id = mustString(args, 'comment_id');
        await deleteComment(id);
        return { ok: true, comment_id: id };
      },
    },

    /* ===== Notifications ===== */
    {
      name: 'list_notifications',
      displayName: 'List notifications',
      description: 'List the teacher\'s in-app notifications (most recent first).',
      category: 'read',
      risk: 'safe',
      parameters: {
        type: 'object',
        properties: { limit: { type: 'integer' } },
      },
      summarize: () => 'Loading notifications',
      execute: async (args) => {
        const limit = Math.min(num(args.limit) ?? 50, 200);
        return await getTeacherNotifications(limit);
      },
    },

    {
      name: 'get_unread_notification_count',
      displayName: 'Unread count',
      description: 'Return the number of unread teacher notifications.',
      category: 'read',
      risk: 'safe',
      parameters: { type: 'object', properties: {} },
      summarize: () => 'Counting unread notifications',
      execute: async () => ({ unread: await getTeacherUnreadCount() }),
    },

    {
      name: 'mark_notification_read',
      displayName: 'Mark notification read',
      description: 'Mark one notification as read.',
      category: 'write',
      risk: 'write',
      parameters: {
        type: 'object',
        properties: { notification_id: { type: 'string' } },
        required: ['notification_id'],
      },
      summarize: (a) =>
        `Mark notification ${str(a.notification_id).slice(0, 8)}… read`,
      execute: async (args) => {
        const id = mustString(args, 'notification_id');
        await markTeacherNotificationRead(id);
        return { ok: true, notification_id: id };
      },
    },

    {
      name: 'mark_all_notifications_read',
      displayName: 'Mark all notifications read',
      description: 'Mark all of the teacher\'s notifications as read.',
      category: 'write',
      risk: 'write',
      parameters: { type: 'object', properties: {} },
      summarize: () => 'Mark all notifications read',
      execute: async () => {
        await markAllTeacherNotificationsRead();
        return { ok: true };
      },
    },

    {
      name: 'notify_all_students',
      displayName: 'Broadcast in-app to students',
      description:
        'Send an in-app notification to every active student under this teacher. Use sparingly.',
      category: 'write',
      risk: 'write',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: [
              'assignment_due',
              'graded',
              'new_assignment',
              'comment',
              'resubmit_request',
              'announcement',
              'submission',
              'general',
            ],
          },
          title: { type: 'string' },
          message: { type: 'string' },
          link_url: { type: 'string' },
        },
        required: ['type', 'title'],
      },
      summarize: (a) => `Broadcast "${str(a.title)}" to all students`,
      execute: async (args, ctx) => {
        await notifyAllStudents(
          ctx.teacherId,
          mustString(args, 'type') as Parameters<typeof notifyAllStudents>[1],
          mustString(args, 'title'),
          str(args.message) || undefined,
          str(args.link_url) || undefined,
        );
        return { ok: true };
      },
    },

    {
      name: 'create_notification',
      displayName: 'Notify one user',
      description:
        'Create a single notification, addressed to either a student or another teacher.',
      category: 'write',
      risk: 'write',
      parameters: {
        type: 'object',
        properties: {
          recipient_student_id: { type: 'string' },
          recipient_teacher_id: { type: 'string' },
          type: {
            type: 'string',
            enum: [
              'assignment_due',
              'graded',
              'new_assignment',
              'comment',
              'resubmit_request',
              'announcement',
              'submission',
              'general',
            ],
          },
          title: { type: 'string' },
          message: { type: 'string' },
          link_url: { type: 'string' },
          related_assignment_id: { type: 'string' },
          related_submission_id: { type: 'string' },
        },
        required: ['type', 'title'],
      },
      summarize: (a) => `Notify "${str(a.title)}"`,
      execute: async (args) => {
        return await createNotification({
          recipientStudentId: str(args.recipient_student_id) || undefined,
          recipientTeacherId: str(args.recipient_teacher_id) || undefined,
          type: mustString(args, 'type') as Parameters<typeof createNotification>[0]['type'],
          title: mustString(args, 'title'),
          message: str(args.message) || undefined,
          linkUrl: str(args.link_url) || undefined,
          relatedAssignmentId: str(args.related_assignment_id) || undefined,
          relatedSubmissionId: str(args.related_submission_id) || undefined,
        });
      },
    },

    {
      name: 'query_official_curriculum',
      displayName: 'Official curriculum (CM / NG)',
      description:
        'Read-only access to embedded **Cameroon** and **Nigeria** Primary Mathematics curricula. For "list the curriculum for Primary 2", use action **list_topics** with `country` and `class_level` exactly like "Primary 2" (spelling flexible: "primary 2" works). Returns `teacher_plaintext_list`—copy that into your reply for the teacher. Also use whenever discussing or generating **lesson plans** so objectives match the official scheme.',
      category: 'read',
      risk: 'safe',
      parameters: {
        type: 'object',
        properties: {
          country: {
            type: 'string',
            enum: ['cameroon', 'nigeria'],
            description: 'Which national primary math curriculum to query.',
          },
          action: {
            type: 'string',
            enum: ['summary', 'class_levels', 'list_topics', 'strands', 'topic_by_id', 'search_topics'],
            description:
              'summary: overview + sample topic ids. class_levels: levels with topic counts. list_topics: needs class_level. strands: strands for a level. topic_by_id: full official text for one topic id. search_topics: substring search within a level.',
          },
          class_level: {
            type: 'string',
            description:
              'Required for list_topics, strands, search_topics. Use "Primary 1" … "Primary 6" (e.g. "Primary 2" for Nigeria Primary 2).',
          },
          topic_id: { type: 'string', description: 'Required for topic_by_id (from list_topics / search_topics).' },
          search_query: { type: 'string', description: 'Substring for search_topics.' },
          max_topics: {
            type: 'integer',
            description: 'Optional cap for list_topics (default 90, max 150).',
          },
        },
        required: ['country', 'action'],
      },
      summarize: (a) => `Curriculum ${str(a.country)} · ${str(a.action)}`,
      execute: async (args) => {
        const country = (str(args.country)?.toLowerCase() === 'nigeria' ? 'nigeria' : 'cameroon') as
          | 'cameroon'
          | 'nigeria';
        const action = mustString(args, 'action');

        switch (action) {
          case 'summary': {
            const c = getCurriculumContent(country);
            const levels = getClassLevelsForCountry(country);
            const firstLevel = levels[0] || 'Primary 1';
            const sampleTopics = getTopicsForClassLevel(country, firstLevel)
              .slice(0, 12)
              .map((t) => ({ id: t.id, title: t.title, strand: t.strand }));
            const teacher_plaintext_list = [
              `${c.country} — ${c.subject} (${c.level})`,
              c.description,
              '',
              'Topics per level:',
              ...levels.map(
                (lv) => `• ${lv}: ${getTopicsForClassLevel(country, lv).length} topics`,
              ),
              '',
              `Sample from ${firstLevel}:`,
              ...sampleTopics.map((t, i) => `${i + 1}. ${t.title} — ${t.strand} (id: ${t.id})`),
            ].join('\n');
            return {
              country,
              official_name: c.country,
              subject: c.subject,
              high_level_description: c.description,
              primary_levels: levels,
              levels_topic_counts: levels.map((level) => ({
                level,
                topic_count: getTopicsForClassLevel(country, level).length,
              })),
              sample_topics_preview_for_first_level: sampleTopics,
              teacher_plaintext_list,
              hint: 'Use list_topics with class_level, then topic_by_id or search_topics for full detail.',
            };
          }
          case 'class_levels': {
            const levels = getClassLevelsForCountry(country);
            const teacher_plaintext_list = levels
              .map(
                (level) =>
                  `${level}: ${getTopicsForClassLevel(country, level).length} mathematics topics`,
              )
              .join('\n');
            return {
              country,
              levels: levels.map((level) => ({
                level,
                topic_count: getTopicsForClassLevel(country, level).length,
              })),
              teacher_plaintext_list,
            };
          }
          case 'list_topics': {
            const levelNorm = normalizePrimaryLevel(mustString(args, 'class_level'));
            const cap = Math.min(150, Math.max(5, num(args.max_topics) ?? 90));
            const topics = getTopicsForClassLevel(country, levelNorm);
            const sliced = topics.slice(0, cap);
            const teacher_plaintext_list = sliced
              .map((t, i) => {
                const w = t.weeklyPlacement != null ? ` (week ${t.weeklyPlacement})` : '';
                return `${i + 1}. ${t.title} — ${t.strand}${w}`;
              })
              .join('\n');
            return {
              country,
              class_level: levelNorm,
              total_topics: topics.length,
              truncated: topics.length > sliced.length,
              topics: sliced.map((t) => ({
                id: t.id,
                title: t.title,
                strand: t.strand,
                week: t.weeklyPlacement ?? null,
                term: t.termPlacement ?? null,
              })),
              teacher_plaintext_list,
            };
          }
          case 'strands': {
            const levelNorm = normalizePrimaryLevel(mustString(args, 'class_level'));
            const strands = getStrandsForClassLevel(country, levelNorm);
            const teacher_plaintext_list = strands.map((s, i) => `${i + 1}. ${s}`).join('\n');
            return {
              country,
              class_level: levelNorm,
              strands,
              teacher_plaintext_list,
            };
          }
          case 'topic_by_id': {
            const topicId = mustString(args, 'topic_id');
            const found = findTopicWithContext(topicId);
            if (!found) {
              throw new Error(
                `Unknown topic_id "${topicId}". Use list_topics or search_topics on a class level to discover ids.`,
              );
            }
            const full = formatSelectedTopicForPrompt(found.topic, found.classLevel, found.country);
            const max = 16_000;
            const body =
              full.length > max ? `${full.slice(0, max)}\n…[truncated]` : full;
            const teacher_plaintext_excerpt =
              full.length > 5000 ? `${full.slice(0, 5000)}\n…[more in official_alignment_text]` : full;
            return {
              country: found.country,
              class_level: found.classLevel,
              topic_id: found.topic.id,
              title: found.topic.title,
              strand: found.topic.strand,
              official_alignment_text: body,
              teacher_plaintext_excerpt,
            };
          }
          case 'search_topics': {
            const levelNorm = normalizePrimaryLevel(mustString(args, 'class_level'));
            const q = mustString(args, 'search_query').toLowerCase();
            const topics = getTopicsForClassLevel(country, levelNorm).filter(
              (t) =>
                t.title.toLowerCase().includes(q) ||
                t.strand.toLowerCase().includes(q) ||
                t.id.toLowerCase().includes(q) ||
                (t.subtopics?.some((s) => s.toLowerCase().includes(q)) ?? false),
            );
            const cap = 40;
            const sliced = topics.slice(0, cap);
            const teacher_plaintext_list = sliced
              .map((t, i) => `${i + 1}. ${t.title} — ${t.strand}`)
              .join('\n');
            return {
              country,
              class_level: levelNorm,
              query: q,
              match_count: topics.length,
              truncated: topics.length > sliced.length,
              matches: sliced.map((t) => ({ id: t.id, title: t.title, strand: t.strand })),
              teacher_plaintext_list,
            };
          }
          default:
            throw new Error(`Unknown curriculum action "${action}".`);
        }
      },
    },

    /* ===== Lesson plan generation (AI) ===== */
    {
      name: 'generate_lesson_plan',
      displayName: 'Generate lesson plan (AI)',
      description:
        'Generate a structured lesson plan JSON for the given topic and grade. When grounding in national expectations, call **query_official_curriculum** first (search_topics / topic_by_id) and fold objectives into the request. Returns JSON for review; saving still happens from the Lesson Plan UI after approval.',
      category: 'ai',
      risk: 'write',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string' },
          grade_level: { type: 'string', description: 'e.g. "Primary 4".' },
          country: { type: 'string', enum: ['cameroon', 'nigeria'] },
          language: {
            type: 'string',
            enum: ['english', 'french', 'pidgin', 'hausa', 'yoruba'],
          },
        },
        required: ['topic', 'grade_level'],
      },
      summarize: (a) =>
        `Generate lesson plan: "${str(a.topic)}" for ${str(a.grade_level)}`,
      execute: async (args, ctx) => {
        const topic = mustString(args, 'topic');
        const level = mustString(args, 'grade_level');
        const country = (str(args.country) || ctx.country || 'cameroon') as
          | 'cameroon'
          | 'nigeria';
        const language = str(args.language) || ctx.language || 'english';
        const result = await generateLessonPlan(
          topic,
          level,
          [],
          undefined,
          country,
          language,
        );
        return {
          topic,
          grade_level: level,
          country,
          language,
          plan: result.rawObject,
        };
      },
    },

    /* ===== Class join code maintenance ===== */
    {
      name: 'regenerate_join_code',
      displayName: 'Rotate class join code',
      description:
        'Generate and assign a new public class join code. Old enrollment links stop working.',
      category: 'write',
      risk: 'destructive',
      parameters: { type: 'object', properties: {} },
      summarize: () => 'Rotate class join code',
      execute: async (_args, ctx) => {
        const code = await regenerateTeacherJoinCode(ctx.teacherId);
        return { code, enroll_url: buildEnrollPageLink(code) };
      },
    },

    /* ===== Navigation ===== */
    {
      name: 'open_dashboard_route',
      displayName: 'Open dashboard route',
      description:
        'Return a canonical URL to a dashboard page. The UI will render a button that takes the teacher there.',
      category: 'navigate',
      risk: 'safe',
      parameters: {
        type: 'object',
        properties: {
          route: {
            type: 'string',
            enum: Object.keys(NAVIGATION_ROUTES) as readonly string[],
            description:
              'One of the supported dashboard routes (dashboard, students, assignments, lesson_plan, etc.).',
          },
          assignment_id: { type: 'string' },
          student_id: { type: 'string' },
        },
        required: ['route'],
      },
      summarize: (a) => `Provide link to ${str(a.route)}`,
      execute: async (args) => {
        const key = str(args.route);
        let path = NAVIGATION_ROUTES[key];
        if (!path) throw new Error(`Unknown route "${key}"`);
        if (path.includes(':assignmentId')) {
          path = path.replace(':assignmentId', str(args.assignment_id));
        }
        if (path.includes(':studentId')) {
          path = path.replace(':studentId', str(args.student_id));
        }
        return { route: key, path };
      },
    },
  ];
}

export type { ToolContext } from './types';
