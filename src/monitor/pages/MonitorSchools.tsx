import { useMemo, useState } from 'react';
import {
  Building2,
  Globe2,
  MapPin,
  School2,
  Users as UsersIcon,
  GraduationCap,
  Trophy,
  Filter,
  Sparkles,
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
import {
  getAllSchools,
  getTeachersByCountry,
  getStudentsPerTeacher,
} from '../services/monitorData';
import { useLiveData } from '../hooks/useLiveData';
import LiveIndicator from '../components/LiveIndicator';
import ExportMenu from '../components/ExportMenu';
import type { ExportPayload } from '../utils/exporters';

interface SchoolRow {
  name: string;
  type: string | null;
  city: string | null;
  country: string | null;
  teacherCount: number;
  studentCount: number;
}

interface SchoolsBundle {
  schools: SchoolRow[];
  countries: { country: string; count: number }[];
  topTeachersByStudents: {
    teacherId: string;
    teacherName: string;
    studentCount: number;
    schoolName: string | null;
  }[];
}

type SortKey = 'teachers' | 'students' | 'name' | 'country';

const PIE_COLORS = [
  '#34d399',
  '#22d3ee',
  '#a78bfa',
  '#fbbf24',
  '#f87171',
  '#60a5fa',
  '#fb923c',
  '#c084fc',
  '#4ade80',
];

const MonitorSchools = () => {
  const { data, loading, refreshing, paused, setPaused, lastUpdated, error, refresh } =
    useLiveData<SchoolsBundle>(
      async () => {
        const [schools, countries, topTeachersByStudents] = await Promise.all([
          getAllSchools(),
          getTeachersByCountry(),
          getStudentsPerTeacher(),
        ]);
        return { schools, countries, topTeachersByStudents };
      },
      { intervalMs: 60_000 },
    );

  const schools = data?.schools ?? [];
  const countries = data?.countries ?? [];
  const topTeachersByStudents = data?.topTeachersByStudents ?? [];

  const [search, setSearch] = useState('');
  const [countryFilter, setCountryFilter] = useState<string | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<string | 'all'>('all');
  const [sort, setSort] = useState<SortKey>('teachers');

  /* ── Derived stats ─────────────────────────────────────── */
  const totalTeachers = useMemo(
    () => schools.reduce((s, r) => s + r.teacherCount, 0),
    [schools],
  );
  const totalStudents = useMemo(
    () => schools.reduce((s, r) => s + r.studentCount, 0),
    [schools],
  );

  const cityCount = useMemo(
    () => new Set(schools.map((s) => s.city).filter(Boolean)).size,
    [schools],
  );

  const avgStudentsPerTeacher = totalTeachers
    ? Math.round(totalStudents / totalTeachers)
    : 0;

  const distinctTypes = useMemo(
    () => [...new Set(schools.map((s) => s.type).filter(Boolean) as string[])].sort(),
    [schools],
  );

  const distinctCountries = useMemo(
    () => [...new Set(schools.map((s) => s.country).filter(Boolean) as string[])].sort(),
    [schools],
  );

  /* ── Breakdowns ─────────────────────────────────────────── */
  const byType = useMemo(() => {
    const m = new Map<string, number>();
    schools.forEach((s) => {
      const k = s.type || 'Unspecified';
      m.set(k, (m.get(k) ?? 0) + 1);
    });
    return [...m.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
  }, [schools]);

  const teachersByCountryTop = useMemo(
    () => countries.slice().sort((a, b) => b.count - a.count).slice(0, 12),
    [countries],
  );

  const byCity = useMemo(() => {
    const m = new Map<string, { teachers: number; students: number }>();
    schools.forEach((s) => {
      const k = s.city || 'Unknown';
      const cur = m.get(k) ?? { teachers: 0, students: 0 };
      cur.teachers += s.teacherCount;
      cur.students += s.studentCount;
      m.set(k, cur);
    });
    return [...m.entries()]
      .map(([city, v]) => ({ city, teachers: v.teachers, students: v.students }))
      .sort((a, b) => b.teachers - a.teachers)
      .slice(0, 10);
  }, [schools]);

  /* ── Filter + sort table ─────────────────────────────────── */
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    let arr = schools;
    if (countryFilter !== 'all') arr = arr.filter((s) => s.country === countryFilter);
    if (typeFilter !== 'all') arr = arr.filter((s) => s.type === typeFilter);
    if (term) {
      arr = arr.filter(
        (s) =>
          (s.name || '').toLowerCase().includes(term) ||
          (s.city || '').toLowerCase().includes(term) ||
          (s.country || '').toLowerCase().includes(term) ||
          (s.type || '').toLowerCase().includes(term),
      );
    }
    const cmp = (a: SchoolRow, b: SchoolRow): number => {
      switch (sort) {
        case 'teachers':
          return b.teacherCount - a.teacherCount;
        case 'students':
          return b.studentCount - a.studentCount;
        case 'name':
          return (a.name || '').localeCompare(b.name || '');
        case 'country':
          return (a.country || '').localeCompare(b.country || '');
      }
    };
    return [...arr].sort(cmp);
  }, [schools, search, countryFilter, typeFilter, sort]);

  /* ── Export payload ─────────────────────────────────────── */
  const buildExportPayload = (): ExportPayload => ({
    fileStem: `qeda-schools-geo`,
    title: 'QEDA Education Monitor — Schools & Geography',
    subtitle: `${schools.length.toLocaleString()} schools · ${countries.length.toLocaleString()} countries${countryFilter !== 'all' ? ` · ${countryFilter}` : ''}${search ? ` · "${search}"` : ''}`,
    summary:
      `QEDA reaches ${schools.length.toLocaleString()} schools across ${countries.length.toLocaleString()} countries ` +
      `and ${cityCount.toLocaleString()} cities. ${totalTeachers.toLocaleString()} teachers serve ` +
      `${totalStudents.toLocaleString()} learners (average of ${avgStudentsPerTeacher} students per teacher).`,
    kpis: [
      { label: 'Distinct schools', value: schools.length },
      { label: 'Distinct countries', value: countries.length },
      { label: 'Distinct cities', value: cityCount },
      { label: 'Teachers (placed)', value: totalTeachers },
      { label: 'Students (placed)', value: totalStudents },
      { label: 'Avg students per teacher', value: avgStudentsPerTeacher },
    ],
    tables: [
      {
        title: 'Schools in current view',
        columns: ['School', 'Type', 'City', 'Country', 'Teachers', 'Students'],
        rows: filtered.map((s) => [
          s.name ?? '—',
          s.type ?? '—',
          s.city ?? '—',
          s.country ?? '—',
          s.teacherCount,
          s.studentCount,
        ]),
      },
      {
        title: 'Teachers by country',
        columns: ['Country', 'Teachers'],
        rows: countries.map((c) => [c.country, c.count]),
      },
      {
        title: 'Top 10 cities by teacher count',
        columns: ['City', 'Teachers', 'Students'],
        rows: byCity.map((c) => [c.city, c.teachers, c.students]),
      },
      {
        title: 'School type distribution',
        columns: ['Type', 'Schools'],
        rows: byType.map((t) => [t.type, t.count]),
      },
      {
        title: 'Top teachers by student count',
        columns: ['Teacher', 'School', 'Students'],
        rows: topTeachersByStudents
          .slice(0, 25)
          .map((t) => [t.teacherName ?? '—', t.schoolName ?? '—', t.studentCount]),
      },
    ],
  });

  /* ── Render ─────────────────────────────────────────────── */
  if (loading && !data)
    return (
      <>
        <PageHeader
          title="Schools & geography"
          icon={Building2}
          subtitle="Where teachers are working — schools, cities and countries."
        />
        <LoadingState label="Loading schools & geography…" />
      </>
    );

  if (!loading && error && !data)
    return (
      <MonitorFetchErrorPage
        title="Schools & geography"
        icon={Building2}
        subtitle="Geographic and institutional distribution of teachers and learners across the QEDA network."
        error={error}
        onRetry={refresh}
      />
    );

  const topCountry = teachersByCountryTop[0];

  return (
    <>
      <PageHeader
        title="Schools & geography"
        icon={Building2}
        subtitle="Geographic and institutional distribution of teachers and learners across the QEDA network."
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

      {error && data && <MonitorFetchErrorBanner error={error} onRetry={refresh} />}

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard
          label="Distinct schools"
          value={schools.length}
          icon={School2}
          tone="cyan"
          hint={`${byType.length} school types`}
        />
        <KpiCard
          label="Countries"
          value={countries.length}
          icon={Globe2}
          tone="emerald"
          hint={topCountry ? `Top: ${topCountry.country}` : undefined}
        />
        <KpiCard
          label="Cities"
          value={cityCount}
          icon={MapPin}
          tone="violet"
        />
        <KpiCard
          label="Students per teacher"
          value={avgStudentsPerTeacher}
          icon={GraduationCap}
          tone="amber"
          hint={`${totalTeachers.toLocaleString()} teachers · ${totalStudents.toLocaleString()} learners`}
        />
      </div>

      {/* Country leaderboard cards */}
      {teachersByCountryTop.length > 0 && (
        <Card className="mt-5">
          <SectionTitle
            title="Teachers by country · top 8"
            hint="Where the QEDA footprint is strongest."
            right={<Trophy className="h-4 w-4 text-amber-400" />}
          />
          <div className="grid gap-2 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-4">
            {teachersByCountryTop.slice(0, 8).map((c, i) => {
              const pct = Math.round((c.count / (topCountry?.count || 1)) * 100);
              return (
                <div
                  key={c.country}
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
                      <div className="truncate text-sm font-medium text-slate-100">
                        {c.country}
                      </div>
                      <div className="truncate text-[11px] text-slate-500">
                        {c.count.toLocaleString()} teachers
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Country + school type charts */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <SectionTitle
            title="Teachers by country"
            hint={`${countries.length} countries represented`}
          />
          <div className="h-80 px-2 pb-3">
            {teachersByCountryTop.length === 0 ? (
              <EmptyState title="No country data" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={teachersByCountryTop}
                  layout="vertical"
                  margin={{ left: 40, right: 12 }}
                >
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" stroke="#64748b" fontSize={11} allowDecimals={false} />
                  <YAxis
                    dataKey="country"
                    type="category"
                    stroke="#94a3b8"
                    fontSize={11}
                    width={130}
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
                    {teachersByCountryTop.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <SectionTitle title="School type mix" hint="Public, private, faith-based, etc." />
          <div className="h-80 px-2 pb-3">
            {byType.length === 0 ? (
              <EmptyState title="No type data" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={byType}
                    dataKey="count"
                    nameKey="type"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={95}
                    paddingAngle={2}
                  >
                    {byType.map((_, i) => (
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
                  <Legend wrapperStyle={{ fontSize: 11, color: '#cbd5e1' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      {/* Cities + teachers by students */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <SectionTitle title="Top 10 cities" hint="Teachers and learners in their cities." />
          <div className="h-72 px-2 pb-3">
            {byCity.length === 0 ? (
              <EmptyState title="No city data" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byCity}>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                  <XAxis dataKey="city" stroke="#64748b" fontSize={11} />
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
                  <Bar dataKey="teachers" name="Teachers" fill="#34d399" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="students" name="Students" fill="#22d3ee" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <SectionTitle
            title="Top teachers by student count"
            hint="Largest classrooms in the network."
            right={<Sparkles className="h-3.5 w-3.5 text-amber-300" />}
          />
          <div className="h-72 px-2 pb-3">
            {topTeachersByStudents.length === 0 ? (
              <EmptyState title="No data" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topTeachersByStudents.slice(0, 10)}
                  layout="vertical"
                  margin={{ left: 40, right: 12 }}
                >
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" stroke="#64748b" fontSize={11} allowDecimals={false} />
                  <YAxis
                    dataKey="teacherName"
                    type="category"
                    stroke="#94a3b8"
                    fontSize={11}
                    width={120}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#0b1020',
                      border: '1px solid #1e293b',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="studentCount" fill="#a78bfa" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      {/* Filter / search / sort */}
      <Card className="mt-5 p-3">
        <div className="flex flex-col gap-3">
          {(distinctCountries.length > 0 || distinctTypes.length > 0) && (
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              {distinctCountries.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <Filter className="ml-1 mr-1 h-3.5 w-3.5 text-slate-500" />
                  <span className="mr-1 text-[11px] uppercase tracking-wider text-slate-500">
                    Country
                  </span>
                  <button
                    onClick={() => setCountryFilter('all')}
                    className={[
                      'rounded-full px-3 py-1.5 text-[12px] transition-colors',
                      countryFilter === 'all'
                        ? 'bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/40'
                        : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100',
                    ].join(' ')}
                  >
                    All
                  </button>
                  {distinctCountries.slice(0, 8).map((c) => (
                    <button
                      key={c}
                      onClick={() => setCountryFilter(c)}
                      className={[
                        'rounded-full px-3 py-1.5 text-[12px] transition-colors',
                        countryFilter === c
                          ? 'bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/40'
                          : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100',
                      ].join(' ')}
                    >
                      {c}
                    </button>
                  ))}
                  {distinctCountries.length > 8 && (
                    <select
                      value={
                        distinctCountries.slice(0, 8).includes(countryFilter as string)
                          ? 'more'
                          : countryFilter
                      }
                      onChange={(e) => setCountryFilter(e.target.value as string)}
                      className="rounded-full border border-slate-800 bg-slate-900/60 px-2 py-1 text-[12px] text-slate-300 outline-none focus:border-emerald-500/40"
                    >
                      <option value="more" disabled>
                        More…
                      </option>
                      {distinctCountries.slice(8).map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
              {distinctTypes.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="mr-1 text-[11px] uppercase tracking-wider text-slate-500">
                    Type
                  </span>
                  <button
                    onClick={() => setTypeFilter('all')}
                    className={[
                      'rounded-full px-3 py-1.5 text-[12px] transition-colors',
                      typeFilter === 'all'
                        ? 'bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-500/40'
                        : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100',
                    ].join(' ')}
                  >
                    All
                  </button>
                  {distinctTypes.map((t) => (
                    <button
                      key={t}
                      onClick={() => setTypeFilter(t)}
                      className={[
                        'rounded-full px-3 py-1.5 text-[12px] transition-colors',
                        typeFilter === t
                          ? 'bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-500/40'
                          : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100',
                      ].join(' ')}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="w-full sm:w-80">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search school, city, country, type…"
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="mr-1 text-slate-500">Sort:</span>
              {(
                [
                  ['teachers', 'Most teachers'],
                  ['students', 'Most students'],
                  ['name', 'A→Z'],
                  ['country', 'Country'],
                ] as [SortKey, string][]
              ).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setSort(k)}
                  className={[
                    'rounded-full px-3 py-1.5 transition-colors',
                    sort === k
                      ? 'bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/40'
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
            {filtered.length.toLocaleString()} of {schools.length.toLocaleString()} schools
          </span>
          <span className="hidden items-center gap-1 sm:flex">
            <UsersIcon className="h-3 w-3" /> {totalTeachers.toLocaleString()} teachers placed
          </span>
        </div>
        {filtered.length === 0 ? (
          <EmptyState
            title="No schools match this view"
            hint="Try a different country / type or clear the search."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800/70 text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3">School</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">City</th>
                  <th className="px-4 py-3">Country</th>
                  <th className="px-4 py-3 text-right">Teachers</th>
                  <th className="px-4 py-3 text-right">Students</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr
                    key={`${s.name}-${s.city}-${s.country}`}
                    className="border-b border-slate-800/40 transition-colors hover:bg-emerald-500/5"
                  >
                    <td className="px-5 py-3 text-slate-100">
                      <div className="flex items-center gap-2">
                        <School2 className="h-3.5 w-3.5 text-slate-500" />
                        <span className="truncate">{s.name || '—'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {s.type ? (
                        <Badge tone="cyan">{s.type}</Badge>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{s.city || '—'}</td>
                    <td className="px-4 py-3 text-slate-300">
                      {s.country ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Globe2 className="h-3 w-3 text-emerald-400" />
                          {s.country}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-100">
                      {s.teacherCount}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-100">
                      {s.studentCount}
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

export default MonitorSchools;
