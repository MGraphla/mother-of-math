/**
 * Builds a compact, privacy-conscious snapshot of the signed-in teacher's
 * dashboard data for MAMA chatbot RAG-style system context.
 * Aggregates only — no student full names unless needed later.
 */

import { supabase } from '@/lib/supabase';

export interface TeacherChatbotContextResult {
  /** Markdown block safe to append to the model system prompt */
  summaryMarkdown: string;
}

const gradeKey = (g: string | null | undefined) => (g?.trim() ? g.trim() : 'Unspecified');

export async function fetchTeacherChatbotContext(teacherId: string): Promise<TeacherChatbotContextResult> {
  if (!teacherId) {
    return { summaryMarkdown: '_No teacher session._' };
  }

  const [studentsRes, assignmentsRes, plansRes] = await Promise.all([
    supabase.from('students').select('id, grade_level, account_status, created_at').eq('teacher_id', teacherId),
    supabase
      .from('assignments')
      .select('id, title, status, grade_level, created_at, due_date')
      .eq('teacher_id', teacherId)
      .order('created_at', { ascending: false })
      .limit(40),
    supabase
      .from('lesson_plans')
      .select('id, title, created_at')
      .eq('user_id', teacherId)
      .order('created_at', { ascending: false })
      .limit(8),
  ]);

  const students = studentsRes.data ?? [];
  const assignmentsAll = assignmentsRes.data ?? [];
  const assignments = assignmentsAll.slice(0, 12);
  const plans = plansRes.data ?? [];
  const assignmentIds = assignmentsAll.map((a: { id: string }) => a.id);

  let subs: { status?: string }[] = [];
  if (assignmentIds.length) {
    const { data: subData } = await supabase
      .from('assignment_submissions')
      .select('id, status, submitted_at')
      .in('assignment_id', assignmentIds)
      .order('submitted_at', { ascending: false })
      .limit(50);
    subs = subData ?? [];
  }

  const byGrade: Record<string, number> = {};
  let active = 0;
  for (const s of students) {
    const k = gradeKey(s.grade_level as string | null);
    byGrade[k] = (byGrade[k] ?? 0) + 1;
    if (s.account_status === 'active') active++;
  }

  const lines: string[] = [];
  lines.push(`- **Learners on roster:** ${students.length} (${active} marked active in records).`);
  if (Object.keys(byGrade).length) {
    lines.push(
      `- **By grade label:** ${Object.entries(byGrade)
        .map(([g, n]) => `${g}: ${n}`)
        .join('; ')}`,
    );
  }
  lines.push(`- **Assignments created (recent sample up to 12):** ${assignments.length ? assignments.length : 0} pulled; **lesson plans (recent up to 8):** ${plans.length} pulled.`);
  if (assignments.length) {
    lines.push(
      `- **Recent assignment titles:** ${assignments
        .slice(0, 6)
        .map((a) => `"${(a.title as string)?.slice(0, 80) || 'Untitled'}"`)
        .join(', ')}`,
    );
  }
  if (plans.length) {
    lines.push(
      `- **Recent lesson plan titles:** ${plans
        .slice(0, 5)
        .map((p) => `"${(p.title as string)?.slice(0, 80) || 'Untitled'}"`)
        .join(', ')}`,
    );
  }
  if (subs.length) {
    const graded = subs.filter((s: { status?: string }) => s.status === 'graded').length;
    lines.push(`- **Recent submissions sampled:** ${subs.length} rows; **graded among sample:** ${graded}.`);
  }

  const summaryMarkdown = lines.join('\n');
  return { summaryMarkdown };
}
