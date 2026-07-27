import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  ArrowUpRight,
  MapPin,
  School2,
  Trophy,
  TrendingUp,
  Flame,
  Snowflake,
  Power,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { Card, PageHeader, LoadingState, EmptyState, Badge, SearchInput, KpiCard, SectionTitle } from '../components/ui';
import { getAllTeachers } from '../services/monitorData';
import type { TeacherStats } from '@/types/admin';
import { useLiveData } from '../hooks/useLiveData';
import LiveIndicator from '../components/LiveIndicator';
import ExportMenu from '../components/ExportMenu';
import type { ExportPayload } from '../utils/exporters';

type SortKey = 'name' | 'students' | 'lesson_plans' | 'assignments' | 'messages' | 'joined' | 'engagement' | 'recent';
type EngagementBucket = 'all' | 'active7' | 'active30' | 'dormant' | 'new';

const computeEngagementScore = (t: TeacherStats): number => {
  const s = (t.total_students ?? 0) * 1;
  const lp = (t.total_lesson_plans ?? 0) * 2;
  const a = (t.total_assignments ?? 0) * 2;
  const m = (t.total_chatbot_messages ?? 0) * 0.25;
  return Math.round(s + lp + a + m);
};

const MonitorTeachers = () => {
  const { data: teachers = [], loading, refreshing, paused, setPaused, lastUpdated, refresh } =
    useLiveData<TeacherStats[]>(() => getAllTeachers(), { intervalMs: 60_000 });
  const list = teachers ?? [];

  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('engagement');
  const [bucket, setBucket] = useState<EngagementBucket>('all');

  // Decorate teachers with computed engagement score & last-active proxy
  const enriched = useMemo(() => {
    return list.map((t) => ({
      ...t,
      score: computeEngagementScore(t),
      isActive7:  t.updated_at ? new Date(t.updated_at) >= subDays(new Date(), 7) : false,
      isActive30: t.updated_at ? new Date(t.updated_at) >= subDays(new Date(), 30) : false,
      isNew:      t.created_at ? new Date(t.created_at) >= subDays(new Date(), 14) : false,
    }));
  }, [list]);

  // Top-line stats
  const stats = useMemo(() => {
    const total = enriched.length;
    const active7 = enriched.filter((t) => t.isActive7).length;
    const active30 = enriched.filter((t) => t.isActive30).length;
    const dormant = total - active30;
    const newOnes = enriched.filter((t) => t.isNew).length;
    const avgStudents = total ? Math.round(enriched.reduce((s, t) => s + (t.total_students ?? 0), 0) / total) : 0;
    const totalStudents = enriched.reduce((s, t) => s + (t.total_students ?? 0), 0);
    const totalLessonPlans = enriched.reduce((s, t) => s + (t.total_lesson_plans ?? 0), 0);
    return { total, active7, active30, dormant, newOnes, avgStudents, totalStudents, totalLessonPlans };
  }, [enriched]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    let arr = enriched;
    if (bucket === 'active7')  arr = arr.filter((t) => t.isActive7);
    if (bucket === 'active30') arr = arr.filter((t) => t.isActive30 && !t.isActive7);
    if (bucket === 'dormant')  arr = arr.filter((t) => !t.isActive30);
    if (bucket === 'new')      arr = arr.filter((t) => t.isNew);
    if (term) {
      arr = arr.filter((t) =>
        [t.full_name, t.email, t.school_name, t.country, t.city, t.gender]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(term)),
      );
    }
    const cmp = (a: typeof arr[0], b: typeof arr[0]): number => {
      switch (sort) {
        case 'name':         return (a.full_name || '').localeCompare(b.full_name || '');
        case 'students':     return (b.total_students || 0) - (a.total_students || 0);
        case 'lesson_plans': return (b.total_lesson_plans || 0) - (a.total_lesson_plans || 0);
        case 'assignments':  return (b.total_assignments || 0) - (a.total_assignments || 0);
        case 'messages':     return (b.total_chatbot_messages || 0) - (a.total_chatbot_messages || 0);
        case 'joined':       return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'recent':       return new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime();
        case 'engagement':   return b.score - a.score;
      }
    };
    return [...arr].sort(cmp);
  }, [enriched, search, sort, bucket]);

  const top5 = useMemo(
    () => [...enriched].sort((a, b) => b.score - a.score).slice(0, 5),
    [enriched],
  );
  const maxScore = top5[0]?.score ?? 1;

  const buildExportPayload = (): ExportPayload => ({
    fileStem: `qeda-teachers${bucket !== 'all' ? `-${bucket}` : ''}`,
    title: 'QEDA Education Monitor — Teachers',
    subtitle: `Showing ${filtered.length} of ${enriched.length} teachers${bucket !== 'all' ? ` · ${bucket}` : ''}${search ? ` · "${search}"` : ''}`,
    summary:
      `Active in last 7 days: ${stats.active7}. Active in last 30 days: ${stats.active30}. ` +
      `Dormant (>30 days): ${stats.dormant}. New (last 14 days): ${stats.newOnes}. ` +
      `Average students per teacher: ${stats.avgStudents}.`,
    kpis: [
      { label: 'Teachers',        value: stats.total },
      { label: 'Active · 7d',     value: stats.active7 },
      { label: 'Active · 30d',    value: stats.active30 },
      { label: 'Dormant',         value: stats.dormant },
      { label: 'New (14d)',       value: stats.newOnes },
      { label: 'Total students',  value: stats.totalStudents },
      { label: 'Lesson plans',    value: stats.totalLessonPlans },
      { label: 'Avg students/teacher', value: stats.avgStudents },
    ],
    tables: [
      {
        title: 'Teacher roster',
        columns: ['Name', 'Email', 'School', 'City', 'Country', 'Students', 'Lesson plans', 'Assignments', 'Chat msgs', 'Engagement', 'Joined'],
        rows: filtered.map((t) => [
          t.full_name ?? 'Unnamed',
          t.email ?? '—',
          t.school_name ?? '—',
          t.city ?? '—',
          t.country ?? '—',
          t.total_students ?? 0,
          t.total_lesson_plans ?? 0,
          t.total_assignments ?? 0,
          t.total_chatbot_messages ?? 0,
          t.score,
          t.created_at ? format(new Date(t.created_at), 'yyyy-MM-dd') : '—',
        ]),
      },
      {
        title: 'Top 5 by engagement score',
        note: 'Engagement = students + 2× lesson plans + 2× assignments + 0.25× chat messages.',
        columns: ['Rank', 'Teacher', 'School', 'Score'],
        rows: top5.map((t, i) => [i + 1, t.full_name ?? '—', t.school_name ?? '—', t.score]),
      },
    ],
  });

  const buckets: { key: EngagementBucket; label: string; icon: React.ElementType; tone: string }[] = [
    { key: 'all',      label: 'All',         icon: Users,    tone: 'cyan' },
    { key: 'active7',  label: 'Active · 7d', icon: Wifi,     tone: 'emerald' },
    { key: 'active30', label: 'Active · 30d',icon: TrendingUp, tone: 'sky' },
    { key: 'dormant',  label: 'Dormant',     icon: WifiOff,  tone: 'amber' },
    { key: 'new',      label: 'New (14d)',   icon: Power,    tone: 'violet' },
  ];

  return (
    <>
      <PageHeader
        title="Teachers"
        icon={Users}
        subtitle="Every teacher in the platform with their per-feature activity. Click a row to open a full monitoring profile."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <LiveIndicator
              lastUpdated={lastUpdated}
              refreshing={refreshing}
              paused={paused}
              onTogglePause={() => setPaused(!paused)}
              onRefresh={refresh}
              intervalMs={60_000}
            />
            <ExportMenu build={buildExportPayload} disabled={loading} />
          </div>
        }
      />

      {/* KPI strip */}
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Teachers"      value={stats.total}    icon={Users}     tone="cyan"    />
        <KpiCard label="Active · 7d"   value={stats.active7}  icon={Flame}     tone="emerald" hint={`${stats.total ? Math.round((stats.active7 / stats.total) * 100) : 0}% of all`} />
        <KpiCard label="Dormant >30d"  value={stats.dormant}  icon={Snowflake} tone="amber"   hint="At-risk · need outreach" />
        <KpiCard label="New (14d)"     value={stats.newOnes}  icon={TrendingUp} tone="violet" />
      </div>

      {/* Top performers */}
      {top5.length > 0 && (
        <Card className="mb-5">
          <SectionTitle
            title="Top 5 by engagement"
            hint="Score = students + 2× lesson plans + 2× assignments + 0.25× chat messages"
            right={<Trophy className="h-4 w-4 text-amber-400" />}
          />
          <div className="grid gap-2 px-5 pb-4 lg:grid-cols-5 md:grid-cols-3 grid-cols-2">
            {top5.map((t, i) => (
              <Link key={t.id} to={`/monitor/teachers/${t.id}`} className="rounded-lg border border-slate-800/70 bg-gradient-to-br from-slate-900/70 to-slate-900/30 p-3 hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-all">
                <div className="flex items-center gap-2">
                  <span className={['flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold', i === 0 ? 'bg-amber-500 text-amber-950' : i === 1 ? 'bg-slate-300 text-slate-900' : i === 2 ? 'bg-orange-700 text-white' : 'bg-slate-700 text-slate-300'].join(' ')}>
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-slate-100">{t.full_name || 'Unnamed'}</div>
                    <div className="truncate text-[11px] text-slate-500">{t.school_name || '—'}</div>
                  </div>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-amber-400" style={{ width: `${(t.score / maxScore) * 100}%` }} />
                </div>
                <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500">
                  <span>Score</span>
                  <span className="font-semibold text-emerald-300 tabular-nums">{t.score}</span>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      )}

      {/* Filter bar */}
      <Card className="mb-5 p-3">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {buckets.map((b) => (
              <button
                key={b.key}
                onClick={() => setBucket(b.key)}
                className={[
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] transition-colors',
                  bucket === b.key
                    ? 'bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/40'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100',
                ].join(' ')}
              >
                <b.icon className="h-3 w-3" />
                {b.label}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="w-full sm:w-80">
              <SearchInput value={search} onChange={setSearch} placeholder="Search by name, email, school, city, country…" />
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="mr-1 text-slate-500">Sort:</span>
              {([
                ['engagement', 'Engagement'],
                ['recent', 'Recently active'],
                ['students', 'Most students'],
                ['lesson_plans', 'Lesson plans'],
                ['assignments', 'Assignments'],
                ['messages', 'Chat msgs'],
                ['joined', 'Newest'],
                ['name', 'A→Z'],
              ] as [SortKey, string][]).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setSort(k)}
                  className={[
                    'rounded-full px-3 py-1.5 transition-colors',
                    sort === k
                      ? 'bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-500/40'
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100',
                  ].join(' ')}
                >{label}</button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {loading ? (
        <LoadingState label="Loading teachers…" />
      ) : filtered.length === 0 ? (
        <Card><EmptyState title="No teachers match this search" /></Card>
      ) : (
        <Card>
          <div className="flex items-center justify-between border-b border-slate-800/70 px-5 py-3 text-[11px] text-slate-500">
            <span>{filtered.length} of {enriched.length} teachers</span>
            <span className="hidden sm:inline">Click any row to open the full profile</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800/70 text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3 sm:px-5">Teacher</th>
                  <th className="px-4 py-3">School / Location</th>
                  <th className="px-4 py-3 text-right">Students</th>
                  <th className="px-4 py-3 text-right">Lessons</th>
                  <th className="px-4 py-3 text-right">Assign.</th>
                  <th className="px-4 py-3 text-right">Chats</th>
                  <th className="px-4 py-3 text-right">Score</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Joined</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id} className="border-b border-slate-800/40 hover:bg-emerald-500/5 transition-colors">
                    <td className="px-4 py-3 sm:px-5">
                      <Link to={`/monitor/teachers/${t.id}`} className="block">
                        <div className="font-medium text-slate-100">{t.full_name || 'Unnamed teacher'}</div>
                        <div className="text-xs text-slate-500">{t.email}</div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {t.account_status && t.account_status !== 'active' && (
                            <Badge tone={t.account_status === 'paused' ? 'amber' : 'rose'}>{t.account_status}</Badge>
                          )}
                          {t.gender && <Badge tone="slate">{t.gender}</Badge>}
                          {t.isNew && <Badge tone="violet">new</Badge>}
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-xs text-slate-300">
                        <School2 className="h-3.5 w-3.5 text-slate-500" />
                        <span className="truncate">{t.school_name || '—'}</span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500">
                        <MapPin className="h-3 w-3" />
                        {[t.city, t.country].filter(Boolean).join(', ') || '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-100">{t.total_students ?? 0}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-100">{t.total_lesson_plans ?? 0}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-100">{t.total_assignments ?? 0}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-100">{t.total_chatbot_messages ?? 0}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span className="font-semibold text-emerald-300">{t.score}</span>
                    </td>
                    <td className="px-4 py-3">
                      {t.isActive7 ? (
                        <Badge tone="emerald">Active 7d</Badge>
                      ) : t.isActive30 ? (
                        <Badge tone="sky">Active 30d</Badge>
                      ) : (
                        <Badge tone="amber">Dormant</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {t.created_at ? format(new Date(t.created_at), 'MMM d, yyyy') : '—'}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Link
                        to={`/monitor/teachers/${t.id}`}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-emerald-300 hover:bg-emerald-500/10"
                      >
                        Open <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
};

export default MonitorTeachers;
