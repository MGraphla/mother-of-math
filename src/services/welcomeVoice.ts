import { FunctionsHttpError } from "@supabase/functions-js";
import { supabase } from "@/lib/supabase";

export const MOM_VOICE_INTENT_KEY = "mom_voice_intent" as const;
/** Set at sign-up so email-confirm links (same browser) can match the new user id. */
export const MOM_WELCOME_PENDING_USER_KEY = "mom_welcome_pending_user_id";
export type MomVoiceIntent = "new" | "returning";

export function setMomVoiceIntent(intent: MomVoiceIntent): void {
  try {
    sessionStorage.setItem(MOM_VOICE_INTENT_KEY, intent);
  } catch {
    /* ignore */
  }
}

export function peekMomVoiceIntent(): MomVoiceIntent | null {
  try {
    const v = sessionStorage.getItem(MOM_VOICE_INTENT_KEY);
    if (v === "new" || v === "returning") return v;
  } catch {
    /* ignore */
  }
  return null;
}

export function consumeMomVoiceIntent(): MomVoiceIntent | null {
  const v = peekMomVoiceIntent();
  if (!v) return null;
  try {
    sessionStorage.removeItem(MOM_VOICE_INTENT_KEY);
  } catch {
    /* ignore */
  }
  return v;
}

/** Clear intent without reading (e.g. after failed retries). */
export function clearMomVoiceIntent(): void {
  try {
    sessionStorage.removeItem(MOM_VOICE_INTENT_KEY);
  } catch {
    /* ignore */
  }
}

function firstNameFromFullName(fullName: string | null | undefined): string {
  if (!fullName?.trim()) return "friend";
  return fullName.trim().split(/\s+/)[0] ?? "friend";
}

async function messageFromInvokeError(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError && error.context instanceof Response) {
    try {
      const res = error.context;
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        const j = (await res.clone().json()) as { error?: string; message?: string };
        if (typeof j?.error === "string" && j.error.trim()) return j.error;
        if (typeof j?.message === "string" && j.message.trim()) return j.message;
      }
    } catch {
      /* ignore */
    }
  }
  if (error instanceof Error) return error.message;
  return "Welcome voice request failed";
}

type WelcomeFnJson = {
  ok?: boolean;
  error?: string;
  audioBase64?: string;
  mimeType?: string;
};

/**
 * `functions.invoke` sometimes fails in the browser; fall back to direct `fetch`
 * with the user JWT when that happens.
 */
async function requestWelcomeGreetingJson(
  kind: MomVoiceIntent,
  firstName: string,
  localHour: number,
  accessToken?: string | null,
): Promise<{ data: WelcomeFnJson | null; transportError: string | null }> {
  const body = { kind, firstName, localHour };

  const { data, error } = await supabase.functions.invoke("welcome-greeting-audio", {
    body,
  });

  if (!error) {
    return { data: data as WelcomeFnJson, transportError: null };
  }

  const em = await messageFromInvokeError(error);

  const base = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!base || !anon) {
    return { data: null, transportError: em };
  }

  let token = accessToken?.trim() || null;
  if (!token) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    token = session?.access_token ?? null;
  }
  if (!token) {
    return { data: null, transportError: em };
  }

  /** Dev: same-origin via Vite proxy (vite.config server.proxy /functions/v1). Prod: direct to Supabase. */
  const fnUrl = import.meta.env.DEV
    ? "/functions/v1/welcome-greeting-audio"
    : `${base}/functions/v1/welcome-greeting-audio`;

  try {
    const res = await fetch(fnUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: anon,
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let parsed: WelcomeFnJson;
    try {
      parsed = text ? (JSON.parse(text) as WelcomeFnJson) : {};
    } catch {
      return { data: null, transportError: `Function ${res.status}: invalid JSON` };
    }
    if (!res.ok) {
      const msg =
        typeof parsed.error === "string" && parsed.error.trim()
          ? parsed.error
          : `Edge Function HTTP ${res.status}`;
      return { data: null, transportError: msg };
    }
    return { data: parsed, transportError: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch failed";
    return { data: null, transportError: `${em} | fallback: ${msg}` };
  }
}

/**
 * Fetches ElevenLabs audio from Edge Function and plays it (best-effort).
 */
export async function playMamaMathWelcomeVoice(
  kind: MomVoiceIntent,
  fullName: string | null | undefined,
  accessToken?: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const localHour = new Date().getHours();
  const firstName = firstNameFromFullName(fullName);

  const { data, transportError } = await requestWelcomeGreetingJson(
    kind,
    firstName,
    localHour,
    accessToken,
  );

  if (transportError) {
    return { ok: false, error: transportError };
  }

  const res = data as {
    ok?: boolean;
    error?: string;
    audioBase64?: string;
    mimeType?: string;
  };

  if (!res || !res.ok || !res.audioBase64) {
    return { ok: false, error: res?.error || "No audio returned" };
  }

  const mime = res.mimeType?.includes("mpeg") ? "audio/mpeg" : "audio/mpeg";
  const url = `data:${mime};base64,${res.audioBase64}`;
  try {
    const audio = new Audio(url);
    await audio.play();
  } catch (e) {
    const playMsg = e instanceof Error ? e.message : "Playback blocked or failed";
    return {
      ok: false,
      error: playMsg,
    };
  }

  return { ok: true };
}
