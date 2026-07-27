// src/services/aiGrading.ts
// AI-powered automatic grading of student assignment submissions using Gemini via OpenRouter

import {
  getClientOpenRouterKey,
  isOpenRouterConfigured,
  OPENROUTER_USE_CLIENT_KEY,
} from './openrouterEnv';
import { fetchOpenRouterChatCompletion, probeOpenRouterEdge } from './openrouterTransport';
import { AssignmentSubmission, StudentAssignment } from './studentService';
import { supabase } from '@/lib/supabase';

/** Prefer env override; default matches vision model used elsewhere (api.ts). */
const GRADING_MODEL =
  import.meta.env.VITE_AI_GRADING_MODEL || 'anthropic/claude-sonnet-4.6';
const FALLBACK_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const REQUEST_TIMEOUT_MS = 120_000; // Increased timeout for detailed analysis
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 3000;

// ── Types ──────────────────────────────────────────────

export interface AiGradingResult {
  score: number;
  feedback: string;
  success: boolean;
  error?: string;
  details?: {
    totalProblems?: number;
    correctProblems?: number;
    errors?: Array<{
      problem: string;
      studentAnswer: string;
      correctAnswer: string;
      errorType: string;
      explanation: string;
    }>;
    strengths?: string[];
    recommendations?: string[];
  };
}

// ── Utility Functions ──────────────────────────────────

/**
 * Verify that an image URL is accessible before sending to AI
 */
export const verifyImageUrl = async (url: string): Promise<boolean> => {
  try {
    const response = await fetch(url, { method: 'HEAD', mode: 'cors' });
    const contentType = response.headers.get('content-type') || '';
    return response.ok && contentType.startsWith('image/');
  } catch (err) {
    console.warn('[AI Grading] Image URL verification failed:', err);
    // If HEAD request fails (CORS), try a regular GET with a small range
    try {
      const response = await fetch(url, { 
        method: 'GET',
        headers: { Range: 'bytes=0-0' }
      });
      return response.ok || response.status === 206;
    } catch {
      return false;
    }
  }
};

/**
 * Sleep utility for retry delays
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** Strip query/hash then check extension — vision APIs need raster images, not PDF/DOC. */
export function submissionFileSupportsAiVision(fileUrl: string): {
  ok: boolean;
  reason?: string;
} {
  const path = fileUrl.split(/[?#]/)[0].toLowerCase();
  if (/\.pdf$/i.test(path)) {
    return {
      ok: false,
      reason:
        'AI grading only supports images (e.g. JPG, PNG). This submission looks like a PDF — ask the learner to upload a photo or screenshot of their work.',
    };
  }
  if (/\.(doc|docx|ppt|pptx|xls|xlsx|zip)$/i.test(path)) {
    return {
      ok: false,
      reason:
        'AI grading only supports image files. Please use a picture of the completed work.',
    };
  }
  return { ok: true };
}

/**
 * Pull a 0–100 percentage from the model reply. Handles many formats the strict
 * `/## Grade…(\d+)%/` regex missed (markdown bullets, "75 percent", "7.5/10", plain "72").
 */
export function parseGradePercentageFromAiContent(content: string, maxScore: number): number | null {
  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
  const tryParseFloat = (s: string) => {
    const x = parseFloat(s);
    return Number.isFinite(x) ? x : NaN;
  };

  const gradeBlock =
    content.match(/##\s*Grade\s*([\s\S]*?)(?=\n##\s+[^\n#]|\n##\s*$|$)/i)?.[1] ?? '';
  const inGrade = gradeBlock.trim();
  const section = inGrade ? gradeBlock : content;

  let m: RegExpMatchArray | null;

  // "75%" or "75 %" — safe in full doc when no heading (percent is unambiguous)
  m = section.match(/(\d{1,3}(?:\.\d+)?)\s*%/);
  if (m) return clamp(tryParseFloat(m[1]));

  // "75 percent"
  m = section.match(/(\d{1,3}(?:\.\d+)?)\s*(?:percent|pct)\b/i);
  if (m) return clamp(tryParseFloat(m[1]));

  // "12/20" or "7.5/10" — only inside ## Grade to avoid picking "3/4" from analysis
  if (inGrade) {
    m = gradeBlock.match(/\b(\d{1,3}(?:\.\d+)?)\s*\/\s*(\d{1,3}(?:\.\d+)?)\b/);
    if (m) {
      const num = tryParseFloat(m[1]);
      const den = tryParseFloat(m[2]);
      if (den > 0 && num >= 0 && num <= den * 1.25) {
        return clamp((num / den) * 100);
      }
    }
  }

  if (inGrade) {
    const singleLine = gradeBlock
      .replace(/\*\*/g, '')
      .split(/\n/)
      .map((l) => l.trim())
      .find((l) => /^\d{1,3}(?:\.\d+)?$/);
    if (singleLine && maxScore > 0) {
      const pts = tryParseFloat(singleLine);
      if (pts >= 0 && pts <= maxScore * 1.01) {
        return clamp((pts / maxScore) * 100);
      }
    }
  }

  if (inGrade) {
    m = gradeBlock.match(
      /\b(?:score|grade|mark)\s*[:.\-–]?\s*(\d{1,3}(?:\.\d+)?)(?!\s*\/)/i,
    );
    if (m) {
      const v = tryParseFloat(m[1]);
      if (v <= maxScore && maxScore > 0) return clamp((v / maxScore) * 100);
      if (v <= 100) return clamp(v);
    }

    m = gradeBlock.match(/(\d{1,3}(?:\.\d+)?)\s*%?/);
    if (m) {
      const v = tryParseFloat(m[1]);
      if (v >= 0 && v <= maxScore && maxScore > 0) return clamp((v / maxScore) * 100);
      if (v >= 0 && v <= 100) return clamp(v);
    }
  }

  return null;
}

/**
 * Determine if an error is retryable (network issues, rate limits)
 */
const isRetryableError = (error: any, status?: number): boolean => {
  if (error?.name === 'AbortError') return false; // Timeout — don't retry
  if (status && status >= 400 && status < 500 && status !== 429) return false; // Client errors
  return true; // Network errors, server errors, rate limits (429)
};

// ── Core Grading Function ──────────────────────────────

/**
 * Send a student's submitted image to a vision model (OpenRouter) for analysis and grading.
 * Returns an AI-generated score and detailed feedback.
 */
export const gradeSubmissionWithAI = async (
  submission: AssignmentSubmission,
  assignment: StudentAssignment,
  studentName: string,
): Promise<AiGradingResult> => {
  if (!isOpenRouterConfigured()) {
    return { score: 0, feedback: '', success: false, error: 'AI is not configured (Supabase proxy or client key).' };
  }

  if (!submission.file_url) {
    return { score: 0, feedback: '', success: false, error: 'No file attached to this submission.' };
  }

  const visionCheck = submissionFileSupportsAiVision(submission.file_url);
  if (!visionCheck.ok) {
    return {
      score: 0,
      feedback: '',
      success: false,
      error: visionCheck.reason || 'This file type cannot be analyzed by AI.',
    };
  }

  const maxScore = assignment.max_score || 100;

  // Build the system prompt
  const systemPrompt = `You are a helpful math teacher assistant. Analyze the student's submitted math work from the image provided.

Assignment: ${assignment.title}
Grade Level: ${assignment.grade_level}
${assignment.instructions ? `Instructions given to student: ${assignment.instructions}` : ''}

Your response must be direct and concise. Follow this format exactly:

## Analysis
[Provide a brief analysis of what the student did. Maximum 4 lines.]

## Error Type
[Categorize the error using one or more of these: Number recognition, Number discrimination, Place value, Simple operations, Patterns and sequencing. If none, write 'None Found'. Maximum 4 lines.]

## Grade
[Give the learner's result as a percentage only, e.g. 75% or 75 percent. One line.]

## Remediation
[Suggest one specific, simple remediation step for the teacher to use. Maximum 4 lines.]

Do not add any extra text, introductions, or explanations. Use simple, non-technical language suitable for primary school teachers.`;

  // Build message content with the image
  const userContent: any[] = [
    {
      type: 'text',
      text: `This is the math work submitted by student "${studentName}". Please analyze it and respond using the exact format specified.`,
    },
    {
      type: 'image_url',
      image_url: {
        url: submission.file_url,
        detail: 'high',
      },
    },
  ];

  // If student added notes, include them
  if (submission.notes) {
    userContent.push({
      type: 'text',
      text: `Student's note: "${submission.notes}"`,
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetchOpenRouterChatCompletion(
      {
        model: GRADING_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        temperature: 0.2,
        max_tokens: 1024,
        stream: false,
      },
      {
        referer: typeof window !== 'undefined' ? window.location.origin : undefined,
        title: 'Mother of Math - AI Grading',
        signal: controller.signal,
      },
    );

    clearTimeout(timeout);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as {
        error?: string | { message?: string };
      };
      console.error('[AI Grading] API error:', response.status, errorData);
      const msg =
        (typeof errorData.error === 'string' && errorData.error) ||
        (typeof errorData.error === 'object' &&
          errorData.error &&
          'message' in errorData.error &&
          typeof (errorData.error as { message?: string }).message === 'string' &&
          (errorData.error as { message: string }).message) ||
        'Unknown error';
      return {
        score: 0,
        feedback: '',
        success: false,
        error: `AI service returned ${response.status}: ${msg}`,
      };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return { score: 0, feedback: '', success: false, error: 'AI returned empty response.' };
    }

    const percentage = parseGradePercentageFromAiContent(content, maxScore);
    if (percentage === null) {
      return {
        score: 0,
        feedback: content.trim(),
        success: false,
        error:
          'AI returned feedback but no readable grade (need a percentage like 75% in the ## Grade section). Try re-running AI grade or set the score manually.',
      };
    }

    const score = Math.round((percentage / 100) * maxScore);

    const feedback = content.trim();

    return { score, feedback, success: true };
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      return { score: 0, feedback: '', success: false, error: 'AI grading timed out. Please try again.' };
    }
    console.error('[AI Grading] Error:', err);
    return { score: 0, feedback: '', success: false, error: err?.message || 'Unknown error during AI grading.' };
  }
};

// ── Save AI Grading to Database ────────────────────────

/**
 * Save AI grading results to the submission record in Supabase.
 */
export const saveAiGrading = async (
  submissionId: string,
  aiScore: number,
  aiFeedback: string,
): Promise<void> => {
  const { error } = await supabase
    .from('assignment_submissions')
    .update({
      ai_score: aiScore,
      ai_feedback: aiFeedback,
      ai_graded_at: new Date().toISOString(),
    })
    .eq('id', submissionId);

  if (error) {
    console.error('[AI Grading] Failed to save results:', error);
    throw error;
  }
};

// ── Batch Grade All Ungraded Submissions ───────────────

/**
 * Grade all submissions for an assignment that haven't been AI-graded yet.
 * Returns a progress callback for UI updates.
 */
export const batchGradeSubmissions = async (
  submissions: (AssignmentSubmission & { studentName: string })[],
  assignment: StudentAssignment,
  onProgress?: (completed: number, total: number, currentStudent: string) => void,
): Promise<{ graded: number; failed: number; results: Map<string, AiGradingResult> }> => {
  const ungraded = submissions.filter((s) => !s.ai_graded_at && s.file_url);

  let graded = 0;
  let failed = 0;
  const results = new Map<string, AiGradingResult>();

  for (let i = 0; i < ungraded.length; i++) {
    const sub = ungraded[i];

    try {
      const result = await gradeSubmissionWithAI(sub, assignment, sub.studentName);
      results.set(sub.id, result);

      if (result.success) {
        await saveAiGrading(sub.id, result.score, result.feedback);
        graded++;
      } else {
        failed++;
      }
    } catch (err) {
      console.error(`[AI Grading] Failed for submission ${sub.id}:`, err);
      results.set(sub.id, { score: 0, feedback: '', success: false, error: 'Unexpected error' });
      failed++;
    }

    onProgress?.(graded + failed, ungraded.length, sub.studentName);

    if (i < ungraded.length - 1) {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  return { graded, failed, results };
};

// ── Re-grade a Single Submission ───────────────────────

/**
 * Force re-grade a submission with AI (even if already graded)
 * This is useful when the teacher wants a fresh AI analysis
 */
export const regradeSubmissionWithAI = async (
  submissionId: string,
  assignment: StudentAssignment,
  studentName: string,
): Promise<AiGradingResult> => {
  // Get the submission
  const { data: submission, error } = await supabase
    .from('assignment_submissions')
    .select('*')
    .eq('id', submissionId)
    .single();

  if (error || !submission) {
    return { score: 0, feedback: '', success: false, error: 'Submission not found.' };
  }

  // Run AI grading
  const result = await gradeSubmissionWithAI(
    submission as AssignmentSubmission,
    assignment,
    studentName
  );

  // Save results if successful
  if (result.success) {
    await saveAiGrading(submissionId, result.score, result.feedback);
  }

  return result;
};

// ── Check AI Grading Service Status ────────────────────

/**
 * Quick check if the AI grading service is properly configured and accessible
 */
export const checkAiGradingStatus = async (): Promise<{
  configured: boolean;
  accessible: boolean;
  error?: string;
}> => {
  if (!isOpenRouterConfigured()) {
    return { configured: false, accessible: false, error: 'AI is not configured.' };
  }

  if (!OPENROUTER_USE_CLIENT_KEY) {
    const probe = await probeOpenRouterEdge();
    return {
      configured: true,
      accessible: probe.ok,
      error: probe.ok ? undefined : probe.error,
    };
  }

  const apiKey = getClientOpenRouterKey();
  if (!apiKey) {
    return { configured: false, accessible: false, error: 'No API key configured.' };
  }

  const apiUrl = import.meta.env.VITE_OPENROUTER_API_URL || FALLBACK_API_URL;

  try {
    const response = await fetch(apiUrl.replace('/chat/completions', '/models'), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (response.ok) {
      return { configured: true, accessible: true };
    }

    return {
      configured: true,
      accessible: false,
      error: `API returned status ${response.status}`,
    };
  } catch (err: unknown) {
    return {
      configured: true,
      accessible: false,
      error: err instanceof Error ? err.message : 'Network error',
    };
  }
};

// ── Get Grading Summary ────────────────────────────────

/**
 * Get a summary of AI grading results for an assignment
 */
export interface AiGradingSummary {
  totalSubmissions: number;
  aiGraded: number;
  pending: number;
  /** Mean of AI scores as a percentage 0–100 (normalized by assignment `max_score`). */
  averageAiScore: number | null;
  highestScore: number | null;
  lowestScore: number | null;
  scoreDistribution: {
    excellent: number; // 80-100%
    good: number;      // 60-79%
    needsWork: number; // 0-59%
  };
}

export const getAiGradingSummary = async (assignmentId: string): Promise<AiGradingSummary> => {
  const { data: submissions } = await supabase
    .from('assignment_submissions')
    .select('ai_score, ai_graded_at')
    .eq('assignment_id', assignmentId);

  const { data: assignmentRow } = await supabase
    .from('assignments')
    .select('max_score')
    .eq('id', assignmentId)
    .maybeSingle();

  const maxPoints =
    assignmentRow?.max_score != null && Number(assignmentRow.max_score) > 0
      ? Number(assignmentRow.max_score)
      : 100;

  const subs = submissions || [];
  const aiGradedSubs = subs.filter((s) => s.ai_graded_at && s.ai_score !== null);
  const scores = aiGradedSubs.map((s) => s.ai_score as number);

  const toPct = (raw: number) => (raw / maxPoints) * 100;
  const pctScores = scores.map(toPct);

  return {
    totalSubmissions: subs.length,
    aiGraded: aiGradedSubs.length,
    pending: subs.length - aiGradedSubs.length,
    averageAiScore:
      scores.length > 0
        ? Math.round((pctScores.reduce((a, b) => a + b, 0) / pctScores.length) * 10) / 10
        : null,
    highestScore: scores.length > 0 ? Math.max(...scores) : null,
    lowestScore: scores.length > 0 ? Math.min(...scores) : null,
    scoreDistribution: {
      excellent: pctScores.filter((s) => s >= 80).length,
      good: pctScores.filter((s) => s >= 60 && s < 80).length,
      needsWork: pctScores.filter((s) => s < 60).length,
    },
  };
};
