import { useMemo } from 'react';
import {
  Users,
  GraduationCap,
  BookOpen,
  ClipboardList,
  MessagesSquare,
  Image as ImageIcon,
  UploadCloud,
  Activity,
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  Minus,
  Zap,
  CalendarDays,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
  RadialBarChart,
  RadialBar,
  Legend,
} from 'recharts';
import {
  Card,
  KpiCard,
  LoadingState,
  PageHeader,
  SectionTitle,
  EmptyState,
  MonitorFetchErrorPage,
  MonitorFetchErrorBanner,
} from '../components/ui';
import {
  getAdminDashboardOverview,
  getActivityTrends,
  getTotalImagesGenerated,
  getAllStudentWorks,
  getComparisonMetrics,
  getAllTeachers,
  getAllChatConversations,
  warmMonitorScope,
} from '../services/monitorData';
import type { DashboardOverview, ComparisonData } from '@/types/admin';
import { useLiveData } from '../hooks/useLiveData';
import LiveIndicator from '../components/LiveIndicator';
import ExportMenu from '../components/ExportMenu';
import type { ExportPayload } from '../utils/exporters';

interface OverviewBundle {
  overview: DashboardOverview;
  trends: { date: string; lessonPlans: number; assignments: number; submissions: number; messages: number }[];
  imageCount: number;
  uploadsCount: number;
  comparison: ComparisonData[];
  totalTeacherCount: number;
  conversationCount: number;
}

const loadAll = async (): Promise<OverviewBundle> => {
  await warmMonitorScope();
  const [overview, trends, imageCount, works, comparison, teachers, convos] = await Promise.all([
    getAdminDashboardOverview(),
    getActivityTrends(),
    getTotalImagesGenerated(),
    getAllStudentWorks(),
    getComparisonMetrics(7).catch(() => [] as ComparisonData[]),
    getAllTeachers(),
    getAllChatConversations(),
  ]);
  return {
    overview,
    trends,
    imageCount,
    uploadsCount: works.length,
    comparison,
    totalTeacherCount: teachers.length,
    conversationCount: convos.length,
  };
};

const MonitorOverview = () => {
  const { data, loading, refreshing, paused, setPaused, lastUpdated, error, refresh } =
    useLiveData<OverviewBundle>(loadAll, { intervalMs: 30_000 });

  const totalsByDay = useMemo(() => {
    if (!data) return [];
    return data.trends.map((t) => ({
      date: t.date.slice(5),
      total: t.lessonPlans + t.assignments + t.submissions + t.messages,
      lessonPlans: t.lessonPlans,
      assignments: t.assignments,
      submissions: t.submissions,
      messages: t.messages,
    }));
  }, [data]);

  const featureMix = useMemo(() => {
    if (!data) return [];
    const sum = data.trends.reduce(
      (acc, t) => {
        acc.lessonPlans += t.lessonPlans;
        acc.assignments += t.assignments;
        acc.submissions += t.submissions;
        acc.messages += t.messages;
        return acc;
      },
      { lessonPlans: 0, assignments: 0, submissions: 0, messages: 0 },
    );
    return [
      { name: 'Chat msgs',    value: sum.messages,    color: '#22d3ee' },
      { name: 'Lesson plans', value: sum.lessonPlans, color: '#a78bfa' },
      { name: 'Assignments',  value: sum.assignments, color: '#fbbf24' },
      { name: 'Submissions',  value: sum.submissions, color: '#34d399' },
    ];
  }, [data]);

  // Engagement / health gauges
  const engagement = useMemo(() => {
    if (!data) return null;
    const o = data.overview;
    const total = data.totalTeacherCount || 1;
    const dailyPct  = Math.min(100, Math.round((o.activeTeachersToday    / total) * 100));
    const weeklyPct = Math.min(100, Math.round((o.activeTeachersThisWeek / total) * 100));
    const monthlyPct= Math.min(100, Math.round((o.activeTeachersThisMonth/ total) * 100));
    return [
      { name: 'Today',     value: dailyPct,   fill: '#34d399' },
      { name: 'This week', value: weeklyPct,  fill: '#22d3ee' },
      { name: 'This month',value: monthlyPct, fill: '#a78bfa' },
    ];
  }, [data]);

  // Trend deltas — compare last 7 vs prior 7 days
  const weekDeltas = useMemo(() => {
    if (!data || data.trends.length < 14) return null;
    const last7 = data.trends.slice(-7);
    const prev7 = data.trends.slice(-14, -7);
    const sum = (rows: typeof last7, key: keyof typeof last7[0]) =>
      rows.reduce((a, r) => a + (r[key] as number), 0);
    const calc = (k: keyof typeof last7[0]) => {
      const cur = sum(last7, k);
      const prev = sum(prev7, k);
      if (prev === 0) return { current: cur, change: cur > 0 ? 100 : 0, dir: cur > 0 ? 'up' : 'flat' as const };
      const change = Math.round(((cur - prev) / prev) * 100);
      return { current: cur, change, dir: change > 2 ? 'up' as const : change < -2 ? 'down' as const : 'flat' as const };
    };
    return {
      lessonPlans: calc('lessonPlans'),
      assignments: calc('assignments'),
      submissions: calc('submissions'),
      messages:    calc('messages'),
    };
  }, [data]);

  // Day of week heat
  const weekdayBars = useMemo(() => {
    if (!data) return [];
    const buckets = [0, 0, 0, 0, 0, 0, 0];
    data.trends.forEach((t) => {
      const d = new Date(t.date);
      buckets[d.getDay()] += t.lessonPlans + t.assignments + t.submissions + t.messages;
    });
    const labels = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    return labels.map((l, i) => ({ day: l, total: buckets[i] }));
  }, [data]);

  const peakDay = useMemo(() => {
    if (!totalsByDay.length) return null;
    return totalsByDay.reduce((max, r) => (r.total > max.total ? r : max), totalsByDay[0]);
  }, [totalsByDay]);

  const last7teach = data?.comparison.find((c) => c.metric_name?.toLowerCase().includes('teacher'));

  /* ── Export payload builder ─────────────────────────────────── */
  const buildExportPayload = (): ExportPayload => {
    if (!data) return { fileStem: 'qeda-overview', title: 'QEDA Education Monitor — Overview' };
    const o = data.overview;
    return {
      fileStem: 'qeda-overview',
      title: 'QEDA Education Monitor — Overview',
      subtitle: `Live snapshot of teacher activity. Generated ${new Date().toLocaleString()}.`,
      summary:
        `As of this report, the platform serves ${o.totalTeachers.toLocaleString()} teachers and ` +
        `${o.totalStudents.toLocaleString()} students. ${o.activeTeachersThisWeek.toLocaleString()} teachers ` +
        `were active in the last 7 days. Together they have created ${o.totalLessonPlans.toLocaleString()} ` +
        `lesson plans and ${o.totalAssignments.toLocaleString()} assignments, with ` +
        `${o.totalSubmissions.toLocaleString()} student submissions on record.`,
      kpis: [
        { label: 'Teachers',              value: o.totalTeachers.toLocaleString(),         hint: `${o.newTeachersThisWeek} new this week` },
        { label: 'Students',              value: o.totalStudents.toLocaleString(),         hint: `${o.newStudentsThisWeek} added this week` },
        { label: 'Lesson plans',          value: o.totalLessonPlans.toLocaleString(),      hint: `${o.newLessonPlansThisWeek} this week` },
        { label: 'Assignments',           value: o.totalAssignments.toLocaleString(),      hint: `${o.newAssignmentsThisWeek} this week` },
        { label: 'Submissions',           value: o.totalSubmissions.toLocaleString(),      hint: `${o.newSubmissionsThisWeek} this week` },
        { label: 'Chat conversations',    value: data.conversationCount.toLocaleString(),  hint: `${o.totalChatMessages.toLocaleString()} messages total` },
        { label: 'Generated images',      value: data.imageCount.toLocaleString() },
        { label: 'Student uploads',       value: data.uploadsCount.toLocaleString() },
        { label: 'Active today',          value: o.activeTeachersToday.toLocaleString() },
        { label: 'Active this week',      value: o.activeTeachersThisWeek.toLocaleString() },
        { label: 'Active this month',     value: o.activeTeachersThisMonth.toLocaleString() },
        { label: 'Resources',             value: (o.totalResources ?? 0).toLocaleString() },
      ],
      tables: [
        {
          title: 'Daily activity · last 30 days',
          columns: ['Date', 'Lesson plans', 'Assignments', 'Submissions', 'Chat msgs', 'Total'],
          rows: data.trends.map((t) => [
            t.date,
            t.lessonPlans,
            t.assignments,
            t.submissions,
            t.messages,
            t.lessonPlans + t.assignments + t.submissions + t.messages,
          ]),
        },
        {
          title: 'Activity by weekday',
          columns: ['Weekday', 'Total events (30d)'],
          rows: weekdayBars.map((w) => [w.day, w.total]),
        },
      ],
      sections: [
        weekDeltas
          ? {
              title: 'Week-over-week change',
              pairs: [
                { key: 'Lesson plans', value: `${weekDeltas.lessonPlans.current} (${weekDeltas.lessonPlans.change > 0 ? '+' : ''}${weekDeltas.lessonPlans.change}%)` },
                { key: 'Assignments',  value: `${weekDeltas.assignments.current} (${weekDeltas.assignments.change > 0 ? '+' : ''}${weekDeltas.assignments.change}%)` },
                { key: 'Submissions',  value: `${weekDeltas.submissions.current} (${weekDeltas.submissions.change > 0 ? '+' : ''}${weekDeltas.submissions.change}%)` },
                { key: 'Chat messages',value: `${weekDeltas.messages.current} (${weekDeltas.messages.change > 0 ? '+' : ''}${weekDeltas.messages.change}%)` },
              ],
            }
          : { title: 'Week-over-week change', body: 'Not enough history (need at least 14 days of activity) to compute a comparison.' },
      ],
    };
  };

  if (loading && !data) {
    return (
      <>
        <PageHeader title="Overview" icon={LayoutDashboard} subtitle="Live snapshot of teacher activity. Pulling data…" />
        <LoadingState label="Pulling latest data…" />
      </>
    );
  }

  if (!loading && error && !data) {
    return (
      <MonitorFetchErrorPage
        title="Overview"
        icon={LayoutDashboard}
        subtitle="Live snapshot of teacher activity across schools, lessons, assignments and AI usage."
        error={error}
        onRetry={refresh}
      />
    );
  }

  if (!data) {
    return null;
  }

  const o = data.overview;

  return (
    <>
      <PageHeader
        title="Overview"
        icon={LayoutDashboard}
        subtitle="Live snapshot of teacher activity across schools, lessons, assignments and AI usage."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <LiveIndicator
              lastUpdated={lastUpdated}
              refreshing={refreshing}
              paused={paused}
              onTogglePause={() => setPaused(!paused)}
              onRefresh={refresh}
              intervalMs={30_000}
            />
            <ExportMenu build={buildExportPayload} />
          </div>
        }
      />

      {error && data && <MonitorFetchErrorBanner error={error} onRetry={refresh} />}

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <KpiCard
          label="Teachers"
          value={o.totalTeachers}
          icon={Users}
          tone="cyan"
          hint={`${o.newTeachersThisWeek} new this week`}
          delta={last7teach
            ? {
                value: Math.round(last7teach.change_percent),
                direction: last7teach.change_direction === 'stable' ? 'flat' : last7teach.change_direction,
                label: 'vs prev week',
              }
            : undefined}
        />
        <KpiCard label="Students"            value={o.totalStudents}            icon={GraduationCap} tone="emerald" hint={`${o.newStudentsThisWeek} added this week`} />
        <KpiCard label="Lesson plans"        value={o.totalLessonPlans}         icon={BookOpen}      tone="violet"  hint={`${o.newLessonPlansThisWeek} created this week`} />
        <KpiCard label="Assignments"         value={o.totalAssignments}         icon={ClipboardList} tone="amber"   hint={`${o.newAssignmentsThisWeek} new this week`} />
        <KpiCard label="Chat conversations"  value={data.conversationCount}     icon={MessagesSquare}tone="sky"     hint={`${o.totalChatMessages.toLocaleString()} total messages`} />
        <KpiCard label="Generated images"    value={data.imageCount}            icon={ImageIcon}     tone="rose"    hint="AI image generation activity" />
        <KpiCard label="Student uploads"     value={data.uploadsCount}          icon={UploadCloud}   tone="cyan"    hint="Homework uploaded for AI analysis" />
        <KpiCard label="Submissions"         value={o.totalSubmissions}         icon={Activity}      tone="emerald" hint={`${o.newSubmissionsThisWeek} new this week`} />
      </div>

      {/* Week-over-week deltas */}
      {weekDeltas && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { k: 'lessonPlans' as const, label: 'Lesson plans · 7d', color: '#a78bfa' },
            { k: 'assignments' as const, label: 'Assignments · 7d', color: '#fbbf24' },
            { k: 'submissions' as const, label: 'Submissions · 7d', color: '#34d399' },
            { k: 'messages'    as const, label: 'Chat msgs · 7d',   color: '#22d3ee' },
          ].map((m) => {
            const d = weekDeltas[m.k];
            const Trend = d.dir === 'up' ? TrendingUp : d.dir === 'down' ? TrendingDown : Minus;
            const tone = d.dir === 'up' ? 'text-emerald-300 bg-emerald-500/10' : d.dir === 'down' ? 'text-rose-300 bg-rose-500/10' : 'text-slate-300 bg-slate-500/10';
            return (
              <Card key={m.k} className="p-4">
                <div className="text-[11px] uppercase tracking-wider text-slate-500">{m.label}</div>
                <div className="mt-1 flex items-baseline gap-2">
                  <div className="text-2xl font-bold text-white tabular-nums">{d.current.toLocaleString()}</div>
                  <span className={['inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold', tone].join(' ')}>
                    <Trend className="h-3 w-3" />
                    {d.change > 0 ? '+' : ''}{d.change}%
                  </span>
                </div>
                <div className="mt-1 text-[10px] text-slate-500">vs previous 7 days</div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Charts */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionTitle
            title="Daily activity · last 30 days"
            hint="Lesson plans, assignments, submissions and chatbot messages per day."
            right={peakDay && (
              <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-300 ring-1 ring-amber-500/20">
                <Zap className="h-3 w-3" /> Peak: <span className="font-semibold">{peakDay.date}</span> · {peakDay.total} events
              </div>
            )}
          />
          <div className="h-80 px-2 pb-4">
            {totalsByDay.length === 0 ? (
              <EmptyState title="No activity in the last 30 days" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={totalsByDay} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gMsg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22d3ee" stopOpacity={0.5} /><stop offset="100%" stopColor="#22d3ee" stopOpacity={0} /></linearGradient>
                    <linearGradient id="gLp"  x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a78bfa" stopOpacity={0.5} /><stop offset="100%" stopColor="#a78bfa" stopOpacity={0} /></linearGradient>
                    <linearGradient id="gAs"  x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fbbf24" stopOpacity={0.45} /><stop offset="100%" stopColor="#fbbf24" stopOpacity={0} /></linearGradient>
                    <linearGradient id="gSb"  x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#34d399" stopOpacity={0.45} /><stop offset="100%" stopColor="#34d399" stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip contentStyle={{ background: '#0b1020', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#cbd5e1' }} />
                  <Area type="monotone" dataKey="messages"    stroke="#22d3ee" fill="url(#gMsg)" strokeWidth={2} />
                  <Area type="monotone" dataKey="lessonPlans" stroke="#a78bfa" fill="url(#gLp)"  strokeWidth={2} />
                  <Area type="monotone" dataKey="assignments" stroke="#fbbf24" fill="url(#gAs)"  strokeWidth={2} />
                  <Area type="monotone" dataKey="submissions" stroke="#34d399" fill="url(#gSb)"  strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card>
          <SectionTitle title="Feature mix · 30 days" hint="Which capabilities teachers used most." />
          <div className="h-80 px-3 pb-4">
            {featureMix.every((f) => f.value === 0) ? (
              <EmptyState title="No usage recorded yet" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={featureMix} layout="vertical" margin={{ top: 10, right: 12, left: 10, bottom: 0 }}>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" stroke="#64748b" fontSize={11} />
                  <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={11} width={90} />
                  <Tooltip contentStyle={{ background: '#0b1020', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                    {featureMix.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      {/* Engagement gauges + weekday */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <SectionTitle title="Teacher engagement" hint="% of all teachers active in each window." />
          <div className="h-72 px-2 pb-4">
            {engagement && (
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart innerRadius="30%" outerRadius="100%" data={engagement} startAngle={90} endAngle={-270}>
                  <RadialBar background dataKey="value" cornerRadius={6} />
                  <Legend iconSize={10} layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: 11, color: '#cbd5e1' }} />
                  <Tooltip contentStyle={{ background: '#0b1020', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }} formatter={(v) => `${v}%`} />
                </RadialBarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <SectionTitle
            title="Activity by weekday · 30 days"
            hint="When teachers are most engaged."
            right={<div className="flex items-center gap-1 text-[11px] text-slate-500"><CalendarDays className="h-3 w-3" /> aggregated</div>}
          />
          <div className="h-72 px-2 pb-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekdayBars} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                <XAxis dataKey="day" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip contentStyle={{ background: '#0b1020', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                  {weekdayBars.map((d, i) => (
                    <Cell key={d.day} fill={i === new Date().getDay() ? '#34d399' : '#1e6a4a'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Active users summary */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: 'Active teachers · today',      value: o.activeTeachersToday,      hint: 'Updated their profile in the last 24h' },
          { label: 'Active · this week',           value: o.activeTeachersThisWeek,   hint: 'Profile updates in the last 7 days' },
          { label: 'Active · this month',          value: o.activeTeachersThisMonth,  hint: 'Profile updates in the last 30 days' },
        ].map((m) => (
          <Card key={m.label} className="p-5">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{m.label}</div>
            <div className="mt-1 text-3xl font-semibold text-white tabular-nums">{m.value.toLocaleString()}</div>
            <div className="mt-1 text-xs text-slate-500">{m.hint}</div>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-amber-400 transition-all"
                style={{ width: `${Math.min(100, Math.round((m.value / Math.max(1, o.totalTeachers)) * 100))}%` }}
              />
            </div>
            <div className="mt-1 text-[10px] text-slate-500 tabular-nums">
              {Math.min(100, Math.round((m.value / Math.max(1, o.totalTeachers)) * 100))}% of all teachers
            </div>
          </Card>
        ))}
      </div>
    </>
  );
};

export default MonitorOverview;
