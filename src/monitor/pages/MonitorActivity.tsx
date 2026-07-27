import { useMemo, useState } from 'react';
import {
  Activity,
  UserPlus,
  GraduationCap,
  BookOpen,
  ClipboardList,
  FileText,
  MessageSquare,
  Filter,
  Calendar,
} from 'lucide-react';
import { formatDistanceToNow, format, startOfDay, isToday, isYesterday, subDays } from 'date-fns';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { PageHeader, Card, LoadingState, EmptyState, Badge, SearchInput, KpiCard, SectionTitle } from '../components/ui';
import { getUserActivity, type ActivityItem } from '../services/monitorData';
import { useLiveData } from '../hooks/useLiveData';
import LiveIndicator from '../components/LiveIndicator';
import ExportMenu from '../components/ExportMenu';
import type { ExportPayload } from '../utils/exporters';

type ActivityType = ActivityItem['type'];

const TYPE_META: Record<
  ActivityType,
  { label: string; tone: 'cyan' | 'emerald' | 'violet' | 'amber' | 'rose' | 'sky'; icon: React.ComponentType<{ className?: string }>; chartColor: string }
> = {
  teacher_signup:  { label: 'Sign up',     tone: 'cyan',    icon: UserPlus,      chartColor: '#22d3ee' },
  student_created: { label: 'Learner',     tone: 'emerald', icon: GraduationCap, chartColor: '#34d399' },
  lesson_plan:     { label: 'Lesson plan', tone: 'violet',  icon: BookOpen,      chartColor: '#a78bfa' },
  assignment:      { label: 'Assignment',  tone: 'amber',   icon: ClipboardList, chartColor: '#fbbf24' },
  submission:      { label: 'Submission',  tone: 'sky',     icon: FileText,      chartColor: '#38bdf8' },
  chat:            { label: 'Chatbot',     tone: 'rose',    icon: MessageSquare, chartColor: '#fb7185' },
};

const FILTERS: { key: ActivityType | 'all'; label: string }[] = [
  { key: 'all',             label: 'All events' },
  { key: 'teacher_signup',  label: 'Sign-ups' },
  { key: 'student_created', label: 'Learners' },
  { key: 'lesson_plan',     label: 'Lesson plans' },
  { key: 'assignment',      label: 'Assignments' },
  { key: 'submission',      label: 'Submissions' },
  { key: 'chat',            label: 'Chatbot' },
];

type RangeKey = '24h' | '7d' | '30d' | 'all';
const RANGES: { key: RangeKey; label: string; ms: number | null }[] = [
  { key: '24h', label: 'Last 24h', ms: 24 * 3600 * 1000 },
  { key: '7d',  label: 'Last 7d',  ms: 7  * 24 * 3600 * 1000 },
  { key: '30d', label: 'Last 30d', ms: 30 * 24 * 3600 * 1000 },
  { key: 'all', label: 'All time', ms: null },
];

const MonitorActivity = () => {
  const { data: activities = [], loading, refreshing, paused, setPaused, lastUpdated, refresh } =
    useLiveData<ActivityItem[]>(() => getUserActivity(), { intervalMs: 25_000 });

  const [filter, setFilter] = useState<ActivityType | 'all'>('all');
  const [range, setRange] = useState<RangeKey>('all');
  const [search, setSearch] = useState('');
  const list = activities ?? [];

  const rangeFiltered = useMemo(() => {
    const r = RANGES.find((x) => x.key === range);
    if (!r || r.ms === null) return list;
    const cutoff = Date.now() - r.ms;
    return list.filter((a) => new Date(a.created_at).getTime() >= cutoff);
  }, [list, range]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rangeFiltered.filter((a) => {
      if (filter !== 'all' && a.type !== filter) return false;
      if (!term) return true;
      return (
        a.description.toLowerCase().includes(term) ||
        (a.user_name ?? '').toLowerCase().includes(term)
      );
    });
  }, [rangeFiltered, filter, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    rangeFiltered.forEach((a) => { c[a.type] = (c[a.type] ?? 0) + 1; });
    return c;
  }, [rangeFiltered]);

  /** Chart series: hourly buckets for fixed windows; daily buckets for all-time (last 365d). */
  const chartSeries = useMemo(() => {
    const r = RANGES.find((x) => x.key === range);
    if (r?.ms === null) {
      const buckets: Record<string, { ts: number; label: string; count: number }> = {};
      for (let i = 364; i >= 0; i--) {
        const d = startOfDay(subDays(new Date(), i));
        const key = format(d, 'yyyy-MM-dd');
        buckets[key] = { ts: d.getTime(), label: format(d, 'MMM d'), count: 0 };
      }
      rangeFiltered.forEach((a) => {
        const key = format(startOfDay(new Date(a.created_at)), 'yyyy-MM-dd');
        if (buckets[key]) buckets[key].count++;
      });
      return Object.values(buckets).sort((a, b) => a.ts - b.ts);
    }
    const buckets: Record<string, { ts: number; label: string; count: number }> = {};
    const now = Date.now();
    const lookbackHours = Math.min(24 * 30, (r?.ms ?? 24 * 3600000) / 3600000);
    for (let i = lookbackHours - 1; i >= 0; i--) {
      const ts = now - i * 3600000;
      const d = new Date(ts);
      const key = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}h`;
      buckets[key] = { ts, label: key, count: 0 };
    }
    rangeFiltered.forEach((a) => {
      const d = new Date(a.created_at);
      const key = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}h`;
      if (buckets[key]) buckets[key].count++;
    });
    return Object.values(buckets);
  }, [rangeFiltered, range]);

  // Top contributors in current range
  const topContributors = useMemo(() => {
    const m = new Map<string, number>();
    rangeFiltered.forEach((a) => {
      if (!a.user_name) return;
      m.set(a.user_name, (m.get(a.user_name) ?? 0) + 1);
    });
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [rangeFiltered]);

  // Group filtered by day for the timeline
  const grouped = useMemo(() => {
    const map = new Map<string, ActivityItem[]>();
    filtered.forEach((a) => {
      const day = startOfDay(new Date(a.created_at)).toISOString();
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(a);
    });
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [filtered]);

  const dayLabel = (iso: string) => {
    const d = new Date(iso);
    if (isToday(d)) return 'Today';
    if (isYesterday(d)) return 'Yesterday';
    return format(d, 'EEEE, MMMM d');
  };

  const buildExportPayload = (): ExportPayload => ({
    fileStem: `qeda-activity-log-${range}`,
    title: 'QEDA Education Monitor — Activity Log',
    subtitle: `${RANGES.find((r) => r.key === range)?.label}${filter !== 'all' ? ` · ${TYPE_META[filter].label}` : ''}${search ? ` · "${search}"` : ''}`,
    summary:
      `${filtered.length.toLocaleString()} events captured. ` +
      `${counts['teacher_signup'] ?? 0} sign-ups, ${counts['student_created'] ?? 0} learners added, ` +
      `${counts['lesson_plan'] ?? 0} lesson plans, ${counts['assignment'] ?? 0} assignments, ` +
      `${counts['submission'] ?? 0} submissions, ${counts['chat'] ?? 0} chatbot interactions.`,
    kpis: [
      { label: 'Total events',  value: filtered.length },
      { label: 'Sign-ups',      value: counts['teacher_signup']  ?? 0 },
      { label: 'Learners',      value: counts['student_created'] ?? 0 },
      { label: 'Lesson plans',  value: counts['lesson_plan']     ?? 0 },
      { label: 'Assignments',   value: counts['assignment']      ?? 0 },
      { label: 'Submissions',   value: counts['submission']      ?? 0 },
      { label: 'Chat events',   value: counts['chat']            ?? 0 },
      { label: 'Unique actors', value: new Set(filtered.map((a) => a.user_name).filter(Boolean)).size },
    ],
    tables: [
      {
        title: 'Activity timeline',
        columns: ['Timestamp', 'Type', 'Actor', 'Description'],
        rows: filtered.map((a) => [
          format(new Date(a.created_at), 'yyyy-MM-dd HH:mm'),
          TYPE_META[a.type]?.label ?? a.type,
          a.user_name ?? '—',
          a.description,
        ]),
      },
      {
        title: 'Top contributors in range',
        columns: ['Actor', 'Events'],
        rows: topContributors.map(([name, n]) => [name, n]),
      },
    ],
  });

  return (
    <>
      <PageHeader
        title="Activity log"
        icon={Activity}
        subtitle="Full history of teacher-side events in Nigeria scope: sign-ups, learners, lesson plans, assignments, submissions, and every chatbot message."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <LiveIndicator
              lastUpdated={lastUpdated}
              refreshing={refreshing}
              paused={paused}
              onTogglePause={() => setPaused(!paused)}
              onRefresh={refresh}
              intervalMs={25_000}
            />
            <ExportMenu build={buildExportPayload} disabled={loading} />
          </div>
        }
      />

      {/* KPI strip */}
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Events in range" value={rangeFiltered.length} icon={Activity}      tone="emerald" />
        <KpiCard label="Sign-ups"        value={counts['teacher_signup']  ?? 0} icon={UserPlus}      tone="cyan"    />
        <KpiCard label="Lesson plans"    value={counts['lesson_plan']     ?? 0} icon={BookOpen}      tone="violet"  />
        <KpiCard label="Submissions"     value={counts['submission']      ?? 0} icon={FileText}      tone="sky"     />
      </div>

      {/* Hourly chart */}
      <Card className="mb-5">
        <SectionTitle
          title="Activity rhythm"
          hint={
            range === 'all'
              ? 'Daily event volume for the last 365 days (list and exports respect full all-time data).'
              : 'Hourly event volume across the selected range.'
          }
          right={
            <div className="flex items-center gap-1.5 rounded-md border border-slate-800 bg-slate-900/40 p-0.5">
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setRange(r.key)}
                  className={[
                    'rounded px-2.5 py-1 text-[11px] font-medium transition-colors',
                    range === r.key ? 'bg-emerald-500/20 text-emerald-200' : 'text-slate-400 hover:text-slate-200',
                  ].join(' ')}
                >{r.label}</button>
              ))}
            </div>
          }
        />
        <div className="h-44 px-2 pb-3">
          {chartSeries.every((h) => h.count === 0) ? (
            <div className="flex h-full items-center justify-center text-xs text-slate-500">No activity in this window</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartSeries} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="actGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"  stopColor="#34d399" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                <XAxis dataKey="label" stroke="#64748b" fontSize={10} interval="preserveStartEnd" tick={{ dy: 4 }} />
                <YAxis stroke="#64748b" fontSize={10} allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#0b1020', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="count" stroke="#34d399" fill="url(#actGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* Filter + search bar */}
      <Card className="mb-5 p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            <Filter className="ml-1 mr-1 h-3.5 w-3.5 text-slate-500" />
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={[
                  'rounded-full px-3 py-1.5 text-[12px] transition-colors',
                  filter === f.key
                    ? 'bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/40'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100',
                ].join(' ')}
              >
                {f.label}
                {f.key !== 'all' && counts[f.key] != null && (
                  <span className="ml-1.5 text-slate-500">· {counts[f.key]}</span>
                )}
              </button>
            ))}
          </div>
          <div className="w-full lg:w-72">
            <SearchInput value={search} onChange={setSearch} placeholder="Search by teacher or description…" />
          </div>
        </div>
      </Card>

      {/* Top contributors */}
      {topContributors.length > 0 && (
        <Card className="mb-5">
          <SectionTitle title="Top contributors in range" hint="Most active teachers in the current range filter." />
          <div className="px-5 pb-4 pt-1">
            <ul className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {topContributors.map(([name, n], i) => {
                const pct = Math.round((n / topContributors[0][1]) * 100);
                return (
                  <li key={name} className="rounded-lg border border-slate-800/70 bg-slate-900/40 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm text-slate-100">
                        <span className="mr-1.5 text-slate-500">#{i + 1}</span>{name}
                      </span>
                      <span className="text-xs font-semibold text-emerald-300 tabular-nums">{n} events</span>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                      <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-amber-400" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </Card>
      )}

      {/* Timeline grouped by day */}
      {loading ? (
        <LoadingState label="Pulling latest activity…" />
      ) : filtered.length === 0 ? (
        <Card><EmptyState title="No matching activity" hint="Try clearing filters or expanding the time range." /></Card>
      ) : (
        <div className="space-y-5">
          {grouped.map(([day, items]) => (
            <Card key={day}>
              <div className="flex items-center justify-between border-b border-slate-800/60 px-5 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                  <Calendar className="h-4 w-4 text-emerald-400" />
                  {dayLabel(day)}
                </div>
                <div className="text-[11px] text-slate-500">{items.length} {items.length === 1 ? 'event' : 'events'}</div>
              </div>
              <ul className="divide-y divide-slate-800/70">
                {items.map((a) => {
                  const meta = TYPE_META[a.type] ?? TYPE_META.chat;
                  const Icon = meta.icon;
                  return (
                    <li key={a.id} className="group flex items-start gap-3 px-4 py-3 sm:px-5 sm:py-4 hover:bg-slate-800/30">
                      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-800/60 ring-1 ring-slate-700/60 group-hover:ring-emerald-500/40 transition-all">
                        <Icon className="h-4 w-4 text-slate-200" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <Badge tone={meta.tone}>{meta.label}</Badge>
                          {a.user_name && (
                            <span className="text-xs text-slate-400">by <span className="text-slate-200">{a.user_name}</span></span>
                          )}
                        </div>
                        <div className="text-sm text-slate-100">{a.description}</div>
                      </div>
                      <div className="hidden text-right text-[11px] text-slate-500 sm:block">
                        <div>{formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</div>
                        <div className="text-slate-600">{format(new Date(a.created_at), 'HH:mm')}</div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </>
  );
};

export default MonitorActivity;
