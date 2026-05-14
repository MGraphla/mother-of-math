import { useEffect, useMemo, useState } from 'react';
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
  RefreshCw,
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
} from 'recharts';
import { Card, KpiCard, LoadingState, PageHeader, SectionTitle, EmptyState } from '../components/ui';
import {
  getAdminDashboardOverview,
  getActivityTrends,
  getTotalImagesGenerated,
  getAllStudentWorks,
  getComparisonMetrics,
} from '../services/monitorData';
import type { DashboardOverview, ComparisonData } from '@/types/admin';

type Trend = { date: string; lessonPlans: number; assignments: number; submissions: number; messages: number };

const MonitorOverview = () => {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [trends, setTrends] = useState<Trend[]>([]);
  const [imageCount, setImageCount] = useState(0);
  const [uploadsCount, setUploadsCount] = useState(0);
  const [comparison, setComparison] = useState<ComparisonData[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setRefreshing(true);
    try {
      const [ov, tr, img, works, cmp] = await Promise.all([
        getAdminDashboardOverview(),
        getActivityTrends(),
        getTotalImagesGenerated(),
        getAllStudentWorks(),
        getComparisonMetrics(7).catch(() => [] as ComparisonData[]),
      ]);
      setOverview(ov);
      setTrends(tr);
      setImageCount(img);
      setUploadsCount(works.length);
      setComparison(cmp);
    } catch (err) {
      console.error('Monitor overview load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
    // soft auto-refresh every 60s
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalsByDay = useMemo(() => {
    return trends.map((t) => ({
      date: t.date.slice(5), // MM-DD
      total: t.lessonPlans + t.assignments + t.submissions + t.messages,
      lessonPlans: t.lessonPlans,
      assignments: t.assignments,
      submissions: t.submissions,
      messages: t.messages,
    }));
  }, [trends]);

  const featureMix = useMemo(() => {
    const sum = trends.reduce(
      (acc, t) => {
        acc.lessonPlans += t.lessonPlans;
        acc.assignments += t.assignments;
        acc.submissions += t.submissions;
        acc.messages += t.messages;
        return acc;
      },
      { lessonPlans: 0, assignments: 0, submissions: 0, messages: 0 }
    );
    return [
      { name: 'Chat msgs',   value: sum.messages,    color: '#22d3ee' },
      { name: 'Lesson plans',value: sum.lessonPlans, color: '#a78bfa' },
      { name: 'Assignments', value: sum.assignments, color: '#fbbf24' },
      { name: 'Submissions', value: sum.submissions, color: '#34d399' },
    ];
  }, [trends]);

  const last7 = comparison.find((c) => c.metric_name?.toLowerCase().includes('teacher'));

  if (loading) {
    return (
      <>
        <PageHeader title="Overview" icon={LayoutDashboard} subtitle="Live snapshot of teacher activity across the platform." />
        <LoadingState label="Pulling real data from Supabase…" />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Overview"
        icon={LayoutDashboard}
        subtitle="Live snapshot of teacher activity across the platform. Auto-refreshes every minute."
        actions={
          <button
            onClick={load}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800"
          >
            <RefreshCw className={['h-3.5 w-3.5', refreshing ? 'animate-spin' : ''].join(' ')} />
            Refresh
          </button>
        }
      />

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <KpiCard
          label="Teachers"
          value={overview?.totalTeachers ?? 0}
          icon={Users}
          tone="cyan"
          hint={`${overview?.newTeachersThisWeek ?? 0} new this week`}
          delta={last7
            ? {
                value: Math.round(last7.change_percent),
                direction: last7.change_direction === 'stable' ? 'flat' : last7.change_direction,
                label: 'vs prev week',
              }
            : undefined}
        />
        <KpiCard
          label="Students"
          value={overview?.totalStudents ?? 0}
          icon={GraduationCap}
          tone="emerald"
          hint={`${overview?.newStudentsThisWeek ?? 0} added this week`}
        />
        <KpiCard
          label="Lesson plans"
          value={overview?.totalLessonPlans ?? 0}
          icon={BookOpen}
          tone="violet"
          hint={`${overview?.newLessonPlansThisWeek ?? 0} created this week`}
        />
        <KpiCard
          label="Assignments"
          value={overview?.totalAssignments ?? 0}
          icon={ClipboardList}
          tone="amber"
          hint={`${overview?.newAssignmentsThisWeek ?? 0} new this week`}
        />
        <KpiCard
          label="Chatbot conversations"
          value={overview?.totalChatConversations ?? 0}
          icon={MessagesSquare}
          tone="sky"
          hint={`${(overview?.totalChatMessages ?? 0).toLocaleString()} total messages`}
        />
        <KpiCard
          label="Generated images"
          value={imageCount}
          icon={ImageIcon}
          tone="rose"
          hint="AI image generation activity"
        />
        <KpiCard
          label="Student work uploads"
          value={uploadsCount}
          icon={UploadCloud}
          tone="cyan"
          hint="Homework uploaded for AI analysis"
        />
        <KpiCard
          label="Submissions"
          value={overview?.totalSubmissions ?? 0}
          icon={Activity}
          tone="emerald"
          hint={`${overview?.newSubmissionsThisWeek ?? 0} new this week`}
        />
      </div>

      {/* Charts */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionTitle
            title="Daily activity · last 30 days"
            hint="Lesson plans, assignments, submissions and chatbot messages per day."
          />
          <div className="h-80 px-2 pb-4">
            {totalsByDay.length === 0 ? (
              <EmptyState title="No activity in the last 30 days" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={totalsByDay} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gMsg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gLp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gAs" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#fbbf24" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gSb" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#34d399" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      background: '#0b1020',
                      border: '1px solid #1e293b',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: '#cbd5e1' }}
                  />
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
          <SectionTitle
            title="Feature mix · 30 days"
            hint="Which capabilities teachers used most."
          />
          <div className="h-80 px-3 pb-4">
            {featureMix.every((f) => f.value === 0) ? (
              <EmptyState title="No usage recorded yet" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={featureMix} layout="vertical" margin={{ top: 10, right: 12, left: 10, bottom: 0 }}>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" stroke="#64748b" fontSize={11} />
                  <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={11} width={90} />
                  <Tooltip
                    contentStyle={{
                      background: '#0b1020',
                      border: '1px solid #1e293b',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                    {featureMix.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      {/* Active users */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Active teachers · today</div>
          <div className="mt-1 text-3xl font-semibold text-white">{overview?.activeTeachersToday ?? 0}</div>
          <div className="mt-1 text-xs text-slate-500">Updated their profile in the last 24h</div>
        </Card>
        <Card className="p-5">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Active · this week</div>
          <div className="mt-1 text-3xl font-semibold text-white">{overview?.activeTeachersThisWeek ?? 0}</div>
          <div className="mt-1 text-xs text-slate-500">Profile updates in the last 7 days</div>
        </Card>
        <Card className="p-5">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Active · this month</div>
          <div className="mt-1 text-3xl font-semibold text-white">{overview?.activeTeachersThisMonth ?? 0}</div>
          <div className="mt-1 text-xs text-slate-500">Profile updates in the last 30 days</div>
        </Card>
      </div>
    </>
  );
};

export default MonitorOverview;
