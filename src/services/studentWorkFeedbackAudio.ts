/**
 * Triggers Edge Function to synthesize ElevenLabs speech for a student_work row
 * (after teacher assigns a student and feedback exists).
 */

import { FunctionsHttpError } from "@supabase/functions-js";
import { supabase } from "@/lib/supabase";

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
      /* ignore parse errors */
    }
  }
  if (error instanceof Error) return error.message;
  return "Voice feedback request failed";
}

/**
 * @param narrativePlain Full script for TTS: usually `buildStudentWorkVoiceScriptForUpload`
 *   (Mama Math intro + parent report). When set, the Edge Function speaks it verbatim; otherwise
 *   it rebuilds on the server (can drift from the portal).
 */
export async function requestStudentWorkFeedbackAudio(
  studentWorkId: string,
  narrativePlain?: string | null,
): Promise<{ ok: boolean; error?: string; started?: boolean }> {
  const reqBody: { studentWorkId: string; narrativePlain?: string } = { studentWorkId };
  const n = narrativePlain?.trim();
  if (n) reqBody.narrativePlain = n;

  const { data, error } = await supabase.functions.invoke("student-work-feedback-audio", {
    body: reqBody,
  });

  if (error) {
    return { ok: false, error: await messageFromInvokeError(error) };
  }

  const res = data as { ok?: boolean; error?: string; started?: boolean; url?: string };

  if (!res?.ok) {
    return { ok: false, error: res?.error || "Voice feedback request failed" };
  }
  return { ok: true, started: res.started === true };
}
