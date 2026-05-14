import { useEffect, useMemo, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Card, PageHeader, LoadingState, EmptyState, KpiCard, SectionTitle, SearchInput, Badge } from '../components/ui';
import { getAllAssignments, getAllSubmissions } from '../services/monitorData';
import type { AssignmentStats, SubmissionStats } from '@/types/admin';
import { format } from 'date-fns';

const MonitorAssignments = () => {
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<AssignmentStats[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionStats[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [a, s] = await Promise.all([getAllAssignments(), getAllSubmissions()]);
        setAssignments(a);
        setSubmissions(s);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const submissionsRate = useMemo(() => {
    const totalExpected = assignments.reduce((acc, a) => acc + (a.total_students || 0), 0);
    const totalSubmitted = assignments.reduce((acc, a) => acc + (a.submitted_count || 0), 0);
    return totalExpected ? Math.round((totalSubmitted / totalExpected) * 100) : 0;
  }, [assignments]);

  const byStatus = useMemo(() => {
    const m = new Map<string, number>();
    assignments.forEach((a) => m.set(a.status, (m.get(a.status) ?? 0) + 1));
    return Array.from(m.entries()).map(([status, count]) => ({ status, count }));
  }, [assignments]);

  const byGrade = useMemo(() => {
    const m = new Map<string, number>();
    assignments.forEach((a) => m.set(a.grade_level || 'Unknown', (m.get(a.grade_level || 'Unknown') ?? 0) + 1));
    return Array.from(m.entries()).map(([grade, count]) => ({ grade, count })).sort((a, b) => b.count - a.count);
  }, [assignments]);

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return assignments;
    return assignments.filter(
      (a) =>
        (a.title || '').toLowerCase().includes(t) ||
        (a.teacher_name || '').toLowerCase().includes(t) ||
        (a.grade_level || '').toLowerCase().includes(t)
    );
  }, [assignments, search]);

  const aiGraded = submissions.filter((s) => s.ai_score != null).length;
  const humanGraded = submissions.filter((s) => s.status === 'graded' && s.score != null).length;

  if (loading)
    return (
      <>
        <PageHeader title="Assignments" icon={ClipboardList} subtitle="All assignments created and submitted." />
        <LoadingState />
      </>
    );

  return (
    <>
      <PageHeader title="Assignments & submissions" icon={ClipboardList} subtitle="Assignments teachers created, who submitted, and how AI vs. human grading compares." />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Total assignments" value={assignments.length} tone="amber" />
        <KpiCard label="Total submissions" value={submissions.length} tone="cyan" />
        <KpiCard label="Submission rate" value={`${submissionsRate}%`} tone="emerald" hint="Submitted ÷ expected" />
        <KpiCard label="AI-graded" value={aiGraded} tone="violet" hint={`${humanGraded} teacher-graded`} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle title="By status" />
          <div className="h-64 px-2 pb-3">
            {byStatus.length === 0 ? <EmptyState title="No assignments" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byStatus}>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                  <XAxis dataKey="status" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip contentStyle={{ background: '#0b1020', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="count" fill="#fbbf24" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card>
          <SectionTitle title="By grade level" />
          <div className="h-64 px-2 pb-3">
            {byGrade.length === 0 ? <EmptyState title="No data" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byGrade}>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                  <XAxis dataKey="grade" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip contentStyle={{ background: '#0b1020', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="count" fill="#22d3ee" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      <Card className="mt-5">
        <SectionTitle
          title="All assignments"
          hint={`${filtered.length} of ${assignments.length}`}
          right={<div className="w-64"><SearchInput value={search} onChange={setSearch} placeholder="Search title, teacher, grade…" /></div>}
        />
        {filtered.length === 0 ? (
          <EmptyState title="No matches" />
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
                {filtered.map((a) => (
                  <tr key={a.id} className="border-b border-slate-800/40">
                    <td className="px-5 py-3 text-slate-100">{a.title}</td>
                    <td className="px-4 py-3 text-slate-300">{a.teacher_name || '—'}</td>
                    <td className="px-4 py-3 text-slate-300">{a.grade_level}</td>
                    <td className="px-4 py-3"><Badge tone={a.status === 'active' ? 'emerald' : a.status === 'closed' ? 'slate' : 'amber'}>{a.status}</Badge></td>
                    <td className="px-4 py-3 text-right tabular-nums">{a.submitted_count}/{a.total_students}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{a.graded_count}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{a.average_score != null ? Number(a.average_score).toFixed(1) : '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{a.due_date ? format(new Date(a.due_date), 'MMM d, yyyy') : '—'}</td>
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

export default MonitorAssignments;
