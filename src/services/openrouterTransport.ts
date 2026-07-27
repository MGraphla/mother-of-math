/**
 * Routes OpenRouter chat/completions either through Supabase Edge (`openrouter-proxy`)
 * or directly from the browser when VITE_OPENROUTER_USE_CLIENT_KEY=true.
 */

import { supabase } from '@/lib/supabase';
import {
  canUseOpenRouterViaEdge,
  FALLBACK_OPENROUTER_CHAT_URL,
  getClientOpenRouterKey,
  headerByteString,
  OPENROUTER_USE_CLIENT_KEY,
} from '@/services/openrouterEnv';

/**
 * POST to OpenRouter chat completions (or the Edge proxy). Returns the raw `Response`
 * (JSON or SSE stream) so callers match existing fetch() handling.
 */
export async function fetchOpenRouterChatCompletion(
  openrouterBody: Record<string, unknown>,
  opts?: { referer?: string; title?: string; signal?: AbortSignal },
): Promise<Response> {
  const referer =
    opts?.referer ??
    (typeof window !== 'undefined'
      ? headerByteString(window.location.origin)
      : 'https://mamamath.org');
  const title = opts?.title ? headerByteString(opts.title) : 'Mother of Math';

  if (OPENROUTER_USE_CLIENT_KEY) {
    const apiKey = getClientOpenRouterKey();
    if (!apiKey) {
      throw new Error(
        'OpenRouter API key missing. Set VITE_OPENROUTER_API_KEY or use the Supabase proxy (default).',
      );
    }
    const url =
      import.meta.env.VITE_OPENROUTER_API_URL || FALLBACK_OPENROUTER_CHAT_URL;
    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': referer,
        'X-Title': title,
      },
      body: JSON.stringify(openrouterBody),
      signal: opts?.signal,
    });
  }

  if (!canUseOpenRouterViaEdge()) {
    throw new Error(
      'AI is not configured: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, deploy openrouter-proxy, and set OPENROUTER_API_KEY secret. For local-only keys, set VITE_OPENROUTER_USE_CLIENT_KEY=true.',
    );
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('You must be signed in to use AI features.');
  }

  const base = import.meta.env.VITE_SUPABASE_URL!.replace(/\/$/, '');
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY!;

  return fetch(`${base}/functions/v1/openrouter-proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: anon,
    },
    body: JSON.stringify({
      openrouter: openrouterBody,
      client_referer: referer,
      client_title: title,
    }),
    signal: opts?.signal,
  });
}

/** Lightweight probe: auth + server secret present (no OpenRouter billing). */
export async function probeOpenRouterEdge(): Promise<{
  ok: boolean;
  error?: string;
}> {
  if (OPENROUTER_USE_CLIENT_KEY || !canUseOpenRouterViaEdge()) {
    return { ok: false, error: 'Edge probe not applicable in this mode.' };
  }
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return { ok: false, error: 'Not signed in.' };
  }
  const base = import.meta.env.VITE_SUPABASE_URL!.replace(/\/$/, '');
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY!;
  try {
    const res = await fetch(`${base}/functions/v1/openrouter-proxy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        apikey: anon,
      },
      body: JSON.stringify({
        openrouter: { health: true },
        client_referer: 'https://mamamath.org',
        client_title: 'Mother of Math',
      }),
    });
    const j = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      health?: boolean;
      error?: string;
    };
    if (!res.ok) {
      return {
        ok: false,
        error: j.error || `HTTP ${res.status}`,
      };
    }
    if (j.ok === true && j.health === true) return { ok: true };
    return {
      ok: false,
      error: typeof j.error === 'string' ? j.error : 'Unexpected probe response',
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Network error',
    };
  }
}
