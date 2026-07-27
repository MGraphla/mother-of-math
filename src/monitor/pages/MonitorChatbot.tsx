import { useMemo, useState } from 'react';
import {
  MessagesSquare,
  User as UserIcon,
  Bot,
  Hash,
  Clock,
  Sparkles,
  X as XIcon,
  ChevronRight,
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
  AreaChart,
  Area,
} from 'recharts';
import { Card, PageHeader, LoadingState, EmptyState, KpiCard, SectionTitle, SearchInput, Badge } from '../components/ui';
import { getAllChatConversations, getAllConversationMessages } from '../services/monitorData';
import { stripMarkdown } from '../utils/text';
import type { ChatbotStats, ConversationMessageStats } from '@/types/admin';
import { format, formatDistanceToNow, subDays } from 'date-fns';
import { useLiveData } from '../hooks/useLiveData';
import LiveIndicator from '../components/LiveIndicator';
import ExportMenu from '../components/ExportMenu';
import type { ExportPayload } from '../utils/exporters';

interface ChatBundle {
  convos: ChatbotStats[];
  messages: ConversationMessageStats[];
}

const PIE_COLORS = ['#22d3ee', '#a78bfa', '#fbbf24', '#34d399', '#f87171', '#60a5fa', '#fb923c', '#c084fc'];

const MonitorChatbot = () => {
  const { data, loading, refreshing, paused, setPaused, lastUpdated, refresh } =
    useLiveData<ChatBundle>(
      async () => {
        const [convos, messages] = await Promise.all([
          getAllChatConversations(),
          getAllConversationMessages(),
        ]);
        return { convos, messages };
      },
      { intervalMs: 30_000 },
    );

  const [search, setSearch] = useState('');
  const [preview, setPreview] = useState<ChatbotStats | null>(null);

  const convos = data?.convos ?? [];
  const messages = data?.messages ?? [];

  const userMsgs = useMemo(() => messages.filter((m) => m.role === 'user'), [messages]);
  const aiMsgs   = useMemo(() => messages.filter((m) => m.role === 'assistant'), [messages]);
  const userWords = useMemo(() => userMsgs.reduce((s, m) => s + (m.content?.trim().split(/\s+/).length || 0), 0), [userMsgs]);
  const aiWords   = useMemo(() => aiMsgs.reduce((s, m) => s + (m.content?.trim().split(/\s+/).length || 0), 0), [aiMsgs]);
  const avgMsgsPerConv = convos.length ? Math.round(messages.length / convos.length) : 0;
  const avgWordsAi = aiMsgs.length ? Math.round(aiWords / aiMsgs.length) : 0;

  const byGrade = useMemo(() => {
    const m = new Map<string, number>();
    convos.forEach((c) => m.set(c.grade || 'Unknown', (m.get(c.grade || 'Unknown') ?? 0) + 1));
    return [...m.entries()].map(([grade, count]) => ({ grade, count })).sort((a, b) => b.count - a.count);
  }, [convos]);

  const byHour = useMemo(() => {
    const buckets = new Array(24).fill(0);
    messages.forEach((m) => {
      const h = new Date(m.created_at).getHours();
      buckets[h] = (buckets[h] || 0) + 1;
    });
    return buckets.map((count, hour) => ({ hour: `${String(hour).padStart(2, '0')}h`, count }));
  }, [messages]);

  const dailyTrend = useMemo(() => {
    const days: Record<string, { date: string; user: number; ai: number }> = {};
    for (let i = 13; i >= 0; i--) {
      const d = subDays(new Date(), i);
      const key = format(d, 'MMM d');
      days[key] = { date: key, user: 0, ai: 0 };
    }
    messages.forEach((m) => {
      const key = format(new Date(m.created_at), 'MMM d');
      if (days[key]) {
        if (m.role === 'user') days[key].user++;
        else days[key].ai++;
      }
    });
    return Object.values(days);
  }, [messages]);

  const topTeachers = useMemo(() => {
    const m = new Map<string, { name: string; convos: number; msgs: number }>();
    convos.forEach((c) => {
      const k = c.user_name || 'Unknown';
      const cur = m.get(k) ?? { name: k, convos: 0, msgs: 0 };
      cur.convos += 1;
      cur.msgs += c.message_count ?? 0;
      m.set(k, cur);
    });
    return [...m.values()].sort((a, b) => b.msgs - a.msgs).slice(0, 8);
  }, [convos]);

  // Top words asked by teachers
  const topWords = useMemo(() => {
    const stop = new Set([
      'the','a','an','is','are','of','to','and','for','in','on','i','my','me','you','your',
      'that','this','it','as','do','can','how','what','why','with','if','be','was','were',
      'have','has','had','will','would','should','could','about','please','help','at','by',
      'from','or','but','not','so','one','some','any','more','most','they','them','their',
      'there','then','than','also','just','very','also','our','we','us','use','using','need',
      'students','student','class','grade','teacher','math','maths','question','questions',
    ]);
    const counts = new Map<string, number>();
    userMsgs.forEach((m) => {
      const words = (m.content || '').toLowerCase().match(/[a-z]+/g) || [];
      words.forEach((w) => {
        if (w.length < 4 || stop.has(w)) return;
        counts.set(w, (counts.get(w) ?? 0) + 1);
      });
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24);
  }, [userMsgs]);
  const maxWordCount = topWords[0]?.[1] ?? 1;

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return convos;
    return convos.filter(
      (c) =>
        (c.title || '').toLowerCase().includes(t) ||
        (c.user_name || '').toLowerCase().includes(t) ||
        (c.grade || '').toLowerCase().includes(t),
    );
  }, [convos, search]);

  const previewMessages = useMemo(() => {
    if (!preview) return [] as ConversationMessageStats[];
    return messages
      .filter((m) => m.conversation_id === preview.id)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [preview, messages]);

  const buildExportPayload = (): ExportPayload => ({
    fileStem: 'qeda-chatbot',
    title: 'QEDA Education Monitor — AI Chatbot',
    subtitle: `${convos.length} conversations · ${messages.length} messages · ${aiWords.toLocaleString()} AI words generated`,
    summary:
      `Teachers held ${convos.length.toLocaleString()} conversations with the AI assistant. ` +
      `${userMsgs.length.toLocaleString()} teacher questions produced ${aiMsgs.length.toLocaleString()} AI replies ` +
      `(${aiWords.toLocaleString()} words total, ${avgWordsAi} avg per reply). ` +
      `Average ${avgMsgsPerConv} messages per conversation.`,
    kpis: [
      { label: 'Conversations',        value: convos.length },
      { label: 'Messages',             value: messages.length, hint: `${userMsgs.length} user · ${aiMsgs.length} AI` },
      { label: 'Teacher words',        value: userWords },
      { label: 'AI words generated',   value: aiWords },
      { label: 'Avg msgs/conv',        value: avgMsgsPerConv },
      { label: 'Avg AI words/reply',   value: avgWordsAi },
      { label: 'Unique teachers',      value: new Set(convos.map((c) => c.user_name).filter(Boolean)).size },
      { label: 'Distinct grade levels',value: byGrade.length },
    ],
    tables: [
      {
        title: 'Conversations',
        columns: ['Started', 'Title', 'Teacher', 'Grade', 'Messages', 'Last message'],
        rows: filtered.map((c) => [
          format(new Date(c.created_at), 'yyyy-MM-dd'),
          c.title || 'Untitled',
          c.user_name ?? '—',
          c.grade ?? '—',
          c.message_count ?? 0,
          format(new Date(c.updated_at), 'yyyy-MM-dd HH:mm'),
        ]),
      },
      {
        title: 'Top teachers by chat volume',
        columns: ['Teacher', 'Conversations', 'Messages'],
        rows: topTeachers.map((t) => [t.name, t.convos, t.msgs]),
      },
      {
        title: 'Conversations by grade',
        columns: ['Grade', 'Conversations'],
        rows: byGrade.map((g) => [g.grade, g.count]),
      },
      {
        title: 'Top question keywords',
        columns: ['Word', 'Mentions'],
        rows: topWords.map(([w, n]) => [w, n]),
      },
    ],
  });

  if (loading) {
    return (
      <>
        <PageHeader title="Chatbot" icon={MessagesSquare} subtitle="What teachers are asking the AI assistant." />
        <LoadingState />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Chatbot"
        icon={MessagesSquare}
        subtitle="Full visibility into AI assistant usage — questions asked, AI words generated, peak hours, top topics."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <LiveIndicator
              lastUpdated={lastUpdated}
              refreshing={refreshing}
              paused={paused}
              onTogglePause={() => setPaused(!paused)}
              onRefresh={refresh}
              intervalMs={30_000}
            />
            <ExportMenu build={buildExportPayload} disabled={loading} />
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Conversations"       value={convos.length}  icon={MessagesSquare} tone="sky"     />
        <KpiCard label="Messages total"      value={messages.length} icon={Hash}          tone="cyan"    hint={`${userMsgs.length} user · ${aiMsgs.length} AI`} />
        <KpiCard label="Teacher words"       value={userWords}      icon={UserIcon}       tone="violet"  />
        <KpiCard label="AI words generated"  value={aiWords}        icon={Bot}            tone="emerald" hint={`${avgWordsAi} avg per reply`} />
      </div>

      {/* Daily trend */}
      <Card className="mt-5">
        <SectionTitle title="Last 14 days · message volume" hint="Teacher questions vs AI replies." right={<Sparkles className="h-3.5 w-3.5 text-amber-400" />} />
        <div className="h-64 px-2 pb-3">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailyTrend} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="cbU" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a78bfa" stopOpacity={0.55} /><stop offset="100%" stopColor="#a78bfa" stopOpacity={0} /></linearGradient>
                <linearGradient id="cbA" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#34d399" stopOpacity={0.55} /><stop offset="100%" stopColor="#34d399" stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
              <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
              <Tooltip contentStyle={{ background: '#0b1020', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" name="Teacher" dataKey="user" stroke="#a78bfa" fill="url(#cbU)" strokeWidth={2} />
              <Area type="monotone" name="AI"      dataKey="ai"   stroke="#34d399" fill="url(#cbA)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle title="Conversations by grade level" />
          <div className="h-72 px-2 pb-3">
            {byGrade.length === 0 ? <EmptyState title="No data" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byGrade} dataKey="count" nameKey="grade" cx="50%" cy="50%" innerRadius={50} outerRadius={100} paddingAngle={2}>
                    {byGrade.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Legend wrapperStyle={{ fontSize: 11, color: '#cbd5e1' }} />
                  <Tooltip contentStyle={{ background: '#0b1020', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card>
          <SectionTitle title="Messages by hour of day" hint="Reveals peak teacher engagement windows." right={<Clock className="h-3.5 w-3.5 text-slate-500" />} />
          <div className="h-72 px-2 pb-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byHour}>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                <XAxis dataKey="hour" stroke="#64748b" fontSize={10} />
                <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#0b1020', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" fill="#34d399" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Word cloud + Top teachers */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionTitle title="What teachers are asking" hint="Top question keywords across all conversations." />
          {topWords.length === 0 ? (
            <EmptyState title="No keywords yet" />
          ) : (
            <div className="flex flex-wrap items-baseline gap-2 px-5 pb-5">
              {topWords.map(([word, n]) => {
                const scale = 0.85 + (n / maxWordCount) * 1.4;
                const opacity = 0.5 + (n / maxWordCount) * 0.5;
                return (
                  <span
                    key={word}
                    className="rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1 font-medium text-emerald-200 transition-all hover:bg-emerald-500/15"
                    style={{ fontSize: `${scale}rem`, opacity }}
                    title={`${word} · ${n} mentions`}
                  >
                    {word}
                    <span className="ml-1.5 text-[10px] text-emerald-400/70">{n}</span>
                  </span>
                );
              })}
            </div>
          )}
        </Card>

        <Card>
          <SectionTitle title="Top chat users" />
          <ul className="divide-y divide-slate-800/60 px-1">
            {topTeachers.length === 0 ? (
              <EmptyState title="No data" />
            ) : (
              topTeachers.map((t, i) => (
                <li key={t.name} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold text-slate-300">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-100">{t.name}</span>
                  <span className="text-[11px] text-slate-500 tabular-nums">{t.convos} convs</span>
                  <span className="text-[11px] font-semibold text-emerald-300 tabular-nums">{t.msgs} msgs</span>
                </li>
              ))
            )}
          </ul>
        </Card>
      </div>

      {/* Conversations table */}
      <Card className="mt-5">
        <SectionTitle
          title="All conversations"
          hint={`${filtered.length} of ${convos.length}`}
          right={<div className="w-64"><SearchInput value={search} onChange={setSearch} placeholder="Search title, teacher, grade…" /></div>}
        />
        {filtered.length === 0 ? (
          <EmptyState title="No conversations match this search" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800/70 text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3">Title</th>
                  <th className="px-4 py-3">Teacher</th>
                  <th className="px-4 py-3">Grade</th>
                  <th className="px-4 py-3 text-right">Messages</th>
                  <th className="px-4 py-3">Started</th>
                  <th className="px-4 py-3">Last message</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-b border-slate-800/40 hover:bg-emerald-500/5">
                    <td className="px-5 py-3 text-slate-100">{c.title || 'Untitled'}</td>
                    <td className="px-4 py-3 text-slate-300">{c.user_name || '—'}</td>
                    <td className="px-4 py-3"><Badge tone="slate">{c.grade || '—'}</Badge></td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-100">{c.message_count ?? 0}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{format(new Date(c.created_at), 'MMM d, yyyy')}</td>
                    <td className="px-4 py-3 text-xs text-slate-400" title={format(new Date(c.updated_at), 'PPpp')}>
                      {formatDistanceToNow(new Date(c.updated_at), { addSuffix: true })}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button onClick={() => setPreview(c)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-emerald-300 hover:bg-emerald-500/10">
                        Read <ChevronRight className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Conversation preview modal */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setPreview(null)}>
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-emerald-500/20 bg-[#0a1410] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-5 py-4">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-100 line-clamp-1">{preview.title || 'Untitled conversation'}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                  <span>{preview.user_name || '—'}</span>
                  <span>·</span>
                  <Badge tone="slate">{preview.grade || '—'}</Badge>
                  <span>·</span>
                  <span>{preview.message_count} msgs</span>
                  <span>·</span>
                  <span>{format(new Date(preview.created_at), 'MMM d, yyyy')}</span>
                </div>
              </div>
              <button onClick={() => setPreview(null)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"><XIcon className="h-4 w-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {previewMessages.length === 0 ? (
                <EmptyState title="Messages not loaded" hint="Open the page again to refresh." />
              ) : (
                previewMessages.map((m) => (
                  <div
                    key={m.id}
                    className={[
                      'rounded-xl border px-4 py-3 text-sm',
                      m.role === 'user'
                        ? 'border-violet-500/20 bg-violet-500/5 text-slate-100'
                        : 'border-emerald-500/20 bg-emerald-500/5 text-emerald-50/90',
                    ].join(' ')}
                  >
                    <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-500">
                      {m.role === 'user' ? <UserIcon className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
                      <span>{m.role === 'user' ? 'Teacher' : 'AI assistant'}</span>
                      <span>·</span>
                      <span>{format(new Date(m.created_at), 'MMM d, HH:mm')}</span>
                    </div>
                    <div className="whitespace-pre-wrap break-words leading-relaxed">
                      {m.role === 'assistant' ? stripMarkdown(m.content) : m.content}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MonitorChatbot;
