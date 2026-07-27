//  MAMA Chatbot Service 
// Supports: streaming, vision, bilingual (EN/FR), context-window management

import type { Language } from '@/lib/i18n';
import { checkRateLimit } from '@/lib/rateLimit';
import { getTopicsForClassLevel } from '@/data/curriculumContent';
import type { TopicItem } from '@/data/curriculumContent';
import {
  headerByteString,
  isOpenRouterConfigured,
} from '@/services/openrouterEnv';
import { fetchOpenRouterChatCompletion } from '@/services/openrouterTransport';

/** Formats the real curriculum topic list into a concise prompt block. */
function buildCurriculumBlock(topics: TopicItem[]): string {
  if (!topics.length) return '';
  const lines: string[] = ['\n\n=== OFFICIAL CURRICULUM TOPICS FOR THIS CLASS ==='];
  const byStrand = topics.reduce<Record<string, TopicItem[]>>((acc, t) => {
    (acc[t.strand] = acc[t.strand] || []).push(t);
    return acc;
  }, {});
  for (const [strand, items] of Object.entries(byStrand)) {
    lines.push(`\n**${strand}**`);
    for (const item of items) {
      lines.push(`- **${item.title}**: ${item.objectives.slice(0, 2).join('; ')}`);
      if (item.subtopics?.length) lines.push(`  Subtopics: ${item.subtopics.slice(0, 4).join(', ')}`);
    }
  }
  lines.push('\n=== END OF CURRICULUM TOPICS ===');
  lines.push('When helping the teacher, always ground your advice in these specific topics.');
  return lines.join('\n');
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  image_url?: string;
}

interface ChatbotResponse {
  success: boolean;
  message: string;
  error?: string;
}

/** Maximum messages to send to the model (prevents token-limit overflow). */
const MAX_HISTORY_MESSAGES = 20;

class ChatbotService {
  private model: string;
  private visionModel: string;

  constructor() {
    this.model = 'google/gemini-3.1-flash-lite-preview';
    this.visionModel = 'google/gemini-3.1-flash-lite-preview';

    if (!isOpenRouterConfigured()) {
      console.warn(
        'OpenRouter is not configured: deploy openrouter-proxy + OPENROUTER_API_KEY, or set VITE_OPENROUTER_USE_CLIENT_KEY with VITE_OPENROUTER_API_KEY.',
      );
    }
  }

  private missingKeyResponse(language: Language): ChatbotResponse {
    return {
      success: false,
      message:
        language === 'fr'
          ? "L'IA n'est pas configurée ou vous n'êtes pas connecté. Déployez la fonction Edge openrouter-proxy et le secret OPENROUTER_API_KEY sur Supabase, ou pour le dev local utilisez VITE_OPENROUTER_USE_CLIENT_KEY avec VITE_OPENROUTER_API_KEY. Connectez-vous pour utiliser le proxy."
          : 'AI is not configured or you are not signed in. Deploy the openrouter-proxy Edge Function and set the OPENROUTER_API_KEY secret on Supabase, or for local dev set VITE_OPENROUTER_USE_CLIENT_KEY with VITE_OPENROUTER_API_KEY. Sign in to use the secure proxy.',
      error: 'API key missing',
    };
  }

  private userFacingErrorMessage(errMsg: string, language: Language): string {
    if (
      errMsg.includes('OpenRouter') ||
      errMsg.includes('VITE_OPENROUTER_API_KEY') ||
      errMsg.includes('API key')
    ) {
      return errMsg;
    }
    return language === 'fr'
      ? "Je m'excuse, mais j'ai rencontré une erreur. Veuillez réessayer."
      : 'I apologize, but I encountered an error. Please try again.';
  }

  private mapOpenRouterError(status: number, apiMessage: string | undefined): string {
    if (status === 401 || status === 403) {
      return (
        'OpenRouter rejected the request (missing or invalid API key, or not signed in). ' +
        'If you use the Supabase proxy, sign in and ensure OPENROUTER_API_KEY is set on the project. ' +
        'For local browser keys, set VITE_OPENROUTER_USE_CLIENT_KEY=true and VITE_OPENROUTER_API_KEY.'
      );
    }
    if (apiMessage && /user not found/i.test(apiMessage)) {
      return (
        'OpenRouter could not authorize this request (often an invalid or expired API key). ' +
        'Check server secrets or your local .env if using a client key.'
      );
    }
    return apiMessage || `API request failed (${status})`;
  }

  /*  System prompts (EN / FR)  */

  /** LaTeX / Mermaid / tables guidance + optional live teacher dashboard snapshot. */
  private augmentSystemPrompt(body: string, teacherContextSummary?: string): string {
    const rich = `\n\n---\n**Rich output:** Use LaTeX in Markdown for all mathematics: $...$ inline and $$...$$ display. When a diagram helps (geometry, data flow, relationships), include a fenced code block with language tag \`mermaid\` and valid Mermaid source. For rubrics or trackers, use **Markdown tables**. Number worksheet or exam items clearly (1., 2., …) on separate lines so export tools work well.

**Readable layout (required):** Do not send one long paragraph. Use real Markdown structure: optional opening line, then \`##\` or \`###\` section headings for each topic, a **blank line** between sections, and **bullet lists** (\`- item\`) or **numbered lists** for any enumeration—never fake lists made only of bold lines like \`**Label:**\` stacked together. Keep paragraphs short (2–4 sentences). Use **bold** sparingly for emphasis, not as fake headings. *(Follow the same structure when the teacher’s language is French.)*\n---`;
    const snap = teacherContextSummary?.trim();
    if (snap) {
      return `${body}${rich}\n\n=== TEACHER DASHBOARD SNAPSHOT (aggregates from Mama Math; do not invent numbers) ===\n${snap}\n=== END SNAPSHOT ===`;
    }
    return `${body}${rich}`;
  }

  private buildSystemPrompt(
    grade: string,
    language: Language = 'en',
    country: 'cameroon' | 'nigeria' = 'cameroon',
    curriculumTopics?: TopicItem[],
    teacherContextSummary?: string,
  ): string {
    const topicsBlock = curriculumTopics && curriculumTopics.length
      ? buildCurriculumBlock(curriculumTopics)
      : buildCurriculumBlock(getTopicsForClassLevel(country, `Primary ${grade}`));
    if (country === 'nigeria') {
      return this.augmentSystemPrompt(`You are MAMA (Mathematics Assistant for Nigerian Primary Schools), an AI teaching assistant specialized in Nigeria's National Primary Mathematics Curriculum. You are currently assisting a teacher for Primary ${grade}. All your responses must be tailored specifically to this grade level and the Nigerian national curriculum.

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

Be helpful, encouraging, and educational in all responses, ensuring they are directly applicable to Primary ${grade} in Nigeria.${topicsBlock}`, teacherContextSummary);
    }

    if (language === 'fr') {
      return this.augmentSystemPrompt(`Vous êtes MAMA (Assistante Mathématique pour le Cameroun), une assistante pédagogique IA spécialisée dans le programme de mathématiques du primaire au Cameroun. Vous assistez actuellement un enseignant pour le Primaire ${grade}. Toutes vos réponses doivent être adaptées à ce niveau.

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

Répondez TOUJOURS en français. Soyez utile, encourageant et éducatif.${topicsBlock}`, teacherContextSummary);
    }

    return this.augmentSystemPrompt(`You are MAMA (Mathematics Assistant for Cameroon), an AI teaching assistant specialized in Cameroon's primary mathematics curriculum. You are currently assisting a teacher for Primary ${grade}. All your responses must be tailored specifically to this grade level.

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

Be helpful, encouraging, and educational in all responses, ensuring they are directly applicable to Primary ${grade}.${topicsBlock}`, teacherContextSummary);
  }

  /*  Content builder (vision support)  */

  private buildMessageContent(text: string, imageBase64?: string): any {
    if (imageBase64) {
      return [
        { type: 'text', text },
        { type: 'image_url', image_url: { url: imageBase64 } },
      ];
    }
    return text;
  }

  /*  Context window management  */

  /**
   * Trims the conversation history to the last MAX_HISTORY_MESSAGES messages.
   * If the history is longer, a brief context note is prepended so the model
   * knows there were earlier messages.
   */
  private trimHistory(history: ChatMessage[]): { role: string; content: string }[] {
    const mapped = history.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    if (mapped.length <= MAX_HISTORY_MESSAGES) return mapped;

    const trimmed = mapped.slice(-MAX_HISTORY_MESSAGES);
    // Prepend a context note so the model knows history was trimmed
    trimmed.unshift({
      role: 'system',
      content:
        '[Note: Earlier messages in this conversation were omitted for brevity. Continue the conversation from the context below.]',
    });
    return trimmed;
  }

  /*  Non-streaming send (fallback)  */

  async sendMessage(
    message: string,
    conversationHistory: ChatMessage[] = [],
    grade: string,
    imageBase64?: string,
    language: Language = 'en',
    country: 'cameroon' | 'nigeria' = 'cameroon',
    curriculumTopics?: TopicItem[],
    teacherContextSummary?: string,
  ): Promise<ChatbotResponse> {
    // Rate limit: max 30 chatbot messages per minute
    if (!checkRateLimit('chatbot', 30, 60 * 1000)) {
      return {
        success: false,
        message: 'Too many messages. Please wait a moment.',
        error: 'Rate limited',
      };
    }

    if (!grade) {
      return {
        success: false,
        message: language === 'fr' ? 'Niveau de classe non sélectionné.' : 'Grade level is not selected.',
        error: 'Grade not provided',
      };
    }

    if (!isOpenRouterConfigured()) return this.missingKeyResponse(language);

    try {
      const hasImage = !!imageBase64;
      const msgs: any[] = [
        {
          role: 'system',
          content: this.buildSystemPrompt(grade, language, country, curriculumTopics, teacherContextSummary),
        },
        ...this.trimHistory(conversationHistory),
        { role: 'user', content: this.buildMessageContent(message, imageBase64) },
      ];

      const response = await fetchOpenRouterChatCompletion(
        {
          model: hasImage ? this.visionModel : this.model,
          messages: msgs,
          temperature: 0.7,
          max_tokens: 2048,
          top_p: 0.9,
          frequency_penalty: 0.1,
          presence_penalty: 0.1,
        },
        { title: headerByteString('Mother of Math - MAMA Chatbot') },
      );

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as {
          error?: string | { message?: string };
        };
        const apiMsg =
          (typeof errorData.error === 'string' && errorData.error) ||
          (typeof errorData.error === 'object' &&
          errorData.error &&
          'message' in errorData.error &&
          typeof (errorData.error as { message?: string }).message === 'string'
            ? (errorData.error as { message: string }).message
            : undefined);
        throw new Error(this.mapOpenRouterError(response.status, apiMsg));
      }

      const data = await response.json();
      if (!data.choices?.[0]?.message) throw new Error('Invalid response format from API');

      return { success: true, message: data.choices[0].message.content.trim() };
    } catch (error) {
      console.error('Chatbot service error:', error);
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        message: this.userFacingErrorMessage(errMsg, language),
        error: errMsg,
      };
    }
  }

  /*  Streaming send  */

  async sendMessageStreaming(
    message: string,
    conversationHistory: ChatMessage[] = [],
    grade: string,
    onChunk: (chunk: string) => void,
    imageBase64?: string,
    language: Language = 'en',
    country: 'cameroon' | 'nigeria' = 'cameroon',
    curriculumTopics?: TopicItem[],
    teacherContextSummary?: string,
  ): Promise<ChatbotResponse> {
    // Rate limit: max 30 chatbot messages per minute
    if (!checkRateLimit('chatbot', 30, 60 * 1000)) {
      return {
        success: false,
        message: 'Too many messages. Please wait a moment.',
        error: 'Rate limited',
      };
    }

    if (!grade) {
      return {
        success: false,
        message: language === 'fr' ? 'Niveau de classe non sélectionné.' : 'Grade level is not selected.',
        error: 'Grade not provided',
      };
    }

    if (!isOpenRouterConfigured()) return this.missingKeyResponse(language);

    try {
      const hasImage = !!imageBase64;
      const msgs: any[] = [
        {
          role: 'system',
          content: this.buildSystemPrompt(grade, language, country, curriculumTopics, teacherContextSummary),
        },
        ...this.trimHistory(conversationHistory),
        { role: 'user', content: this.buildMessageContent(message, imageBase64) },
      ];

      const response = await fetchOpenRouterChatCompletion(
        {
          model: hasImage ? this.visionModel : this.model,
          messages: msgs,
          temperature: 0.7,
          max_tokens: 2048,
          top_p: 0.9,
          stream: true,
        },
        { title: headerByteString('Mother of Math - MAMA Chatbot') },
      );

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as {
          error?: string | { message?: string };
        };
        const apiMsg =
          (typeof errorData.error === 'string' && errorData.error) ||
          (typeof errorData.error === 'object' &&
          errorData.error &&
          'message' in errorData.error &&
          typeof (errorData.error as { message?: string }).message === 'string'
            ? (errorData.error as { message: string }).message
            : undefined);
        throw new Error(this.mapOpenRouterError(response.status, apiMsg));
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let fullText = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const jsonStr = trimmed.slice(6);
          if (jsonStr === '[DONE]') continue;

          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              fullText += delta;
              onChunk(delta);
            }
          } catch {
            // skip malformed JSON
          }
        }
      }

      return { success: true, message: fullText };
    } catch (error) {
      console.error('Chatbot streaming error:', error);
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        message: this.userFacingErrorMessage(errMsg, language),
        error: errMsg,
      };
    }
  }
}

export default ChatbotService;
export type { ChatMessage, ChatbotResponse };