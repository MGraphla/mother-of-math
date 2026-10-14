import { supabase } from "../lib/supabase";
import type { Assignment, AssignmentSubmission } from "./assignments";

export interface AiGradingResult {
  score: number;
  feedback: string;
  success: boolean;
  error?: string;
}

const GRADING_MODEL = "google/gemini-3.1-flash-lite-preview";

export const submissionFileSupportsAiVision = (
  fileUrl: string,
): { ok: boolean; reason?: string } => {
  const lower = fileUrl.toLowerCase().split("?")[0];
  if (/\.(jpg|jpeg|png|gif|webp|avif)$/i.test(lower)) return { ok: true };
  if (/\.pdf$/i.test(lower)) {
    return { ok: false, reason: "PDF files cannot be AI-graded yet. Grade manually." };
  }
  return { ok: false, reason: "This file type cannot be analyzed by AI." };
};

export const parseGradePercentageFromAiContent = (
  content: string,
  _maxScore: number,
): number | null => {
  const gradeSection = content.match(/##\s*Grade\s*([\s\S]*?)(?=##|$)/i);
  const haystack = gradeSection?.[1] ?? content;
  const match = haystack.match(/(\d{1,3})\s*(?:%|percent)/i);
  if (!match) return null;
  const value = Number(match[1]);
  if (Number.isNaN(value)) return null;
  return Math.max(0, Math.min(100, value));
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

export const saveAiGrading = async (
  submissionId: string,
  aiScore: number,
  aiFeedback: string,
) => {
  const { error } = await supabase
    .from("assignment_submissions")
    .update({
      ai_score: aiScore,
      ai_feedback: aiFeedback,
      ai_graded_at: new Date().toISOString(),
    })
    .eq("id", submissionId);
  if (error) throw error;
};

export const gradeSubmissionWithAI = async (
  submission: AssignmentSubmission,
  assignment: Assignment,
  studentName: string,
): Promise<AiGradingResult> => {
  if (!submission.file_url) {
    return { score: 0, feedback: "", success: false, error: "No file attached to this submission." };
  }

  const visionCheck = submissionFileSupportsAiVision(submission.file_url);
  if (!visionCheck.ok) {
    return {
      score: 0,
      feedback: "",
      success: false,
      error: visionCheck.reason || "This file type cannot be analyzed by AI.",
    };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return {
      score: 0,
      feedback: "",
      success: false,
      error: "You must be signed in to use AI grading.",
    };
  }

  const maxScore = assignment.max_score || 100;
  const systemPrompt = `You are a helpful math teacher assistant. Analyze the student's submitted math work from the image provided.

Assignment: ${assignment.title}
Grade Level: ${assignment.grade_level ?? "Primary"}
${assignment.instructions ? `Instructions given to student: ${assignment.instructions}` : ""}

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

  const userContent: any[] = [
    {
      type: "text",
      text: `This is the math work submitted by student "${studentName}". Please analyze it and respond using the exact format specified.`,
    },
    {
      type: "image_url",
      image_url: { url: submission.file_url, detail: "high" },
    },
  ];
  if (submission.notes) {
    userContent.push({ type: "text", text: `Student's note: "${submission.notes}"` });
  }

  try {
    const { data, error } = await supabase.functions.invoke("openrouter-proxy", {
      body: {
        openrouter: {
          model: GRADING_MODEL,
          temperature: 0.2,
          max_tokens: 1024,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
        },
        client_referer: "motherofmath://",
        client_title: "Mother of Math Mobile - AI Grading",
      },
    });

    if (error) {
      return {
        score: 0,
        feedback: "",
        success: false,
        error: error.message || "AI request failed.",
      };
    }

    const content = extractAssistantText(data);
    if (!content) {
      return { score: 0, feedback: "", success: false, error: "AI returned empty response." };
    }

    const percentage = parseGradePercentageFromAiContent(content, maxScore);
    if (percentage === null) {
      return {
        score: 0,
        feedback: content.trim(),
        success: false,
        error:
          "AI returned feedback but no readable grade. Try re-running AI grade or set the score manually.",
      };
    }

    return {
      score: Math.round((percentage / 100) * maxScore),
      feedback: content.trim(),
      success: true,
    };
  } catch (err: any) {
    return {
      score: 0,
      feedback: "",
      success: false,
      error: err?.message || "Unknown error during AI grading.",
    };
  }
};

export const batchGradeSubmissions = async (
  submissions: AssignmentSubmission[],
  assignment: Assignment,
  onProgress?: (completed: number, total: number, currentStudent: string) => void,
): Promise<{ graded: number; failed: number }> => {
  const ungraded = submissions.filter((s) => !s.ai_graded_at && s.file_url);
  let graded = 0;
  let failed = 0;

  for (let i = 0; i < ungraded.length; i++) {
    const sub = ungraded[i];
    const name = sub.student_name || "Learner";
    try {
      const result = await gradeSubmissionWithAI(sub, assignment, name);
      if (result.success) {
        await saveAiGrading(sub.id, result.score, result.feedback);
        graded++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
    onProgress?.(graded + failed, ungraded.length, name);
    if (i < ungraded.length - 1) {
      await new Promise((r) => setTimeout(r, 1200));
    }
  }

  return { graded, failed };
};
