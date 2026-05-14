/**
 * Generate spoken feedback (ElevenLabs) for a student_work row after teacher assigns a student.
 * Optional body.narrativePlain: exact portal “Your summary” text from the client — spoken verbatim
 * so audio matches /student/analysis (no duplicate server narrative logic).
 * Secrets: ELEVENLABS_API_KEY (required), optional ELEVENLABS_VOICE_ID, ELEVENLABS_MODEL_ID
 * Default model: eleven_v3 (override with ELEVENLABS_MODEL_ID if needed).
 *
 * Deploy (must disable gateway JWT so browser OPTIONS preflight succeeds):
 *   supabase functions deploy student-work-feedback-audio --no-verify-jwt
 * Secrets: supabase secrets set ELEVENLABS_API_KEY=your_key
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

// Supabase Edge — keep TTS work alive after HTTP response (avoids client timeout)
declare const EdgeRuntime:
  | { waitUntil(p: Promise<unknown>): void }
  | undefined;

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, prefer, x-supabase-api-version, x-region",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const DEFAULT_VOICE_ID = "PEyWCmLPt74vpHWLv3Fo";
/** Eleven v3 — latest expressive model (see ElevenLabs docs; ~5k chars/request). */
const DEFAULT_MODEL_ID = "eleven_v3";
/** Keep under Eleven v3 per-request character limits. */
const MAX_TTS_CHARS = 4800;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type Parsed = { analysis: string; error_type: string; grade: string; remediation: string };

function stripMarkdownAggressive(text: string): string {
  if (!text) return "";
  let t = text.replace(/\r\n/g, "\n");
  while (t.includes("**")) {
    t = t.replace(/\*\*([\s\S]*?)\*\*/g, "$1").replace(/\*\*/g, "");
  }
  t = t.replace(/\*([^*\n]+)\*/g, "$1");
  t = t.replace(/_{1,2}([^_\n]+)_{1,2}/g, "$1");
  t = t.replace(/`([^`]+)`/g, "$1");
  t = t.replace(/^#{1,6}\s*/gm, "");
  t = t.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  t = t.replace(/^\s*[-*•]\s+/gm, "");
  t = t.replace(/\*+/g, " ");
  return t.trim();
}

function collapseSpaces(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function polishNarrativeText(text: string): string {
  let s = collapseSpaces(stripMarkdownAggressive(text));
  while (s.includes("**")) {
    s = s.replace(/\*\*([\s\S]*?)\*\*/g, "$1").replace(/\*\*/g, "");
  }
  s = s.replace(/\*+/g, " ");
  s = s.replace(/\bQ\s*(\d+)\s*[:.)-]?\s*/gi, "Question $1. ");
  s = s.replace(/(\d+)\s*%\s*/g, "$1 percent ");
  s = s.replace(/\b(\d+)\s*\/\s*(\d+)\b/g, "$1 over $2");
  s = s.replace(/\s×\s/g, " times ");
  s = s.replace(/\s÷\s/g, " divided by ");
  s = s.replace(/\s+=\s+/g, " equals ");
  s = s.replace(/\s+\+\s+/g, " plus ");
  s = s.replace(/\s+−\s+/g, " minus ");
  s = s.replace(/\s+-\s+(?=\d)/g, " minus ");
  return collapseSpaces(s);
}

function normalizeProse(text: string): string {
  return stripMarkdownAggressive(text).replace(/\n+/g, " ").replace(/\s+/g, " ").trim();
}

function parseFeedbackSections(feedback: string): Parsed {
  const sections: Parsed = { analysis: "", error_type: "", grade: "", remediation: "" };
  const re = /##\s*(Analysis|Error Type|Grade|Remediation)\s*\n([\s\S]*?)(?=##\s|$)/gi;
  let m;
  while ((m = re.exec(feedback)) !== null) {
    const key = m[1].toLowerCase();
    const val = m[2].trim();
    if (key === "analysis") sections.analysis = val;
    else if (key === "error type") sections.error_type = val;
    else if (key === "grade") sections.grade = val;
    else if (key === "remediation") sections.remediation = val;
  }
  return sections;
}

function isNoneError(s: string): boolean {
  const t = s.trim().toLowerCase();
  return !t || t === "none" || t.startsWith("none found") || t === "none.";
}

function countQuestionMarkers(s: string): number {
  const m = s.match(/\bQ\s*\d+/gi);
  return m ? m.length : 0;
}

function softenQuestionLabels(s: string): string {
  return s.replace(/\bQ\s*(\d+)\s*[:.)-]?\s*/gi, " ");
}

function smartTruncate(s: string, maxLen: number): string {
  const t = collapseSpaces(s);
  if (t.length <= maxLen) return t;
  const slice = t.slice(0, maxLen);
  const dot = slice.lastIndexOf(".");
  if (dot > maxLen * 0.45) return slice.slice(0, dot + 1).trim();
  const sp = slice.lastIndexOf(" ");
  return (sp > 40 ? slice.slice(0, sp) : slice).trim() + "…";
}

/**
 * Must match `buildStudentWorkNarrativeParagraph(..., "student")` in
 * `src/lib/studentFeedbackNarrative.ts` so audio === “Your summary” on /student/analysis.
 */
function buildScript(work: {
  student_name: string | null;
  subject: string | null;
  feedback: string | null;
  error_type: string | null;
  remediation: string | null;
}): string {
  const rawFeedback = work.feedback?.trim() || "";
  if (!rawFeedback) return "";

  const parsed = parseFeedbackSections(rawFeedback);
  const subject = collapseSpaces(work.subject?.trim() || "mathematics");
  const subjectPhrase =
    subject.toLowerCase().includes("math") || subject.toLowerCase() === "mathematics"
      ? "this mathematics work"
      : `this ${subject} work`;

  let analysisRaw = parsed.analysis.trim();
  if (!analysisRaw) analysisRaw = rawFeedback;

  const analysisClean = normalizeProse(softenQuestionLabels(stripMarkdownAggressive(analysisRaw)));
  const qMarkers = countQuestionMarkers(analysisRaw) + countQuestionMarkers(rawFeedback);

  const errRaw =
    (work.error_type?.trim() && work.error_type) || parsed.error_type || "";
  let errors = normalizeProse(softenQuestionLabels(stripMarkdownAggressive(errRaw)));
  if (isNoneError(errors)) errors = "";

  const remRaw =
    (work.remediation?.trim() && work.remediation) || parsed.remediation || "";
  let remediation = normalizeProse(
    softenQuestionLabels(stripMarkdownAggressive(remRaw)),
  );

  const gradeBit = normalizeProse(parsed.grade || "");

  const denseItemization = qMarkers >= 2 || analysisClean.length > 650;

  if (denseItemization) {
    const errShort = errors ? smartTruncate(errors, 420) : "";
    const remShort = remediation ? smartTruncate(remediation, 420) : "";
    const gist = analysisClean ? smartTruncate(analysisClean, qMarkers >= 3 ? 200 : 320) : "";

    const bits: string[] = [`In ${subjectPhrase}, you worked through the exercises on the page.`];
    if (errShort) bits.push(`The main things to work on are: ${errShort}`);
    else if (gist) bits.push(`In short: ${gist}`);
    if (remShort) bits.push(`To improve, try this: ${remShort}`);
    else if (gist && errShort) {
      /* covered */
    } else if (gist) bits.push(`${gist}`);
    if (gradeBit && /\d/.test(gradeBit)) bits.push(`Score noted on the work: ${gradeBit}.`);
    if (bits.length === 1) {
      bits.push("Keep practicing similar problems and check each digit and tally mark carefully.");
    }
    let out = polishNarrativeText(collapseSpaces(bits.join(" ")));
    if (out.length > MAX_TTS_CHARS) out = smartTruncate(out, MAX_TTS_CHARS);
    return out;
  }

  let analysis = analysisClean;
  if (analysis.length > 720) analysis = smartTruncate(analysis, 700);

  const parts: string[] = [];
  parts.push(`In ${subjectPhrase}, here is what stands out: ${analysis}`);
  if (errors) parts.push(`Some mistakes or weak spots to work on are: ${errors}`);
  if (remediation) parts.push(`To improve, try this: ${remediation}`);

  let out = polishNarrativeText(collapseSpaces(parts.join(" ")));
  if (out.length > MAX_TTS_CHARS) out = smartTruncate(out, MAX_TTS_CHARS);
  return out;
}

/** Spoken line must match portal text + warm “Mother of Mathematics” math-reading style. */
function buildSpokenScript(work: {
  student_name: string | null;
  subject: string | null;
  feedback: string | null;
  error_type: string | null;
  remediation: string | null;
}): string {
  const core = buildScript(work);
  const intro =
    "Hello from Mother of Mathematics — warm, clear feedback on primary mathematics. " +
    "Symbols like plus, minus, equals, percent, and fractions are read in full words. ";
  let full = collapseSpaces(intro + core);
  if (full.length > MAX_TTS_CHARS) full = smartTruncate(full, MAX_TTS_CHARS);
  return full;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const elevenKey = Deno.env.get("ELEVENLABS_API_KEY") ?? "";
  const voiceId = Deno.env.get("ELEVENLABS_VOICE_ID") || DEFAULT_VOICE_ID;
  const modelId = Deno.env.get("ELEVENLABS_MODEL_ID") || DEFAULT_MODEL_ID;

  if (!elevenKey) {
    return json({ ok: false, error: "ELEVENLABS_API_KEY not configured" }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ ok: false, error: "Missing authorization" }, 401);
  }

  let body: { studentWorkId?: string; narrativePlain?: string };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }

  const studentWorkId = body.studentWorkId?.trim();
  if (!studentWorkId) {
    return json({ ok: false, error: "studentWorkId required" }, 400);
  }

  const clientNarrative =
    typeof body.narrativePlain === "string" ? body.narrativePlain.trim() : "";

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser();
  if (userErr || !user) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  const admin = createClient(supabaseUrl, serviceKey);

  const { data: work, error: fetchErr } = await admin
    .from("student_works")
    .select(
      "id, teacher_id, student_id, feedback, student_name, subject, error_type, remediation",
    )
    .eq("id", studentWorkId)
    .maybeSingle();

  if (fetchErr || !work) {
    return json({ ok: false, error: "Work not found" }, 404);
  }

  if (work.teacher_id !== user.id) {
    return json({ ok: false, error: "Forbidden" }, 403);
  }

  if (!work.student_id) {
    return json({ ok: false, error: "Assign a student before generating audio" }, 400);
  }

  if (!work.feedback?.trim()) {
    return json({ ok: false, error: "No analysis text yet" }, 400);
  }

  const { error: pendingErr } = await admin
    .from("student_works")
    .update({ feedback_audio_status: "pending", feedback_audio_url: null })
    .eq("id", studentWorkId);

  if (pendingErr) {
    console.error("[student-work-feedback-audio] pending update", pendingErr);
    return json(
      {
        ok: false,
        error:
          pendingErr.message ||
          "Could not save audio status — run migration 20250328200000_student_work_feedback_audio.sql",
      },
      500,
    );
  }

  /** Prefer client text = exact “Your summary” on /student/analysis (no server rebuild drift). */
  let ttsText: string;
  if (clientNarrative.length >= 20) {
    ttsText =
      clientNarrative.length > MAX_TTS_CHARS
        ? smartTruncate(clientNarrative, MAX_TTS_CHARS)
        : collapseSpaces(clientNarrative);
  } else {
    ttsText = buildSpokenScript(work);
  }

  const runTts = async () => {
    try {
      const text = ttsText;
      if (text.length < 20) {
        throw new Error("Script too short after processing");
      }

      const ttsRes = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: "POST",
          headers: {
            "xi-api-key": elevenKey,
            "Content-Type": "application/json",
            Accept: "audio/mpeg",
          },
          body: JSON.stringify({
            text,
            model_id: modelId,
          }),
        },
      );

      if (!ttsRes.ok) {
        const errTxt = await ttsRes.text();
        throw new Error(`ElevenLabs ${ttsRes.status}: ${errTxt.slice(0, 400)}`);
      }

      const audioBuffer = new Uint8Array(await ttsRes.arrayBuffer());
      const path = `${work.teacher_id}/${studentWorkId}_${Date.now()}.mp3`;

      const { error: upErr } = await admin.storage
        .from("student-feedback-audio")
        .upload(path, audioBuffer, {
          contentType: "audio/mpeg",
          upsert: true,
        });

      if (upErr) {
        throw new Error(upErr.message);
      }

      const { data: pub } = admin.storage.from("student-feedback-audio").getPublicUrl(path);
      const publicUrl = pub.publicUrl;

      await admin
        .from("student_works")
        .update({
          feedback_audio_url: publicUrl,
          feedback_audio_status: "ready",
        })
        .eq("id", studentWorkId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      console.error("[student-work-feedback-audio]", msg);
      await admin
        .from("student_works")
        .update({ feedback_audio_status: "error" })
        .eq("id", studentWorkId);
    }
  };

  if (typeof EdgeRuntime !== "undefined") {
    EdgeRuntime.waitUntil(runTts());
    return json({ ok: true, started: true });
  }

  await runTts();
  const { data: refreshed } = await admin
    .from("student_works")
    .select("feedback_audio_url, feedback_audio_status")
    .eq("id", studentWorkId)
    .maybeSingle();

  if (refreshed?.feedback_audio_status === "ready") {
    return json({ ok: true, url: refreshed.feedback_audio_url });
  }
  return json({ ok: false, error: "Audio generation failed" }, 500);
});
