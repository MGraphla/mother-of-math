import { useEffect, useState } from 'react';
import { Sparkles, Loader2, AlertCircle, Wand2 } from 'lucide-react';
import { Card, PageHeader, SectionTitle, Badge } from '../components/ui';
import { stripMarkdown } from '../utils/text';
import { SCOPE_COUNTRY_NAME } from '../utils/scope';
import {
  getAdminDashboardOverview,
  getActivityTrends,
  getStudentsPerTeacher,
  getLessonPlansByTeacher,
  getTeachersByCountry,
  getAllStudentWorks,
} from '../services/monitorData';
import { generateInsight, hasOpenRouterKey } from '../services/aiInsights';

const PRESET_PROMPTS = [
  {
    label: 'Adoption summary',
    question: 'Summarise overall adoption: how many teachers are active, what countries are best represented, what features are being used most, and what is the engagement trend over the last 30 days?',
  },
  {
    label: 'Top performing teachers',
    question: 'Who are the top performing teachers based on lesson plans, assignments and student interactions? What patterns do they share?',
  },
  {
    label: 'Common student errors',
    question: 'Based on the AI-classified error types and counts, what are the most common student errors? Which grades or subjects are most affected?',
  },
  {
    label: 'Risks & recommendations',
    question: 'What are the biggest concerns or risks visible in the data (low engagement, missing data, drop-offs)? Give three concrete recommendations.',
  },
];

const MonitorAIInsights = () => {
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [building, setBuilding] = useState(true);
  const [question, setQuestion] = useState(PRESET_PROMPTS[0].question);
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const hasKey = hasOpenRouterKey();

  /* Build a compact, real-data summary on mount */
  useEffect(() => {
    (async () => {
      try {
        const [overview, trends, topTeachers, topPlans, countries, works] = await Promise.all([
          getAdminDashboardOverview(),
          getActivityTrends(),
          getStudentsPerTeacher(),
          getLessonPlansByTeacher(),
          getTeachersByCountry(),
          getAllStudentWorks(),
        ]);

        // Aggregate errors
        const errMap = new Map<string, number>();
        works.forEach((w) => {
          if (w.error_type) errMap.set(w.error_type, (errMap.get(w.error_type) ?? 0) + 1);
        });
        const topErrors = Array.from(errMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([type, count]) => ({ type, count }));

        const totals30d = trends.reduce(
          (acc, t) => {
            acc.lessonPlans += t.lessonPlans;
            acc.assignments += t.assignments;
            acc.submissions += t.submissions;
            acc.messages += t.messages;
            return acc;
          },
          { lessonPlans: 0, assignments: 0, submissions: 0, messages: 0 }
        );

        setSummary({
          totals: {
            teachers: overview.totalTeachers,
            students: overview.totalStudents,
            lesson_plans: overview.totalLessonPlans,
            assignments: overview.totalAssignments,
            submissions: overview.totalSubmissions,
            chatbot_conversations: overview.totalChatConversations,
            chatbot_messages: overview.totalChatMessages,
            announcements: overview.totalAnnouncements,
            resources: overview.totalResources,
          },
          new_this_week: {
            teachers: overview.newTeachersThisWeek,
            students: overview.newStudentsThisWeek,
            lesson_plans: overview.newLessonPlansThisWeek,
            assignments: overview.newAssignmentsThisWeek,
            submissions: overview.newSubmissionsThisWeek,
          },
          active_teachers: {
            today: overview.activeTeachersToday,
            this_week: overview.activeTeachersThisWeek,
            this_month: overview.activeTeachersThisMonth,
          },
          last_30_days_totals: totals30d,
          top_teachers_by_students: topTeachers.slice(0, 8),
          top_teachers_by_lesson_plans: topPlans.sort((a, b) => b.lessonPlanCount - a.lessonPlanCount).slice(0, 8),
          teachers_by_country: countries.slice(0, 12),
          top_error_types: topErrors,
          uploads_total: works.length,
          uploads_with_feedback: works.filter((w) => !!w.feedback).length,
        });
      } finally {
        setBuilding(false);
      }
    })();
  }, []);

  const ask = async (q?: string) => {
    const finalQ = (q ?? question).trim();
    if (!finalQ || !summary) return;
    setQuestion(finalQ);
    setThinking(true);
    setError(null);
    setAnswer(null);
    const res = await generateInsight({
      context: `Mother of Math is an AI assistant for primary-school mathematics teachers. The summary below was extracted live from the Supabase database and is restricted to ${SCOPE_COUNTRY_NAME}-based teachers only. No PII is included — only aggregate counts.`,
      summary,
      question: finalQ,
    });
    setThinking(false);
    if (!res.ok) {
      setError(res.error ?? 'Unknown error.');
      return;
    }
    setAnswer(res.text ?? '');
  };

  return (
    <>
      <PageHeader
        title="AI insights"
        icon={Sparkles}
        subtitle={`Ask the AI to analyse the live Supabase data — restricted to ${SCOPE_COUNTRY_NAME} — and surface patterns, risks and recommendations.`}
      />

      {!hasKey && (
        <Card className="mb-5 border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 text-amber-300" />
            <div>
              <div className="text-sm font-medium text-amber-200">OpenRouter API key not configured</div>
              <div className="mt-0.5 text-xs text-amber-200/80">
                Add <code className="rounded bg-slate-900 px-1">VITE_OPENROUTER_API_KEY</code> to <code className="rounded bg-slate-900 px-1">.env</code> to enable AI-powered insights. The dashboard still works without it.
              </div>
            </div>
          </div>
        </Card>
      )}

      <Card className="mb-5">
        <SectionTitle title="Live data summary sent to the AI" hint="Aggregate counts only — no PII. Refreshed each visit." />
        <div className="px-5 pb-5">
          {building ? (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Building summary from Supabase…
            </div>
          ) : summary ? (
            <pre className="max-h-72 overflow-auto rounded-lg border border-slate-800/60 bg-slate-950/60 p-3 text-[11px] leading-relaxed text-slate-300">
{JSON.stringify(summary, null, 2)}
            </pre>
          ) : (
            <div className="text-sm text-slate-400">No summary available.</div>
          )}
        </div>
      </Card>

      <Card className="mb-5 p-5">
        <div className="mb-3 text-sm font-medium text-slate-200">Quick questions</div>
        <div className="flex flex-wrap gap-2">
          {PRESET_PROMPTS.map((p) => (
            <button
              key={p.label}
              onClick={() => ask(p.question)}
              disabled={!hasKey || !summary || thinking}
              className="rounded-full border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-50"
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="mt-5">
          <label className="block text-xs uppercase tracking-wider text-slate-500">Your question</label>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={3}
            placeholder="Ask anything about teacher behaviour, adoption, errors, engagement…"
            className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-cyan-500/40 focus:ring-2 focus:ring-cyan-500/20"
          />
          <button
            onClick={() => ask()}
            disabled={!hasKey || !summary || thinking || !question.trim()}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition-transform hover:scale-[1.01] disabled:opacity-60"
          >
            {thinking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            Generate insight
          </button>
        </div>
      </Card>

      {error && (
        <Card className="border-rose-500/30 bg-rose-500/5 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 text-rose-300" />
            <div className="text-sm text-rose-200">{error}</div>
          </div>
        </Card>
      )}

      {answer && (
        <Card>
          <SectionTitle title="AI analysis" right={<Badge tone="cyan">OpenRouter · gpt-4o-mini</Badge>} />
          <div className="whitespace-pre-wrap px-5 pb-5 text-sm leading-relaxed text-slate-200">
            {stripMarkdown(answer)}
          </div>
        </Card>
      )}
    </>
  );
};

export default MonitorAIInsights;
