/**
 * Build OpenRouter chat messages from UI state, with protocol fixes:
 * - Every assistant message with `tool_calls` must be immediately followed by
 *   exactly one `tool` message per `tool_call_id` (OpenAI / OpenRouter rule).
 * - Tool messages are emitted in the same order as `tool_calls` on the assistant turn.
 * - Missing tool responses (e.g. legacy localStorage or interrupted runs) are
 *   patched with a small JSON error object so the API does not return 400.
 */

import type { AgentMessage, OpenRouterMessage, ToolCallRecord } from './types';

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Collect consecutive `tool` rows after assistant index `ai` until a non-tool message. */
function sliceToolBlock(messages: AgentMessage[], ai: number): { end: number; tools: AgentMessage[] } {
  let end = ai + 1;
  while (end < messages.length && messages[end].role === 'tool') end++;
  return { end, tools: messages.slice(ai + 1, end) };
}

function syntheticToolMessage(tc: ToolCallRecord): AgentMessage {
  let body: unknown;
  if (tc.status === 'error') {
    body = { ok: false, error: tc.error || 'Tool execution failed' };
  } else if (tc.status === 'denied') {
    body = { ok: false, denied: true, reason: 'User denied the action.' };
  } else if (tc.status === 'pending_confirmation') {
    body = {
      _agent: 'pending_approval',
      message:
        'Teacher approval is required before this tool runs. Wait for the user to confirm in the UI.',
    };
  } else {
    body = {
      ok: false,
      error: 'missing_tool_response',
      tool_call_id: tc.id,
      detail: 'No tool result was stored for this call.',
    };
  }

  return {
    id: makeId('toolph'),
    role: 'tool',
    toolCallId: tc.id,
    toolName: tc.name,
    content: JSON.stringify(body),
    createdAt: Date.now(),
    toolPlaceholder: true,
  };
}

/**
 * After an assistant turn with tools, ensure the following tool rows exist,
 * are ordered like `assistant.toolCalls`, and include a row for every id.
 */
export function normalizeAssistantToolTurn(
  messages: AgentMessage[],
  assistantId: string,
): AgentMessage[] {
  const ai = messages.findIndex((m) => m.id === assistantId);
  if (ai === -1) return messages;
  const assistant = messages[ai];
  if (assistant.role !== 'assistant' || !assistant.toolCalls?.length) return messages;

  const { end, tools: existingBlock } = sliceToolBlock(messages, ai);
  const byId = new Map<string, AgentMessage>();
  for (const t of existingBlock) {
    if (t.toolCallId) byId.set(t.toolCallId, t);
  }

  const ordered: AgentMessage[] = [];
  for (const tc of assistant.toolCalls) {
    const row = byId.get(tc.id);
    if (row) {
      ordered.push(row);
      continue;
    }
    ordered.push(syntheticToolMessage(tc));
  }

  // Keep orphan tool rows that did not match any id (should not happen)
  const used = new Set(assistant.toolCalls.map((c) => c.id));
  for (const t of existingBlock) {
    if (t.toolCallId && !used.has(t.toolCallId)) ordered.push(t);
  }

  return [...messages.slice(0, ai + 1), ...ordered, ...messages.slice(end)];
}

export function buildOpenRouterMessages(
  systemPrompt: string,
  messages: AgentMessage[],
): OpenRouterMessage[] {
  const out: OpenRouterMessage[] = [{ role: 'system', content: systemPrompt }];

  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.role === 'user') {
      out.push({ role: 'user', content: m.content });
      continue;
    }

    if (m.role === 'assistant') {
      const orMsg: OpenRouterMessage = {
        role: 'assistant',
        content: m.content?.trim() ? m.content : null,
      };
      if (m.toolCalls && m.toolCalls.length > 0) {
        orMsg.tool_calls = m.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.args ?? {}),
          },
        }));
      }
      out.push(orMsg);

      if (!m.toolCalls?.length) continue;

      const { end, tools: block } = sliceToolBlock(messages, i);
      const byId = new Map(block.map((t) => [t.toolCallId || '', t]));

      for (const tc of m.toolCalls) {
        const tm = byId.get(tc.id);
        if (tm && tm.toolCallId) {
          out.push({
            role: 'tool',
            tool_call_id: tc.id,
            name: tm.toolName || tc.name,
            content: tm.content && tm.content.length > 0 ? tm.content : '{}',
          });
        } else {
          out.push({
            role: 'tool',
            tool_call_id: tc.id,
            name: tc.name,
            content: JSON.stringify({
              error: 'missing_tool_response',
              detail:
                'The UI did not record a result for this tool call. Ask the user to clear the chat and retry.',
              tool_call_id: tc.id,
            }),
          });
        }
      }

      i = end - 1;
      continue;
    }

    if (m.role === 'tool') {
      // Orphan tool rows (already consumed with their assistant) are skipped.
      continue;
    }
  }

  return out;
}
