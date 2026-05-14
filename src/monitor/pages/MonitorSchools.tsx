import { useEffect, useMemo, useState } from 'react';
import { Building2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Card, PageHeader, LoadingState, EmptyState, KpiCard, SectionTitle, SearchInput } from '../components/ui';
import { getAllSchools, getTeachersByCountry, getStudentsPerTeacher } from '../services/monitorData';

interface SchoolRow { name: string; type: string | null; city: string | null; country: string | null; teacherCount: number; studentCount: number }

const MonitorSchools = () => {
  const [loading, setLoading] = useState(true);
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [countries, setCountries] = useState<{ country: string; count: number }[]>([]);
  const [topTeachersByStudents, setTopTeachersByStudents] = useState<{ teacherId: string; teacherName: string; studentCount: number; schoolName: string | null }[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [s, c, t] = await Promise.all([getAllSchools(), getTeachersByCountry(), getStudentsPerTeacher()]);
        setSchools(s);
        setCountries(c);
        setTopTeachersByStudents(t);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totalTeachers = schools.reduce((s, r) => s + r.teacherCount, 0);
  const totalStudents = schools.reduce((s, r) => s + r.studentCount, 0);

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return schools;
    return schools.filter(
      (s) =>
        (s.name || '').toLowerCase().includes(t) ||
        (s.city || '').toLowerCase().includes(t) ||
        (s.country || '').toLowerCase().includes(t) ||
        (s.type || '').toLowerCase().includes(t)
    );
  }, [schools, search]);

  if (loading)
    return (
      <>
        <PageHeader title="Schools & geography" icon={Building2} subtitle="Where teachers are working — schools, cities and countries." />
        <LoadingState />
      </>
    );

  return (
    <>
      <PageHeader title="Schools & geography" icon={Building2} subtitle="Geographic and institutional distribution of teachers and learners." />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Distinct schools" value={schools.length} tone="cyan" />
        <KpiCard label="Distinct countries" value={countries.length} tone="emerald" />
        <KpiCard label="Teachers (placed)" value={totalTeachers} tone="violet" />
        <KpiCard label="Students (placed)" value={totalStudents} tone="amber" />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle title="Teachers by country" />
          <div className="h-72 px-2 pb-3">
            {countries.length === 0 ? <EmptyState title="No country data" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={countries.slice(0, 12)} layout="vertical" margin={{ left: 40, right: 12 }}>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" stroke="#64748b" fontSize={11} />
                  <YAxis dataKey="country" type="category" stroke="#94a3b8" fontSize={11} width={120} />
                  <Tooltip contentStyle={{ background: '#0b1020', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="count" fill="#34d399" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card>
          <SectionTitle title="Top teachers by student count" />
          <div className="h-72 px-2 pb-3">
            {topTeachersByStudents.length === 0 ? <EmptyState title="No data" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topTeachersByStudents.slice(0, 10)} layout="vertical" margin={{ left: 40, right: 12 }}>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" stroke="#64748b" fontSize={11} />
                  <YAxis dataKey="teacherName" type="category" stroke="#94a3b8" fontSize={11} width={120} />
                  <Tooltip contentStyle={{ background: '#0b1020', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="studentCount" fill="#22d3ee" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      <Card className="mt-5">
        <SectionTitle
          title="All schools"
          hint={`${filtered.length} of ${schools.length}`}
          right={<div className="w-64"><SearchInput value={search} onChange={setSearch} placeholder="Search school, city, country…" /></div>}
        />
        {filtered.length === 0 ? (
          <EmptyState title="No matches" />
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
                {filtered.sort((a, b) => b.teacherCount - a.teacherCount).map((s) => (
                  <tr key={`${s.name}-${s.city}-${s.country}`} className="border-b border-slate-800/40">
                    <td className="px-5 py-3 text-slate-100">{s.name || '—'}</td>
                    <td className="px-4 py-3 text-slate-300">{s.type || '—'}</td>
                    <td className="px-4 py-3 text-slate-300">{s.city || '—'}</td>
                    <td className="px-4 py-3 text-slate-300">{s.country || '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-100">{s.teacherCount}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-100">{s.studentCount}</td>
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
