import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';
import { Card, PageHeader, LoadingState, EmptyState, KpiCard, SectionTitle, Badge } from '../components/ui';
import { getAllStudentWorks } from '../services/monitorData';
import { stripMarkdown } from '../utils/text';
import type { StudentWorkStats } from '@/types/admin';

const PIE_COLORS = ['#22d3ee', '#a78bfa', '#fbbf24', '#34d399', '#f87171', '#60a5fa', '#fb923c', '#c084fc', '#4ade80'];

const MonitorErrorAnalysis = () => {
  const [loading, setLoading] = useState(true);
  const [works, setWorks] = useState<StudentWorkStats[]>([]);

  useEffect(() => {
    (async () => {
      try {
        setWorks(await getAllStudentWorks());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const withErrorType = works.filter((w) => !!w.error_type);

  const byErrorType = useMemo(() => {
    const m = new Map<string, number>();
    withErrorType.forEach((w) => {
      const k = (w.error_type || 'Unknown').trim();
      m.set(k, (m.get(k) ?? 0) + 1);
    });
    return Array.from(m.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
  }, [withErrorType]);

  const bySubject = useMemo(() => {
    const m = new Map<string, number>();
    withErrorType.forEach((w) => {
      const k = (w.subject || 'Other').trim();
      m.set(k, (m.get(k) ?? 0) + 1);
    });
    return Array.from(m.entries()).map(([subject, count]) => ({ subject, count })).sort((a, b) => b.count - a.count);
  }, [withErrorType]);

  const byGrade = useMemo(() => {
    const m = new Map<string, number>();
    withErrorType.forEach((w) => {
      const k = (w.grade || 'Unspecified').trim();
      m.set(k, (m.get(k) ?? 0) + 1);
    });
    return Array.from(m.entries()).map(([grade, count]) => ({ grade, count })).sort((a, b) => b.count - a.count);
  }, [withErrorType]);

  const topRemediations = useMemo(() => {
    return withErrorType
      .filter((w) => !!w.remediation)
      .slice(0, 10);
  }, [withErrorType]);

  if (loading)
    return (
      <>
        <PageHeader title="Error analysis" icon={AlertTriangle} subtitle="Aggregate breakdown of student errors identified by the AI." />
        <LoadingState />
      </>
    );

  return (
    <>
      <PageHeader
        title="Error analysis"
        icon={AlertTriangle}
        subtitle="Aggregate breakdown of student errors identified by the AI uploader, segmented by error type, subject and grade."
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Uploads analysed" value={works.length} tone="cyan" />
        <KpiCard label="With classified error" value={withErrorType.length} tone="amber" />
        <KpiCard label="Distinct error types" value={byErrorType.length} tone="rose" />
        <KpiCard label="Classification rate" value={works.length ? `${Math.round((withErrorType.length / works.length) * 100)}%` : '0%'} tone="violet" />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <SectionTitle title="Errors by type" hint="The most common mistakes the AI identifies." />
          <div className="h-80 px-2 pb-3">
            {byErrorType.length === 0 ? <EmptyState title="No classified errors yet" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byErrorType.slice(0, 12)} layout="vertical" margin={{ left: 40, right: 12 }}>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" stroke="#64748b" fontSize={11} />
                  <YAxis dataKey="type" type="category" stroke="#94a3b8" fontSize={11} width={180} />
                  <Tooltip contentStyle={{ background: '#0b1020', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="count" fill="#fbbf24" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <SectionTitle title="By subject" />
          <div className="h-80 px-2 pb-3">
            {bySubject.length === 0 ? <EmptyState title="No data" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={bySubject} dataKey="count" nameKey="subject" cx="50%" cy="50%" outerRadius={90} innerRadius={50}>
                    {bySubject.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#0b1020', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      <Card className="mt-5">
        <SectionTitle title="Errors by grade level" />
        <div className="h-64 px-2 pb-3">
          {byGrade.length === 0 ? <EmptyState title="No data" /> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byGrade}>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                <XAxis dataKey="grade" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip contentStyle={{ background: '#0b1020', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" fill="#f87171" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      <Card className="mt-5">
        <SectionTitle title="Recent AI remediation suggestions" hint="What the AI recommended to address the identified errors." />
        {topRemediations.length === 0 ? (
          <EmptyState title="No remediation entries yet" />
        ) : (
          <ul className="divide-y divide-slate-800/70">
            {topRemediations.map((w) => (
              <li key={w.id} className="px-5 py-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge tone="amber">{w.error_type}</Badge>
                  <span className="text-xs text-slate-400">{w.student_name}</span>
                  <span className="text-xs text-slate-500">· {w.teacher_name || 'Unknown teacher'}</span>
                </div>
                <div className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">{stripMarkdown(w.remediation)}</div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
};

export default MonitorErrorAnalysis;
