import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  UserPlus,
  GraduationCap,
  BookOpen,
  ClipboardList,
  FileText,
  MessageSquare,
  RefreshCw,
  Filter,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { PageHeader, Card, LoadingState, EmptyState, Badge, SearchInput } from '../components/ui';
import { getUserActivity, type ActivityItem } from '../services/monitorData';

const TYPE_META: Record<
  ActivityItem['type'],
  { label: string; tone: 'cyan' | 'emerald' | 'violet' | 'amber' | 'rose' | 'sky'; icon: React.ComponentType<{ className?: string }> }
> = {
  teacher_signup:  { label: 'Sign up',     tone: 'cyan',    icon: UserPlus },
  student_created: { label: 'Learner',     tone: 'emerald', icon: GraduationCap },
  lesson_plan:     { label: 'Lesson plan', tone: 'violet',  icon: BookOpen },
  assignment:      { label: 'Assignment',  tone: 'amber',   icon: ClipboardList },
  submission:      { label: 'Submission',  tone: 'sky',     icon: FileText },
  chat:            { label: 'Chatbot',     tone: 'rose',    icon: MessageSquare },
};

const FILTERS: { key: ActivityItem['type'] | 'all'; label: string }[] = [
  { key: 'all',             label: 'All events' },
  { key: 'teacher_signup',  label: 'Sign-ups' },
  { key: 'student_created', label: 'Learners' },
  { key: 'lesson_plan',     label: 'Lesson plans' },
  { key: 'assignment',      label: 'Assignments' },
  { key: 'submission',      label: 'Submissions' },
];

const MonitorActivity = () => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<ActivityItem['type'] | 'all'>('all');
  const [search, setSearch] = useState('');

  const load = async () => {
    setRefreshing(true);
    try {
      const data = await getUserActivity();
      setActivities(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 45_000);
    return () => clearInterval(t);
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return activities.filter((a) => {
      if (filter !== 'all' && a.type !== filter) return false;
      if (!term) return true;
      return (
        a.description.toLowerCase().includes(term) ||
        (a.user_name ?? '').toLowerCase().includes(term)
      );
    });
  }, [activities, filter, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    activities.forEach((a) => {
      c[a.type] = (c[a.type] ?? 0) + 1;
    });
    return c;
  }, [activities]);

  return (
    <>
      <PageHeader
        title="Activity log"
        icon={Activity}
        subtitle="Every teacher action surfaced from Supabase — sign-ups, lesson plans, assignments, submissions and learner creation."
        actions={
          <button
            onClick={load}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800"
          >
            <RefreshCw className={['h-3.5 w-3.5', refreshing ? 'animate-spin' : ''].join(' ')} />
            Refresh
          </button>
        }
      />

      {/* Filter bar */}
      <Card className="mb-5 p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            <Filter className="ml-1 mr-1 h-3.5 w-3.5 text-slate-500" />
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={[
                  'rounded-full px-3 py-1.5 text-[12px] transition-colors',
                  filter === f.key
                    ? 'bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-500/40'
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
          <div className="w-full sm:w-72">
            <SearchInput value={search} onChange={setSearch} placeholder="Search by teacher or description…" />
          </div>
        </div>
      </Card>

      {/* Feed */}
      {loading ? (
        <LoadingState label="Pulling activity from Supabase…" />
      ) : filtered.length === 0 ? (
        <Card><EmptyState title="No matching activity" hint="Try clearing filters or wait for new events." /></Card>
      ) : (
        <Card>
          <ul className="divide-y divide-slate-800/70">
            {filtered.map((a) => {
              const meta = TYPE_META[a.type] ?? TYPE_META.chat;
              const Icon = meta.icon;
              return (
                <li key={a.id} className="flex items-start gap-3 px-4 py-3 sm:px-5 sm:py-4 hover:bg-slate-800/30">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-800/60 ring-1 ring-slate-700/60">
                    <Icon className="h-4 w-4 text-slate-200" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                      {a.user_name && (
                        <span className="text-xs text-slate-400">by <span className="text-slate-200">{a.user_name}</span></span>
                      )}
                    </div>
                    <div className="truncate text-sm text-slate-100">{a.description}</div>
                  </div>
                  <div className="hidden text-right text-[11px] text-slate-500 sm:block">
                    <div>{formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</div>
                    <div className="text-slate-600">{format(new Date(a.created_at), 'MMM d, HH:mm')}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </>
  );
};

export default MonitorActivity;
