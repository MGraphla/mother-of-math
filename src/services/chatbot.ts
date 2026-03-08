//  MAMA Chatbot Service 
// Supports: streaming, vision, bilingual (EN/FR), context-window management

import type { Language } from '@/lib/i18n';
import { getTopicsForClassLevel } from '@/data/curriculumContent';
import type { TopicItem } from '@/data/curriculumContent';

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
  private apiKey: string;
  private apiUrl: string;
  private model: string;
  private visionModel: string;

  constructor() {
    this.apiKey =
      import.meta.env.VITE_OPENROUTER_API_KEY ||
      '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';
    this.apiUrl =
      import.meta.env.VITE_OPENROUTER_API_URL ||
      'https://openrouter.ai/api/v1/chat/completions';
    this.model = 'google/gemini-3.1-flash-lite-preview';
    this.visionModel = 'google/gemini-3.1-flash-lite-preview';

    if (!this.apiKey) {
      console.warn('OpenRouter API key is not configured');
    }
  }

  /*  System prompts (EN / FR)  */

  private buildSystemPrompt(grade: string, language: Language = 'en', country: 'cameroon' | 'nigeria' = 'cameroon', curriculumTopics?: TopicItem[]): string {
    const topicsBlock = curriculumTopics && curriculumTopics.length
      ? buildCurriculumBlock(curriculumTopics)
      : buildCurriculumBlock(getTopicsForClassLevel(country, `Primary ${grade}`));
    if (country === 'nigeria') {
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
- When writing mathematical formulas, use LaTeX notation between $...$ for inline and $$...$$ for display blocks.

Be helpful, encouraging, and educational in all responses, ensuring they are directly applicable to Primary ${grade} in Nigeria.${topicsBlock}`;
    }

    if (language === 'fr') {
      return `Vous �tes MAMA (Assistante Math�matique pour le Cameroun), une assistante p�dagogique IA sp�cialis�e dans le programme de math�matiques du primaire au Cameroun. Vous assistez actuellement un enseignant pour le Primaire ${grade}. Toutes vos r�ponses doivent �tre adapt�es � ce niveau.

Vous aidez les enseignants avec :
- L'orientation curriculaire en math�matiques selon les normes nationales du Cameroun pour le Primaire ${grade}.
- La planification de cours et les strat�gies d'enseignement pour le Primaire ${grade}.
- L'�valuation des �l�ves et le suivi des progr�s pour le Primaire ${grade}.
- L'explication de concepts math�matiques appropri�s au Primaire ${grade}.
- L'int�gration culturelle de contextes camerounais locaux dans l'�ducation math�matique pour le Primaire ${grade}.

Directives :
- Votre objectif principal est le Primaire ${grade}. Tous les exemples et conseils doivent y �tre adapt�s.
- Utilisez toujours des exemples culturellement pertinents (francs CFA, march�s locaux, aliments familiers, etc.).
- Utilisez un langage simple et clair adapt� au Primaire ${grade}.
- Fournissez des conseils sp�cifiques et pratiques pour les enseignants.
- Lorsqu'une image est partag�e, analysez-la en profondeur pour tout contenu math�matique.
- Formatez vos r�ponses en Markdown : titres, gras, listes num�rot�es, puces.
- Lorsque vous �crivez des formules math�matiques, utilisez la notation LaTeX entre $...$ pour les formules en ligne et $$...$$ pour les blocs.

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
- When writing mathematical formulas, use LaTeX notation between $...$ for inline and $$...$$ for display blocks.

Be helpful, encouraging, and educational in all responses, ensuring they are directly applicable to Primary ${grade}.${topicsBlock}`;
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
    curriculumTopics?: TopicItem[]
  ): Promise<ChatbotResponse> {
    if (!grade) {
      return {
        success: false,
        message: language === 'fr' ? 'Niveau de classe non sélectionné.' : 'Grade level is not selected.',
        error: 'Grade not provided',
      };
    }

    try {
      const hasImage = !!imageBase64;
      const msgs: any[] = [
        { role: 'system', content: this.buildSystemPrompt(grade, language, country, curriculumTopics) },
        ...this.trimHistory(conversationHistory),
        { role: 'user', content: this.buildMessageContent(message, imageBase64) },
      ];

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Mother of Mathematics - Cameroon Math Teacher AI',
        },
        body: JSON.stringify({
          model: hasImage ? this.visionModel : this.model,
          messages: msgs,
          temperature: 0.7,
          max_tokens: 2048,
          top_p: 0.9,
          frequency_penalty: 0.1,
          presence_penalty: 0.1,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `API request failed: ${response.status}`);
      }

      const data = await response.json();
      if (!data.choices?.[0]?.message) throw new Error('Invalid response format from API');

      return { success: true, message: data.choices[0].message.content.trim() };
    } catch (error) {
      console.error('Chatbot service error:', error);
      return {
        success: false,
        message:
          language === 'fr'
            ? "Je m'excuse, mais j'ai rencontré une erreur. Veuillez réessayer."
            : 'I apologize, but I encountered an error. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error',
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
    curriculumTopics?: TopicItem[]
  ): Promise<ChatbotResponse> {
    if (!grade) {
      return {
        success: false,
        message: language === 'fr' ? 'Niveau de classe non sélectionné.' : 'Grade level is not selected.',
        error: 'Grade not provided',
      };
    }

    try {
      const hasImage = !!imageBase64;
      const msgs: any[] = [
        { role: 'system', content: this.buildSystemPrompt(grade, language, country, curriculumTopics) },
        ...this.trimHistory(conversationHistory),
        { role: 'user', content: this.buildMessageContent(message, imageBase64) },
      ];

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Mother of Mathematics - Cameroon Math Teacher AI',
        },
        body: JSON.stringify({
          model: hasImage ? this.visionModel : this.model,
          messages: msgs,
          temperature: 0.7,
          max_tokens: 2048,
          top_p: 0.9,
          stream: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `API request failed: ${response.status}`);
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
      return {
        success: false,
        message:
          language === 'fr'
            ? "Je m'excuse, mais j'ai rencontr� une erreur. Veuillez r�essayer."
            : 'I apologize, but I encountered an error. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

export default ChatbotService;
export type { ChatMessage, ChatbotResponse };