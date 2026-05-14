import { useEffect, useMemo, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { Card, PageHeader, LoadingState, EmptyState, KpiCard, SectionTitle, SearchInput, Badge } from '../components/ui';
import { getAllStudentWorks } from '../services/monitorData';
import { stripMarkdown } from '../utils/text';
import type { StudentWorkStats } from '@/types/admin';
import { format } from 'date-fns';

const MonitorUploads = () => {
  const [loading, setLoading] = useState(true);
  const [works, setWorks] = useState<StudentWorkStats[]>([]);
  const [search, setSearch] = useState('');
  const [preview, setPreview] = useState<StudentWorkStats | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setWorks(await getAllStudentWorks());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const withErrors = works.filter((w) => !!w.error_type).length;
  const analysed = works.filter((w) => !!w.feedback).length;
  const totalSize = works.reduce((s, w) => s + (w.file_size || 0), 0);
  const sizeMb = (totalSize / 1_048_576).toFixed(1);

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return works;
    return works.filter(
      (w) =>
        (w.student_name || '').toLowerCase().includes(t) ||
        (w.teacher_name || '').toLowerCase().includes(t) ||
        (w.subject || '').toLowerCase().includes(t) ||
        (w.error_type || '').toLowerCase().includes(t)
    );
  }, [works, search]);

  if (loading)
    return (
      <>
        <PageHeader title="Student work uploads" icon={UploadCloud} subtitle="Every homework image uploaded by teachers for AI analysis." />
        <LoadingState />
      </>
    );

  return (
    <>
      <PageHeader title="Student work uploads" icon={UploadCloud} subtitle="Every homework image uploaded for AI analysis, the feedback returned, and the error patterns identified." />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Total uploads" value={works.length} tone="cyan" />
        <KpiCard label="AI-analysed" value={analysed} tone="emerald" hint="Uploads with feedback" />
        <KpiCard label="With error type" value={withErrors} tone="amber" hint="Errors classified" />
        <KpiCard label="Total file size" value={`${sizeMb} MB`} tone="violet" />
      </div>

      <Card className="mt-5">
        <SectionTitle
          title="All uploads"
          hint={`${filtered.length} of ${works.length}`}
          right={<div className="w-64"><SearchInput value={search} onChange={setSearch} placeholder="Search student, teacher, error type…" /></div>}
        />
        {filtered.length === 0 ? (
          <EmptyState title="No matches" />
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
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((w) => (
                  <tr key={w.id} className="border-b border-slate-800/40 hover:bg-slate-800/30">
                    <td className="px-5 py-3 text-slate-100">{w.student_name}</td>
                    <td className="px-4 py-3 text-slate-300">{w.teacher_name || '—'}</td>
                    <td className="px-4 py-3 text-slate-300">{w.subject || '—'}</td>
                    <td className="px-4 py-3">{w.error_type ? <Badge tone="amber">{w.error_type}</Badge> : <span className="text-slate-500">—</span>}</td>
                    <td className="px-4 py-3 text-slate-300"><div className="line-clamp-2 max-w-md">{w.feedback || '—'}</div></td>
                    <td className="px-4 py-3 text-xs text-slate-400">{format(new Date(w.created_at), 'MMM d, yyyy')}</td>
                    <td className="px-3 py-3 text-right">
                      <button onClick={() => setPreview(w)} className="rounded-md px-2 py-1 text-xs text-cyan-300 hover:bg-cyan-500/10">View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setPreview(null)}>
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-800 bg-[#0b1020] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-sm text-slate-100">{preview.student_name}</div>
                <div className="text-xs text-slate-500">{preview.teacher_name || '—'} · {format(new Date(preview.created_at), 'MMM d, yyyy HH:mm')}</div>
              </div>
              <button onClick={() => setPreview(null)} className="rounded-md px-2 py-1 text-sm text-slate-400 hover:bg-slate-800">Close</button>
            </div>
            {preview.image_url && (
              <img src={preview.image_url} alt="Student work" className="mb-4 max-h-[60vh] w-full rounded-lg border border-slate-800 object-contain" />
            )}
            {preview.error_type && <div className="mb-2"><Badge tone="amber">{preview.error_type}</Badge></div>}
            {preview.feedback && (
              <div className="mb-3 rounded-lg border border-slate-800/60 bg-slate-900/40 p-3 text-sm text-slate-200 whitespace-pre-wrap">{preview.feedback}</div>
            )}
            {preview.remediation && (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-emerald-100 whitespace-pre-wrap">
                <div className="mb-1 text-[11px] uppercase tracking-wider text-emerald-300">Suggested remediation</div>
                {preview.remediation}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default MonitorUploads;
