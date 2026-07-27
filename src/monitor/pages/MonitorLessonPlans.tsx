import { useMemo, useState } from 'react';
import {
  BookOpen,
  Trophy,
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  Filter,
  CalendarDays,
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
import { format, subDays } from 'date-fns';
import { getAllLessonPlans, getLessonPlansByTeacher } from '../services/monitorData';
import type { LessonPlanStats } from '@/types/admin';
import { useLiveData } from '../hooks/useLiveData';
import LiveIndicator from '../components/LiveIndicator';
import ExportMenu from '../components/ExportMenu';
import type { ExportPayload } from '../utils/exporters';

interface LessonPlansBundle {
  plans: LessonPlanStats[];
  byTeacher: { teacherId: string; teacherName: string; lessonPlanCount: number }[];
}

type RangeKey = '24h' | '7d' | '30d' | 'all';
const RANGES: { key: RangeKey; label: string; ms: number | null }[] = [
  { key: '24h', label: 'Last 24h', ms: 24 * 3600 * 1000 },
  { key: '7d', label: 'Last 7d', ms: 7 * 24 * 3600 * 1000 },
  { key: '30d', label: 'Last 30d', ms: 30 * 24 * 3600 * 1000 },
  { key: 'all', label: 'All time', ms: null },
];

type SortKey = 'newest' | 'oldest' | 'title' | 'teacher' | 'grade';

const PIE_COLORS = [
  '#a78bfa',
  '#22d3ee',
  '#34d399',
  '#fbbf24',
  '#f87171',
  '#60a5fa',
  '#fb923c',
  '#c084fc',
];

const MonitorLessonPlans = () => {
  const { data, loading, refreshing, paused, setPaused, lastUpdated, error, refresh } =
    useLiveData<LessonPlansBundle>(
      async () => {
        const [plans, byTeacher] = await Promise.all([
          getAllLessonPlans(),
          getLessonPlansByTeacher(),
        ]);
        return { plans, byTeacher };
      },
      { intervalMs: 45_000 },
    );

  const plans = data?.plans ?? [];
  const byTeacher = data?.byTeacher ?? [];

  const [range, setRange] = useState<RangeKey>('30d');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('newest');
  const [gradeFilter, setGradeFilter] = useState<string | 'all'>('all');

  /* ── Range filtering ───────────────────────────────────── */
  const rangeFiltered = useMemo(() => {
    const r = RANGES.find((x) => x.key === range);
    if (!r || r.ms === null) return plans;
    const cutoff = Date.now() - r.ms;
    return plans.filter((p) => new Date(p.created_at).getTime() >= cutoff);
  }, [plans, range]);

  /* ── KPI stats and weekly delta ─────────────────────────── */
  const stats = useMemo(() => {
    const now = Date.now();
    const week = now - 7 * 86400000;
    const prevWeek = now - 14 * 86400000;
    const thisWeek = plans.filter((p) => new Date(p.created_at).getTime() >= week).length;
    const lastWeek = plans.filter((p) => {
      const t = new Date(p.created_at).getTime();
      return t >= prevWeek && t < week;
    }).length;
    const delta =
      lastWeek === 0
        ? { value: thisWeek > 0 ? 100 : 0, direction: thisWeek > 0 ? ('up' as const) : ('flat' as const) }
        : (() => {
            const change = Math.round(((thisWeek - lastWeek) / lastWeek) * 100);
            return {
              value: change,
              direction:
                change > 2 ? ('up' as const) : change < -2 ? ('down' as const) : ('flat' as const),
            };
          })();
    return {
      total: plans.length,
      distinctTeachers: new Set(plans.map((p) => p.teacher_id)).size,
      distinctGrades: new Set(plans.map((p) => p.grade_level).filter(Boolean)).size,
      distinctSubjects: new Set(plans.map((p) => p.subject).filter(Boolean)).size,
      thisWeek,
      lastWeek,
      delta,
    };
  }, [plans]);

  /* ── Daily trend (last 14 days) ─────────────────────────── */
  const dailyTrend = useMemo(() => {
    const days: Record<string, { date: string; created: number }> = {};
    for (let i = 13; i >= 0; i--) {
      const d = subDays(new Date(), i);
      const key = format(d, 'MMM d');
      days[key] = { date: key, created: 0 };
    }
    plans.forEach((p) => {
      const key = format(new Date(p.created_at), 'MMM d');
      if (days[key]) days[key].created += 1;
    });
    return Object.values(days);
  }, [plans]);

  const peakDay = useMemo(() => {
    if (!dailyTrend.length) return null;
    return dailyTrend.reduce((max, r) => (r.created > max.created ? r : max), dailyTrend[0]);
  }, [dailyTrend]);

  /* ── Breakdowns ─────────────────────────────────────────── */
  const byGrade = useMemo(() => {
    const m = new Map<string, number>();
    rangeFiltered.forEach((p) =>
      m.set(p.grade_level || 'Unknown', (m.get(p.grade_level || 'Unknown') ?? 0) + 1),
    );
    return [...m.entries()]
      .map(([grade, count]) => ({ grade, count }))
      .sort((a, b) => b.count - a.count);
  }, [rangeFiltered]);

  const bySubject = useMemo(() => {
    const m = new Map<string, number>();
    rangeFiltered.forEach((p) =>
      m.set(p.subject || 'Other', (m.get(p.subject || 'Other') ?? 0) + 1),
    );
    return [...m.entries()]
      .map(([subject, count]) => ({ subject, count }))
      .sort((a, b) => b.count - a.count);
  }, [rangeFiltered]);

  const topTeachers = useMemo(
    () =>
      byTeacher
        .filter((t) => t.lessonPlanCount > 0)
        .sort((a, b) => b.lessonPlanCount - a.lessonPlanCount)
        .slice(0, 10),
    [byTeacher],
  );
  const topTeacherMax = topTeachers[0]?.lessonPlanCount ?? 1;

  const allGrades = useMemo(
    () =>
      [...new Set(plans.map((p) => p.grade_level).filter(Boolean))].sort() as string[],
    [plans],
  );

  /* ── Table filtering / sorting ──────────────────────────── */
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    let arr = rangeFiltered;
    if (gradeFilter !== 'all') arr = arr.filter((p) => p.grade_level === gradeFilter);
    if (term) {
      arr = arr.filter(
        (p) =>
          (p.title || '').toLowerCase().includes(term) ||
          (p.teacher_name || '').toLowerCase().includes(term) ||
          (p.subject || '').toLowerCase().includes(term) ||
          (p.grade_level || '').toLowerCase().includes(term),
      );
    }
    const cmp = (a: LessonPlanStats, b: LessonPlanStats): number => {
      switch (sort) {
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'title':
          return (a.title || '').localeCompare(b.title || '');
        case 'teacher':
          return (a.teacher_name || '').localeCompare(b.teacher_name || '');
        case 'grade':
          return (a.grade_level || '').localeCompare(b.grade_level || '');
      }
    };
    return [...arr].sort(cmp);
  }, [rangeFiltered, search, sort, gradeFilter]);

  /* ── Export payload ─────────────────────────────────────── */
  const buildExportPayload = (): ExportPayload => ({
    fileStem: `qeda-lesson-plans-${range}`,
    title: 'QEDA Education Monitor — Lesson Plans',
    subtitle: `${RANGES.find((r) => r.key === range)?.label}${gradeFilter !== 'all' ? ` · ${gradeFilter}` : ''}${search ? ` · "${search}"` : ''}`,
    summary:
      `${plans.length.toLocaleString()} lesson plans created in total by ${stats.distinctTeachers.toLocaleString()} teachers ` +
      `across ${stats.distinctGrades} grade levels and ${stats.distinctSubjects} subjects. ` +
      `${stats.thisWeek} plans in the last 7 days (${stats.delta.value > 0 ? '+' : ''}${stats.delta.value}% vs the previous 7 days).`,
    kpis: [
      { label: 'Total plans', value: stats.total },
      { label: 'Distinct teachers', value: stats.distinctTeachers },
      { label: 'Distinct grades', value: stats.distinctGrades },
      { label: 'Distinct subjects', value: stats.distinctSubjects },
      { label: 'This week', value: stats.thisWeek, hint: `vs ${stats.lastWeek} previous` },
      { label: 'In selected range', value: rangeFiltered.length },
    ],
    tables: [
      {
        title: 'All lesson plans in current view',
        columns: ['Title', 'Teacher', 'Subject', 'Grade', 'Created'],
        rows: filtered.map((p) => [
          p.title ?? 'Untitled',
          p.teacher_name ?? '—',
          p.subject ?? '—',
          p.grade_level ?? '—',
          format(new Date(p.created_at), 'yyyy-MM-dd'),
        ]),
      },
      {
        title: 'Top teachers by lesson plans',
        columns: ['Rank', 'Teacher', 'Plans'],
        rows: topTeachers.map((t, i) => [i + 1, t.teacherName ?? '—', t.lessonPlanCount]),
      },
      {
        title: 'Plans by grade level',
        columns: ['Grade', 'Plans'],
        rows: byGrade.map((g) => [g.grade, g.count]),
      },
      {
        title: 'Plans by subject',
        columns: ['Subject', 'Plans'],
        rows: bySubject.map((s) => [s.subject, s.count]),
      },
    ],
  });

  /* ── Render ─────────────────────────────────────────────── */
  if (loading && !data)
    return (
      <>
        <PageHeader
          title="Lesson plans"
          icon={BookOpen}
          subtitle="Every AI-generated lesson plan, the teachers who created them, and the grade-level distribution."
        />
        <LoadingState label="Loading lesson plans…" />
      </>
    );

  if (!loading && error && !data)
    return (
      <MonitorFetchErrorPage
        title="Lesson plans"
        icon={BookOpen}
        subtitle="Every AI-generated lesson plan, the teachers who created them, and the grade-level distribution."
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
        title="Lesson plans"
        icon={BookOpen}
        subtitle="Every AI-generated lesson plan, the teachers who created them, and the grade-level distribution."
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
        <KpiCard label="Total plans" value={stats.total} icon={BookOpen} tone="violet" />
        <KpiCard
          label="Distinct teachers"
          value={stats.distinctTeachers}
          tone="cyan"
          hint="Authoring at least one plan"
        />
        <KpiCard
          label="Distinct grades"
          value={stats.distinctGrades}
          tone="amber"
          hint={`${stats.distinctSubjects} subjects covered`}
        />
        <KpiCard
          label="This week"
          value={stats.thisWeek}
          icon={Sparkles}
          tone="emerald"
          hint={`${stats.lastWeek} previous · ${stats.delta.value > 0 ? '+' : ''}${stats.delta.value}%`}
          delta={{
            value: stats.delta.value,
            direction: stats.delta.direction,
            label: 'vs prev 7d',
          }}
        />
      </div>

      {/* Daily trend */}
      <Card className="mt-5">
        <SectionTitle
          title="Last 14 days · plans created"
          hint="When teachers are most actively producing material."
          right={
            peakDay && peakDay.created > 0 ? (
              <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-300 ring-1 ring-amber-500/20">
                <TrendIcon className="h-3 w-3" /> Peak:{' '}
                <span className="font-semibold">{peakDay.date}</span> · {peakDay.created}
              </div>
            ) : null
          }
        />
        <div className="h-60 px-2 pb-3">
          {dailyTrend.every((d) => d.created === 0) ? (
            <EmptyState title="No plans created in the last 14 days" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyTrend} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="lpGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
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
                <Area
                  type="monotone"
                  dataKey="created"
                  stroke="#a78bfa"
                  fill="url(#lpGrad)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* Range chips */}
      <Card className="mt-5 p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            <Filter className="ml-1 mr-1 h-3.5 w-3.5 text-slate-500" />
            {RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
                className={[
                  'rounded-full px-3 py-1.5 text-[12px] transition-colors',
                  range === r.key
                    ? 'bg-violet-500/15 text-violet-200 ring-1 ring-violet-500/40'
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
        </div>
      </Card>

      {/* Charts */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <SectionTitle
            title="Lesson plans by grade level"
            hint={`${byGrade.length} grades in current range`}
          />
          <div className="h-72 px-2 pb-3">
            {byGrade.length === 0 ? (
              <EmptyState title="No plans yet" />
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
                  <Bar dataKey="count" fill="#a78bfa" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <SectionTitle title="By subject" hint="Topic mix in the selected range." />
          <div className="h-72 px-2 pb-3">
            {bySubject.length === 0 ? (
              <EmptyState title="No data" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={bySubject}
                    dataKey="count"
                    nameKey="subject"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={95}
                    paddingAngle={2}
                  >
                    {bySubject.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend wrapperStyle={{ fontSize: 11, color: '#cbd5e1' }} />
                  <Tooltip
                    contentStyle={{
                      background: '#0b1020',
                      border: '1px solid #1e293b',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      {/* Top teachers leaderboard */}
      {topTeachers.length > 0 && (
        <Card className="mt-5">
          <SectionTitle
            title="Top 10 teachers · lesson plans created"
            hint="All-time leaderboard of authoring activity."
            right={<Trophy className="h-4 w-4 text-amber-400" />}
          />
          <div className="grid gap-2 px-5 pb-5 lg:grid-cols-5 md:grid-cols-3 grid-cols-2">
            {topTeachers.slice(0, 5).map((t, i) => (
              <div
                key={t.teacherId}
                className="rounded-lg border border-slate-800/70 bg-gradient-to-br from-slate-900/70 to-slate-900/30 p-3 transition-all hover:border-violet-500/40 hover:bg-violet-500/5"
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
                    <div className="truncate text-sm font-medium text-slate-100">
                      {t.teacherName || 'Unknown'}
                    </div>
                    <div className="truncate text-[11px] text-slate-500">
                      {t.lessonPlanCount.toLocaleString()} plans
                    </div>
                  </div>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-500 to-amber-400"
                    style={{ width: `${(t.lessonPlanCount / topTeacherMax) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          {topTeachers.length > 5 && (
            <div className="border-t border-slate-800/60 px-5 pb-4 pt-3">
              <div className="text-[11px] uppercase tracking-wider text-slate-500">Honourable mentions · #6–10</div>
              <ul className="mt-2 grid gap-1 md:grid-cols-2 lg:grid-cols-5">
                {topTeachers.slice(5, 10).map((t, idx) => (
                  <li
                    key={t.teacherId}
                    className="flex items-center justify-between gap-2 rounded-md border border-slate-800/60 bg-slate-900/40 px-2.5 py-1.5"
                  >
                    <span className="truncate text-xs text-slate-300">
                      <span className="mr-1.5 text-slate-500">#{idx + 6}</span>
                      {t.teacherName || 'Unknown'}
                    </span>
                    <span className="text-[11px] font-semibold text-violet-300 tabular-nums">
                      {t.lessonPlanCount}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      {/* Filter / search / sort bar */}
      <Card className="mt-5 p-3">
        <div className="flex flex-col gap-3">
          {allGrades.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="ml-1 mr-1 text-[11px] uppercase tracking-wider text-slate-500">
                Grade
              </span>
              <button
                onClick={() => setGradeFilter('all')}
                className={[
                  'rounded-full px-3 py-1.5 text-[12px] transition-colors',
                  gradeFilter === 'all'
                    ? 'bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-500/40'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100',
                ].join(' ')}
              >
                All
              </button>
              {allGrades.map((g) => (
                <button
                  key={g}
                  onClick={() => setGradeFilter(g)}
                  className={[
                    'rounded-full px-3 py-1.5 text-[12px] transition-colors',
                    gradeFilter === g
                      ? 'bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-500/40'
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100',
                  ].join(' ')}
                >
                  {g}
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="w-full sm:w-80">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search title, teacher, subject, grade…"
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="mr-1 text-slate-500">Sort:</span>
              {(
                [
                  ['newest', 'Newest'],
                  ['oldest', 'Oldest'],
                  ['title', 'Title A→Z'],
                  ['teacher', 'Teacher'],
                  ['grade', 'Grade'],
                ] as [SortKey, string][]
              ).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setSort(k)}
                  className={[
                    'rounded-full px-3 py-1.5 transition-colors',
                    sort === k
                      ? 'bg-violet-500/15 text-violet-200 ring-1 ring-violet-500/40'
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100',
                  ].join(' ')}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="mt-5">
        <div className="flex items-center justify-between border-b border-slate-800/70 px-5 py-3 text-[11px] text-slate-500">
          <span>
            {filtered.length.toLocaleString()} of {plans.length.toLocaleString()} plans
          </span>
          <div className="hidden items-center gap-1 sm:flex">
            <CalendarDays className="h-3 w-3" /> {RANGES.find((r) => r.key === range)?.label}
            {gradeFilter !== 'all' && <span> · {gradeFilter}</span>}
          </div>
        </div>
        {filtered.length === 0 ? (
          <EmptyState
            title="No lesson plans match this view"
            hint="Try a wider time range or clear the grade filter."
          />
        ) : (
          <div className="max-h-[640px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-900/95 backdrop-blur">
                <tr className="border-b border-slate-800/70 text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3">Title</th>
                  <th className="px-4 py-3">Teacher</th>
                  <th className="px-4 py-3">Grade</th>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-slate-800/40 transition-colors hover:bg-violet-500/5"
                  >
                    <td className="px-5 py-3 text-slate-100">
                      <div className="truncate">{p.title || 'Untitled'}</div>
                      {p.topic && (
                        <div className="mt-0.5 truncate text-[11px] text-slate-500">
                          {p.topic}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{p.teacher_name || '—'}</td>
                    <td className="px-4 py-3">
                      <Badge tone="violet">{p.grade_level || '—'}</Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{p.subject || '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {format(new Date(p.created_at), 'MMM d, yyyy')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
};

export default MonitorLessonPlans;
