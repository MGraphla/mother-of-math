import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, ArrowUpRight, MapPin, School2 } from 'lucide-react';
import { format } from 'date-fns';
import { Card, PageHeader, LoadingState, EmptyState, Badge, SearchInput } from '../components/ui';
import { getAllTeachers } from '../services/monitorData';
import type { TeacherStats } from '@/types/admin';

type SortKey = 'name' | 'students' | 'lesson_plans' | 'assignments' | 'messages' | 'joined';

const MonitorTeachers = () => {
  const [teachers, setTeachers] = useState<TeacherStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('students');

  useEffect(() => {
    (async () => {
      try {
        setTeachers(await getAllTeachers());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = term
      ? teachers.filter((t) =>
          [t.full_name, t.email, t.school_name, t.country, t.city]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(term))
        )
      : [...teachers];

    const cmp = (a: TeacherStats, b: TeacherStats): number => {
      switch (sort) {
        case 'name':         return (a.full_name || '').localeCompare(b.full_name || '');
        case 'students':     return (b.total_students || 0) - (a.total_students || 0);
        case 'lesson_plans': return (b.total_lesson_plans || 0) - (a.total_lesson_plans || 0);
        case 'assignments':  return (b.total_assignments || 0) - (a.total_assignments || 0);
        case 'messages':     return (b.total_chatbot_messages || 0) - (a.total_chatbot_messages || 0);
        case 'joined':       return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    };
    return list.sort(cmp);
  }, [teachers, search, sort]);

  return (
    <>
      <PageHeader
        title="Teachers"
        icon={Users}
        subtitle="Every teacher in the platform with their real per-feature activity. Click a row to open a full monitoring profile."
      />

      <Card className="mb-5 p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="w-full sm:w-80">
            <SearchInput value={search} onChange={setSearch} placeholder="Search by name, email, school, country…" />
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="mr-1 text-slate-500">Sort:</span>
            {([
              ['students', 'Most students'],
              ['lesson_plans', 'Lesson plans'],
              ['assignments', 'Assignments'],
              ['messages', 'Chat msgs'],
              ['joined', 'Newest'],
              ['name', 'Name (A→Z)'],
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
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {loading ? (
        <LoadingState label="Loading teachers from Supabase…" />
      ) : filtered.length === 0 ? (
        <Card><EmptyState title="No teachers match this search" /></Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800/70 text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3 sm:px-5">Teacher</th>
                  <th className="px-4 py-3">School / Location</th>
                  <th className="px-4 py-3 text-right">Students</th>
                  <th className="px-4 py-3 text-right">Lesson plans</th>
                  <th className="px-4 py-3 text-right">Assignments</th>
                  <th className="px-4 py-3 text-right">Chat msgs</th>
                  <th className="px-4 py-3">Joined</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id} className="border-b border-slate-800/40 hover:bg-slate-800/30">
                    <td className="px-4 py-3 sm:px-5">
                      <Link to={`/monitor/teachers/${t.id}`} className="block">
                        <div className="font-medium text-slate-100">{t.full_name || 'Unnamed teacher'}</div>
                        <div className="text-xs text-slate-500">{t.email}</div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {t.account_status && t.account_status !== 'active' && (
                            <Badge tone={t.account_status === 'paused' ? 'amber' : 'rose'}>
                              {t.account_status}
                            </Badge>
                          )}
                          {t.gender && <Badge tone="slate">{t.gender}</Badge>}
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
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {t.created_at ? format(new Date(t.created_at), 'MMM d, yyyy') : '—'}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Link
                        to={`/monitor/teachers/${t.id}`}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-cyan-300 hover:bg-cyan-500/10"
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
