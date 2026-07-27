import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  UsersRound,
  GraduationCap,
  UploadCloud,
  Bell,
  MessageSquare,
  Filter,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  FileText,
  School2,
} from 'lucide-react';
import { format, subDays } from 'date-fns';
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
import type {
  StudentStats,
  SubmissionStats,
  StudentWorkStats,
  NotificationStats,
  CommentStats,
} from '@/types/admin';
import {
  getLearnerParentMonitorBundle,
  type LearnerParentMonitorBundle,
} from '../services/monitorData';
import { useLiveData } from '../hooks/useLiveData';
import LiveIndicator from '../components/LiveIndicator';
import ExportMenu from '../components/ExportMenu';
import type { ExportPayload } from '../utils/exporters';

type RangeKey = '7d' | '30d' | '90d' | 'all';
const RANGES: { key: RangeKey; label: string; ms: number | null }[] = [
  { key: '7d', label: 'Last 7d', ms: 7 * 24 * 3600 * 1000 },
  { key: '30d', label: 'Last 30d', ms: 30 * 24 * 3600 * 1000 },
  { key: '90d', label: 'Last 90d', ms: 90 * 24 * 3600 * 1000 },
  { key: 'all', label: 'All time', ms: null },
];

const FOURTEEN_DAYS_MS = 14 * 86400000;

type SortKey =
  | 'newest'
  | 'oldest'
  | 'name'
  | 'teacher'
  | 'grade'
  | 'submissions'
  | 'uploads'
  | 'score'
  | 'activity';

const BAR_COLORS = ['#34d399', '#22d3ee', '#a78bfa', '#fbbf24', '#fb7185', '#60a5fa', '#4ade80', '#f97316'];

const MonitorLearnersParents = () => {
  const { data, loading, refreshing, paused, setPaused, lastUpdated, error, refresh } =
    useLiveData<LearnerParentMonitorBundle>(() => getLearnerParentMonitorBundle(), {
      intervalMs: 45_000,
    });

  const students = data?.students ?? [];
  const submissions = data?.submissions ?? [];
  const works = data?.works ?? [];
  const notifications = data?.notifications ?? [];
  const comments = data?.comments ?? [];

  const [range, setRange] = useState<RangeKey>('30d');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('newest');
  const [gradeFilter, setGradeFilter] = useState<string | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | StudentStats['account_status']>('all');

  const studentIds = useMemo(() => new Set(students.map((s) => s.id)), [students]);

  const nameToStudentId = useMemo(() => {
    const m = new Map<string, string>();
    students.forEach((s) => {
      m.set(s.full_name.trim().toLowerCase(), s.id);
    });
    return m;
  }, [students]);

  const uploadCountByStudent = useMemo(() => {
    const c = new Map<string, number>();
    works.forEach((w) => {
      const sid = nameToStudentId.get((w.student_name || '').trim().toLowerCase());
      if (sid) c.set(sid, (c.get(sid) ?? 0) + 1);
    });
    return c;
  }, [works, nameToStudentId]);

  const notifCountByStudent = useMemo(() => {
    const c = new Map<string, number>();
    notifications.forEach((n) => {
      if (n.recipient_student_id && studentIds.has(n.recipient_student_id)) {
        c.set(n.recipient_student_id, (c.get(n.recipient_student_id) ?? 0) + 1);
      }
    });
    return c;
  }, [notifications, studentIds]);

  const commentCountByStudent = useMemo(() => {
    const c = new Map<string, number>();
    comments.forEach((cm) => {
      if (cm.student_id && studentIds.has(cm.student_id)) {
        c.set(cm.student_id, (c.get(cm.student_id) ?? 0) + 1);
      }
    });
    return c;
  }, [comments, studentIds]);

  const rangeFilteredStudents = useMemo(() => {
    const r = RANGES.find((x) => x.key === range);
    if (!r || r.ms === null) return students;
    const cutoff = Date.now() - r.ms;
    return students.filter((s) => new Date(s.created_at).getTime() >= cutoff);
  }, [students, range]);

  const rangeFilteredSubs = useMemo(() => {
    const r = RANGES.find((x) => x.key === range);
    if (!r || r.ms === null) return submissions;
    const cutoff = Date.now() - r.ms;
    return submissions.filter(
      (s) => s.submitted_at && new Date(s.submitted_at).getTime() >= cutoff,
    );
  }, [submissions, range]);

  const stats = useMemo(() => {
    const total = students.length;
    const active = students.filter((s) => s.account_status === 'active').length;
    const pausedAcc = students.filter((s) => s.account_status === 'paused').length;
    const suspended = students.filter((s) => s.account_status === 'suspended').length;
    const subsInRange = rangeFilteredSubs.filter((s) => studentIds.has(s.student_id)).length;
    const scored = students.filter((s) => s.average_score != null);
    const avgLearnerScore = scored.length
      ? Math.round(
          scored.reduce((sum, s) => sum + (s.average_score as number), 0) / scored.length,
        )
      : null;
    const studentNotifs = notifications.filter(
      (n) => n.recipient_student_id && studentIds.has(n.recipient_student_id),
    ).length;
    const studentComments = comments.filter(
      (c) => c.student_id && studentIds.has(c.student_id),
    ).length;
    const now = Date.now();
    const week = now - 7 * 86400000;
    const prevWeek = now - 14 * 86400000;
    const thisWeek = students.filter((s) => new Date(s.created_at).getTime() >= week).length;
    const lastWeek = students.filter((s) => {
      const t = new Date(s.created_at).getTime();
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
      total,
      active,
      pausedAcc,
      suspended,
      subsInRange,
      avgLearnerScore,
      studentNotifs,
      studentComments,
      thisWeek,
      lastWeek,
      delta,
      uploadsMatched: [...uploadCountByStudent.values()].reduce((a, b) => a + b, 0),
    };
  }, [
    students,
    rangeFilteredSubs,
    studentIds,
    notifications,
    comments,
    uploadCountByStudent,
  ]);

  const byGrade = useMemo(() => {
    const m = new Map<string, number>();
    rangeFilteredStudents.forEach((s) => {
      const g = s.grade_level || 'Unknown';
      m.set(g, (m.get(g) ?? 0) + 1);
    });
    return [...m.entries()]
      .map(([grade, count]) => ({ grade, count }))
      .sort((a, b) => b.count - a.count);
  }, [rangeFilteredStudents]);

  const teachersByRoster = useMemo(() => {
    const m = new Map<string, { name: string; count: number }>();
    students.forEach((s) => {
      const tid = s.teacher_id;
      const name = s.teacher_name || 'Unknown teacher';
      const cur = m.get(tid) ?? { name, count: 0 };
      cur.count += 1;
      m.set(tid, cur);
    });
    return [...m.entries()]
      .map(([teacherId, v]) => ({ teacherId, ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);
  }, [students]);

  const dailyTrend = useMemo(() => {
    const days: Record<string, { date: string; newLearners: number; submissions: number }> = {};
    for (let i = 13; i >= 0; i--) {
      const d = subDays(new Date(), i);
      const key = format(d, 'MMM d');
      days[key] = { date: key, newLearners: 0, submissions: 0 };
    }
    const cut = Date.now() - FOURTEEN_DAYS_MS;
    students.forEach((s) => {
      const t = new Date(s.created_at).getTime();
      if (t < cut) return;
      const key = format(new Date(s.created_at), 'MMM d');
      if (days[key]) days[key].newLearners += 1;
    });
    submissions.forEach((s) => {
      if (!s.submitted_at || !studentIds.has(s.student_id)) return;
      const t = new Date(s.submitted_at).getTime();
      if (t < cut) return;
      const key = format(new Date(s.submitted_at), 'MMM d');
      if (days[key]) days[key].submissions += 1;
    });
    return Object.values(days);
  }, [students, submissions, studentIds]);

  const allGrades = useMemo(
    () => [...new Set(students.map((s) => s.grade_level).filter(Boolean))].sort() as string[],
    [students],
  );

  const enrichedRows = useMemo(() => {
    return students.map((s) => ({
      ...s,
      uploads: uploadCountByStudent.get(s.id) ?? 0,
      notifs: notifCountByStudent.get(s.id) ?? 0,
      assignmentComments: commentCountByStudent.get(s.id) ?? 0,
    }));
  }, [students, uploadCountByStudent, notifCountByStudent, commentCountByStudent]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    let arr = enrichedRows;
    if (gradeFilter !== 'all') arr = arr.filter((s) => s.grade_level === gradeFilter);
    if (statusFilter !== 'all') arr = arr.filter((s) => s.account_status === statusFilter);
    if (term) {
      arr = arr.filter(
        (s) =>
          (s.full_name || '').toLowerCase().includes(term) ||
          (s.teacher_name || '').toLowerCase().includes(term) ||
          (s.grade_level || '').toLowerCase().includes(term),
      );
    }
    const cmp = (a: (typeof enrichedRows)[0], b: (typeof enrichedRows)[0]): number => {
      switch (sort) {
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'name':
          return (a.full_name || '').localeCompare(b.full_name || '');
        case 'teacher':
          return (a.teacher_name || '').localeCompare(b.teacher_name || '');
        case 'grade':
          return (a.grade_level || '').localeCompare(b.grade_level || '');
        case 'submissions':
          return b.total_submissions - a.total_submissions;
        case 'uploads':
          return b.uploads - a.uploads;
        case 'score':
          return (b.average_score ?? -1) - (a.average_score ?? -1);
        case 'activity':
          return (
            new Date(b.last_activity || b.created_at).getTime() -
            new Date(a.last_activity || a.created_at).getTime()
          );
      }
    };
    return [...arr].sort(cmp);
  }, [enrichedRows, search, sort, gradeFilter, statusFilter]);

  const recentStudentNotifs = useMemo(() => {
    return [...notifications]
      .filter((n) => n.recipient_student_id && studentIds.has(n.recipient_student_id))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 18);
  }, [notifications, studentIds]);

  const buildExportPayload = (): ExportPayload => ({
    fileStem: `qeda-learners-parents-${range}`,
    title: 'QEDA Education Monitor — Learners & parent dashboards',
    subtitle: `${RANGES.find((r) => r.key === range)?.label} · ${students.length.toLocaleString()} learner accounts (Nigeria scope)`,
    summary:
      `${stats.total.toLocaleString()} learner profiles linked to Nigerian teachers. ` +
      `${stats.active} active, ${stats.pausedAcc} paused, ${stats.suspended} suspended. ` +
      `${stats.subsInRange.toLocaleString()} assignment submissions in range. ` +
      `${stats.studentNotifs.toLocaleString()} in-app notifications addressed to learners. ` +
      `${stats.uploadsMatched.toLocaleString()} homework uploads matched to a roster name.`,
    kpis: [
      { label: 'Learners', value: stats.total },
      { label: 'Active accounts', value: stats.active, hint: `${stats.pausedAcc} paused` },
      { label: 'Submissions (range)', value: stats.subsInRange },
      {
        label: 'Avg learner score',
        value: stats.avgLearnerScore != null ? `${stats.avgLearnerScore}` : '—',
        hint: 'From graded work',
      },
      { label: 'Learner notifications', value: stats.studentNotifs },
      { label: 'Teacher comments on learner work', value: stats.studentComments },
      { label: 'New learners this week', value: stats.thisWeek, hint: `vs ${stats.lastWeek} prior` },
    ],
    tables: [
      {
        title: 'Learners in current table view',
        columns: [
          'Learner',
          'Grade',
          'Teacher',
          'Status',
          'Submissions',
          'Avg score',
          'Matched uploads',
          'Notifications',
          'Comments',
          'Joined',
        ],
        rows: filtered.map((s) => [
          s.full_name,
          s.grade_level ?? '—',
          s.teacher_name ?? '—',
          s.account_status,
          s.total_submissions,
          s.average_score != null ? Number(s.average_score).toFixed(1) : '—',
          s.uploads,
          s.notifs,
          s.assignmentComments,
          format(new Date(s.created_at), 'yyyy-MM-dd'),
        ]),
      },
      {
        title: 'Roster size by teacher (top)',
        columns: ['Teacher', 'Learners'],
        rows: teachersByRoster.map((t) => [t.name, t.count]),
      },
      {
        title: 'Learners by grade (in range filter)',
        columns: ['Grade', 'Count'],
        rows: byGrade.map((g) => [g.grade, g.count]),
      },
    ],
  });

  if (loading && !data)
    return (
      <>
        <PageHeader
          title="Learners & parents"
          icon={UsersRound}
          subtitle="Roster health, homework uploads, assignment results, and nudges for learner and parent-facing dashboard usage."
        />
        <LoadingState label="Loading learner & parent dashboard signals…" />
      </>
    );

  if (!loading && error && !data)
    return (
      <MonitorFetchErrorPage
        title="Learners & parents"
        icon={UsersRound}
        subtitle="Roster health, submissions, uploads, notifications, and assignment feedback involving learners."
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
        title="Learners & parents"
        icon={UsersRound}
        subtitle="Deep view of learner accounts under Nigerian teachers: roster, assignment submissions, AI homework uploads (matched by name), in-app notifications to learners, and teacher comments tied to learner work."
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

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Learner profiles" value={stats.total} icon={GraduationCap} tone="emerald" />
        <KpiCard
          label="Active"
          value={stats.active}
          tone="cyan"
          hint={`${stats.pausedAcc} paused · ${stats.suspended} suspended`}
        />
        <KpiCard
          label="Submissions (range)"
          value={stats.subsInRange}
          icon={FileText}
          tone="violet"
          hint={RANGES.find((r) => r.key === range)?.label ?? ''}
        />
        <KpiCard
          label="Avg score"
          value={stats.avgLearnerScore != null ? stats.avgLearnerScore : '—'}
          tone="amber"
          hint="Across learners with graded work"
        />
        <KpiCard
          label="Learner notifications"
          value={stats.studentNotifs}
          icon={Bell}
          tone="rose"
          hint="In-app nudges to learner IDs"
        />
        <KpiCard
          label="New this week"
          value={stats.thisWeek}
          icon={Sparkles}
          tone="sky"
          hint={`${stats.lastWeek} prior week`}
          delta={{ value: stats.delta.value, direction: stats.delta.direction, label: 'vs prev' }}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle
            title="Last 14 days · new learners vs submissions"
            hint="Fixed trailing window. KPIs and tables below use the time range you pick in the filters section."
          />
          <div className="h-52 px-2 pb-4">
            {dailyTrend.every((d) => d.newLearners === 0 && d.submissions === 0) ? (
              <EmptyState title="No activity in the last 14 days" hint="New roster joins and submissions will appear here as they occur." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyTrend} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="lpLearners" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#34d399" stopOpacity={0.55} />
                      <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="lpSubs" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={10} />
                  <YAxis stroke="#64748b" fontSize={10} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: '#0b1020', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="newLearners"
                    name="New learners (created)"
                    stroke="#34d399"
                    fill="url(#lpLearners)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="submissions"
                    name="Submissions"
                    stroke="#22d3ee"
                    fill="url(#lpSubs)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card>
          <SectionTitle title="Learners by grade" hint="Distribution within the selected range filter." />
          <div className="h-52 px-2 pb-4">
            {byGrade.length === 0 ? (
              <EmptyState title="No learners in range" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byGrade} layout="vertical" margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" stroke="#64748b" fontSize={10} allowDecimals={false} />
                  <YAxis type="category" dataKey="grade" stroke="#64748b" fontSize={10} width={72} />
                  <Tooltip
                    contentStyle={{ background: '#0b1020', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }}
                  />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                    {byGrade.map((_, i) => (
                      <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <SectionTitle
          title="Largest rosters"
          hint="Teachers with the most learner profiles — click through to the teacher drill-down."
        />
        <div className="overflow-x-auto px-2 pb-4">
          {teachersByRoster.length === 0 ? (
            <EmptyState title="No teachers with learners" />
          ) : (
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-2">#</th>
                  <th className="px-4 py-2">Teacher</th>
                  <th className="px-4 py-2 text-right">Learners</th>
                  <th className="px-4 py-2 text-right">Open</th>
                </tr>
              </thead>
              <tbody>
                {teachersByRoster.map((t, i) => (
                  <tr key={t.teacherId} className="border-b border-slate-800/60 hover:bg-slate-800/30">
                    <td className="px-4 py-2.5 text-slate-500">{i + 1}</td>
                    <td className="px-4 py-2.5 text-slate-200">{t.name}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-emerald-200">{t.count}</td>
                    <td className="px-4 py-2.5 text-right">
                      <Link
                        to={`/monitor/teachers/${t.teacherId}`}
                        className="text-xs font-medium text-cyan-400 hover:text-cyan-300"
                      >
                        Profile →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      <Card className="mt-4 p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            <Filter className="ml-1 h-3.5 w-3.5 text-slate-500" />
            <span className="text-xs text-slate-500">Range</span>
            {RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => setRange(r.key)}
                className={[
                  'rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
                  range === r.key ? 'bg-violet-500/25 text-violet-200' : 'text-slate-400 hover:text-slate-200',
                ].join(' ')}
              >
                {r.label}
              </button>
            ))}
            <span className="mx-1 hidden h-4 w-px bg-slate-700 sm:inline" />
            <span className="text-xs text-slate-500">Grade</span>
            <button
              type="button"
              onClick={() => setGradeFilter('all')}
              className={[
                'rounded-full px-2.5 py-1 text-[11px] font-medium',
                gradeFilter === 'all' ? 'bg-emerald-500/20 text-emerald-200' : 'text-slate-400 hover:text-slate-200',
              ].join(' ')}
            >
              All
            </button>
            {allGrades.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGradeFilter(g)}
                className={[
                  'rounded-full px-2.5 py-1 text-[11px] font-medium',
                  gradeFilter === g ? 'bg-emerald-500/20 text-emerald-200' : 'text-slate-400 hover:text-slate-200',
                ].join(' ')}
              >
                {g}
              </button>
            ))}
            <span className="mx-2 hidden h-4 w-px bg-slate-700 sm:inline" />
            <span className="text-xs text-slate-500">Status</span>
            {(['all', 'active', 'paused', 'suspended'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={[
                  'rounded-full px-2.5 py-1 text-[11px] font-medium capitalize',
                  statusFilter === st ? 'bg-cyan-500/20 text-cyan-200' : 'text-slate-400 hover:text-slate-200',
                ].join(' ')}
              >
                {st}
              </button>
            ))}
          </div>
          <div className="flex w-full flex-col gap-2 sm:max-w-md lg:w-80">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search learner, teacher, grade…"
            />
            <div className="flex flex-wrap gap-1">
              {(
                [
                  ['newest', 'Newest'],
                  ['submissions', 'Most submissions'],
                  ['uploads', 'Most uploads'],
                  ['score', 'Highest avg score'],
                  ['activity', 'Recent activity'],
                  ['name', 'Name A–Z'],
                ] as const
              ).map(([k, lab]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setSort(k)}
                  className={[
                    'rounded px-2 py-1 text-[10px] font-medium',
                    sort === k ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300',
                  ].join(' ')}
                >
                  {lab}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <Card className="mt-4">
        <SectionTitle
          title="Learner directory"
          hint="Uploads column counts homework images whose student name matches the roster (parent-uploaded work shares the same pipeline)."
          right={
            <span className="text-xs text-slate-500">
              {filtered.length.toLocaleString()} of {students.length.toLocaleString()} shown
            </span>
          }
        />
        <div className="max-h-[min(70vh,520px)] overflow-auto">
          {filtered.length === 0 ? (
            <EmptyState title="No learners match this view" />
          ) : (
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="sticky top-0 z-[1] bg-slate-900/95 backdrop-blur">
                <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-2">Learner</th>
                  <th className="px-4 py-2">Grade</th>
                  <th className="px-4 py-2">Teacher</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2 text-right">Submissions</th>
                  <th className="px-4 py-2 text-right">Avg</th>
                  <th className="px-4 py-2 text-right">Uploads</th>
                  <th className="px-4 py-2 text-right">Notifs</th>
                  <th className="px-4 py-2 text-right">Comments</th>
                  <th className="px-4 py-2">Last activity</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="border-b border-slate-800/60 hover:bg-slate-800/25">
                    <td className="px-4 py-2.5 font-medium text-slate-100">{s.full_name}</td>
                    <td className="px-4 py-2.5 text-slate-300">{s.grade_level ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      <Link
                        to={`/monitor/teachers/${s.teacher_id}`}
                        className="text-cyan-400 hover:text-cyan-300"
                      >
                        {s.teacher_name ?? '—'}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge
                        tone={
                          s.account_status === 'active'
                            ? 'emerald'
                            : s.account_status === 'paused'
                              ? 'amber'
                              : 'rose'
                        }
                      >
                        {s.account_status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-200">{s.total_submissions}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-300">
                      {s.average_score != null ? Number(s.average_score).toFixed(1) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-cyan-200">{s.uploads}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-amber-200/90">{s.notifs}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-violet-200/90">{s.assignmentComments}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">
                      {s.last_activity
                        ? format(new Date(s.last_activity), 'MMM d, yyyy')
                        : format(new Date(s.created_at), 'MMM d, yyyy')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle
            title="Recent notifications to learners"
            hint="System and teacher nudges where the recipient is a learner profile."
          />
          <div className="max-h-80 space-y-2 overflow-y-auto px-4 pb-4">
            {recentStudentNotifs.length === 0 ? (
              <EmptyState title="No learner notifications" />
            ) : (
              recentStudentNotifs.map((n) => (
                <div
                  key={n.id}
                  className="rounded-lg border border-slate-800/80 bg-slate-900/40 px-3 py-2 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-200">{n.title}</span>
                    <span className="shrink-0 text-slate-500">
                      {format(new Date(n.created_at), 'MMM d HH:mm')}
                    </span>
                  </div>
                  {n.message && <p className="mt-1 line-clamp-2 text-slate-400">{n.message}</p>}
                  <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-slate-500">
                    <span className="rounded bg-slate-800 px-1.5 py-0.5">{n.type}</span>
                    {n.is_read ? (
                      <span className="text-emerald-500/80">Read</span>
                    ) : (
                      <span className="text-amber-400/90">Unread</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <SectionTitle
            title="Engagement summary"
            hint="Cross-signals that matter for parent-facing dashboards."
          />
          <div className="space-y-3 px-4 pb-5 text-sm text-slate-300">
            <div className="flex items-start gap-2 rounded-lg bg-slate-900/50 p-3 ring-1 ring-slate-800">
              <UploadCloud className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
              <p>
                <span className="font-semibold text-white">{stats.uploadsMatched.toLocaleString()}</span> homework
                uploads could be matched to a roster name (parent or learner uploads through the same AI pipeline).
              </p>
            </div>
            <div className="flex items-start gap-2 rounded-lg bg-slate-900/50 p-3 ring-1 ring-slate-800">
              <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-violet-400" />
              <p>
                <span className="font-semibold text-white">{stats.studentComments.toLocaleString()}</span>{' '}
                assignment comments are tied to a learner ID — useful to see teacher feedback volume reaching
                families.
              </p>
            </div>
            <div className="flex items-start gap-2 rounded-lg bg-slate-900/50 p-3 ring-1 ring-slate-800">
              <School2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              <p>
                Use <strong className="text-white">Largest rosters</strong> and{' '}
                <strong className="text-white">teacher profile</strong> links to prioritise where parent load is
                highest.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-500">
              <TrendIcon className="h-4 w-4 text-emerald-400" />
              New learner accounts vs prior week:{' '}
              <span className="font-medium text-slate-200">
                {stats.delta.value > 0 ? '+' : ''}
                {stats.delta.value}%
              </span>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
};

export default MonitorLearnersParents;
