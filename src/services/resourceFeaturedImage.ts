/**
 * Background AI featured cover for resource library cards (non-image files).
 * Plans a scene with text LLM, then generates an image via OpenRouter (Gemini image).
 */

import { checkRateLimit } from "@/lib/rateLimit";
import { getApiKey } from "./api";
import { generateSlideImage, buildResourceFeaturedCoverPrompt } from "./imageGeneration";
import { updateResource, uploadResourceFile } from "./resourceService";

const PLANNER_MODEL = "anthropic/claude-sonnet-4.6";
const FALLBACK_API_URL = "https://openrouter.ai/api/v1/chat/completions";

export type FeaturedImageJobContext = {
  resourceId: string;
  teacherId: string;
  title: string;
  description?: string | null;
  topic?: string | null;
  summary?: string | null;
  fileType: string;
};

export function queueResourceFeaturedImageGeneration(ctx: FeaturedImageJobContext): void {
  void runResourceFeaturedImageJob(ctx);
}

function buildLiteralBrief(ctx: FeaturedImageJobContext): string {
  return [
    ctx.topic ? `Topic / folder: ${ctx.topic}` : "",
    ctx.description ? `Description: ${ctx.description}` : "",
    ctx.summary ? `Summary: ${ctx.summary}` : "",
    `File type: ${ctx.fileType}`,
  ]
    .filter(Boolean)
    .join("\n");
}

async function planScene(ctx: FeaturedImageJobContext): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("OpenRouter API key not configured");

  const apiUrl = import.meta.env.VITE_OPENROUTER_API_URL || FALLBACK_API_URL;
  const bits = [
    `Resource title: ${ctx.title}`,
    ctx.topic ? `Topic / folder: ${ctx.topic}` : "",
    ctx.description ? `Description: ${ctx.description}` : "",
    ctx.summary ? `Summary: ${ctx.summary}` : "",
    `Resource type: ${ctx.fileType}`,
  ]
    .filter(Boolean)
    .join("\n");

  const userInstructions = `You output ONE JSON object for a cover illustration that must match this resource exactly — not a different lesson or topic.

Rules:
- The "scene" must be a direct visual reading of what the resource is about, using ONLY details supported by the title, topic, description, and summary above. Do not swap in another math strand (e.g. if it is fractions, do not illustrate algebra or clocks unless the text mentions them).
- Name specific manipulatives, representations, or activities only if they follow from the text; if the text is thin, stay close to the exact words in the title (e.g. "Fractions quiz" → divided shapes, sharing, measuring parts — still fractions).
- Setting: diverse young Black students in a Cameroonian / African primary school context, warm and accurate to the subject.
- The final image must contain NO readable text, letters, or numbers on the artwork.

Return JSON only: {"scene":"3–6 sentences, concrete and faithful to the resource","mood":"short tone phrase"}. No markdown.

---
${bits}`;

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": typeof window !== "undefined" ? window.location.origin : "https://mamamath.org",
      "X-Title": "Mother of Math",
    },
    body: JSON.stringify({
      model: PLANNER_MODEL,
      temperature: 0.15,
      max_tokens: 700,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You write image briefs for mathematics teaching resources. Your job is fidelity: the brief must describe a scene that reflects the teacher's resource as given, without altering or replacing the mathematical focus. Output valid JSON only with keys scene and mood.",
        },
        { role: "user", content: userInstructions },
      ],
    }),
  });

  if (!res.ok) throw new Error(`Planner request failed (${res.status})`);

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  let raw = data.choices?.[0]?.message?.content?.trim() || "{}";
  if (raw.startsWith("```")) {
    raw = raw.replace(/^```[a-zA-Z]*\s*/m, "").replace(/```\s*$/m, "").trim();
  }
  let parsed: { scene?: string; mood?: string };
  try {
    parsed = JSON.parse(raw) as { scene?: string; mood?: string };
  } catch {
    parsed = {};
  }
  const scene = [parsed.scene, parsed.mood].filter(Boolean).join(" ");
  if (!scene.trim()) {
    const brief = buildLiteralBrief(ctx);
    return brief
      ? `Illustration faithful to this resource only:\n${brief}\nVisualize the mathematics named in the title with age-appropriate manipulatives and diverse young learners in a Cameroonian primary classroom. No unrelated math topics.`
      : `Illustration faithful to the resource titled "${ctx.title}" only: show the specific mathematics implied by that title with diverse young learners and appropriate hands-on materials in a Cameroonian primary classroom. Do not substitute a different topic.`;
  }
  return scene.trim();
}

async function runResourceFeaturedImageJob(ctx: FeaturedImageJobContext): Promise<void> {
  if (ctx.fileType === "image") return;

  if (!checkRateLimit("resource-featured-image", 6, 60_000)) {
    console.warn("[FeaturedImage] soft rate limit — try again shortly");
    return;
  }

  try {
    const literalBrief = buildLiteralBrief(ctx);
    const scene = await planScene(ctx);
    const prompt = buildResourceFeaturedCoverPrompt(ctx.title, scene, literalBrief);
    const dataUrl = await generateSlideImage(prompt, "16:9");
    if (!dataUrl) {
      await updateResource(ctx.resourceId, { featuredImageStatus: "error" });
      return;
    }
    const blob = await fetch(dataUrl).then((r) => r.blob());
    const file = new File([blob], `featured-${ctx.resourceId}.png`, {
      type: blob.type || "image/png",
    });
    const publicUrl = await uploadResourceFile(file, ctx.teacherId);
    await updateResource(ctx.resourceId, {
      thumbnailUrl: publicUrl,
      featuredImageStatus: "ready",
    });
  } catch (e) {
    console.error("[FeaturedImage] job failed", e);
    try {
      await updateResource(ctx.resourceId, { featuredImageStatus: "error" });
    } catch {
      /* ignore */
    }
  }
}
