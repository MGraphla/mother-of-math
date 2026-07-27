// src/services/api.ts

import { checkRateLimit } from '@/lib/rateLimit';
import { fetchOpenRouterChatCompletion } from '@/services/openrouterTransport';
import {
  FALLBACK_OPENROUTER_CHAT_URL,
  getClientOpenRouterKey,
  headerByteString,
  isOpenRouterConfigured,
} from '@/services/openrouterEnv';

const FALLBACK_API_URL = FALLBACK_OPENROUTER_CHAT_URL;

const OPENROUTER_MODEL = "anthropic/claude-sonnet-4.6";

const cleanJsonResponse = (content: string): string => {
  const trimmed = content.trim();

  if (!trimmed) {
    throw new Error("The AI returned an empty response.");
  }

  let cleaned = trimmed;
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\s*/m, '').replace(/```\s*$/m, '').trim();
  }

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  return cleaned;
};

/** @deprecated Prefer isOpenRouterConfigured — key may live only on Supabase Edge. */
export const getApiKey = (): string | undefined => getClientOpenRouterKey();

export { headerByteString } from '@/services/openrouterEnv';

export const hasApiKey = isOpenRouterConfigured;

/** When an image is sent: student homework analysis vs describing a teacher sketch for image generation. */
export type VisionImagePurpose = 'student-work' | 'sketch-to-image';

// Main function to send messages to the AI
export const sendMessage = async (
  message: string,
  imageBase64?: string,
  responseType: 'json' | 'text' = 'text',
  visionPurpose: VisionImagePurpose = 'student-work',
): Promise<any> => {
  // Rate limit: max 20 AI requests per minute
  if (!checkRateLimit('ai-api', 20, 60 * 1000)) {
    throw new Error('Too many requests. Please wait a moment before trying again.');
  }

  if (!isOpenRouterConfigured()) {
    throw new Error(
      'AI is not configured. Use Supabase Edge (default): deploy openrouter-proxy and set OPENROUTER_API_KEY secret. For local dev with a browser key, set VITE_OPENROUTER_USE_CLIENT_KEY=true and VITE_OPENROUTER_API_KEY.',
    );
  }

  let systemPrompt: string;
  let userMessageContent: any;
  const requestBody: any = {
      model: OPENROUTER_MODEL, // Default model
      temperature: 0.3,
      max_tokens: 12000,
      stream: false,
  };

  // Switch to a vision-capable model if an image is provided
  if (imageBase64) {
    requestBody.model = "anthropic/claude-sonnet-4.6"; // Vision-capable model for image analysis
    if (visionPurpose === 'sketch-to-image') {
      requestBody.temperature = 0.2;
    }
  }

  if (imageBase64) {
    if (visionPurpose === 'sketch-to-image') {
      systemPrompt = `You help teachers turn rough hand-drawn sketches into polished illustrations. The image is a TEACHER'S quick sketch on paper (lines, shapes, doodles)—not graded student homework.

Your only task: write a single flowing description another AI will use to generate a final picture that MATCHES THE SKETCH.

Strict rules:
- Output plain prose only. No markdown, no headings, no bullet lists, no "error analysis", no remediation, no comments about student mistakes.
- Describe exactly what is drawn: shapes, lines, symbols, figures, their relative positions (left/center/right, foreground/background), proportions, and what each part likely represents.
- Preserve layout and composition; do not invent major new subjects that are not implied by the drawing.
- If something is ambiguous, describe the strokes literally (e.g. "a circle with three radiating lines") rather than guessing a unrelated scene.
- 4–10 sentences, dense visual detail, suitable as an image-generation prompt.
- Educational tone is fine only as general context; do not turn the sketch into a lesson plan—stay visual.`;
    } else {
      systemPrompt = `You are an AI assistant for "Mothers for Mathematics", a project helping teachers and parents in Cameroon with mathematics education. You specialize in providing feedback on student work using Math Error Analysis principles. When analyzing student work, identify:
- Specific error types (e.g., incorrect counting, mixed grouping, etc.)
- Root causes of mathematical misunderstandings
- Practical remediation strategies that parents or teachers can implement

Always be encouraging, use simple language, and provide actionable advice. Use markdown formatting, including headings, to structure the analysis and make it easy to read. The user has uploaded an image of student work. Analyze it for mathematical errors, providing specific feedback on what the student did correctly and incorrectly. Suggest practical remediation activities.`;
    }
    userMessageContent = [
      { type: "text", text: message },
      { type: "image_url", image_url: { url: imageBase64, detail: "high" } }
    ];
  } else {
    // This is for lesson plan generation
     systemPrompt = `You are an AI assistant for "Mothers for Mathematics". Your task is to generate a structured lesson plan based on a given topic. The response MUST be a valid JSON object.`;
     userMessageContent = message;
     // Force the model to return JSON
     if (responseType === 'json') {
        requestBody.response_format = { "type": "json_object" };
     }
  }

  requestBody.messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessageContent }
  ];

  try {
    const response = await fetchOpenRouterChatCompletion(requestBody, {
      referer:
        typeof window !== 'undefined'
          ? headerByteString(window.location.origin)
          : 'https://mamamath.org',
      title: 'Mother of Math',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as {
        error?: string | { message?: string };
        ok?: boolean;
      };
      console.error("API Error Details:", errorData);
      const nested =
        typeof errorData.error === 'object' && errorData.error !== null
          ? (errorData.error as { message?: string }).message
          : undefined;
      const flat =
        typeof errorData.error === 'string' ? errorData.error : undefined;
      throw new Error(
        `API request failed with status ${response.status}: ${nested || flat || 'Unknown error'}`,
      );
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    if (responseType === 'json') {
        try {
        const cleaned = cleanJsonResponse(content);
            return JSON.parse(cleaned);
        } catch (e) {
            console.error("Failed to parse JSON from AI response, even when requested.", e);
            console.error("Raw content was:", content);
        throw new Error("The AI response was incomplete or not valid JSON. Please try again.");
        }
    } else {
        // For 'text' responseType, just return the content.
        return { text: content };
    }

  } catch (error) {
    console.error("API Request Error:", error);
    throw error;
  }
};

// Function to convert file to base64
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};