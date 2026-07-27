/**
 * Proxies OpenRouter `POST /api/v1/chat/completions` so the API key stays in
 * Supabase secrets (`OPENROUTER_API_KEY`), not in the browser bundle.
 *
 * Deploy:
 *   supabase functions deploy openrouter-proxy --no-verify-jwt
 *   supabase secrets set OPENROUTER_API_KEY=sk-or-v1-...
 *
 * Gateway JWT verification is off so OPTIONS preflight succeeds without Bearer;
 * this function validates the user JWT with `auth.getUser()`.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, prefer, x-supabase-api-version, x-region",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function asciiHeader(value: string, max: number): string {
  const s = value.replace(/[^\x00-\xFF]/g, "?");
  return s.length > max ? s.slice(0, max) : s;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return json({ ok: false, error: "Missing Authorization bearer token" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!supabaseUrl || !supabaseAnon) {
    return json({ ok: false, error: "Server misconfigured (Supabase)" }, 500);
  }

  const supabase = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  const openrouterKey = (Deno.env.get("OPENROUTER_API_KEY") ?? "").trim();
  if (!openrouterKey) {
    return json(
      { ok: false, error: "OPENROUTER_API_KEY is not set (Supabase secret)" },
      503,
    );
  }

  let envelope: Record<string, unknown>;
  try {
    envelope = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "Invalid JSON body" }, 400);
  }

  const innerUnknown = envelope.openrouter ?? envelope;
  if (!innerUnknown || typeof innerUnknown !== "object" || Array.isArray(innerUnknown)) {
    return json({ ok: false, error: "Expected object `openrouter` with chat completion fields" }, 400);
  }

  const inner = innerUnknown as Record<string, unknown>;

  if (inner.health === true && Object.keys(inner).length === 1) {
    return json({ ok: true, health: true }, 200);
  }

  const referer = asciiHeader(
    typeof envelope.client_referer === "string" ? envelope.client_referer : "https://mamamath.org",
    256,
  );
  const title = asciiHeader(
    typeof envelope.client_title === "string" ? envelope.client_title : "Mother of Math",
    128,
  );

  const orRes = await fetch(OPENROUTER_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openrouterKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": referer,
      "X-Title": title,
    },
    body: JSON.stringify(inner),
  });

  if (!orRes.ok) {
    const errText = await orRes.text();
    return json(
      {
        ok: false,
        error: `OpenRouter ${orRes.status}: ${errText.slice(0, 1200)}`,
      },
      502,
    );
  }

  const stream = inner.stream === true;
  if (stream && orRes.body) {
    return new Response(orRes.body, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": orRes.headers.get("content-type") ||
          "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  }

  const text = await orRes.text();
  return new Response(text, {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
