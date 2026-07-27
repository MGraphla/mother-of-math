import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Filter,
  Sparkles,
  Lightbulb,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
} from 'recharts';
import {
  Card,
  PageHeader,
  LoadingState,
  EmptyState,
  KpiCard,
  SectionTitle,
  Badge,
  SearchInput,
  MonitorFetchErrorPage,
  MonitorFetchErrorBanner,
} from '../components/ui';
import { format, subDays } from 'date-fns';
import { getAllStudentWorks } from '../services/monitorData';
import { stripMarkdown } from '../utils/text';
import type { StudentWorkStats } from '@/types/admin';
import { useLiveData } from '../hooks/useLiveData';
import LiveIndicator from '../components/LiveIndicator';
import ExportMenu from '../components/ExportMenu';
import type { ExportPayload } from '../utils/exporters';

const PIE_COLORS = [
  '#fbbf24',
  '#f87171',
  '#a78bfa',
  '#22d3ee',
  '#34d399',
  '#60a5fa',
  '#fb923c',
  '#c084fc',
  '#4ade80',
];

type RangeKey = '7d' | '30d' | '90d' | 'all';
const RANGES: { key: RangeKey; label: string; ms: number | null }[] = [
  { key: '7d', label: 'Last 7d', ms: 7 * 24 * 3600 * 1000 },
  { key: '30d', label: 'Last 30d', ms: 30 * 24 * 3600 * 1000 },
  { key: '90d', label: 'Last 90d', ms: 90 * 24 * 3600 * 1000 },
  { key: 'all', label: 'All time', ms: null },
];

const MonitorErrorAnalysis = () => {
  const { data: works, loading, refreshing, paused, setPaused, lastUpdated, error, refresh } =
    useLiveData<StudentWorkStats[]>(() => getAllStudentWorks(), { intervalMs: 45_000 });
  const list = works ?? [];

  const [range, setRange] = useState<RangeKey>('30d');
  const [search, setSearch] = useState('');
  const [errorFilter, setErrorFilter] = useState<string | 'all'>('all');

  /* ── Range filtering ───────────────────────────────────── */
  const rangeFiltered = useMemo(() => {
    const r = RANGES.find((x) => x.key === range);
    if (!r || r.ms === null) return list;
    const cutoff = Date.now() - r.ms;
    return list.filter((w) => new Date(w.created_at).getTime() >= cutoff);
  }, [list, range]);

  const withError = useMemo(() => rangeFiltered.filter((w) => !!w.error_type), [rangeFiltered]);

  /* ── KPI stats ─────────────────────────────────────────── */
  const stats = useMemo(() => {
    const totalUploads = list.length;
    const totalClassified = list.filter((w) => !!w.error_type).length;
    const classificationRate = totalUploads
      ? Math.round((totalClassified / totalUploads) * 100)
      : 0;
    const distinctErrorTypes = new Set(
      list.map((w) => w.error_type).filter(Boolean),
    ).size;
    const distinctSubjects = new Set(
      withError.map((w) => w.subject).filter(Boolean),
    ).size;

    const now = Date.now();
    const week = now - 7 * 86400000;
    const prev = now - 14 * 86400000;
    const thisWeek = list.filter(
      (w) => w.error_type && new Date(w.created_at).getTime() >= week,
    ).length;
    const prevWeek = list.filter((w) => {
      if (!w.error_type) return false;
      const t = new Date(w.created_at).getTime();
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
      totalUploads,
      totalClassified,
      classificationRate,
      distinctErrorTypes,
      distinctSubjects,
      thisWeek,
      prevWeek,
      delta: { value: change, direction },
    };
  }, [list, withError]);

  /* ── Breakdowns ─────────────────────────────────────────── */
  const byErrorType = useMemo(() => {
    const m = new Map<string, number>();
    withError.forEach((w) => {
      const k = (w.error_type || 'Unknown').trim();
      m.set(k, (m.get(k) ?? 0) + 1);
    });
    return [...m.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
  }, [withError]);

  const bySubject = useMemo(() => {
    const m = new Map<string, number>();
    withError.forEach((w) => {
      const k = (w.subject || 'Other').trim();
      m.set(k, (m.get(k) ?? 0) + 1);
    });
    return [...m.entries()]
      .map(([subject, count]) => ({ subject, count }))
      .sort((a, b) => b.count - a.count);
  }, [withError]);

  const byGrade = useMemo(() => {
    const m = new Map<string, number>();
    withError.forEach((w) => {
      const k = (w.grade || 'Unspecified').trim();
      m.set(k, (m.get(k) ?? 0) + 1);
    });
    return [...m.entries()]
      .map(([grade, count]) => ({ grade, count }))
      .sort((a, b) => b.count - a.count);
  }, [withError]);

  const dailyTrend = useMemo(() => {
    const days: Record<string, { date: string; errors: number; uploads: number }> = {};
    for (let i = 13; i >= 0; i--) {
      const d = subDays(new Date(), i);
      const key = format(d, 'MMM d');
      days[key] = { date: key, errors: 0, uploads: 0 };
    }
    list.forEach((w) => {
      const key = format(new Date(w.created_at), 'MMM d');
      if (days[key]) {
        days[key].uploads += 1;
        if (w.error_type) days[key].errors += 1;
      }
    });
    return Object.values(days);
  }, [list]);

  const errorTopTeachers = useMemo(() => {
    const m = new Map<string, number>();
    withError.forEach((w) => {
      const k = w.teacher_name || 'Unknown';
      m.set(k, (m.get(k) ?? 0) + 1);
    });
    return [...m.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [withError]);
  const topTeacherMax = errorTopTeachers[0]?.count ?? 1;

  const filteredRemediations = useMemo(() => {
    let arr = withError.filter((w) => !!w.remediation);
    if (errorFilter !== 'all') arr = arr.filter((w) => w.error_type === errorFilter);
    const term = search.trim().toLowerCase();
    if (term) {
      arr = arr.filter(
        (w) =>
          (w.error_type || '').toLowerCase().includes(term) ||
          (w.student_name || '').toLowerCase().includes(term) ||
          (w.teacher_name || '').toLowerCase().includes(term) ||
          (w.remediation || '').toLowerCase().includes(term),
      );
    }
    return arr
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
      .slice(0, 30);
  }, [withError, errorFilter, search]);

  /* ── Export payload ─────────────────────────────────────── */
  const buildExportPayload = (): ExportPayload => ({
    fileStem: `qeda-error-analysis-${range}`,
    title: 'QEDA Education Monitor — Error Analysis',
    subtitle: `${RANGES.find((r) => r.key === range)?.label}${errorFilter !== 'all' ? ` · ${errorFilter}` : ''}${search ? ` · "${search}"` : ''}`,
    summary:
      `${stats.totalClassified.toLocaleString()} classified errors across ${stats.totalUploads.toLocaleString()} ` +
      `uploads (${stats.classificationRate}% classification rate). ` +
      `${stats.distinctErrorTypes} distinct error types observed across ${stats.distinctSubjects} subjects. ` +
      `${stats.thisWeek} new errors in the last 7 days (${stats.delta.value > 0 ? '+' : ''}${stats.delta.value}% vs the previous 7 days).`,
    kpis: [
      { label: 'Uploads analysed', value: stats.totalUploads },
      { label: 'Classified errors', value: stats.totalClassified, hint: `${stats.classificationRate}%` },
      { label: 'Distinct error types', value: stats.distinctErrorTypes },
      { label: 'Subjects affected', value: stats.distinctSubjects },
      { label: 'In range', value: withError.length },
      { label: 'This week', value: stats.thisWeek, hint: `vs ${stats.prevWeek} prev` },
    ],
    tables: [
      {
        title: 'Errors by type',
        columns: ['Error type', 'Count'],
        rows: byErrorType.map((e) => [e.type, e.count]),
      },
      {
        title: 'Errors by subject',
        columns: ['Subject', 'Count'],
        rows: bySubject.map((s) => [s.subject, s.count]),
      },
      {
        title: 'Errors by grade level',
        columns: ['Grade', 'Count'],
        rows: byGrade.map((g) => [g.grade, g.count]),
      },
      {
        title: 'Top teachers seeing errors',
        columns: ['Teacher', 'Errors detected'],
        rows: errorTopTeachers.map((t) => [t.name, t.count]),
      },
      {
        title: 'Recent remediation suggestions',
        columns: ['Date', 'Error', 'Student', 'Teacher', 'Remediation'],
        rows: filteredRemediations.map((w) => [
          format(new Date(w.created_at), 'yyyy-MM-dd'),
          w.error_type ?? '—',
          w.student_name ?? '—',
          w.teacher_name ?? '—',
          (stripMarkdown(w.remediation) || '').slice(0, 240),
        ]),
      },
    ],
  });

  /* ── Render ─────────────────────────────────────────────── */
  if (loading && works == null)
    return (
      <>
        <PageHeader
          title="Error analysis"
          icon={AlertTriangle}
          subtitle="Aggregate breakdown of student errors identified by the AI uploader."
        />
        <LoadingState label="Analysing errors…" />
      </>
    );

  if (!loading && error && works == null)
    return (
      <MonitorFetchErrorPage
        title="Error analysis"
        icon={AlertTriangle}
        subtitle="Aggregate breakdown of student errors identified by the AI uploader."
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
        title="Error analysis"
        icon={AlertTriangle}
        subtitle="Aggregate breakdown of student errors identified by the AI uploader, segmented by error type, subject and grade."
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

      {error && works != null && <MonitorFetchErrorBanner error={error} onRetry={refresh} />}

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Uploads analysed" value={stats.totalUploads} tone="cyan" />
        <KpiCard
          label="Classified errors"
          value={stats.totalClassified}
          icon={AlertTriangle}
          tone="amber"
          hint={`${stats.classificationRate}% rate`}
        />
        <KpiCard
          label="Distinct error types"
          value={stats.distinctErrorTypes}
          tone="rose"
        />
        <KpiCard
          label="This week"
          value={stats.thisWeek}
          icon={Sparkles}
          tone="violet"
          hint={`${stats.prevWeek} previous`}
          delta={{ value: stats.delta.value, direction: stats.delta.direction, label: 'vs prev 7d' }}
        />
      </div>

      {/* Daily trend */}
      <Card className="mt-5">
        <SectionTitle
          title="Last 14 days · errors vs uploads"
          hint="Are error volumes rising or falling?"
          right={
            <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2.5 py-1 text-[11px] text-rose-300 ring-1 ring-rose-500/20">
              <TrendIcon className="h-3 w-3" /> {stats.delta.value > 0 ? '+' : ''}
              {stats.delta.value}% week over week
            </div>
          }
        />
        <div className="h-64 px-2 pb-3">
          {dailyTrend.every((d) => d.uploads === 0) ? (
            <EmptyState title="No uploads in the last 14 days" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyTrend} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="eaErr" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="#fbbf24" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="eaUp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.35} />
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
                  name="Uploads"
                  dataKey="uploads"
                  stroke="#22d3ee"
                  fill="url(#eaUp)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  name="Errors"
                  dataKey="errors"
                  stroke="#fbbf24"
                  fill="url(#eaErr)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* Range chips */}
      <Card className="mt-5 p-3">
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
            {withError.length.toLocaleString()} errors · {rangeFiltered.length.toLocaleString()} uploads in range
          </span>
        </div>
      </Card>

      {/* Charts row */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <SectionTitle
            title="Errors by type"
            hint="The most common mistakes the AI identifies."
          />
          <div className="h-80 px-2 pb-3">
            {byErrorType.length === 0 ? (
              <EmptyState title="No classified errors in this window" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={byErrorType.slice(0, 12)}
                  layout="vertical"
                  margin={{ left: 40, right: 12 }}
                >
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" stroke="#64748b" fontSize={11} allowDecimals={false} />
                  <YAxis
                    dataKey="type"
                    type="category"
                    stroke="#94a3b8"
                    fontSize={11}
                    width={180}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#0b1020',
                      border: '1px solid #1e293b',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                    {byErrorType.slice(0, 12).map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <SectionTitle title="By subject" />
          <div className="h-80 px-2 pb-3">
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
                    outerRadius={95}
                    innerRadius={50}
                    paddingAngle={2}
                  >
                    {bySubject.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
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
                  <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      {/* Grade + teachers */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <SectionTitle title="Errors by grade level" />
          <div className="h-64 px-2 pb-3">
            {byGrade.length === 0 ? (
              <EmptyState title="No data" />
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
                  <Bar dataKey="count" fill="#f87171" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <SectionTitle title="Teachers seeing most errors" hint="Where targeted coaching may help." />
          <div className="space-y-2 px-5 pb-4">
            {errorTopTeachers.length === 0 ? (
              <EmptyState title="No data" />
            ) : (
              errorTopTeachers.map((t, i) => (
                <div
                  key={t.name}
                  className="rounded-lg border border-slate-800/70 bg-slate-900/40 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm text-slate-100">
                      <span className="mr-1.5 text-slate-500">#{i + 1}</span>
                      {t.name}
                    </span>
                    <span className="text-xs font-semibold text-rose-300 tabular-nums">
                      {t.count}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-rose-500 to-amber-400"
                      style={{ width: `${(t.count / topTeacherMax) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Remediation feed */}
      <Card className="mt-5">
        <SectionTitle
          title="Recent AI remediation suggestions"
          hint="What the AI is recommending to address the identified errors."
          right={<Lightbulb className="h-4 w-4 text-amber-300" />}
        />

        {/* Filter chips for error type */}
        <div className="flex flex-col gap-3 border-b border-slate-800/70 px-5 pb-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="ml-1 mr-1 text-[11px] uppercase tracking-wider text-slate-500">
              Error type
            </span>
            <button
              onClick={() => setErrorFilter('all')}
              className={[
                'rounded-full px-3 py-1.5 text-[12px] transition-colors',
                errorFilter === 'all'
                  ? 'bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/40'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100',
              ].join(' ')}
            >
              All
            </button>
            {byErrorType.slice(0, 8).map((e) => (
              <button
                key={e.type}
                onClick={() => setErrorFilter(e.type)}
                className={[
                  'rounded-full px-3 py-1.5 text-[12px] transition-colors',
                  errorFilter === e.type
                    ? 'bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/40'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100',
                ].join(' ')}
              >
                {e.type} <span className="ml-1.5 text-slate-500">· {e.count}</span>
              </button>
            ))}
          </div>
          <div className="w-full sm:w-80">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search error, student, teacher, remediation…"
            />
          </div>
        </div>

        {filteredRemediations.length === 0 ? (
          <EmptyState
            title="No remediation entries match this filter"
            hint="Try widening the time range or clearing search."
          />
        ) : (
          <ul className="divide-y divide-slate-800/70">
            {filteredRemediations.map((w) => (
              <li key={w.id} className="px-5 py-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge tone="amber">{w.error_type}</Badge>
                  <span className="text-xs text-slate-300">{w.student_name}</span>
                  <span className="text-xs text-slate-500">
                    · {w.teacher_name || 'Unknown teacher'}
                  </span>
                  {w.subject && (
                    <>
                      <span className="text-xs text-slate-500">·</span>
                      <Badge tone="slate">{w.subject}</Badge>
                    </>
                  )}
                  <span className="ml-auto text-[11px] text-slate-500">
                    {format(new Date(w.created_at), 'MMM d, yyyy')}
                  </span>
                </div>
                <div className="text-sm leading-relaxed text-slate-200 whitespace-pre-wrap">
                  {stripMarkdown(w.remediation)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
};

export default MonitorErrorAnalysis;
