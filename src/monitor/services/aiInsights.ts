/**
 * AI Insights — OpenRouter-powered natural-language analysis of the
 * real monitoring data for the implementing-partner dashboard.
 *
 * The function intentionally takes a *summary object* (NOT raw PII) and
 * a question prompt. It calls OpenRouter from the browser with the
 * same `VITE_OPENROUTER_API_KEY` already used by the rest of the app.
 */

const OPENROUTER_URL =
  (import.meta.env.VITE_OPENROUTER_API_URL as string | undefined) ||
  'https://openrouter.ai/api/v1/chat/completions';

const OPENROUTER_KEY = (import.meta.env.VITE_OPENROUTER_API_KEY as string | undefined) || '';

const DEFAULT_MODEL = 'openai/gpt-4o-mini';

export interface InsightRequest {
  /** Short human label describing what the summary represents. */
  context: string;
  /** Plain summary object — counts / aggregates, no PII. */
  summary: Record<string, unknown>;
  /** What the partner wants to learn. */
  question: string;
  model?: string;
}

export interface InsightResponse {
  ok: boolean;
  text?: string;
  error?: string;
}

export const hasOpenRouterKey = (): boolean => !!OPENROUTER_KEY;

export const generateInsight = async (req: InsightRequest): Promise<InsightResponse> => {
  if (!OPENROUTER_KEY) {
    return {
      ok: false,
      error:
        'OpenRouter API key is not configured. Set VITE_OPENROUTER_API_KEY in .env to enable AI Insights.',
    };
  }

  const system = `You are a calm, data-literate analyst writing a brief for an NGO / funder \
that monitors how Nigerian teachers use the Mother of Math platform. Your job is to read \
the JSON summary of REAL usage data (scoped to Nigeria) and answer the partner's question \
with concrete observations, plain-English language, and numbered insights. Do NOT invent \
numbers — only cite what appears in the provided summary. End with up to three short, \
practical recommendations.

IMPORTANT FORMATTING RULES:
- Reply in plain text only. Do NOT use Markdown.
- No asterisks (*, **), no hashes (#), no backticks, no underscores for emphasis.
- Use simple numbered lists like "1." for points.
- Use clear paragraph breaks instead of headings.
- Keep prose readable for a non-technical reader.`;

  const user = `Context: ${req.context}\n\nData summary (JSON):\n${JSON.stringify(
    req.summary,
    null,
    2
  )}\n\nQuestion: ${req.question}`;

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENROUTER_KEY}`,
        'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : '',
        'X-Title': 'Mother of Math — Partner Monitor',
      },
      body: JSON.stringify({
        model: req.model || DEFAULT_MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `OpenRouter ${res.status}: ${text.slice(0, 200)}` };
    }

    const data = await res.json();
    const content: string | undefined = data?.choices?.[0]?.message?.content;
    if (!content) return { ok: false, error: 'No content returned by the model.' };
    return { ok: true, text: content };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Unknown error contacting OpenRouter.',
    };
  }
};
