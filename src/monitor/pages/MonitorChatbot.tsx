import { useEffect, useMemo, useState } from 'react';
import { MessagesSquare } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { Card, PageHeader, LoadingState, EmptyState, KpiCard, SectionTitle, SearchInput, Badge } from '../components/ui';
import { getAllChatConversations, getAllConversationMessages } from '../services/monitorData';
import type { ChatbotStats, ConversationMessageStats } from '@/types/admin';
import { format } from 'date-fns';

const MonitorChatbot = () => {
  const [loading, setLoading] = useState(true);
  const [convos, setConvos] = useState<ChatbotStats[]>([]);
  const [messages, setMessages] = useState<ConversationMessageStats[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [c, m] = await Promise.all([getAllChatConversations(), getAllConversationMessages()]);
        setConvos(c);
        setMessages(m);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const userMsgs = messages.filter((m) => m.role === 'user');
  const aiMsgs = messages.filter((m) => m.role === 'assistant');
  const aiWords = aiMsgs.reduce((s, m) => s + (m.content?.trim().split(/\s+/).length || 0), 0);
  const userWords = userMsgs.reduce((s, m) => s + (m.content?.trim().split(/\s+/).length || 0), 0);

  const byGrade = useMemo(() => {
    const m = new Map<string, number>();
    convos.forEach((c) => m.set(c.grade || 'Unknown', (m.get(c.grade || 'Unknown') ?? 0) + 1));
    return Array.from(m.entries()).map(([grade, count]) => ({ grade, count })).sort((a, b) => b.count - a.count);
  }, [convos]);

  const byHour = useMemo(() => {
    const buckets = new Array(24).fill(0);
    messages.forEach((m) => {
      const h = new Date(m.created_at).getHours();
      buckets[h] = (buckets[h] || 0) + 1;
    });
    return buckets.map((count, hour) => ({ hour: `${hour}h`, count }));
  }, [messages]);

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return convos;
    return convos.filter(
      (c) =>
        (c.title || '').toLowerCase().includes(t) ||
        (c.user_name || '').toLowerCase().includes(t) ||
        (c.grade || '').toLowerCase().includes(t)
    );
  }, [convos, search]);

  if (loading)
    return (
      <>
        <PageHeader title="Chatbot" icon={MessagesSquare} subtitle="What teachers are asking the AI assistant." />
        <LoadingState />
      </>
    );

  return (
    <>
      <PageHeader title="Chatbot" icon={MessagesSquare} subtitle="Full visibility into chatbot usage — questions asked, AI words generated, peak hours." />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Conversations" value={convos.length} tone="sky" />
        <KpiCard label="Messages total" value={messages.length} tone="cyan" hint={`${userMsgs.length} user · ${aiMsgs.length} AI`} />
        <KpiCard label="Teacher words" value={userWords} tone="violet" />
        <KpiCard label="AI words generated" value={aiWords} tone="emerald" />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle title="Conversations by grade level" />
          <div className="h-72 px-2 pb-3">
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

        <Card>
          <SectionTitle title="Messages by hour of day" hint="UTC clock; reveals peak teacher engagement windows." />
          <div className="h-72 px-2 pb-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byHour}>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                <XAxis dataKey="hour" stroke="#64748b" fontSize={10} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip contentStyle={{ background: '#0b1020', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" fill="#34d399" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

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
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-b border-slate-800/40">
                    <td className="px-5 py-3 text-slate-100">{c.title || 'Untitled'}</td>
                    <td className="px-4 py-3 text-slate-300">{c.user_name || '—'}</td>
                    <td className="px-4 py-3"><Badge tone="slate">{c.grade || '—'}</Badge></td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-100">{c.message_count ?? 0}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{format(new Date(c.created_at), 'MMM d, yyyy')}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{format(new Date(c.updated_at), 'MMM d, HH:mm')}</td>
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

export default MonitorChatbot;
