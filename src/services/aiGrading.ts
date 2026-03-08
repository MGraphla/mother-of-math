// src/services/aiGrading.ts
// AI-powered automatic grading of student assignment submissions using Gemini via OpenRouter

import { getApiKey } from './api';
import { AssignmentSubmission, StudentAssignment } from './studentService';
import { supabase } from '@/lib/supabase';

const GRADING_MODEL = 'google/gemini-3.1-pro-preview';
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
 * Send a student's submitted image to Gemini for analysis and grading.
 * Returns an AI-generated score and detailed feedback.
 */
export const gradeSubmissionWithAI = async (
  submission: AssignmentSubmission,
  assignment: StudentAssignment,
  studentName: string,
): Promise<AiGradingResult> => {
  const apiKey = getApiKey();
  const apiUrl = import.meta.env.VITE_OPENROUTER_API_URL || FALLBACK_API_URL;

  if (!apiKey) {
    return { score: 0, feedback: '', success: false, error: 'No API key configured.' };
  }

  if (!submission.file_url) {
    return { score: 0, feedback: '', success: false, error: 'No file attached to this submission.' };
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
[Give a percentage score only, e.g. 75%. Maximum 4 lines.]

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
    const response = await fetch(apiUrl, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Mother of Math - AI Grading',
      },
      body: JSON.stringify({
        model: GRADING_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        temperature: 0.2,
        max_tokens: 1024,
        stream: false,
      }),
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[AI Grading] API error:', response.status, errorData);
      return {
        score: 0,
        feedback: '',
        success: false,
        error: `AI service returned ${response.status}: ${errorData?.error?.message || 'Unknown error'}`,
      };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return { score: 0, feedback: '', success: false, error: 'AI returned empty response.' };
    }

    // Extract the percentage from the ## Grade section
    const gradeMatch = content.match(/##\s*Grade[\s\S]*?(\d{1,3})\s*%/i);
    const percentage = gradeMatch ? Math.max(0, Math.min(100, Number(gradeMatch[1]))) : 0;
    // Convert percentage to the assignment's max score
    const score = Math.round((percentage / 100) * maxScore);

    // Use the full Markdown response as feedback
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

  for (const sub of ungraded) {
    onProgress?.(graded + failed, ungraded.length, sub.studentName);

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

    // Small delay between requests to avoid rate limiting
    if (ungraded.indexOf(sub) < ungraded.length - 1) {
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
  const apiKey = getApiKey();
  
  if (!apiKey) {
    return { configured: false, accessible: false, error: 'No API key configured.' };
  }

  const apiUrl = import.meta.env.VITE_OPENROUTER_API_URL || FALLBACK_API_URL;

  try {
    // Simple test request to check if API is accessible
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
      error: `API returned status ${response.status}` 
    };
  } catch (err: any) {
    return { 
      configured: true, 
      accessible: false, 
      error: err?.message || 'Network error' 
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

  const subs = submissions || [];
  const aiGradedSubs = subs.filter(s => s.ai_graded_at && s.ai_score !== null);
  const scores = aiGradedSubs.map(s => s.ai_score as number);

  return {
    totalSubmissions: subs.length,
    aiGraded: aiGradedSubs.length,
    pending: subs.length - aiGradedSubs.length,
    averageAiScore: scores.length > 0 
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 
      : null,
    highestScore: scores.length > 0 ? Math.max(...scores) : null,
    lowestScore: scores.length > 0 ? Math.min(...scores) : null,
    scoreDistribution: {
      excellent: scores.filter(s => s >= 80).length,
      good: scores.filter(s => s >= 60 && s < 80).length,
      needsWork: scores.filter(s => s < 60).length,
    },
  };
};
