/**
 * Teacher Agent Page
 *
 * A modern, MCP-style agent UI that:
 *   - Talks to OpenRouter with function calling.
 *   - Exposes typed tools (students, assignments, curriculum CM/NG, …).
 *   - Auto-runs read tools, requires teacher approval for writes,
 *     emphasises destructive actions.
 *   - Renders tool cards with human-readable summaries; raw payloads are optional.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import {
  Bot,
  Send,
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  Trash2,
  ExternalLink,
  AlertTriangle,
  MoreHorizontal,
  Wrench,
  Sparkles,
  LayoutDashboard,
  TrendingDown,
  Megaphone,
  BookOpen,
  Search,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';

import { buildToolRegistry } from '@/services/agent/tools';
import { buildAgentSystemPrompt } from '@/services/agent/systemPrompt';
import {
  callAgentModel,
  toolsToOpenRouterFormat,
} from '@/services/agent/openrouter';
import {
  buildOpenRouterMessages,
  normalizeAssistantToolTurn,
} from '@/services/agent/transcript';
import type {
  AgentMessage,
  RegisteredTool,
  ToolCallRecord,
  ToolContext,
  ToolRiskLevel,
} from '@/services/agent/types';

/* ── Helpers ─────────────────────────────────────────── */

const MAX_AGENT_STEPS = 12;
const STORAGE_KEY = 'mom.teacherAgent.history.v2';

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function summarizeJson(value: unknown, max = 4000): string {
  try {
    const text =
      typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    if (!text) return '';
    return text.length > max ? `${text.slice(0, max)}\n…[truncated]` : text;
  } catch {
    return String(value);
  }
}

function formatKeyLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Strip fenced code blocks to plain text; remove common Markdown noise for display. */
function formatAssistantTextForDisplay(raw: string): string {
  let t = raw.replace(/```\w*\n?([\s\S]*?)```/g, (_, inner: string) => `\n${String(inner).trim()}\n`);
  t = t.replace(/\*\*([^*]+)\*\*/g, '$1');
  t = t.replace(/^#{1,6}\s+/gm, '');
  return t.trim();
}

function humanizeToolResult(result: unknown, depth = 0): string {
  if (depth > 3) return 'Nested data (see technical details if needed).';
  if (result === null || result === undefined) return 'No data returned.';

  if (typeof result === 'string') {
    const t = result.trim();
    if (
      (t.startsWith('{') && t.endsWith('}')) ||
      (t.startsWith('[') && t.endsWith(']'))
    ) {
      try {
        return humanizeToolResult(JSON.parse(t), depth);
      } catch {
        return t.length > 2500 ? `${t.slice(0, 2500)}…` : t;
      }
    }
    return t.length > 4000 ? `${t.slice(0, 4000)}…` : t;
  }

  if (typeof result === 'number' || typeof result === 'boolean') {
    return String(result);
  }
  if (typeof result !== 'object') return String(result);

  if (Array.isArray(result)) {
    if (result.length === 0) return 'Empty list.';
    const lines: string[] = [`${result.length} item(s):`];
    const sample = result.slice(0, 20);
    for (const item of sample) {
      if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
        const o = item as Record<string, unknown>;
        const label =
          (typeof o.full_name === 'string' && o.full_name) ||
          (typeof o.title === 'string' && o.title) ||
          (typeof o.name === 'string' && o.name) ||
          (typeof o.email === 'string' && o.email) ||
          (typeof o.student_name === 'string' && o.student_name) ||
          (typeof o.id === 'string' && `Record ${o.id.slice(0, 8)}…`);
        if (label) lines.push(`  • ${label}`);
        else {
          const s = JSON.stringify(o);
          lines.push(`  • ${s.length > 140 ? `${s.slice(0, 140)}…` : s}`);
        }
      } else {
        const s = String(item);
        lines.push(`  • ${s.length > 200 ? `${s.slice(0, 200)}…` : s}`);
      }
    }
    if (result.length > 20) lines.push(`  … and ${result.length - 20} more`);
    const joined = lines.join('\n');
    return joined.length > 8000 ? `${joined.slice(0, 8000)}…` : joined;
  }

  const obj = result as Record<string, unknown>;

  if (typeof obj.ok === 'boolean') {
    if (obj.ok === false) {
      const err = obj.error ?? obj.message ?? obj.detail ?? 'Request failed';
      return typeof err === 'string' ? err : humanizeToolResult(err, depth + 1);
    }
  }

  if (typeof obj.teacher_plaintext_list === 'string' && obj.teacher_plaintext_list.trim()) {
    const text = obj.teacher_plaintext_list.trim();
    return text.length > 12000 ? `${text.slice(0, 12000)}…` : text;
  }
  if (typeof obj.teacher_plaintext_excerpt === 'string' && obj.teacher_plaintext_excerpt.trim()) {
    const text = obj.teacher_plaintext_excerpt.trim();
    return text.length > 12000 ? `${text.slice(0, 12000)}…` : text;
  }

  const lines: string[] = [];

  if (typeof obj.message === 'string' && obj.message.trim()) {
    lines.push(obj.message.trim());
  }

  for (const [key, val] of Object.entries(obj)) {
    if (
      ['ok', '_agent', 'access_token', 'tool_call_id', 'teacher_plaintext_list', 'teacher_plaintext_excerpt'].includes(
        key,
      )
    )
      continue;
    if (val === null || val === undefined) continue;
    if (typeof val === 'object') {
      lines.push(`${formatKeyLabel(key)}:\n${humanizeToolResult(val, depth + 1)}`);
    } else {
      lines.push(`${formatKeyLabel(key)}: ${String(val)}`);
    }
  }

  const body = lines.join('\n\n').trim();
  const out = body || 'Done.';
  return out.length > 10000 ? `${out.slice(0, 10000)}…` : out;
}

/** Split tool rows: successful reads → collapsed summary; reads still running → one strip; writes/errors → full cards. */
function partitionAssistantTools(
  toolCalls: ToolCallRecord[],
  toolByName: Map<string, RegisteredTool>,
): {
  silentSuccess: ToolCallRecord[];
  readActive: ToolCallRecord[];
  attention: ToolCallRecord[];
} {
  const silentSuccess: ToolCallRecord[] = [];
  const readActive: ToolCallRecord[] = [];
  const attention: ToolCallRecord[] = [];

  for (const tc of toolCalls) {
    const def = toolByName.get(tc.name);
    const risk = def?.risk ?? 'safe';

    /* Curriculum tool: always show full card so topic lists are visible (not hidden in collapsed read summary). */
    if (tc.name === 'query_official_curriculum') {
      if (tc.status === 'running') {
        readActive.push(tc);
      } else {
        attention.push(tc);
      }
      continue;
    }

    if (risk !== 'safe') {
      attention.push(tc);
      continue;
    }

    if (tc.status === 'success') {
      silentSuccess.push(tc);
    } else if (tc.status === 'running') {
      readActive.push(tc);
    } else {
      attention.push(tc);
    }
  }

  return { silentSuccess, readActive, attention };
}

function risksOrder(r: ToolRiskLevel): number {
  return r === 'safe' ? 0 : r === 'write' ? 1 : 2;
}

const RISK_BADGE: Record<ToolRiskLevel, { label: string; className: string }> = {
  safe: {
    label: 'Read',
    className:
      'border-emerald-200/80 bg-emerald-50/90 text-emerald-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]',
  },
  write: {
    label: 'Write',
    className:
      'border-amber-200/80 bg-amber-50/90 text-amber-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]',
  },
  destructive: {
    label: 'Delete',
    className: 'border-rose-200/80 bg-rose-50/90 text-rose-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]',
  },
};

const STATUS_LABEL: Record<ToolCallRecord['status'], string> = {
  pending_confirmation: 'Needs approval',
  running: 'Running',
  success: 'Complete',
  error: 'Failed',
  denied: 'Denied',
};

const STATUS_COLOR: Record<ToolCallRecord['status'], string> = {
  pending_confirmation:
    'border-amber-200/70 bg-gradient-to-br from-amber-50/95 via-white to-orange-50/40 shadow-sm ring-1 ring-amber-100/50',
  running:
    'border-cyan-200/70 bg-gradient-to-br from-cyan-50/90 via-white to-slate-50/30 shadow-sm ring-1 ring-cyan-100/40',
  success:
    'border-emerald-200/60 bg-gradient-to-br from-emerald-50/50 via-white to-white shadow-sm ring-1 ring-emerald-100/40',
  error: 'border-rose-200/80 bg-gradient-to-br from-rose-50/90 to-white shadow-sm ring-1 ring-rose-100/50',
  denied: 'border-slate-200/80 bg-slate-50/80 shadow-sm ring-1 ring-slate-200/40',
};

const STATUS_BAR: Record<ToolCallRecord['status'], string> = {
  pending_confirmation: 'bg-amber-400',
  running: 'bg-cyan-400',
  success: 'bg-emerald-500',
  error: 'bg-rose-500',
  denied: 'bg-slate-400',
};

/* ── Tool result upsert (one row per tool_call_id) ───── */

const SUGGESTIONS: Array<{
  label: string;
  description: string;
  prompt: string;
  icon: LucideIcon;
}> = [
  {
    label: 'Friday close-out',
    description: 'Ungraded work, missing submissions, next steps',
    prompt:
      'Give me a "Friday close-out" report: list every assignment that still has ungraded submissions, who has not submitted what, and propose a short next-step for each. Use my real data.',
    icon: Sparkles,
  },
  {
    label: 'Class snapshot',
    description: 'Roster, assignments, overdue, pending grades',
    prompt:
      'Give me a one-paragraph snapshot of my class right now: total students, active assignments, overdue assignments, and pending grades. Use my real data.',
    icon: LayoutDashboard,
  },
  {
    label: 'Who is falling behind?',
    description: 'Names, patterns, missing work',
    prompt:
      'Identify learners in my class who appear to be falling behind based on submissions and average score. Show me names + the assignments they are missing.',
    icon: TrendingDown,
  },
  {
    label: 'Draft an announcement',
    description: 'Polished copy; you approve before post',
    prompt:
      'Draft an announcement reminding learners about this week\'s active assignments and their due dates. Then ask me to confirm before posting.',
    icon: Megaphone,
  },
  {
    label: 'Generate lesson plan',
    description: 'Structured plan aligned to your context',
    prompt:
      'Generate a Primary 4 lesson plan on "Fractions: equivalent and simplification" in English, Cameroon curriculum.',
    icon: BookOpen,
  },
];

/* ── Page ─────────────────────────────────────────────── */

export default function AgentPage() {
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const tools = useMemo(() => buildToolRegistry(), []);
  const toolByName = useMemo(() => {
    const m = new Map<string, RegisteredTool>();
    tools.forEach((t) => m.set(t.name, t));
    return m;
  }, [tools]);
  const orTools = useMemo(() => toolsToOpenRouterFormat(tools), [tools]);

  const ctx: ToolContext = useMemo(
    () => ({
      teacherId: user?.id || '',
      teacherName: profile?.full_name || profile?.email || 'Teacher',
      country:
        (profile?.country?.toLowerCase().includes('niger') ? 'nigeria' : 'cameroon') as
          | 'cameroon'
          | 'nigeria',
      language: 'english',
    }),
    [user?.id, profile?.full_name, profile?.email, profile?.country],
  );

  const systemPrompt = useMemo(() => buildAgentSystemPrompt(ctx), [ctx]);

  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [lastModelUsed, setLastModelUsed] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<AgentMessage[]>([]);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const agentStepRef = useRef(0);

  // Keep ref in sync — used by async loops that started before re-renders.
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Auto-scroll on new content.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  // Persist last conversation in localStorage (best-effort, capped).
  useEffect(() => {
    try {
      if (messages.length === 0) {
        localStorage.removeItem(STORAGE_KEY);
        return;
      }
      const compact = messages.slice(-30);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(compact));
    } catch {
      /* ignore quota */
    }
  }, [messages]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as AgentMessage[];
        if (Array.isArray(parsed)) setMessages(parsed);
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Updaters ─────────────────────────────────────── */

  const updateMessages = useCallback(
    (updater: (prev: AgentMessage[]) => AgentMessage[]) => {
      setMessages((prev) => {
        const next = updater(prev);
        messagesRef.current = next;
        return next;
      });
    },
    [],
  );

  const updateToolCall = useCallback(
    (callId: string, patch: Partial<ToolCallRecord>) => {
      updateMessages((prev) =>
        prev.map((m) => {
          if (!m.toolCalls) return m;
          if (!m.toolCalls.some((tc) => tc.id === callId)) return m;
          return {
            ...m,
            toolCalls: m.toolCalls.map((tc) =>
              tc.id === callId ? { ...tc, ...patch } : tc,
            ),
          };
        }),
      );
    },
    [updateMessages],
  );

  const upsertToolMessageResult = useCallback(
    (call: ToolCallRecord) => {
      const content = summarizeJson(
        call.status === 'denied'
          ? { ok: false, denied: true, reason: 'User denied the action.' }
          : call.status === 'error'
            ? { ok: false, error: call.error || 'Unknown error' }
            : call.result ?? { ok: true },
      );
      updateMessages((prev) => {
        const idx = prev.findIndex(
          (m) => m.role === 'tool' && m.toolCallId === call.id,
        );
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = {
            ...next[idx]!,
            content,
            toolPlaceholder: false,
          };
          messagesRef.current = next;
          return next;
        }
        const next = [
          ...prev,
          {
            id: makeId('msg'),
            role: 'tool' as const,
            content,
            toolCallId: call.id,
            toolName: call.name,
            createdAt: Date.now(),
            toolPlaceholder: false,
          },
        ];
        messagesRef.current = next;
        return next;
      });
    },
    [updateMessages],
  );

  /* ── Core run loop ────────────────────────────────── */

  const runOneStep = useCallback(
    async (): Promise<void> => {
      if (!user?.id) {
        toast({
          variant: 'destructive',
          title: 'Not signed in',
          description: 'You need to be signed in as a teacher to use the agent.',
        });
        return;
      }

      setBusy(true);
      const ac = new AbortController();
      abortRef.current = ac;

      try {
        const orMessages = buildOpenRouterMessages(systemPrompt, messagesRef.current);
        const result = await callAgentModel({
          messages: orMessages,
          tools: orTools,
          signal: ac.signal,
        });
        setLastModelUsed(result.modelUsed);

        // Build assistant message.
        const toolCallRecords: ToolCallRecord[] = (result.toolCalls || []).map((tc) => {
          const def = toolByName.get(tc.name);
          const initialStatus: ToolCallRecord['status'] =
            !def ? 'error' : def.risk === 'safe' ? 'running' : 'pending_confirmation';
          return {
            id: tc.id,
            name: tc.name,
            args: tc.args || {},
            status: initialStatus,
            error: def ? undefined : `Unknown tool "${tc.name}"`,
            startedAt: Date.now(),
          };
        });

        const assistantMsg: AgentMessage = {
          id: makeId('msg'),
          role: 'assistant',
          content: result.content || '',
          toolCalls: toolCallRecords.length ? toolCallRecords : undefined,
          createdAt: Date.now(),
        };

        updateMessages((prev) => [...prev, assistantMsg]);

        if (!toolCallRecords.length) {
          // Final answer.
          setBusy(false);
          abortRef.current = null;
          return;
        }

        // Auto-execute every safe tool sequentially. Pause for the rest.
        for (const call of toolCallRecords) {
          const def = toolByName.get(call.name);
          if (!def) {
            updateToolCall(call.id, {
              status: 'error',
              error: `Unknown tool "${call.name}"`,
              completedAt: Date.now(),
            });
            upsertToolMessageResult({ ...call, status: 'error' });
            continue;
          }
          if (def.risk !== 'safe') {
            // Wait for user approval through the UI.
            continue;
          }
          try {
            const value = await def.execute(call.args, ctx);
            updateToolCall(call.id, {
              status: 'success',
              result: value,
              completedAt: Date.now(),
            });
            upsertToolMessageResult({
              ...call,
              status: 'success',
              result: value,
            });
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            updateToolCall(call.id, {
              status: 'error',
              error: msg,
              completedAt: Date.now(),
            });
            upsertToolMessageResult({ ...call, status: 'error', error: msg });
          }
        }

        updateMessages((prev) =>
          normalizeAssistantToolTurn(prev, assistantMsg.id),
        );

        // Are any tool calls still pending confirmation? If so, stop here.
        const stillPending = messagesRef.current
          .flatMap((m) => m.toolCalls || [])
          .some((tc) => tc.status === 'pending_confirmation' || tc.status === 'running');

        if (stillPending) {
          setBusy(false);
          abortRef.current = null;
          return;
        }

        // Otherwise continue the loop (model will read tool results next turn).
        agentStepRef.current += 1;
        if (agentStepRef.current >= MAX_AGENT_STEPS) {
          updateMessages((prev) => [
            ...prev,
            {
              id: makeId('msg'),
              role: 'assistant',
              content:
                'Stopped after the maximum number of automated steps. Ask me to continue if you need more.',
              createdAt: Date.now(),
            },
          ]);
          setBusy(false);
          abortRef.current = null;
          return;
        }
        await runOneStep();
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') {
          updateMessages((prev) => [
            ...prev,
            {
              id: makeId('msg'),
              role: 'assistant',
              content: 'Cancelled.',
              createdAt: Date.now(),
            },
          ]);
        } else {
          const msg = err instanceof Error ? err.message : String(err);
          updateMessages((prev) => [
            ...prev,
            {
              id: makeId('msg'),
              role: 'assistant',
              content: `Something went wrong: ${msg}`,
              createdAt: Date.now(),
            },
          ]);
          toast({
            variant: 'destructive',
            title: 'Agent error',
            description: msg,
          });
        }
        setBusy(false);
        abortRef.current = null;
      }
    },
    [
      ctx,
      orTools,
      systemPrompt,
      toast,
      toolByName,
      updateMessages,
      updateToolCall,
      upsertToolMessageResult,
      user?.id,
    ],
  );

  /* ── Public actions ───────────────────────────────── */

  const sendUserMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy) return;

      agentStepRef.current = 0;
      setLastModelUsed(null);
      updateMessages((prev) => [
        ...prev,
        {
          id: makeId('msg'),
          role: 'user',
          content: trimmed,
          createdAt: Date.now(),
        },
      ]);
      setInput('');
      // Wait for state flush so messagesRef has the latest message.
      await Promise.resolve();
      void runOneStep();
    },
    [busy, runOneStep, updateMessages],
  );

  const cancelRun = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clearConversation = useCallback(() => {
    setMessages([]);
    messagesRef.current = [];
    agentStepRef.current = 0;
    setLastModelUsed(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const approveCall = useCallback(
    async (call: ToolCallRecord) => {
      const def = toolByName.get(call.name);
      if (!def) return;
      updateToolCall(call.id, { status: 'running' });
      try {
        const value = await def.execute(call.args, ctx);
        updateToolCall(call.id, {
          status: 'success',
          result: value,
          completedAt: Date.now(),
        });
        upsertToolMessageResult({ ...call, status: 'success', result: value });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        updateToolCall(call.id, {
          status: 'error',
          error: msg,
          completedAt: Date.now(),
        });
        upsertToolMessageResult({ ...call, status: 'error', error: msg });
      }
      // Continue the loop if no other pending calls remain.
      const stillPending = messagesRef.current
        .flatMap((m) => m.toolCalls || [])
        .some((tc) => tc.status === 'pending_confirmation' || tc.status === 'running');
      if (!stillPending) {
        agentStepRef.current += 1;
        if (agentStepRef.current >= MAX_AGENT_STEPS) {
          updateMessages((prev) => [
            ...prev,
            {
              id: makeId('msg'),
              role: 'assistant',
              content:
                'Stopped after the maximum number of automated steps. Ask me to continue if you need more.',
              createdAt: Date.now(),
            },
          ]);
          return;
        }
        void runOneStep();
      }
    },
    [upsertToolMessageResult, ctx, runOneStep, toolByName, updateToolCall, updateMessages],
  );

  const denyCall = useCallback(
    (call: ToolCallRecord) => {
      updateToolCall(call.id, { status: 'denied', completedAt: Date.now() });
      upsertToolMessageResult({ ...call, status: 'denied' });
      const stillPending = messagesRef.current
        .flatMap((m) => m.toolCalls || [])
        .some((tc) => tc.status === 'pending_confirmation' || tc.status === 'running');
      if (!stillPending) {
        agentStepRef.current += 1;
        if (agentStepRef.current >= MAX_AGENT_STEPS) {
          updateMessages((prev) => [
            ...prev,
            {
              id: makeId('msg'),
              role: 'assistant',
              content:
                'Stopped after the maximum number of automated steps. Ask me to continue if you need more.',
              createdAt: Date.now(),
            },
          ]);
          return;
        }
        void runOneStep();
      }
    },
    [upsertToolMessageResult, runOneStep, updateToolCall, updateMessages],
  );

  /* ── Derived UI state ─────────────────────────────── */

  const pendingCallCount = useMemo(
    () =>
      messages
        .flatMap((m) => m.toolCalls || [])
        .filter((tc) => tc.status === 'pending_confirmation').length,
    [messages],
  );

  const sortedTools = useMemo(
    () => [...tools].sort((a, b) => risksOrder(a.risk) - risksOrder(b.risk) || a.name.localeCompare(b.name)),
    [tools],
  );

  const visibleMessages = useMemo(
    () => messages.filter((m) => m.role !== 'tool'),
    [messages],
  );

  return (
    <TooltipProvider delayDuration={280}>
      <div className="-mx-4 flex min-h-0 flex-1 flex-col overflow-hidden bg-gradient-to-b from-muted/50 via-background to-emerald-50/15 sm:-mx-6">
        <header className="relative shrink-0 overflow-hidden border-b border-white/10 bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-800 text-white shadow-md shadow-emerald-900/20">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.07)_0%,transparent_42%,rgba(255,255,255,0.05)_78%,transparent_100%)]" />
            <div className="absolute -right-24 -top-28 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-32 left-10 h-72 w-72 rounded-full bg-cyan-300/25 blur-3xl" />
          </div>
          <div className="relative z-10 px-4 pb-5 pt-5 sm:px-7 sm:pb-6 sm:pt-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/85">
                    Assistant
                  </span>
                  <Badge
                    variant="secondary"
                    className="border-0 bg-white/15 text-[10px] font-medium text-white hover:bg-white/25"
                  >
                    {tools.length} tools
                  </Badge>
                </div>
                <h1 className="text-balance text-2xl font-bold tracking-tight sm:text-3xl lg:text-[2rem] lg:leading-tight">
                  MAMA Agent
                </h1>
                <p className="max-w-2xl text-sm leading-relaxed text-white/85 sm:text-[0.9375rem]">
                  Grounded answers from your roster, assignments, and submissions. Sensitive
                  changes always wait for your approval.
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2 lg:pb-0.5">
                <Dialog open={showTools} onOpenChange={setShowTools}>
                  <DialogTrigger asChild>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-9 border-0 bg-white/15 text-xs font-medium text-white shadow-sm backdrop-blur-sm hover:bg-white/25"
                    >
                      <Wrench className="mr-1.5 h-3.5 w-3.5 opacity-90" />
                      Tool library
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[88vh] max-w-lg gap-0 overflow-hidden border-border/60 p-0 sm:max-w-xl">
                    <div className="border-b border-border/60 bg-gradient-to-r from-emerald-600/10 via-teal-600/5 to-transparent px-6 py-4">
                      <DialogHeader className="space-y-1 text-left">
                        <DialogTitle className="text-lg font-semibold tracking-tight">
                          Tool library
                        </DialogTitle>
                        <DialogDescription className="text-xs leading-relaxed text-muted-foreground">
                          {tools.length} capabilities. Reads run automatically; writes and deletes
                          require your confirmation.
                        </DialogDescription>
                      </DialogHeader>
                    </div>
                    <div className="p-4 sm:p-5">
                      <ToolCatalog tools={sortedTools} />
                    </div>
                  </DialogContent>
                </Dialog>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-9 w-9 border-0 bg-white/15 text-white shadow-sm backdrop-blur-sm hover:bg-white/25"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">More</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 rounded-xl border-border/80 p-1 shadow-lg">
                    <DropdownMenuItem
                      disabled={busy || messages.length === 0}
                      onClick={clearConversation}
                      className="cursor-pointer rounded-lg text-xs"
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                      Clear conversation
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </header>

        <div className="relative flex min-h-0 flex-1 flex-col px-3 pb-3 pt-3 sm:px-5 sm:pb-4 sm:pt-4">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-primary/[0.07] to-transparent" />

          {pendingCallCount > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative z-[1] mb-3 flex items-center gap-3 rounded-xl border border-amber-300/50 bg-gradient-to-r from-amber-50 to-orange-50/80 px-3 py-2.5 text-xs text-amber-950 shadow-sm dark:border-amber-500/30 dark:from-amber-950/40 dark:to-amber-900/20 dark:text-amber-50"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/15">
                <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-200" />
              </div>
              <div className="min-w-0 leading-snug">
                <p className="font-semibold">Action required</p>
                <p className="text-[11px] text-amber-900/80 dark:text-amber-100/80">
                  {pendingCallCount} change{pendingCallCount === 1 ? '' : 's'} waiting for your approval
                  in the cards below.
                </p>
              </div>
            </motion.div>
          )}

          <div className="relative z-[1] flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/90 shadow-[0_24px_48px_-18px_rgba(15,23,42,0.14)] ring-1 ring-black/[0.04] backdrop-blur-md dark:bg-card/80 dark:ring-white/[0.06]">
            <div
              ref={scrollerRef}
              className="agent-chat-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain scroll-smooth px-3 py-4 sm:px-6 sm:py-6"
            >
              {visibleMessages.length === 0 ? (
                <EmptyState onPick={(p) => void sendUserMessage(p)} />
              ) : (
                <div className="mx-auto max-w-3xl space-y-1 sm:max-w-4xl">
                  <AnimatePresence initial={false} mode="popLayout">
                    {visibleMessages.map((msg) => (
                      <motion.div
                        key={msg.id}
                        layout
                        initial={{ opacity: 0, y: 14, filter: 'blur(4px)' }}
                        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                        className="pt-2"
                      >
                        <MessageBubble
                          message={msg}
                          toolByName={toolByName}
                          onApprove={approveCall}
                          onDeny={denyCall}
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {busy && <TypingIndicator />}
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-border/60 bg-gradient-to-b from-muted/25 to-card px-3 py-3 sm:px-5 sm:py-4">
              <div className="mx-auto max-w-3xl sm:max-w-4xl">
                <Composer
                  value={input}
                  onChange={setInput}
                  onSend={() => void sendUserMessage(input)}
                  onCancel={cancelRun}
                  busy={busy}
                  disabled={!user?.id}
                  lastModelUsed={lastModelUsed}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

/* ── Sub-components ──────────────────────────────────── */

function EmptyState({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <div className="mx-auto max-w-4xl px-1 py-4 sm:py-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="text-center"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-600/25 ring-4 ring-emerald-500/10">
          <Bot className="h-7 w-7" strokeWidth={1.75} />
        </div>
        <h2 className="mt-5 text-lg font-semibold tracking-tight text-foreground sm:text-xl">
          How can I help your class today?
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
          Ask in plain language. I pull live data from your dashboard—students, assignments,
          submissions, and more—then explain it clearly.
        </p>
      </motion.div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SUGGESTIONS.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.button
              key={s.label}
              type="button"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06 * i + 0.1, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => onPick(s.prompt)}
              className={cn(
                'group flex flex-col rounded-2xl border border-border/80 bg-gradient-to-b from-card to-muted/20 p-4 text-left shadow-sm',
                'ring-1 ring-black/[0.03] transition-shadow hover:border-emerald-300/50 hover:shadow-md hover:shadow-emerald-500/10',
                'dark:from-card dark:to-muted/10 dark:ring-white/[0.04]',
              )}
            >
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/15 to-teal-500/10 text-emerald-700 ring-1 ring-emerald-500/15 dark:text-emerald-300">
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold leading-snug text-foreground group-hover:text-emerald-800 dark:group-hover:text-emerald-200">
                    {s.label}
                  </span>
                  <span className="mt-1 block text-[11px] leading-snug text-muted-foreground sm:text-xs">
                    {s.description}
                  </span>
                </span>
                <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-600" />
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function Composer({
  value,
  onChange,
  onSend,
  onCancel,
  busy,
  disabled,
  lastModelUsed,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onCancel: () => void;
  busy: boolean;
  disabled?: boolean;
  lastModelUsed: string | null;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 rounded-2xl border border-border/70 bg-background/80 p-1.5 shadow-inner shadow-black/[0.03] backdrop-blur-sm dark:bg-background/50 sm:flex-row sm:items-end sm:p-2">
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={
            disabled ? 'Sign in as a teacher to use the agent.' : 'Ask anything about your classes…'
          }
          disabled={disabled}
          rows={2}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          className="min-h-[48px] flex-1 resize-none border-0 bg-transparent px-3 py-2.5 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 sm:min-h-[52px]"
        />
        <div className="flex shrink-0 items-center justify-end gap-2 px-1.5 pb-1.5 sm:flex-col sm:px-0 sm:pb-0">
          {busy ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onCancel}
                  className="h-10 rounded-xl border-destructive/30 px-4 text-destructive hover:bg-destructive/10"
                >
                  Stop
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Stop the current reply</TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  onClick={onSend}
                  disabled={disabled || !value.trim()}
                  className="h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 px-5 font-semibold text-white shadow-md shadow-emerald-600/25 transition hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40"
                >
                  <Send className="mr-2 h-4 w-4 opacity-90" />
                  Send
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Enter to send · Shift+Enter for new line</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-1 px-0.5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11px] text-muted-foreground">
          Replies use your real class data. Writes require approval in-line.
        </p>
        {lastModelUsed ? (
          <p className="flex items-center gap-1 text-[10px] text-muted-foreground/80 sm:justify-end">
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500/80" aria-hidden />
            <span className="font-mono">{lastModelUsed}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 pt-3"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-600/20">
        <Bot className="h-4 w-4" />
      </div>
      <div className="flex items-center gap-1.5 rounded-2xl border border-border/60 bg-muted/30 px-4 py-2.5 shadow-sm">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-2 w-2 rounded-full bg-emerald-500/70"
            animate={{ y: [0, -5, 0], opacity: [0.5, 1, 0.5] }}
            transition={{
              duration: 0.9,
              repeat: Infinity,
              delay: i * 0.15,
              ease: 'easeInOut',
            }}
          />
        ))}
        <span className="ml-2 text-xs font-medium text-muted-foreground">Thinking</span>
      </div>
    </motion.div>
  );
}

function ReadToolsActivity({
  calls,
  toolByName,
}: {
  calls: ToolCallRecord[];
  toolByName: Map<string, RegisteredTool>;
}) {
  const label = useMemo(() => {
    const order: string[] = [];
    const seen = new Set<string>();
    for (const c of calls) {
      const lab = toolByName.get(c.name)?.displayName || c.name;
      if (!seen.has(lab)) {
        seen.add(lab);
        order.push(lab);
      }
    }
    return order.join(' · ');
  }, [calls, toolByName]);

  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-cyan-200/55 bg-gradient-to-r from-cyan-50/90 to-white/80 px-3 py-2.5 text-xs shadow-sm dark:border-cyan-500/25 dark:from-cyan-950/40 dark:to-slate-900/40">
      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-cyan-600 dark:text-cyan-300" />
      <div className="min-w-0 leading-snug">
        <p className="font-semibold text-foreground">Gathering your data</p>
        <p className="truncate text-[11px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function ReadToolsSummary({
  calls,
  toolByName,
}: {
  calls: ToolCallRecord[];
  toolByName: Map<string, RegisteredTool>;
}) {
  const { summaryLine, rows } = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of calls) {
      counts.set(c.name, (counts.get(c.name) ?? 0) + 1);
    }
    const rows = [...counts.entries()].map(([name, n]) => ({
      key: name,
      label: toolByName.get(name)?.displayName || name,
      n,
    }));
    const total = calls.length;
    const summaryLine = total === 1 ? '1 data lookup completed' : `${total} data lookups completed`;
    return { summaryLine, rows };
  }, [calls, toolByName]);

  return (
    <details className="group rounded-xl border border-emerald-200/40 bg-emerald-50/25 text-xs ring-1 ring-emerald-500/10 dark:border-emerald-500/20 dark:bg-emerald-950/20 dark:ring-emerald-500/10">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 font-medium text-muted-foreground transition hover:bg-emerald-50/60 hover:text-foreground dark:hover:bg-emerald-950/35 [&::-webkit-details-marker]:hidden">
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <span className="min-w-0 flex-1 truncate">{summaryLine}</span>
        <span className="shrink-0 text-[10px] font-normal opacity-70">Details</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50 transition-transform group-open:rotate-180" />
      </summary>
      <ul className="space-y-1 border-t border-emerald-200/30 px-4 py-2 text-[11px] text-muted-foreground dark:border-emerald-500/20">
        {rows.map(({ key, label, n }) => (
          <li key={key}>
            {n > 1 ? `${label} (${n}×)` : label}
          </li>
        ))}
      </ul>
    </details>
  );
}

function AssistantMessageBody({ content }: { content: string }) {
  const text = formatAssistantTextForDisplay(content);
  if (!text) return null;
  return (
    <div className="whitespace-pre-wrap break-words text-[0.9375rem] leading-relaxed tracking-[-0.01em] text-foreground/95 [overflow-wrap:anywhere]">
      {text}
    </div>
  );
}

function MessageBubble({
  message,
  toolByName,
  onApprove,
  onDeny,
}: {
  message: AgentMessage;
  toolByName: Map<string, RegisteredTool>;
  onApprove: (call: ToolCallRecord) => void;
  onDeny: (call: ToolCallRecord) => void;
}) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[min(100%,32rem)] rounded-2xl rounded-br-md bg-gradient-to-br from-emerald-600 to-teal-700 px-4 py-3 text-sm text-white shadow-lg shadow-emerald-900/15 ring-1 ring-white/10">
          <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
        </div>
      </div>
    );
  }

  const toolCalls = message.toolCalls ?? [];
  const { silentSuccess, readActive, attention } = useMemo(
    () => partitionAssistantTools(toolCalls, toolByName),
    [toolCalls, toolByName],
  );
  const hideReadSummary = Boolean(message.content?.trim());

  return (
    <div className="flex gap-3 sm:gap-4">
      <div
        className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-600/20 sm:h-10 sm:w-10"
        aria-hidden
      >
        <Bot className="h-4 w-4 sm:h-[1.125rem] sm:w-[1.125rem]" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        {message.content?.trim() ? (
          <div className="relative overflow-hidden rounded-2xl rounded-tl-md border border-border/60 bg-gradient-to-b from-card to-muted/15 px-4 py-3.5 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.04]">
            <div
              className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-emerald-500 to-teal-600 opacity-90"
              aria-hidden
            />
            <div className="pl-2">
              <AssistantMessageBody content={message.content} />
            </div>
          </div>
        ) : null}
        {readActive.length > 0 ? (
          <ReadToolsActivity calls={readActive} toolByName={toolByName} />
        ) : null}
        {attention.map((call) => (
          <ToolCallCard
            key={call.id}
            call={call}
            def={toolByName.get(call.name)}
            onApprove={() => onApprove(call)}
            onDeny={() => onDeny(call)}
          />
        ))}
        {silentSuccess.length > 0 && readActive.length === 0 && !hideReadSummary ? (
          <ReadToolsSummary calls={silentSuccess} toolByName={toolByName} />
        ) : null}
      </div>
    </div>
  );
}

function ToolCallCard({
  call,
  def,
  onApprove,
  onDeny,
}: {
  call: ToolCallRecord;
  def?: RegisteredTool;
  onApprove: () => void;
  onDeny: () => void;
}) {
  const [open, setOpen] = useState(
    call.status === 'pending_confirmation' ||
      call.status === 'error' ||
      (call.name === 'query_official_curriculum' &&
        (call.status === 'success' || call.status === 'error')),
  );
  const [copied, setCopied] = useState(false);

  const risk = def?.risk ?? 'safe';
  const riskInfo = RISK_BADGE[risk];
  const StatusIcon =
    call.status === 'success'
      ? CheckCircle2
      : call.status === 'error'
        ? XCircle
        : call.status === 'denied'
          ? XCircle
          : call.status === 'running'
            ? Loader2
            : AlertTriangle;

  const summary = def?.summarize ? def.summarize(call.args) : call.name;

  const navPath =
    call.name === 'open_dashboard_route' && call.status === 'success'
      ? (call.result as { path?: string } | undefined)?.path
      : undefined;

  const showDetails =
    open &&
    (call.status === 'success' || call.status === 'error') &&
    call.result !== undefined;

  const bar = STATUS_BAR[call.status];

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border text-sm shadow-sm',
        STATUS_COLOR[call.status],
        call.status === 'running' && 'shadow-[0_0_0_1px_rgba(6,182,212,0.25)]',
      )}
    >
      <div className={cn('absolute left-0 top-0 z-[1] h-full w-[3px]', bar)} aria-hidden />
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="relative flex w-full items-center gap-3 py-2.5 pl-4 pr-3 text-left sm:py-3 sm:pl-5"
      >
        <StatusIcon
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground',
            call.status === 'running' && 'animate-spin text-cyan-600',
            call.status === 'success' && 'text-emerald-600',
            call.status === 'error' && 'text-destructive',
            call.status === 'denied' && 'text-slate-500',
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-semibold tracking-tight text-foreground">
              {def?.displayName || call.name}
            </span>
            <span
              className={cn(
                'rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                riskInfo.className,
              )}
            >
              {riskInfo.label}
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{summary}</p>
        </div>
        <span className="shrink-0 rounded-md bg-background/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground ring-1 ring-border/60">
          {STATUS_LABEL[call.status]}
        </span>
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="relative border-t border-border/60 bg-muted/10 px-3 py-3 sm:px-4">
          {call.status === 'pending_confirmation' && (
            <div className="flex flex-col gap-3 rounded-xl border border-amber-200/70 bg-gradient-to-r from-amber-50 to-orange-50/50 p-3 text-xs sm:flex-row sm:items-center sm:justify-between dark:border-amber-500/25 dark:from-amber-950/35 dark:to-amber-900/15">
              <p className="leading-snug text-amber-950 dark:text-amber-50">
                {risk === 'destructive'
                  ? 'This permanently deletes data. Only approve if you fully intend to remove it.'
                  : 'This will change data in your account. Review the summary, then approve or deny.'}
              </p>
              <div className="flex shrink-0 gap-2">
                <Button size="sm" variant="outline" className="h-9 rounded-lg text-xs" onClick={onDeny}>
                  Deny
                </Button>
                <Button
                  size="sm"
                  className={cn(
                    'h-9 rounded-lg text-xs font-semibold',
                    risk === 'destructive'
                      ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                      : 'bg-gradient-to-br from-emerald-600 to-teal-600 text-white hover:from-emerald-500 hover:to-teal-500',
                  )}
                  onClick={onApprove}
                >
                  Approve
                </Button>
              </div>
            </div>
          )}

          {call.status === 'error' && (
            <p className="text-xs font-medium text-destructive">{call.error || 'Tool failed.'}</p>
          )}

          {navPath && (
            <Link
              to={navPath}
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg text-xs font-semibold text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-300"
            >
              Open in app
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          )}

          {showDetails && (
            <div className="mt-3 space-y-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Summary
                </span>
                <div className="mt-1.5 whitespace-pre-wrap break-words rounded-xl border border-border/70 bg-background/90 px-3 py-2.5 text-xs leading-relaxed text-foreground shadow-inner">
                  {humanizeToolResult(call.result)}
                </div>
              </div>
              <details className="group overflow-hidden rounded-xl border border-border/60 bg-muted/20">
                <summary className="cursor-pointer list-none px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground transition hover:bg-muted/40 hover:text-foreground [&::-webkit-details-marker]:hidden">
                  <span className="inline-flex items-center gap-2">
                    Technical details (JSON)
                    <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
                  </span>
                </summary>
                <div className="border-t border-border/60 bg-background/50 px-3 pb-3 pt-2">
                  <div className="mb-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          navigator.clipboard.writeText(JSON.stringify(call.result, null, 2));
                          setCopied(true);
                          setTimeout(() => setCopied(false), 1500);
                        } catch {
                          /* ignore */
                        }
                      }}
                      className="text-[10px] font-medium text-muted-foreground hover:text-foreground"
                    >
                      {copied ? 'Copied' : 'Copy JSON'}
                    </button>
                  </div>
                  <pre className="max-h-52 overflow-auto rounded-lg border border-border/80 bg-muted/30 p-3 font-mono text-[10px] leading-relaxed">
                    {summarizeJson(call.result, 8000)}
                  </pre>
                </div>
              </details>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ToolCatalog({ tools }: { tools: RegisteredTool[] }) {
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    if (!ql) return tools;
    return tools.filter(
      (t) =>
        t.name.toLowerCase().includes(ql) ||
        t.description.toLowerCase().includes(ql) ||
        (t.displayName?.toLowerCase().includes(ql) ?? false),
    );
  }, [q, tools]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, description…"
          className="h-10 rounded-xl border-border/80 pl-9 shadow-sm"
        />
      </div>
      <ScrollArea className="h-[58vh] rounded-xl border border-border/80 bg-muted/10 shadow-inner">
        <div className="divide-y divide-border/60">
          {filtered.map((t) => {
            const ri = RISK_BADGE[t.risk];
            return (
              <div
                key={t.name}
                className="flex flex-col gap-1.5 bg-card/40 px-4 py-3.5 transition-colors hover:bg-muted/30"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-foreground sm:text-sm">{t.name}</span>
                  <span
                    className={cn(
                      'rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                      ri.className,
                    )}
                  >
                    {ri.label}
                  </span>
                  <span className="rounded-md border border-border/80 bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {t.category}
                  </span>
                </div>
                {t.displayName && (
                  <p className="text-xs font-semibold text-foreground/90">{t.displayName}</p>
                )}
                <p className="text-xs leading-relaxed text-muted-foreground">{t.description}</p>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <p className="p-8 text-center text-sm text-muted-foreground">No tools match your search.</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
