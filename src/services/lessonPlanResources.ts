/**
 * Generate quiz + worksheet from a saved lesson plan as branded PDFs → Resources library.
 */

import { checkRateLimit } from "@/lib/rateLimit";
import { getApiKey } from "./api";
import { uploadResourceFile, createResource } from "./resourceService";
import { queueResourceFeaturedImageGeneration } from "./resourceFeaturedImage";
import {
  stripArtifacts,
  buildQuizPdfBlob,
  buildWorksheetPdfBlob,
  type QuizPayload,
  type QuizQuestion,
  type WorksheetPayload,
  type WorksheetPart,
} from "@/lib/generatedResourcePdf";

const FALLBACK_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "anthropic/claude-sonnet-4.6";

const JSON_SCHEMA_HINT = `Return one JSON object with exactly two keys: "quiz" and "worksheet". No markdown anywhere — only plain text inside JSON strings.

"quiz" must be an object:
{
  "title": "Short catchy quiz title (plain text)",
  "questions": [
    {
      "n": 1,
      "type": "multiple_choice",
      "question": "Question text only — no bullets or markdown",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."]
    },
    {
      "n": 2,
      "type": "short_answer",
      "question": "Question text",
      "lines": 4
    },
    {
      "n": 3,
      "type": "true_false",
      "question": "Statement to judge true or false"
    }
  ],
  "answers": [
    { "n": 1, "text": "Correct option or wording" },
    { "n": 2, "text": "Sample acceptable answer" },
    { "n": 3, "text": "True" }
  ]
}

"worksheet" must be an object:
{
  "title": "Worksheet title (plain text)",
  "intro": "1–3 sentences of instructions for pupils — plain sentences only",
  "parts": [
    {
      "heading": "Section name e.g. Warm-up",
      "tasks": ["First exercise written as a clear sentence", "Second exercise ..."]
    },
    {
      "heading": "Main practice",
      "tasks": ["...", "..."]
    }
  ]
}

Rules:
- Use 6–12 quiz questions total, mixed types where appropriate for the level.
- Every string is plain English for pupils; no **, #, \`, bullets as characters — use full sentences for tasks.
- "answers" must include one entry per question number in "questions".
- "parts" must have at least 2 sections with several tasks each.`;

function parseModelJsonObject(content: string): Record<string, unknown> {
  let t = content.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```[a-zA-Z]*\s*/m, "").replace(/```\s*$/m, "").trim();
  }
  const fb = t.indexOf("{");
  const lb = t.lastIndexOf("}");
  if (fb !== -1 && lb > fb) t = t.slice(fb, lb + 1);
  return JSON.parse(t) as Record<string, unknown>;
}

function sanitizeTitle(raw: string): string {
  return raw.replace(/^["']|["']$/g, "").trim() || "Lesson plan";
}

function safeFileSlug(title: string): string {
  const s = sanitizeTitle(title)
    .slice(0, 48)
    .replace(/[^\w\s-]+/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase();
  return s || `lesson-${Date.now()}`;
}

function normalizeQuizPayload(raw: unknown): QuizPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const title = typeof o.title === "string" ? stripArtifacts(o.title) : "";
  if (!title) return null;

  const questionsRaw = o.questions;
  if (!Array.isArray(questionsRaw) || questionsRaw.length === 0) return null;

  const questions: QuizQuestion[] = questionsRaw.map((q, i) => {
    const row = q as Record<string, unknown>;
    const n = typeof row.n === "number" && row.n > 0 ? row.n : i + 1;
    const tr = String(row.type || "short_answer").toLowerCase().replace(/\s+/g, "_");
    let type: QuizQuestion["type"] =
      tr === "multiple_choice" || tr === "mcq" ? "multiple_choice" : tr === "true_false" ? "true_false" : "short_answer";
    const question = stripArtifacts(String(row.question || ""));
    let options = Array.isArray(row.options)
      ? row.options.map((x) => stripArtifacts(String(x))).filter(Boolean)
      : undefined;
    if (type === "multiple_choice" && (!options || options.length < 2)) {
      type = "short_answer";
      options = undefined;
    }
    const lines = typeof row.lines === "number" && row.lines > 0 ? Math.min(12, row.lines) : 4;
    return { n, type, question, options, lines };
  }).filter((q) => q.question);

  if (questions.length === 0) return null;

  let answers: { n: number; text: string }[] = [];
  const answersRaw = o.answers;
  if (Array.isArray(answersRaw)) {
    answers = answersRaw.map((a, i) => {
      const row = a as Record<string, unknown>;
      const n = typeof row.n === "number" && row.n > 0 ? row.n : i + 1;
      const text = stripArtifacts(String(row.text ?? row.answer ?? ""));
      return { n, text };
    });
  }

  const nums = new Set(questions.map((q) => q.n));
  for (const n of nums) {
    if (!answers.some((a) => a.n === n)) {
      answers.push({ n, text: "—" });
    }
  }
  answers.sort((a, b) => a.n - b.n);

  return { title, questions, answers };
}

function normalizeWorksheetPayload(raw: unknown): WorksheetPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const title = typeof o.title === "string" ? stripArtifacts(o.title) : "";
  if (!title) return null;

  const intro =
    typeof o.intro === "string"
      ? stripArtifacts(o.intro)
      : typeof o.introduction === "string"
        ? stripArtifacts(o.introduction)
        : "";

  const partsRaw = o.parts;
  if (!Array.isArray(partsRaw) || partsRaw.length === 0) return null;

  const parts: WorksheetPart[] = partsRaw
    .map((p) => {
      const row = p as Record<string, unknown>;
      const heading = stripArtifacts(String(row.heading || row.title || "Practice"));
      const tasksRaw = row.tasks;
      const tasks = Array.isArray(tasksRaw)
        ? tasksRaw.map((t) => stripArtifacts(String(t))).filter(Boolean)
        : [];
      return { heading, tasks };
    })
    .filter((p) => p.tasks.length > 0);

  if (parts.length === 0) return null;
  return { title, intro, parts };
}

/**
 * Calls the AI, builds branded PDFs, uploads, inserts `resources` rows.
 */
export async function createResourcesFromLessonPlan(params: {
  title: string;
  level: string;
  content: unknown;
  teacherId: string;
}): Promise<{ created: number }> {
  const { title, level, content, teacherId } = params;

  if (!checkRateLimit("ai-api", 20, 60 * 1000)) {
    throw new Error("Too many AI requests. Please wait a moment and try again.");
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("OpenRouter API key is not configured. Check VITE_OPENROUTER_API_KEY in your environment.");
  }

  const apiUrl = import.meta.env.VITE_OPENROUTER_API_URL || FALLBACK_API_URL;
  const displayTitle = sanitizeTitle(title);
  const payload = JSON.stringify(content);
  const truncated =
    payload.length > 120_000 ? payload.slice(0, 120_000) + "\n…[truncated for length]" : payload;

  const userMessage = `You create printable classroom materials for mathematics in African/Cameroonian schools.

Lesson title: ${displayTitle}
Level / grade: ${level}

Lesson plan JSON (may be truncated):
${truncated}

${JSON_SCHEMA_HINT}`;

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": typeof window !== "undefined" ? window.location.origin : "https://mamamath.org",
      "X-Title": "Mother of Math",
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.35,
      max_tokens: 8192,
      stream: false,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You reply with one valid JSON object only. Keys: quiz (object), worksheet (object). All human-readable text must be plain text — no markdown syntax (no #, **, *, `, []()). Do not wrap JSON in markdown fences.",
        },
        { role: "user", content: userMessage },
      ],
    }),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    const msg = (errBody as { error?: { message?: string } })?.error?.message;
    throw new Error(msg || `AI request failed (${response.status})`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = data.choices?.[0]?.message?.content;
  if (!raw?.trim()) {
    throw new Error("The AI returned an empty response. Please try again.");
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = parseModelJsonObject(raw);
  } catch {
    throw new Error("Could not read the AI response. Please try again.");
  }

  const quizPayload = normalizeQuizPayload(parsed.quiz);
  const worksheetPayload = normalizeWorksheetPayload(parsed.worksheet);

  if (!quizPayload && !worksheetPayload) {
    throw new Error(
      "The AI response could not be turned into quiz/worksheet PDFs. Try again, or shorten the lesson plan.",
    );
  }

  const slug = safeFileSlug(displayTitle);
  const topic = displayTitle.slice(0, 120);
  const meta = { lessonTitle: displayTitle, level };
  let created = 0;

  if (quizPayload) {
    const blob = buildQuizPdfBlob(quizPayload, meta);
    const file = new File([blob], `quiz-${slug}.pdf`, { type: "application/pdf" });
    const fileUrl = await uploadResourceFile(file, teacherId);
    const quizRow = await createResource({
      title: `Quiz: ${displayTitle.slice(0, 100)}`,
      description: "Branded PDF quiz generated from your lesson plan.",
      fileUrl,
      fileType: "pdf",
      topic,
      gradeLevel: level,
      featuredImageStatus: "pending",
    });
    if (quizRow) {
      queueResourceFeaturedImageGeneration({
        resourceId: quizRow.id,
        teacherId,
        title: quizRow.title,
        description: quizRow.description,
        topic: quizRow.topic,
        fileType: "pdf",
      });
    }
    created++;
  }

  if (worksheetPayload) {
    const blob = buildWorksheetPdfBlob(worksheetPayload, meta);
    const file = new File([blob], `worksheet-${slug}.pdf`, { type: "application/pdf" });
    const fileUrl = await uploadResourceFile(file, teacherId);
    const wsRow = await createResource({
      title: `Worksheet: ${displayTitle.slice(0, 100)}`,
      description: "Branded PDF worksheet generated from your lesson plan.",
      fileUrl,
      fileType: "pdf",
      topic,
      gradeLevel: level,
      featuredImageStatus: "pending",
    });
    if (wsRow) {
      queueResourceFeaturedImageGeneration({
        resourceId: wsRow.id,
        teacherId,
        title: wsRow.title,
        description: wsRow.description,
        topic: wsRow.topic,
        fileType: "pdf",
      });
    }
    created++;
  }

  return { created };
}
