import { useMemo, useState } from 'react';
import {
  ClipboardList,
  Filter,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  Clock,
  Bot,
  GraduationCap,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  AreaChart,
  Area,
  Cell,
  PieChart,
  Pie,
  Legend,
} from 'recharts';
import {
  Card,
  PageHeader,
  LoadingState,
  EmptyState,
  KpiCard,
  SectionTitle,
  SearchInput,
  Badge,
  MonitorFetchErrorPage,
  MonitorFetchErrorBanner,
} from '../components/ui';
import { format, subDays, isPast } from 'date-fns';
import { getAllAssignments, getAllSubmissions } from '../services/monitorData';
import type { AssignmentStats, SubmissionStats } from '@/types/admin';
import { useLiveData } from '../hooks/useLiveData';
import LiveIndicator from '../components/LiveIndicator';
import ExportMenu from '../components/ExportMenu';
import type { ExportPayload } from '../utils/exporters';

interface AssignmentsBundle {
  assignments: AssignmentStats[];
  submissions: SubmissionStats[];
}

type RangeKey = '7d' | '30d' | '90d' | 'all';
const RANGES: { key: RangeKey; label: string; ms: number | null }[] = [
  { key: '7d', label: 'Last 7d', ms: 7 * 24 * 3600 * 1000 },
  { key: '30d', label: 'Last 30d', ms: 30 * 24 * 3600 * 1000 },
  { key: '90d', label: 'Last 90d', ms: 90 * 24 * 3600 * 1000 },
  { key: 'all', label: 'All time', ms: null },
];

type StatusFilter = 'all' | 'active' | 'draft' | 'closed' | 'overdue';
type SortKey = 'newest' | 'oldest' | 'submitted' | 'completion' | 'score' | 'due';

const STATUS_COLORS: Record<string, string> = {
  active: '#34d399',
  draft: '#fbbf24',
  closed: '#94a3b8',
};

const MonitorAssignments = () => {
  const { data, loading, refreshing, paused, setPaused, lastUpdated, error, refresh } =
    useLiveData<AssignmentsBundle>(
      async () => {
        const [a, s] = await Promise.all([getAllAssignments(), getAllSubmissions()]);
        return { assignments: a, submissions: s };
      },
      { intervalMs: 45_000 },
    );

  const assignments = data?.assignments ?? [];
  const submissions = data?.submissions ?? [];

  const [range, setRange] = useState<RangeKey>('30d');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('newest');

  /* ── Range filtering ───────────────────────────────────── */
  const rangeFiltered = useMemo(() => {
    const r = RANGES.find((x) => x.key === range);
    if (!r || r.ms === null) return assignments;
    const cutoff = Date.now() - r.ms;
    return assignments.filter((a) => new Date(a.created_at).getTime() >= cutoff);
  }, [assignments, range]);

  /* ── KPI stats ─────────────────────────────────────────── */
  const stats = useMemo(() => {
    const totalAssignments = assignments.length;
    const totalSubmissions = submissions.length;
    const expected = assignments.reduce((s, a) => s + (a.total_students || 0), 0);
    const submitted = assignments.reduce((s, a) => s + (a.submitted_count || 0), 0);
    const submissionRate = expected ? Math.round((submitted / expected) * 100) : 0;
    const aiGraded = submissions.filter((s) => s.ai_score != null).length;
    const humanGraded = submissions.filter(
      (s) => s.status === 'graded' && s.score != null,
    ).length;
    const overdue = assignments.filter(
      (a) => a.status !== 'closed' && a.due_date && isPast(new Date(a.due_date)),
    ).length;

    const avgScore = (() => {
      const scored = submissions.filter((s) => s.score != null);
      if (!scored.length) return null;
      const sum = scored.reduce((s, x) => s + (x.score as number), 0);
      return Math.round(sum / scored.length);
    })();

    const now = Date.now();
    const week = now - 7 * 86400000;
    const prev = now - 14 * 86400000;
    const thisWeek = assignments.filter((a) => new Date(a.created_at).getTime() >= week).length;
    const prevWeek = assignments.filter((a) => {
      const t = new Date(a.created_at).getTime();
      return t >= prev && t < week;
    }).length;
    const change =
      prevWeek === 0
        ? thisWeek > 0
          ? 100
          : 0
        : Math.round(((thisWeek - prevWeek) / prevWeek) * 100);
    const direction =
      change > 2 ? ('up' as const) : change < -2 ? ('down' as const) : ('flat' as const);

    return {
      totalAssignments,
      totalSubmissions,
      submissionRate,
      aiGraded,
      humanGraded,
      overdue,
      avgScore,
      thisWeek,
      prevWeek,
      delta: { value: change, direction },
    };
  }, [assignments, submissions]);

  /* ── Daily trend (last 14 days) ─────────────────────────── */
  const dailyTrend = useMemo(() => {
    const days: Record<string, { date: string; created: number; submitted: number }> = {};
    for (let i = 13; i >= 0; i--) {
      const d = subDays(new Date(), i);
      const key = format(d, 'MMM d');
      days[key] = { date: key, created: 0, submitted: 0 };
    }
    assignments.forEach((a) => {
      const key = format(new Date(a.created_at), 'MMM d');
      if (days[key]) days[key].created += 1;
    });
    submissions.forEach((s) => {
      const key = format(new Date(s.submitted_at), 'MMM d');
      if (days[key]) days[key].submitted += 1;
    });
    return Object.values(days);
  }, [assignments, submissions]);

  /* ── Breakdowns ─────────────────────────────────────────── */
  const byStatus = useMemo(() => {
    const m = new Map<string, number>();
    rangeFiltered.forEach((a) => m.set(a.status, (m.get(a.status) ?? 0) + 1));
    return [...m.entries()].map(([status, count]) => ({ status, count }));
  }, [rangeFiltered]);

  const byGrade = useMemo(() => {
    const m = new Map<string, number>();
    rangeFiltered.forEach((a) =>
      m.set(a.grade_level || 'Unknown', (m.get(a.grade_level || 'Unknown') ?? 0) + 1),
    );
    return [...m.entries()].map(([grade, count]) => ({ grade, count })).sort((a, b) => b.count - a.count);
  }, [rangeFiltered]);

  const bySubject = useMemo(() => {
    const m = new Map<string, number>();
    rangeFiltered.forEach((a) =>
      m.set(a.subject || 'Other', (m.get(a.subject || 'Other') ?? 0) + 1),
    );
    return [...m.entries()].map(([subject, count]) => ({ subject, count })).sort((a, b) => b.count - a.count);
  }, [rangeFiltered]);

  const topAssignments = useMemo(
    () =>
      [...rangeFiltered]
        .map((a) => {
          const pct = a.total_students
            ? Math.round(((a.submitted_count || 0) / a.total_students) * 100)
            : 0;
          return { ...a, completionPct: pct };
        })
        .filter((a) => a.submitted_count > 0)
        .sort((a, b) => b.completionPct - a.completionPct || b.submitted_count - a.submitted_count)
        .slice(0, 5),
    [rangeFiltered],
  );

  /* ── Filtering / sorting ────────────────────────────────── */
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    let arr = rangeFiltered;
    if (statusFilter === 'overdue') {
      arr = arr.filter(
        (a) => a.status !== 'closed' && a.due_date && isPast(new Date(a.due_date)),
      );
    } else if (statusFilter !== 'all') {
      arr = arr.filter((a) => a.status === statusFilter);
    }
    if (term) {
      arr = arr.filter(
        (a) =>
          (a.title || '').toLowerCase().includes(term) ||
          (a.teacher_name || '').toLowerCase().includes(term) ||
          (a.grade_level || '').toLowerCase().includes(term) ||
          (a.subject || '').toLowerCase().includes(term),
      );
    }
    const completion = (a: AssignmentStats) =>
      a.total_students ? (a.submitted_count || 0) / a.total_students : 0;
    const cmp = (a: AssignmentStats, b: AssignmentStats): number => {
      switch (sort) {
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'submitted':
          return (b.submitted_count || 0) - (a.submitted_count || 0);
        case 'completion':
          return completion(b) - completion(a);
        case 'score':
          return (b.average_score ?? -1) - (a.average_score ?? -1);
        case 'due':
          return (
            new Date(b.due_date || 0).getTime() - new Date(a.due_date || 0).getTime()
          );
      }
    };
    return [...arr].sort(cmp);
  }, [rangeFiltered, statusFilter, search, sort]);

  /* ── Export payload ─────────────────────────────────────── */
  const buildExportPayload = (): ExportPayload => ({
    fileStem: `qeda-assignments-${range}`,
    title: 'QEDA Education Monitor — Assignments & Submissions',
    subtitle: `${RANGES.find((r) => r.key === range)?.label}${statusFilter !== 'all' ? ` · ${statusFilter}` : ''}${search ? ` · "${search}"` : ''}`,
    summary:
      `${stats.totalAssignments.toLocaleString()} assignments created in total. ` +
      `${stats.totalSubmissions.toLocaleString()} submissions on record with an overall ${stats.submissionRate}% submission rate. ` +
      `${stats.aiGraded.toLocaleString()} AI-graded, ${stats.humanGraded.toLocaleString()} teacher-graded. ` +
      `${stats.overdue.toLocaleString()} assignments are currently overdue.`,
    kpis: [
      { label: 'Assignments', value: stats.totalAssignments },
      { label: 'Submissions', value: stats.totalSubmissions },
      { label: 'Submission rate', value: `${stats.submissionRate}%` },
      { label: 'AI-graded', value: stats.aiGraded, hint: `${stats.humanGraded} human` },
      { label: 'Overdue', value: stats.overdue },
      {
        label: 'Avg score',
        value: stats.avgScore != null ? `${stats.avgScore}` : '—',
      },
      { label: 'This week', value: stats.thisWeek, hint: `vs ${stats.prevWeek} prev` },
    ],
    tables: [
      {
        title: 'Assignments in current view',
        columns: [
          'Title',
          'Teacher',
          'Grade',
          'Subject',
          'Status',
          'Submitted',
          'Graded',
          'Avg score',
          'Due',
        ],
        rows: filtered.map((a) => [
          a.title ?? '—',
          a.teacher_name ?? '—',
          a.grade_level ?? '—',
          a.subject ?? '—',
          a.status,
          `${a.submitted_count}/${a.total_students}`,
          a.graded_count,
          a.average_score != null ? Number(a.average_score).toFixed(1) : '—',
          a.due_date ? format(new Date(a.due_date), 'yyyy-MM-dd') : '—',
        ]),
      },
      {
        title: 'Top assignments by submission rate',
        columns: ['Title', 'Teacher', 'Submitted', 'Expected', 'Completion %'],
        rows: topAssignments.map((a) => [
          a.title ?? '—',
          a.teacher_name ?? '—',
          a.submitted_count,
          a.total_students,
          `${a.completionPct}%`,
        ]),
      },
      {
        title: 'Assignments by status',
        columns: ['Status', 'Count'],
        rows: byStatus.map((s) => [s.status, s.count]),
      },
      {
        title: 'Assignments by grade',
        columns: ['Grade', 'Count'],
        rows: byGrade.map((g) => [g.grade, g.count]),
      },
    ],
  });

  /* ── Render ─────────────────────────────────────────────── */
  if (loading && !data)
    return (
      <>
        <PageHeader
          title="Assignments"
          icon={ClipboardList}
          subtitle="All assignments created and submitted."
        />
        <LoadingState label="Loading assignments…" />
      </>
    );

  if (!loading && error && !data)
    return (
      <MonitorFetchErrorPage
        title="Assignments & submissions"
        icon={ClipboardList}
        subtitle="Assignments teachers created, who submitted, and how AI vs. human grading compares."
        error={error}
        onRetry={refresh}
      />
    );

  const TrendIcon =
    stats.delta.direction === 'up'
      ? TrendingUp
      : stats.delta.direction === 'down'
        ? TrendingDown
        : Minus;

  return (
    <>
      <PageHeader
        title="Assignments & submissions"
        icon={ClipboardList}
        subtitle="Assignments teachers created, who submitted, and how AI vs. human grading compares."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <LiveIndicator
              lastUpdated={lastUpdated}
              refreshing={refreshing}
              paused={paused}
              onTogglePause={() => setPaused(!paused)}
              onRefresh={refresh}
              intervalMs={45_000}
            />
            <ExportMenu build={buildExportPayload} disabled={loading} />
          </div>
        }
      />

      {error && data && <MonitorFetchErrorBanner error={error} onRetry={refresh} />}

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard
          label="Total assignments"
          value={stats.totalAssignments}
          icon={ClipboardList}
          tone="amber"
        />
        <KpiCard
          label="Total submissions"
          value={stats.totalSubmissions}
          icon={CheckCircle2}
          tone="cyan"
          hint={`${stats.submissionRate}% submission rate`}
        />
        <KpiCard
          label="AI-graded"
          value={stats.aiGraded}
          icon={Bot}
          tone="violet"
          hint={`${stats.humanGraded} teacher-graded`}
        />
        <KpiCard
          label="This week"
          value={stats.thisWeek}
          icon={Sparkles}
          tone="emerald"
          hint={`${stats.overdue} overdue · ${stats.avgScore != null ? `avg score ${stats.avgScore}` : 'no scores yet'}`}
          delta={{ value: stats.delta.value, direction: stats.delta.direction, label: 'vs prev 7d' }}
        />
      </div>

      {/* Daily trend */}
      <Card className="mt-5">
        <SectionTitle
          title="Last 14 days · assignments & submissions"
          hint="When work is being assigned and when it’s coming back."
          right={
            <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-300 ring-1 ring-amber-500/20">
              <TrendIcon className="h-3 w-3" /> {stats.delta.value > 0 ? '+' : ''}
              {stats.delta.value}% week over week
            </div>
          }
        />
        <div className="h-64 px-2 pb-3">
          {dailyTrend.every((d) => d.created === 0 && d.submitted === 0) ? (
            <EmptyState title="No assignment activity in the last 14 days" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyTrend} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="asA" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="#fbbf24" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="asS" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: '#0b1020',
                    border: '1px solid #1e293b',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area
                  type="monotone"
                  name="Assigned"
                  dataKey="created"
                  stroke="#fbbf24"
                  fill="url(#asA)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  name="Submitted"
                  dataKey="submitted"
                  stroke="#22d3ee"
                  fill="url(#asS)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* Range + status chips */}
      <Card className="mt-5 p-3">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <Filter className="ml-1 mr-1 h-3.5 w-3.5 text-slate-500" />
            {RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
                className={[
                  'rounded-full px-3 py-1.5 text-[12px] transition-colors',
                  range === r.key
                    ? 'bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/40'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100',
                ].join(' ')}
              >
                {r.label}
              </button>
            ))}
            <span className="ml-2 text-[11px] text-slate-500">
              {rangeFiltered.length.toLocaleString()} in range
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="ml-1 mr-1 text-[11px] uppercase tracking-wider text-slate-500">
              Status
            </span>
            {(
              [
                ['all', 'All', 'bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-500/40'],
                ['active', 'Active', 'bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/40'],
                ['draft', 'Draft', 'bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/40'],
                ['closed', 'Closed', 'bg-slate-500/15 text-slate-200 ring-1 ring-slate-500/40'],
                ['overdue', 'Overdue', 'bg-rose-500/15 text-rose-200 ring-1 ring-rose-500/40'],
              ] as [StatusFilter, string, string][]
            ).map(([k, label, activeCls]) => (
              <button
                key={k}
                onClick={() => setStatusFilter(k)}
                className={[
                  'rounded-full px-3 py-1.5 text-[12px] transition-colors',
                  statusFilter === k
                    ? activeCls
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Breakdown charts */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <SectionTitle title="By status" />
          <div className="h-64 px-2 pb-3">
            {byStatus.length === 0 ? (
              <EmptyState title="No assignments" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={byStatus}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={85}
                    paddingAngle={2}
                  >
                    {byStatus.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={STATUS_COLORS[entry.status] || '#94a3b8'}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: '#0b1020',
                      border: '1px solid #1e293b',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#cbd5e1' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="lg:col-span-3">
          <SectionTitle title="By grade & subject" hint="Where assignments concentrate." />
          <div className="grid grid-cols-1 gap-3 px-3 pb-3 md:grid-cols-2">
            <div className="h-60">
              {byGrade.length === 0 ? (
                <EmptyState title="No grade data" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byGrade}>
                    <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                    <XAxis dataKey="grade" stroke="#64748b" fontSize={11} />
                    <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        background: '#0b1020',
                        border: '1px solid #1e293b',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="count" fill="#22d3ee" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="h-60">
              {bySubject.length === 0 ? (
                <EmptyState title="No subject data" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bySubject}>
                    <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                    <XAxis dataKey="subject" stroke="#64748b" fontSize={11} />
                    <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        background: '#0b1020',
                        border: '1px solid #1e293b',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="count" fill="#a78bfa" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Top assignments by completion */}
      {topAssignments.length > 0 && (
        <Card className="mt-5">
          <SectionTitle
            title="Top assignments by submission rate"
            hint="Where learners are most engaged."
            right={<GraduationCap className="h-4 w-4 text-emerald-300" />}
          />
          <ul className="grid gap-2 px-5 pb-5 lg:grid-cols-5 md:grid-cols-3 grid-cols-1">
            {topAssignments.map((a, i) => (
              <li
                key={a.id}
                className="rounded-lg border border-slate-800/70 bg-gradient-to-br from-slate-900/70 to-slate-900/30 p-3"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={[
                      'flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold',
                      i === 0
                        ? 'bg-amber-500 text-amber-950'
                        : i === 1
                          ? 'bg-slate-300 text-slate-900'
                          : i === 2
                            ? 'bg-orange-700 text-white'
                            : 'bg-slate-700 text-slate-300',
                    ].join(' ')}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-slate-100">{a.title || 'Untitled'}</div>
                    <div className="truncate text-[11px] text-slate-500">{a.teacher_name || '—'}</div>
                  </div>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-500 to-emerald-400"
                    style={{ width: `${a.completionPct}%` }}
                  />
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">
                    {a.submitted_count}/{a.total_students}
                  </span>
                  <span className="font-semibold text-emerald-300 tabular-nums">{a.completionPct}%</span>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Search / sort */}
      <Card className="mt-5 p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="w-full sm:w-80">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search title, teacher, grade, subject…"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="mr-1 text-slate-500">Sort:</span>
            {(
              [
                ['newest', 'Newest'],
                ['oldest', 'Oldest'],
                ['completion', 'Completion %'],
                ['submitted', 'Most submitted'],
                ['score', 'Avg score'],
                ['due', 'Due date'],
              ] as [SortKey, string][]
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setSort(k)}
                className={[
                  'rounded-full px-3 py-1.5 transition-colors',
                  sort === k
                    ? 'bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/40'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="mt-5">
        <div className="flex items-center justify-between border-b border-slate-800/70 px-5 py-3 text-[11px] text-slate-500">
          <span>
            {filtered.length.toLocaleString()} of {assignments.length.toLocaleString()} assignments
          </span>
          {stats.overdue > 0 && statusFilter !== 'overdue' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] text-rose-300 ring-1 ring-rose-500/30">
              <Clock className="h-3 w-3" /> {stats.overdue} overdue
            </span>
          )}
        </div>
        {filtered.length === 0 ? (
          <EmptyState
            title="No assignments match this view"
            hint="Try a wider time range or change the status filter."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800/70 text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3">Title</th>
                  <th className="px-4 py-3">Teacher</th>
                  <th className="px-4 py-3">Grade</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Submitted</th>
                  <th className="px-4 py-3 text-right">Graded</th>
                  <th className="px-4 py-3 text-right">Avg score</th>
                  <th className="px-4 py-3">Due</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => {
                  const pct = a.total_students
                    ? Math.round(((a.submitted_count || 0) / a.total_students) * 100)
                    : 0;
                  const overdue =
                    a.status !== 'closed' && a.due_date && isPast(new Date(a.due_date));
                  return (
                    <tr
                      key={a.id}
                      className="border-b border-slate-800/40 transition-colors hover:bg-amber-500/5"
                    >
                      <td className="px-5 py-3 text-slate-100">
                        <div className="truncate">{a.title}</div>
                        {a.subject && (
                          <div className="mt-0.5 truncate text-[11px] text-slate-500">{a.subject}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-300">{a.teacher_name || '—'}</td>
                      <td className="px-4 py-3 text-slate-300">{a.grade_level}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          <Badge
                            tone={
                              a.status === 'active'
                                ? 'emerald'
                                : a.status === 'closed'
                                  ? 'slate'
                                  : 'amber'
                            }
                          >
                            {a.status}
                          </Badge>
                          {overdue && <Badge tone="rose">overdue</Badge>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="tabular-nums text-slate-100">
                          {a.submitted_count}/{a.total_students}
                        </div>
                        <div className="mt-1 h-1 w-20 overflow-hidden rounded-full bg-slate-800 ml-auto">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-emerald-400"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-100">
                        {a.graded_count}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {a.average_score != null ? (
                          <span className="font-semibold text-emerald-300">
                            {Number(a.average_score).toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {a.due_date ? format(new Date(a.due_date), 'MMM d, yyyy') : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
};

export default MonitorAssignments;
