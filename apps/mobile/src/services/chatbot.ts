import { fetch as expoFetch } from "expo/fetch";
import { getTopicsForClassLevel, type TopicItem } from "../data/curriculumContent";
import type { Language } from "../lib/i18n";
import { toFriendlyNetworkError } from "../lib/network";
import { getSupabaseAnonKey, getSupabaseUrl, supabase } from "../lib/supabase";
import {
  STUDENT_WORK_ANALYSIS_SYSTEM_PROMPT,
  STUDENT_WORK_MAX_TOKENS,
  STUDENT_WORK_TEMPERATURE,
  STUDENT_WORK_VISION_DETAIL,
  buildStudentWorkAnalysisPrompt,
  normalizeStudentWorkFeedback,
} from "../lib/studentWorkAnalysisPrompt";

export type ChatCountry = "cameroon" | "nigeria";

/** Formats the real curriculum topic list into a concise prompt block (same as web). */
function buildCurriculumBlock(topics: TopicItem[]): string {
  if (!topics.length) return "";
  const lines: string[] = ["\n\n=== OFFICIAL CURRICULUM TOPICS FOR THIS CLASS ==="];
  const byStrand = topics.reduce<Record<string, TopicItem[]>>((acc, t) => {
    (acc[t.strand] = acc[t.strand] || []).push(t);
    return acc;
  }, {});
  for (const [strand, items] of Object.entries(byStrand)) {
    lines.push(`\n**${strand}**`);
    for (const item of items) {
      lines.push(`- **${item.title}**: ${item.objectives.slice(0, 2).join("; ")}`);
      if (item.subtopics?.length) lines.push(`  Subtopics: ${item.subtopics.slice(0, 4).join(", ")}`);
    }
  }
  lines.push("\n=== END OF CURRICULUM TOPICS ===");
  lines.push("When helping the teacher, always ground your advice in these specific topics.");
  return lines.join("\n");
}

/**
 * Same country/grade/curriculum system prompt as the web ChatbotService.
 * Country selection loads that nation's topics; class selection scopes the prompt.
 */
export const buildMamaSystemPrompt = (
  grade: string,
  language: Language = "en",
  country: ChatCountry = "cameroon",
  curriculumTopics?: TopicItem[],
): string => {
  const topicsBlock =
    curriculumTopics && curriculumTopics.length
      ? buildCurriculumBlock(curriculumTopics)
      : buildCurriculumBlock(getTopicsForClassLevel(country, `Primary ${grade}`));

  if (country === "nigeria") {
    return `You are MAMA (Mathematics Assistant for Nigerian Primary Schools), an AI teaching assistant specialized in Nigeria's National Primary Mathematics Curriculum. You are currently assisting a teacher for Primary ${grade}. All your responses must be tailored specifically to this grade level and the Nigerian national curriculum.

You help teachers with:
- Mathematics curriculum guidance for Nigeria's National Primary Mathematics Standards for Primary ${grade}.
- Lesson planning and teaching strategies aligned with the Nigerian national curriculum for Primary ${grade}.
- Student assessment and progress tracking for Primary ${grade}.
- Explaining mathematical concepts appropriate for Primary ${grade}.
- Cultural integration of local Nigerian contexts in math education for Primary ${grade}.

Nigerian Primary Mathematics Curriculum Strands covered at Primary ${grade}:
- **Number and Numeration**: counting, place value, whole numbers, fractions, decimals, percentages.
- **Basic Operations**: addition, subtraction, multiplication, division with whole numbers and fractions.
- **Algebraic Processes**: number patterns, sequences, simple open sentences and equations.
- **Mensuration and Geometry**: measurement of length, mass, capacity, time, perimeter, area; 2D and 3D shapes.
- **Everyday Statistics**: data collection, frequency tables, bar charts, pictograms, averages.

Key Guidelines:
- Your primary focus is Primary ${grade} in Nigeria. All examples and advice must be suitable for this level.
- **Answer specifically what is asked without providing unsolicited information.**
- Use Nigerian contexts (Naira, local markets, familiar Nigerian foods, cities, cultural activities, etc.).
- Align all advice firmly to Nigeria's national curriculum standards and UBE framework.
- Use simple, clear language appropriate for Primary ${grade} teachers.
- Provide specific, actionable advice for teachers relevant to Primary ${grade}.
- When an image is shared, analyze it thoroughly for any mathematical content, student work, or educational material.
- Format your responses using Markdown: use headings, bold text, numbered lists, and bullet points for clarity.
- For any reply longer than a few sentences, use \`##\` or \`###\` headings, blank lines between sections, and real \`-\` or numbered lists—do not fake lists using only bold lines like \`**Label:**\`.
- When writing mathematical formulas, use LaTeX notation between $...$ for inline and $$...$$ for display blocks.

Be helpful, encouraging, and educational in all responses, ensuring they are directly applicable to Primary ${grade} in Nigeria.${topicsBlock}`;
  }

  if (language === "fr") {
    return `Vous êtes MAMA (Assistante Mathématique pour le Cameroun), une assistante pédagogique IA spécialisée dans le programme de mathématiques du primaire au Cameroun. Vous assistez actuellement un enseignant pour le Primaire ${grade}. Toutes vos réponses doivent être adaptées à ce niveau.

Vous aidez les enseignants avec :
- L'orientation curriculaire en mathématiques selon les normes nationales du Cameroun pour le Primaire ${grade}.
- La planification de cours et les stratégies d'enseignement pour le Primaire ${grade}.
- L'évaluation des élèves et le suivi des progrès pour le Primaire ${grade}.
- L'explication de concepts mathématiques appropriés au Primaire ${grade}.
- L'intégration culturelle de contextes camerounais locaux dans l'éducation mathématique pour le Primaire ${grade}.

Directives :
- Votre objectif principal est le Primaire ${grade}. Tous les exemples et conseils doivent y être adaptés.
- Utilisez toujours des exemples culturellement pertinents (francs CFA, marchés locaux, aliments familiers, etc.).
- Utilisez un langage simple et clair adapté au Primaire ${grade}.
- Fournissez des conseils spécifiques et pratiques pour les enseignants.
- Lorsqu'une image est partagée, analysez-la en profondeur pour tout contenu mathématique.
- Formatez vos réponses en Markdown : titres, gras, listes numérotées, puces.
- Pour les réponses un peu longues, utilisez des titres \`##\` ou \`###\`, une ligne vide entre les sections, et de vraies listes à puces \`-\` ou numérotées ; évitez les « listes » faites seulement de lignes en gras du type \`**Libellé :**\`.
- Lorsque vous écrivez des formules mathématiques, utilisez la notation LaTeX entre $...$ pour les formules en ligne et $$...$$ pour les blocs.

Répondez TOUJOURS en français. Soyez utile, encourageant et éducatif.${topicsBlock}`;
  }

  return `You are MAMA (Mathematics Assistant for Cameroon), an AI teaching assistant specialized in Cameroon's primary mathematics curriculum. You are currently assisting a teacher for Primary ${grade}. All your responses must be tailored specifically to this grade level.

You help teachers with:
- Mathematics curriculum guidance for Cameroon National Primary Mathematics Standards for Primary ${grade}.
- Lesson planning and teaching strategies for Primary ${grade}.
- Student assessment and progress tracking for Primary ${grade}.
- Explaining mathematical concepts appropriate for Primary ${grade}.
- Cultural integration of local Cameroonian contexts in math education for Primary ${grade}.

Key Guidelines:
- Your primary focus is Primary ${grade}. All examples, explanations, and advice must be suitable for a child in this class.
- **Answer specifically what is asked without overwriting or providing unsolicited information.** Do not over-explain unless necessary for clarity.
- If you ask a follow-up question, ensure it is **directly related to the current discussion**.
- Always provide culturally relevant examples using Cameroonian contexts (CFA francs, local markets, familiar foods, etc.).
- Use simple, clear language appropriate for Primary ${grade}.
- Provide specific, actionable advice for teachers relevant to Primary ${grade}.
- When an image is shared, analyze it thoroughly for any mathematical content, student work, or educational material.
- Format your responses using Markdown: use headings, bold text, numbered lists, and bullet points for clarity.
- For any reply longer than a few sentences, use \`##\` or \`###\` headings, blank lines between sections, and real \`-\` or numbered lists—do not fake lists using only bold lines like \`**Label:**\`.
- When writing mathematical formulas, use LaTeX notation between $...$ for inline and $$...$$ for display blocks.

Be helpful, encouraging, and educational in all responses, ensuring they are directly applicable to Primary ${grade}.${topicsBlock}`;
};

export interface ConversationRow {
  id: string;
  user_id: string;
  title: string;
  grade: string | null;
  updated_at: string;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  rating?: number | null;
  bookmarked?: boolean | null;
}

type ChatContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail?: string } };

type ChatMessage = {
  role: string;
  content: string | ChatContentPart[];
};

const extractAssistantText = (data: any): string | null => {
  if (!data) return null;
  if (typeof data === "string") return data;
  if (typeof data.error === "string") throw new Error(data.error);
  const choice = data?.choices?.[0]?.message?.content;
  if (typeof choice === "string" && choice.trim()) return choice;
  if (typeof data.message === "string" && data.message.trim()) return data.message;
  if (typeof data.content === "string" && data.content.trim()) return data.content;
  return null;
};

export const listConversations = async (userId: string): Promise<ConversationRow[]> => {
  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ConversationRow[];
};

export const createConversation = async (userId: string, title: string, grade = "General") => {
  const { data, error } = await supabase
    .from("conversations")
    .insert({ user_id: userId, title, grade, updated_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw error;
  return data as ConversationRow;
};

export const listMessages = async (conversationId: string): Promise<MessageRow[]> => {
  const { data, error } = await supabase
    .from("conversation_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as MessageRow[];
};

export const addMessage = async (
  conversationId: string,
  role: "user" | "assistant",
  content: string,
) => {
  const { data, error } = await supabase
    .from("conversation_messages")
    .insert({ conversation_id: conversationId, role, content })
    .select()
    .single();
  if (error) throw error;
  await supabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);
  return data as MessageRow;
};

export const deleteConversation = async (id: string) => {
  await supabase.from("conversation_messages").delete().eq("conversation_id", id);
  const { error } = await supabase.from("conversations").delete().eq("id", id);
  if (error) throw error;
};

/** Same as web: 1 = helpful, -1 = not helpful, null = cleared. */
export const updateMessageRating = async (messageId: string, rating: number | null) => {
  const { error } = await supabase
    .from("conversation_messages")
    .update({ rating })
    .eq("id", messageId);
  if (error) throw error;
};

/** Same as web: toggle bookmark on an assistant message. */
export const toggleMessageBookmark = async (messageId: string, bookmarked: boolean) => {
  const { error } = await supabase
    .from("conversation_messages")
    .update({ bookmarked })
    .eq("id", messageId);
  if (error) throw error;
};

export type BookmarkedMessage = MessageRow & {
  conversation_title?: string;
};

/** Fetch all bookmarked messages for a user (across conversations) — same as web. */
export const getBookmarkedMessages = async (userId: string): Promise<BookmarkedMessage[]> => {
  const { data: convos, error: convosError } = await supabase
    .from("conversations")
    .select("id, title")
    .eq("user_id", userId);
  if (convosError || !convos?.length) return [];

  const convoIds = convos.map((c) => c.id as string);
  const convoMap = Object.fromEntries(convos.map((c) => [c.id as string, c.title as string]));

  const { data, error } = await supabase
    .from("conversation_messages")
    .select("*")
    .in("conversation_id", convoIds)
    .eq("bookmarked", true)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return ((data ?? []) as MessageRow[]).map((m) => ({
    ...m,
    conversation_title: convoMap[m.conversation_id] || "Untitled",
  }));
};

/** Same path as web: Supabase Edge Function `openrouter-proxy`. */
export const askChatbot = async (
  messages: ChatMessage[],
  systemPrompt?: string,
  options?: {
    model?: string;
    temperature?: number;
    max_tokens?: number;
  },
) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("You must be signed in to use AI features.");

  const { data, error } = await supabase.functions.invoke("openrouter-proxy", {
    body: {
      openrouter: {
        // Same default as web ChatbotService — gemini-2.0-flash-001 is retired on OpenRouter.
        model: options?.model ?? "google/gemini-3.1-flash-lite-preview",
        temperature: options?.temperature,
        max_tokens: options?.max_tokens,
        messages: [
          {
            role: "system",
            content:
              systemPrompt ??
              "You are MamaMath, an AI teaching assistant for Cameroonian mathematics teachers. Be practical, curriculum-aware, and concise.",
          },
          ...messages,
        ],
      },
      client_referer: "motherofmath://",
      client_title: "Mother of Math Mobile",
    },
  });

  if (error) {
    const detail = (error as any)?.context?.json
      ? await (error as any).context.json().catch(() => null)
      : null;
    throw new Error(detail?.error || error.message || "AI request failed. Please try again.");
  }

  try {
    return (
      extractAssistantText(data) ??
      (() => {
        throw new Error("No AI response received. Please try again.");
      })()
    );
  } catch (e) {
    if (e instanceof Error) throw e;
    throw new Error("Unable to read AI response.");
  }
};

const DEFAULT_CHAT_MODEL = "google/gemini-3.1-flash-lite-preview";
const DEFAULT_SYSTEM =
  "You are MamaMath, an AI teaching assistant for Cameroonian mathematics teachers. Be practical, curriculum-aware, and concise.";

const deltaFromSseLine = (line: string): string => {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data: ")) return "";
  const jsonStr = trimmed.slice(6);
  if (!jsonStr || jsonStr === "[DONE]") return "";
  try {
    const parsed = JSON.parse(jsonStr) as {
      error?: string | { message?: string };
      choices?: { delta?: { content?: string } }[];
    };
    if (typeof parsed.error === "string" && parsed.error.trim()) {
      throw new Error(parsed.error);
    }
    if (parsed.error && typeof parsed.error === "object" && parsed.error.message) {
      throw new Error(parsed.error.message);
    }
    const delta = parsed.choices?.[0]?.delta?.content;
    return typeof delta === "string" ? delta : "";
  } catch (e) {
    if (e instanceof Error && e.message && !e.message.startsWith("Unexpected") && !e.message.includes("JSON")) {
      throw e;
    }
    return "";
  }
};

const parseSseText = (raw: string): string => {
  let full = "";
  for (const line of raw.split("\n")) {
    full += deltaFromSseLine(line);
  }
  return full;
};

/**
 * Same OpenRouter proxy as `askChatbot`, but streams tokens so the UI can type
 * the reply the way the web chatbot does.
 */
export const askChatbotStreaming = async (
  messages: ChatMessage[],
  systemPrompt: string | undefined,
  onUpdate: (fullText: string) => void,
  options?: {
    model?: string;
    temperature?: number;
    max_tokens?: number;
  },
): Promise<string> => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("You must be signed in to use AI features.");

  const base = getSupabaseUrl().replace(/\/$/, "");
  const anon = getSupabaseAnonKey();
  if (!base || !anon) throw new Error("AI is not configured on this device.");

  let response: Response;
  try {
    response = await expoFetch(`${base}/functions/v1/openrouter-proxy`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        Authorization: `Bearer ${session.access_token}`,
        apikey: anon,
      },
      body: JSON.stringify({
        openrouter: {
          model: options?.model ?? DEFAULT_CHAT_MODEL,
          temperature: options?.temperature ?? 0.7,
          max_tokens: options?.max_tokens ?? 2048,
          stream: true,
          messages: [
            { role: "system", content: systemPrompt ?? DEFAULT_SYSTEM },
            ...messages,
          ],
        },
        client_referer: "motherofmath://",
        client_title: "Mother of Math Mobile",
      }),
    });
  } catch (error) {
    throw toFriendlyNetworkError(error);
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    let message = `AI request failed (${response.status}).`;
    try {
      const parsed = JSON.parse(errText) as { error?: string };
      if (parsed.error) message = parsed.error;
    } catch {
      if (errText.trim()) message = errText.slice(0, 280);
    }
    throw new Error(message);
  }

  const deliverBuffered = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed.startsWith("{")) {
      try {
        const fromJson = extractAssistantText(JSON.parse(trimmed));
        if (fromJson?.trim()) {
          onUpdate(fromJson);
          return fromJson;
        }
      } catch (e) {
        if (!(e instanceof SyntaxError)) throw e;
      }
    }
    const fromSse = parseSseText(raw);
    if (!fromSse.trim()) throw new Error("No AI response received. Please try again.");
    onUpdate(fromSse);
    return fromSse;
  };

  const reader = response.body?.getReader?.();
  if (!reader) {
    return deliverBuffered(await response.text());
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  const consume = (incoming: string) => {
    buffer += incoming;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    let added = "";
    for (const line of lines) added += deltaFromSseLine(line);
    return added;
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      const piece = value ? decoder.decode(value, { stream: !done }) : "";
      const added = consume(piece + (done ? "\n" : ""));
      if (added) {
        full += added;
        onUpdate(full);
      }
      if (done) break;
    }
  } catch (error) {
    throw toFriendlyNetworkError(error);
  }

  if (!full.trim() && buffer.trim()) {
    return deliverBuffered(buffer);
  }
  if (!full.trim()) throw new Error("No AI response received. Please try again.");
  onUpdate(full);
  return full;
};

/**
 * Vision analysis — same model, prompt, and normalization as web `/dashboard/upload`.
 * `imageUrl` may be a public https URL or a `data:image/...;base64,...` URL.
 */
export const analyzeStudentWorkWithAI = async (input: {
  imageUrl: string;
  notes?: string;
  fileName?: string | null;
  studentName?: string | null;
  subject?: string | null;
  grade?: string | null;
}) => {
  const promptParts = [
    buildStudentWorkAnalysisPrompt(),
    input.studentName ? `Learner: ${input.studentName}` : null,
    input.subject ? `Subject: ${input.subject}` : null,
    input.grade ? `Grade level: ${input.grade}` : null,
    input.fileName ? `File: ${input.fileName}` : null,
    input.notes?.trim() ? `Teacher notes:\n${input.notes.trim()}` : null,
  ].filter(Boolean);

  const raw = await askChatbot(
    [
      {
        role: "user",
        content: [
          { type: "text", text: promptParts.join("\n\n") },
          {
            type: "image_url",
            image_url: {
              url: input.imageUrl,
              detail: STUDENT_WORK_VISION_DETAIL,
            },
          },
        ],
      },
    ],
    STUDENT_WORK_ANALYSIS_SYSTEM_PROMPT,
    {
      model: "anthropic/claude-opus-4.8",
      temperature: STUDENT_WORK_TEMPERATURE,
      max_tokens: STUDENT_WORK_MAX_TOKENS,
    },
  );

  return normalizeStudentWorkFeedback(raw);
};

export const generateLessonPlanWithAI = async (topic: string, level: string) => {
  return askChatbot(
    [
      {
        role: "user",
        content: `Create a detailed Cameroonian mathematics lesson plan for topic "${topic}" at level "${level}". Include objectives, materials, steps, differentiation, assessment, and homework.`,
      },
    ],
    "You are an expert Cameroonian curriculum lesson planner. Structure clearly with markdown headings.",
  );
};
