/** Shared OpenRouter env + small helpers (no Supabase / fetch). */

export const FALLBACK_OPENROUTER_CHAT_URL =
  'https://openrouter.ai/api/v1/chat/completions';

/**
 * When `true`, the browser calls OpenRouter directly with `VITE_OPENROUTER_API_KEY`.
 * Default is `false`: requests go through the `openrouter-proxy` Edge Function.
 */
export const OPENROUTER_USE_CLIENT_KEY =
  import.meta.env.VITE_OPENROUTER_USE_CLIENT_KEY === 'true';

export function canUseOpenRouterViaEdge(): boolean {
  return (
    !OPENROUTER_USE_CLIENT_KEY &&
    !!import.meta.env.VITE_SUPABASE_URL?.trim() &&
    !!import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()
  );
}

/** Vite client key (sk-or-v1-…). Only used when OPENROUTER_USE_CLIENT_KEY is true. */
export function getClientOpenRouterKey(): string | undefined {
  const key = import.meta.env.VITE_OPENROUTER_API_KEY?.trim();
  if (!key) {
    console.error('API key is missing. Please check your .env file.');
    return undefined;
  }
  if (!key.startsWith('sk-or-v1-')) {
    console.error(
      'API key format is invalid - OpenRouter keys should start with sk-or-v1-',
    );
    return undefined;
  }
  return key;
}

export function isOpenRouterConfigured(): boolean {
  if (OPENROUTER_USE_CLIENT_KEY) {
    return !!getClientOpenRouterKey();
  }
  return canUseOpenRouterViaEdge();
}

/** Header values must be ISO-8859-1 (ByteString) for fetch(); replace other code points. */
export function headerByteString(value: string): string {
  return Array.from(value)
    .map((ch) => {
      const code = ch.charCodeAt(0);
      return code <= 255 ? ch : '?';
    })
    .join('');
}
