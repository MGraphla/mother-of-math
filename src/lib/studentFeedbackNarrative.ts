import type { StudentWork } from "@/lib/supabase";

export type NarrativeAudience = "student" | "parent";

export interface ParsedFeedbackSections {
  analysis: string;
  error_type: string;
  grade: string;
  remediation: string;
}

/** Remove markdown/hash noise so UI and SMS stay plain text. */
export function stripMarkdownAggressive(text: string): string {
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

/**
 * Final pass: remove leftover stars, turn Q1 into "Question 1", spell math symbols for clear reading (screen + TTS).
 */
export function polishNarrativeText(text: string): string {
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
  return stripMarkdownAggressive(text)
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Same section split as teacher Upload (## Analysis, etc.). Raw values still hold markdown — clean at use site. */
export function parseStudentWorkFeedbackSections(text: string): ParsedFeedbackSections {
  const sections: ParsedFeedbackSections = {
    analysis: "",
    error_type: "",
    grade: "",
    remediation: "",
  };
  const regex = /##\s*(Analysis|Error Type|Grade|Remediation)\s*\n([\s\S]*?)(?=##\s|$)/gi;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const key = match[1].toLowerCase();
    const value = match[2].trim();
    if (key === "analysis") sections.analysis = value;
    else if (key === "error type") sections.error_type = value;
    else if (key === "grade") sections.grade = value;
    else if (key === "remediation") sections.remediation = value;
  }
  return sections;
}

function isNoneError(s: string): boolean {
  const t = s.trim().toLowerCase();
  return !t || t === "none" || t.startsWith("none found") || t === "none.";
}

/** How many "Q1", "Q2" style markers (dense item-by-item feedback). */
function countQuestionMarkers(s: string): number {
  const m = s.match(/\bQ\s*\d+/gi);
  return m ? m.length : 0;
}

/** Flatten question labels so prose flows; does not remove content. */
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

type WorkNarrativeInput = Pick<
  StudentWork,
  "student_name" | "subject" | "feedback" | "error_type" | "remediation"
>;

/**
 * Warm spoken/SMS opening — mentions the child by first name when known.
 * Pidgin-style greeting the product uses for guardian-facing audio.
 */
export function buildMamaMathVoicePretext(studentFirstName: string): string {
  const raw = studentFirstName.trim().split(/\s+/)[0];
  if (!raw) {
    return "My name na Mama Math oooo. Here is feedback about your child's latest schoolwork.";
  }
  return `My name na Mama Math oooo. This is feedback about what your child, ${raw}, has done.`;
}

/**
 * Full TTS script: Mama Math intro + parent report (no technical error labels).
 * Student-facing text on the portal stays `buildStudentWorkNarrativeParagraph(..., "student")`.
 */
export function buildStudentWorkVoiceScriptForUpload(args: {
  studentName: string;
  subject: string;
  feedback: string;
  errorType?: string | null;
  remediation?: string | null;
}): string {
  const work: WorkNarrativeInput = {
    student_name: args.studentName,
    subject: args.subject,
    feedback: args.feedback,
    error_type: args.errorType ?? undefined,
    remediation: args.remediation ?? undefined,
  };
  const first = args.studentName.trim().split(/\s+/)[0] || "";
  const pre = buildMamaMathVoicePretext(first);
  const body = buildStudentWorkNarrativeParagraph(work, "parent");
  return polishNarrativeText(collapseSpaces(`${pre} ${body}`));
}

/**
 * Plain parent report for SMS snippets (same ideas as voice body, no intro).
 */
export function buildStudentWorkParentReportPlain(args: {
  studentName: string;
  subject: string;
  feedback: string;
  errorType?: string | null;
  remediation?: string | null;
}): string {
  return buildStudentWorkNarrativeParagraph(
    {
      student_name: args.studentName,
      subject: args.subject,
      feedback: args.feedback,
      error_type: args.errorType ?? undefined,
      remediation: args.remediation ?? undefined,
    },
    "parent",
  );
}

/**
 * One readable paragraph: no ##/**, minimal list feel.
 * When feedback is question-by-question heavy, prioritizes themes + remediation over reading every line.
 */
export function buildStudentWorkNarrativeParagraph(
  work: WorkNarrativeInput,
  audience: NarrativeAudience
): string {
  const rawFeedback = work.feedback?.trim() || "";
  if (!rawFeedback) return "";

  const parsed = parseStudentWorkFeedbackSections(rawFeedback);
  const subject = collapseSpaces(work.subject || "mathematics");
  const subjectPhrase =
    subject.toLowerCase().includes("math") || subject.toLowerCase() === "mathematics"
      ? "this mathematics work"
      : `this ${subject} work`;

  let analysisRaw = parsed.analysis.trim();
  if (!analysisRaw) {
    analysisRaw = rawFeedback;
  }

  const analysisClean = normalizeProse(softenQuestionLabels(stripMarkdownAggressive(analysisRaw)));
  const qMarkers = countQuestionMarkers(analysisRaw) + countQuestionMarkers(work.feedback || "");

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
  const nameToken = (work.student_name || "").trim().split(/\s+/)[0] || "";

  const denseItemization = qMarkers >= 2 || analysisClean.length > 650;

  if (denseItemization) {
    const errShort = errors ? smartTruncate(errors, 420) : "";
    const remShort = remediation ? smartTruncate(remediation, 420) : "";
    const gist = analysisClean
      ? smartTruncate(analysisClean, qMarkers >= 3 ? 200 : 320)
      : "";

    if (audience === "student") {
      const bits: string[] = [
        `In ${subjectPhrase}, you worked through the exercises on the page.`,
      ];
      if (errShort) {
        bits.push(`The main things to work on are: ${errShort}`);
      } else if (gist) {
        bits.push(`In short: ${gist}`);
      }
      if (remShort) {
        bits.push(`To improve, try this: ${remShort}`);
      } else if (gist && errShort) {
        /* already covered */
      } else if (gist) {
        bits.push(`${gist}`);
      }
      if (gradeBit && /\d/.test(gradeBit)) {
        bits.push(`Score noted on the work: ${gradeBit}.`);
      }
      if (bits.length === 1) {
        bits.push(
          "Keep practicing similar problems and check each digit and tally mark carefully.",
        );
      }
      return polishNarrativeText(collapseSpaces(bits.join(" ")));
    }

    const who = nameToken || "your child";
    const bits: string[] = [
      `In ${subjectPhrase}, ${who} completed the exercises.`,
    ];
    /* Parent report: describe the work and what to do at home — skip error-type labels
       (e.g. “Factual error —”) that guardians rarely understand. */
    if (gist) {
      bits.push(`Here is what showed in their working: ${gist}`);
    }
    if (remShort) {
      bits.push(`What helps most at home is this: ${remShort}`);
    } else if (!gist) {
      bits.push(
        "Keep encouraging them to work slowly and to check each answer before moving on.",
      );
    }
    if (gradeBit && /\d/.test(gradeBit)) {
      bits.push(`The teacher noted a score around ${gradeBit}.`);
    }
    if (bits.length === 1) {
      bits.push(
        "Encourage careful writing of numbers and short counting practice together.",
      );
    }
    return polishNarrativeText(collapseSpaces(bits.join(" ")));
  }

  let analysis = analysisClean;
  if (analysis.length > 720) {
    analysis = smartTruncate(analysis, 700);
  }

  const parts: string[] = [];

  if (audience === "student") {
    parts.push(`In ${subjectPhrase}, here is what stands out: ${analysis}`);
    if (errors) {
      parts.push(`Some mistakes or weak spots to work on are: ${errors}`);
    }
    if (remediation) {
      parts.push(`To improve, try this: ${remediation}`);
    }
  } else {
    const who = nameToken || "Your child";
    parts.push(
      `In ${subjectPhrase}, ${who} finished the questions. Here is what showed in their work: ${analysis}`,
    );
    if (remediation) {
      parts.push(`What you can do to help at home: ${remediation}`);
    }
  }

  return polishNarrativeText(collapseSpaces(parts.join(" ")));
}
