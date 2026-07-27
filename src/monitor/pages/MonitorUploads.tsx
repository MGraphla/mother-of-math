import { useMemo, useState } from 'react';
import {
  UploadCloud,
  Filter,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Image as ImageIconLucide,
  CheckCircle2,
  Clock,
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
import { format, formatDistanceToNow, subDays } from 'date-fns';
import { getAllStudentWorks } from '../services/monitorData';
import { stripMarkdown } from '../utils/text';
import type { StudentWorkStats } from '@/types/admin';
import { useLiveData } from '../hooks/useLiveData';
import LiveIndicator from '../components/LiveIndicator';
import ExportMenu from '../components/ExportMenu';
import type { ExportPayload } from '../utils/exporters';

type RangeKey = '24h' | '7d' | '30d' | 'all';
const RANGES: { key: RangeKey; label: string; ms: number | null }[] = [
  { key: '24h', label: 'Last 24h', ms: 24 * 3600 * 1000 },
  { key: '7d', label: 'Last 7d', ms: 7 * 24 * 3600 * 1000 },
  { key: '30d', label: 'Last 30d', ms: 30 * 24 * 3600 * 1000 },
  { key: 'all', label: 'All time', ms: null },
];

type Status = 'all' | 'analysed' | 'errors' | 'pending';
type SortKey = 'newest' | 'oldest' | 'student' | 'teacher' | 'error';

const MonitorUploads = () => {
  const { data: works, loading, refreshing, paused, setPaused, lastUpdated, error, refresh } =
    useLiveData<StudentWorkStats[]>(() => getAllStudentWorks(), { intervalMs: 30_000 });
  const list = works ?? [];

  const [range, setRange] = useState<RangeKey>('30d');
  const [status, setStatus] = useState<Status>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('newest');
  const [preview, setPreview] = useState<StudentWorkStats | null>(null);

  /* ── Range filtering ───────────────────────────────────── */
  const rangeFiltered = useMemo(() => {
    const r = RANGES.find((x) => x.key === range);
    if (!r || r.ms === null) return list;
    const cutoff = Date.now() - r.ms;
    return list.filter((w) => new Date(w.created_at).getTime() >= cutoff);
  }, [list, range]);

  /* ── KPI stats ─────────────────────────────────────────── */
  const stats = useMemo(() => {
    const total = list.length;
    const analysed = list.filter((w) => !!w.feedback).length;
    const withErrors = list.filter((w) => !!w.error_type).length;
    const totalSize = list.reduce((s, w) => s + (w.file_size || 0), 0);
    const sizeMb = (totalSize / 1_048_576).toFixed(1);
    const classRate = total ? Math.round((withErrors / total) * 100) : 0;
    const analyseRate = total ? Math.round((analysed / total) * 100) : 0;

    const now = Date.now();
    const week = now - 7 * 86400000;
    const prev = now - 14 * 86400000;
    const thisWeek = list.filter((w) => new Date(w.created_at).getTime() >= week).length;
    const prevWeek = list.filter((w) => {
      const t = new Date(w.created_at).getTime();
      return t >= prev && t < week;
    }).length;
    const change =
      prevWeek === 0
        ? thisWeek > 0
          ? 100
          : 0
        : Math.round(((thisWeek - prevWeek) / prevWeek) * 100);
    const direction = change > 2 ? ('up' as const) : change < -2 ? ('down' as const) : ('flat' as const);
    return {
      total,
      analysed,
      withErrors,
      sizeMb,
      classRate,
      analyseRate,
      thisWeek,
      prevWeek,
      delta: { value: change, direction },
    };
  }, [list]);

  /* ── Daily trend (last 14 days) ─────────────────────────── */
  const dailyTrend = useMemo(() => {
    const days: Record<string, { date: string; uploads: number; errors: number }> = {};
    for (let i = 13; i >= 0; i--) {
      const d = subDays(new Date(), i);
      const key = format(d, 'MMM d');
      days[key] = { date: key, uploads: 0, errors: 0 };
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

  /* ── Breakdowns ─────────────────────────────────────────── */
  const byError = useMemo(() => {
    const m = new Map<string, number>();
    rangeFiltered.forEach((w) => {
      if (!w.error_type) return;
      m.set(w.error_type, (m.get(w.error_type) ?? 0) + 1);
    });
    return [...m.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [rangeFiltered]);

  const bySubject = useMemo(() => {
    const m = new Map<string, number>();
    rangeFiltered.forEach((w) => {
      const k = w.subject || 'Other';
      m.set(k, (m.get(k) ?? 0) + 1);
    });
    return [...m.entries()]
      .map(([subject, count]) => ({ subject, count }))
      .sort((a, b) => b.count - a.count);
  }, [rangeFiltered]);

  const topTeachers = useMemo(() => {
    const m = new Map<string, number>();
    rangeFiltered.forEach((w) => {
      const k = w.teacher_name || 'Unknown';
      m.set(k, (m.get(k) ?? 0) + 1);
    });
    return [...m.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [rangeFiltered]);
  const topTeacherMax = topTeachers[0]?.count ?? 1;

  /* ── Filtering / sorting ────────────────────────────────── */
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    let arr = rangeFiltered;
    if (status === 'analysed') arr = arr.filter((w) => !!w.feedback);
    if (status === 'errors') arr = arr.filter((w) => !!w.error_type);
    if (status === 'pending') arr = arr.filter((w) => !w.feedback);
    if (term) {
      arr = arr.filter(
        (w) =>
          (w.student_name || '').toLowerCase().includes(term) ||
          (w.teacher_name || '').toLowerCase().includes(term) ||
          (w.subject || '').toLowerCase().includes(term) ||
          (w.error_type || '').toLowerCase().includes(term),
      );
    }
    const cmp = (a: StudentWorkStats, b: StudentWorkStats): number => {
      switch (sort) {
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'student':
          return (a.student_name || '').localeCompare(b.student_name || '');
        case 'teacher':
          return (a.teacher_name || '').localeCompare(b.teacher_name || '');
        case 'error':
          return (a.error_type || '').localeCompare(b.error_type || '');
      }
    };
    return [...arr].sort(cmp);
  }, [rangeFiltered, status, search, sort]);

  /* ── Export payload ─────────────────────────────────────── */
  const buildExportPayload = (): ExportPayload => ({
    fileStem: `qeda-uploads-${range}`,
    title: 'QEDA Education Monitor — Student Work Uploads',
    subtitle: `${RANGES.find((r) => r.key === range)?.label}${status !== 'all' ? ` · ${status}` : ''}${search ? ` · "${search}"` : ''}`,
    summary:
      `${stats.total.toLocaleString()} homework images analysed for ${new Set(list.map((w) => w.teacher_name).filter(Boolean)).size} teachers. ` +
      `${stats.analysed.toLocaleString()} received AI feedback (${stats.analyseRate}%), ` +
      `${stats.withErrors.toLocaleString()} had classified errors (${stats.classRate}%). ` +
      `${stats.thisWeek} uploads in the last 7 days (${stats.delta.value > 0 ? '+' : ''}${stats.delta.value}% vs the previous 7 days).`,
    kpis: [
      { label: 'Total uploads', value: stats.total },
      { label: 'AI-analysed', value: stats.analysed, hint: `${stats.analyseRate}%` },
      { label: 'With error type', value: stats.withErrors, hint: `${stats.classRate}% classification` },
      { label: 'Storage', value: `${stats.sizeMb} MB` },
      { label: 'In current range', value: rangeFiltered.length },
      { label: 'This week', value: stats.thisWeek, hint: `vs ${stats.prevWeek} prev` },
    ],
    tables: [
      {
        title: 'Uploads in current view',
        columns: ['Student', 'Teacher', 'Subject', 'Error type', 'Feedback excerpt', 'Uploaded'],
        rows: filtered.map((w) => [
          w.student_name ?? '—',
          w.teacher_name ?? '—',
          w.subject ?? '—',
          w.error_type ?? '—',
          (stripMarkdown(w.feedback) || '').slice(0, 160),
          format(new Date(w.created_at), 'yyyy-MM-dd HH:mm'),
        ]),
      },
      {
        title: 'Top error types in range',
        columns: ['Error type', 'Count'],
        rows: byError.map((e) => [e.type, e.count]),
      },
      {
        title: 'Top teachers uploading work',
        columns: ['Teacher', 'Uploads'],
        rows: topTeachers.map((t) => [t.name, t.count]),
      },
    ],
  });

  /* ── Render ─────────────────────────────────────────────── */
  if (loading && works == null)
    return (
      <>
        <PageHeader
          title="Student work uploads"
          icon={UploadCloud}
          subtitle="Every homework image uploaded for AI analysis."
        />
        <LoadingState label="Loading uploads…" />
      </>
    );

  if (!loading && error && works == null)
    return (
      <MonitorFetchErrorPage
        title="Student work uploads"
        icon={UploadCloud}
        subtitle="Every homework image uploaded for AI analysis."
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
        title="Student work uploads"
        icon={UploadCloud}
        subtitle="Every homework image uploaded for AI analysis, the feedback returned, and the error patterns identified."
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
            <ExportMenu build={buildExportPayload} disabled={loading} />
          </div>
        }
      />

      {error && works != null && <MonitorFetchErrorBanner error={error} onRetry={refresh} />}

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard
          label="Total uploads"
          value={stats.total}
          icon={UploadCloud}
          tone="cyan"
          hint={`${stats.sizeMb} MB of imagery`}
        />
        <KpiCard
          label="AI-analysed"
          value={stats.analysed}
          icon={CheckCircle2}
          tone="emerald"
          hint={`${stats.analyseRate}% receive feedback`}
        />
        <KpiCard
          label="With error type"
          value={stats.withErrors}
          icon={AlertTriangle}
          tone="amber"
          hint={`${stats.classRate}% classified`}
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
          title="Last 14 days · uploads & errors"
          hint="Submissions arriving and errors detected per day."
          right={
            <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-cyan-500/10 px-2.5 py-1 text-[11px] text-cyan-300 ring-1 ring-cyan-500/20">
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
                  <linearGradient id="upU" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="upE" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="#fbbf24" stopOpacity={0} />
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
                  name="Uploads"
                  dataKey="uploads"
                  stroke="#22d3ee"
                  fill="url(#upU)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  name="Errors"
                  dataKey="errors"
                  stroke="#fbbf24"
                  fill="url(#upE)"
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
                    ? 'bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-500/40'
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
            <span className="ml-1 mr-1 text-[11px] uppercase tracking-wider text-slate-500">Status</span>
            {(
              [
                ['all', 'All'],
                ['analysed', 'AI-analysed'],
                ['errors', 'With errors'],
                ['pending', 'Awaiting feedback'],
              ] as [Status, string][]
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setStatus(k)}
                className={[
                  'rounded-full px-3 py-1.5 text-[12px] transition-colors',
                  status === k
                    ? 'bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/40'
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
        <Card className="lg:col-span-3">
          <SectionTitle
            title="Top error types in range"
            hint="What learners are getting wrong most often."
          />
          <div className="h-72 px-2 pb-3">
            {byError.length === 0 ? (
              <EmptyState title="No classified errors in this window" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={byError}
                  layout="vertical"
                  margin={{ left: 30, right: 12 }}
                >
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" stroke="#64748b" fontSize={11} allowDecimals={false} />
                  <YAxis
                    dataKey="type"
                    type="category"
                    stroke="#94a3b8"
                    fontSize={11}
                    width={160}
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
                    {byError.map((_, i) => (
                      <Cell
                        key={i}
                        fill={['#fbbf24', '#f87171', '#fb923c', '#a78bfa', '#22d3ee', '#34d399', '#60a5fa', '#c084fc'][i % 8]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <SectionTitle title="By subject" hint={`${bySubject.length} subjects represented`} />
          <div className="h-72 px-2 pb-3">
            {bySubject.length === 0 ? (
              <EmptyState title="No data" />
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
                  <Bar dataKey="count" fill="#22d3ee" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      {/* Top teachers */}
      {topTeachers.length > 0 && (
        <Card className="mt-5">
          <SectionTitle title="Top teachers uploading work" hint="In the selected range." />
          <ul className="grid gap-2 px-5 pb-4 md:grid-cols-2 lg:grid-cols-5">
            {topTeachers.map((t, i) => {
              const pct = Math.round((t.count / topTeacherMax) * 100);
              return (
                <li
                  key={t.name}
                  className="rounded-lg border border-slate-800/70 bg-slate-900/40 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm text-slate-100">
                      <span className="mr-1.5 text-slate-500">#{i + 1}</span>
                      {t.name}
                    </span>
                    <span className="text-xs font-semibold text-cyan-300 tabular-nums">
                      {t.count}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {/* Search + sort */}
      <Card className="mt-5 p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="w-full sm:w-80">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search student, teacher, subject, error…"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="mr-1 text-slate-500">Sort:</span>
            {(
              [
                ['newest', 'Newest'],
                ['oldest', 'Oldest'],
                ['student', 'Student'],
                ['teacher', 'Teacher'],
                ['error', 'Error type'],
              ] as [SortKey, string][]
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setSort(k)}
                className={[
                  'rounded-full px-3 py-1.5 transition-colors',
                  sort === k
                    ? 'bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-500/40'
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
            {filtered.length.toLocaleString()} of {list.length.toLocaleString()} uploads
          </span>
          <span className="hidden sm:inline">Click any row to preview the work and feedback</span>
        </div>
        {filtered.length === 0 ? (
          <EmptyState
            title="No uploads match this view"
            hint="Try a wider time range or clear the filters."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800/70 text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3">Student</th>
                  <th className="px-4 py-3">Teacher</th>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Error type</th>
                  <th className="px-4 py-3">Feedback excerpt</th>
                  <th className="px-4 py-3">Uploaded</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((w) => (
                  <tr
                    key={w.id}
                    onClick={() => setPreview(w)}
                    className="cursor-pointer border-b border-slate-800/40 transition-colors hover:bg-cyan-500/5"
                  >
                    <td className="px-5 py-3 text-slate-100">{w.student_name}</td>
                    <td className="px-4 py-3 text-slate-300">{w.teacher_name || '—'}</td>
                    <td className="px-4 py-3 text-slate-300">{w.subject || '—'}</td>
                    <td className="px-4 py-3">
                      {w.error_type ? (
                        <Badge tone="amber">{w.error_type}</Badge>
                      ) : w.feedback ? (
                        <Badge tone="emerald">Clean</Badge>
                      ) : (
                        <Badge tone="slate">
                          <Clock className="mr-1 inline h-2.5 w-2.5" /> Pending
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      <div className="line-clamp-2 max-w-md text-xs text-slate-400">
                        {stripMarkdown(w.feedback) || '—'}
                      </div>
                    </td>
                    <td
                      className="px-4 py-3 text-xs text-slate-400"
                      title={format(new Date(w.created_at), 'PPpp')}
                    >
                      {formatDistanceToNow(new Date(w.created_at), { addSuffix: true })}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreview(w);
                        }}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-cyan-300 hover:bg-cyan-500/10"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Preview modal */}
      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setPreview(null)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-cyan-500/20 bg-[#0a1410] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-5 py-4">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-100">
                  {preview.student_name}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                  <span>{preview.teacher_name || 'Unknown teacher'}</span>
                  {preview.subject && (
                    <>
                      <span>·</span>
                      <span>{preview.subject}</span>
                    </>
                  )}
                  {preview.grade && (
                    <>
                      <span>·</span>
                      <Badge tone="slate">{preview.grade}</Badge>
                    </>
                  )}
                  <span>·</span>
                  <span>{format(new Date(preview.created_at), 'MMM d, yyyy HH:mm')}</span>
                </div>
              </div>
              <button
                onClick={() => setPreview(null)}
                className="rounded-md px-2 py-1 text-sm text-slate-400 hover:bg-slate-800"
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {preview.image_url ? (
                <img
                  src={preview.image_url}
                  alt="Student work"
                  className="mb-4 max-h-[60vh] w-full rounded-lg border border-slate-800 object-contain"
                />
              ) : (
                <div className="mb-4 flex h-40 items-center justify-center rounded-lg border border-dashed border-slate-800 bg-slate-900/40 text-xs text-slate-500">
                  <ImageIconLucide className="mr-2 h-4 w-4" /> No image attached
                </div>
              )}
              {preview.error_type && (
                <div className="mb-3">
                  <Badge tone="amber">{preview.error_type}</Badge>
                </div>
              )}
              {preview.feedback && (
                <div className="mb-3 rounded-lg border border-slate-800/60 bg-slate-900/40 p-3 text-sm leading-relaxed text-slate-200 whitespace-pre-wrap">
                  <div className="mb-1 text-[11px] uppercase tracking-wider text-slate-500">
                    AI feedback
                  </div>
                  {stripMarkdown(preview.feedback)}
                </div>
              )}
              {preview.remediation && (
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm leading-relaxed text-emerald-100 whitespace-pre-wrap">
                  <div className="mb-1 text-[11px] uppercase tracking-wider text-emerald-300">
                    Suggested remediation
                  </div>
                  {stripMarkdown(preview.remediation)}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MonitorUploads;
