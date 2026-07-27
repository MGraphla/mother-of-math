/**
 * Thin wrapper around OpenRouter chat completions with function-calling
 * (tool use). Used by the Teacher Agent page.
 */

import { checkRateLimit } from '@/lib/rateLimit';
import { headerByteString, isOpenRouterConfigured } from '@/services/openrouterEnv';
import { fetchOpenRouterChatCompletion } from '@/services/openrouterTransport';
import type {
  OpenRouterMessage,
  OpenRouterResponse,
  OpenRouterTool,
  RegisteredTool,
} from './types';

/**
 * Default agent model. Function-calling capable on OpenRouter.
 * Override by setting `VITE_AGENT_MODEL` in `.env`.
 * Default is cost-conscious; transcript normalization keeps tool turns valid for strict providers.
 */
const DEFAULT_AGENT_MODEL =
  import.meta.env.VITE_AGENT_MODEL || 'openai/gpt-4o-mini';

/** Stronger model if the primary errors or rate-limits. */
const FALLBACK_AGENT_MODEL = 'openai/gpt-4o';

export function toolsToOpenRouterFormat(tools: RegisteredTool[]): OpenRouterTool[] {
  return tools.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

export interface ChatCompletionRequest {
  messages: OpenRouterMessage[];
  tools: OpenRouterTool[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
  signal?: AbortSignal;
}

export interface ChatCompletionResult {
  content: string | null;
  toolCalls: Array<{
    id: string;
    name: string;
    /** Parsed JSON args (best effort). Falls back to raw string under `_raw`. */
    args: Record<string, unknown>;
    rawArguments: string;
  }>;
  raw: OpenRouterResponse;
  modelUsed: string;
}

function safeParseToolArgs(raw: string): Record<string, unknown> {
  if (!raw || typeof raw !== 'string') return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    /* fallthrough */
  }
  return { _raw: raw };
}

export async function callAgentModel(
  req: ChatCompletionRequest,
): Promise<ChatCompletionResult> {
  if (!isOpenRouterConfigured()) {
    throw new Error(
      'OpenRouter is not configured. Deploy the openrouter-proxy Edge Function and set OPENROUTER_API_KEY, or use VITE_OPENROUTER_USE_CLIENT_KEY with VITE_OPENROUTER_API_KEY for local dev.',
    );
  }

  if (!checkRateLimit('agent-api', 30, 60 * 1000)) {
    throw new Error('Too many agent requests. Please wait a moment and try again.');
  }

  const primaryModel = req.model || DEFAULT_AGENT_MODEL;
  const candidateModels = primaryModel === FALLBACK_AGENT_MODEL
    ? [primaryModel]
    : [primaryModel, FALLBACK_AGENT_MODEL];

  let lastErr: unknown;
  for (const model of candidateModels) {
    try {
      const body: Record<string, unknown> = {
        model,
        messages: req.messages,
        temperature: req.temperature ?? 0.22,
        max_tokens: req.max_tokens ?? 4096,
      };
      if (req.tools.length > 0) {
        body.tools = req.tools;
        body.tool_choice = 'auto';
      }

      const referer =
        typeof window !== 'undefined'
          ? headerByteString(window.location.origin)
          : 'https://mamamath.org';

      const res = await fetchOpenRouterChatCompletion(body, {
        referer,
        title: 'Mother of Math - Teacher Agent',
        signal: req.signal,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`OpenRouter ${res.status} (${model}): ${errText.slice(0, 300)}`);
      }

      const data = (await res.json()) as OpenRouterResponse;
      const choice = data.choices?.[0];
      if (!choice) throw new Error('OpenRouter returned no choices.');

      const toolCallsRaw = choice.message.tool_calls || [];
      const toolCalls = toolCallsRaw.map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        rawArguments: tc.function.arguments,
        args: safeParseToolArgs(tc.function.arguments),
      }));

      return {
        content: choice.message.content ?? null,
        toolCalls,
        raw: data,
        modelUsed: model,
      };
    } catch (err) {
      lastErr = err;
      // If it's an abort, do not try fallback.
      if ((err as Error)?.name === 'AbortError') throw err;
      // Try fallback on the next iteration if any remain.
    }
  }

  throw lastErr instanceof Error
    ? lastErr
    : new Error('Agent model call failed.');
}
