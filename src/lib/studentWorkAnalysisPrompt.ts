/**
 * Prompts and score normalization for AI grading of photographed learner worksheets.
 * Supports N.E.R.D. Grade 2 assessments (multiple form variants, multi-page).
 */

export const STUDENT_WORK_ANALYSIS_SYSTEM_PROMPT =
  'You are MAMA, an expert mathematics education specialist for Cameroon primary schools. When analyzing student work, pay extremely close attention to HOW each number and letter is written — not just whether the answer is numerically correct. Flag reversed, mirrored, inverted, or malformed characters. Describe exactly what each written character looks like. Use Markdown headings for clear formatting. The photo may show **one or several pages** of the same assessment — read every page. Always grade in strict order from the **first item on page 1** through the **last item on the final page**. Grade **every scorable item** including entirely blank sections. Be **consistent**: use the fixed question numbering rubric provided — do not invent a different total each time.';

/** Canonical rubrics — fixed totals stop 47 vs 49 vs 44 drift on re-analysis */
export const FORM_RUBRICS = {
  nerd_pilot_grade2: {
    id: 'nerd_pilot_grade2',
    total: 49,
    label: 'N.E.R.D. Pilot Evaluation Grade 2 (3-page)',
    detect: /pilot evaluation|section 1.*number recognition.*symbol|amara has \d+ orange|count in 1s.*count in 2s.*count in 10s/i,
  },
  nerd_form_b: {
    id: 'nerd_form_b',
    total: 44,
    label: 'N.E.R.D. Form B (single-page)',
    detect: /number discrimination|circle the bigger number|tunde has 7 mangoes/i,
  },
} as const;

export type NerdFormId = keyof typeof FORM_RUBRICS;

/** N.E.R.D. Pilot Evaluation — fixed 49-item map (Q1–Q49). Always use this total. */
export const NERD_PILOT_GRADE2_INVENTORY = `
N.E.R.D. PILOT EVALUATION — GRADE 2 (3 pages) — FIXED RUBRIC: **T = 49 always**. Use Q1–Q49 exactly:

Page 1 — Section 1 Number Recognition (Q1–Q20):
  Q1–Q5: Row 1 symbols (left → right, 5 cells)
  Q6–Q10: Row 1 words (left → right, 5 cells)
  Q11–Q15: Row 2 symbols (left → right, 5 cells)
  Q16–Q20: Row 2 words (left → right, 5 cells)

Page 1 — Section 2 Counting Fluency (Q21–Q27):
  Q21–Q23: Count in 1s — each missing blank (left → right)
  Q24–Q26: Count in 2s — each missing blank (left → right)
  Q27: Count in 10s — missing blank

Page 2 — Section 3 Number Recognition (Q28–Q32):
  Q28–Q32: Circle-the-number items (left → right, top → bottom, 5 targets)

Page 2 — Section 4 Place Value (Q33–Q37):
  Q33–Q37: Each table row answer (5 rows)

Page 2 — Section 5 Simple Operations (Q38–Q47):
  Q38–Q42: Addition sums (left → right)
  Q43–Q47: Subtraction sums (left → right)

Page 3 — Section 6 Word Problems (Q48–Q49):
  Q48: Word problem 1
  Q49: Word problem 2

You MUST write exactly 49 Analysis lines (Q1 through Q49). T in ## Grade MUST be 49.
`.trim();

/** N.E.R.D. Form B — fixed 44-item map */
export const NERD_FORM_B_INVENTORY = `
N.E.R.D. FORM B (single page) — FIXED RUBRIC: **T = 44 always**:
  Q1–Q10: Number Discrimination pairs
  Q11–Q20: Simple Operations
  Q21–Q27: Counting Fluency blanks
  Q28–Q29: Word Problems
  Q30–Q39: Number Recognition shape boxes
  Q40–Q44: Place Value rows
You MUST write exactly 44 Analysis lines. T in ## Grade MUST be 44.
`.trim();

const ANALYSIS_LINE_RULES = `
## Analysis
[Write **exactly one line per item** Q1 through QT in strict order. For N.E.R.D. Pilot use Q1–Q49. For Form B use Q1–Q44.
**MANDATORY ORDER:** Page 1 Section 1 Q1 first → … → last page last section QT last. Never start mid-form.
Patterns:
"Q1: … — Final answer is Correct."
"Q2: … — Final answer is Incorrect."
"Q3: Learner did not attempt this exercise. — Final answer is Not attempted."
Every line ends with exactly one of those three verdicts (full stop at end). No gaps in numbering.]

## Error Type
[List issues in Q1→QT order. Categories: Not attempted, Incomplete work, Factual error, Procedural error, Conceptual error, Counting error, Place value, Simple operations, Patterns and sequencing, Number discrimination, Mirroring, Reversal, Number formation, Number recognition, None.]

## Grade
[Write ONLY C/T. For N.E.R.D. Pilot T must be **49**. For Form B T must be **44**. Otherwise T = items on form. Example: 16/49. No words, no %.]

## Remediation
[2-4 brief bullet points.]
`.trim();

const CRITICAL_FORMATTING = `
CRITICAL:
- Headings in order: ## Analysis, ## Error Type, ## Grade, ## Remediation.
- First Analysis line = Q1. Last = QT (49 for Pilot, 44 for Form B).
- ## Grade denominator MUST match the fixed rubric total — never 47, never attempted-only count.
- Be consistent: same worksheet photo → same question count and same order every time.
`.trim();

export function buildStudentWorkAnalysisPrompt(): string {
  return `Analyze this student's math worksheet photo. Be brief and direct.

STEP 1 — IDENTIFY FORM (pick ONE rubric)
- **N.E.R.D. Pilot Evaluation** (3 pages, sections: Number Recognition with symbol/word rows, Counting Fluency, circle numbers, Place Value, Simple Operations, Word Problems) → use **Q1–Q49, T=49**
- **N.E.R.D. Form B** (1 page, Number Discrimination bigger-number pairs) → use **Q1–Q44, T=44**
- Other worksheet → count all items once, assign Q1…QT, keep T fixed for that form layout

STEP 2 — USE THE FIXED RUBRIC (do not recount differently each run)
${NERD_PILOT_GRADE2_INVENTORY}

${NERD_FORM_B_INVENTORY}

STEP 3 — ORDER
Grade Page 1 → Page 2 → Page 3. Within each section: top → bottom, left → right.
Blank sections (e.g. all Place Value empty) still get Q-lines as Not attempted in position.

STEP 4 — SCORING
- C = count of items with verdict Correct only.
- Score = C/T with T from fixed rubric (49 or 44).
- Unanswered = Not attempted (not omitted).

${ANALYSIS_LINE_RULES}

${CRITICAL_FORMATTING}

Use very simple language for primary school teachers.`;
}

export function extractMaxQuestionNumber(text: string): number {
  let max = 0;
  for (const raw of text.split(/\r?\n/)) {
    let line = raw.trim();
    line = line.replace(/^#{1,6}\s+/, '').replace(/^\s*[-*•]\s+/, '');
    line = line.replace(/^\*+/, '').replace(/\*+$/, '').trim();
    const m = line.match(/^Q\s*(\d+)\s*:/i);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  }
  return max;
}

/**
 * Resolve form + total for scoring. Highest question number in the analysis wins —
 * if Q49 appears, total is 49 even if Form B heuristics also match.
 */
export function resolveScoringRubric(text: string): {
  formId: NerdFormId | null;
  total: number;
  maxQ: number;
} {
  const sections = parseAiFeedbackSections(text);
  const maxQ = Math.max(
    extractMaxQuestionNumber(sections.analysis),
    extractMaxQuestionNumber(text),
  );

  // Strongest signal: how many questions were actually analysed
  if (maxQ >= 45) {
    return { formId: 'nerd_pilot_grade2', total: FORM_RUBRICS.nerd_pilot_grade2.total, maxQ };
  }
  if (maxQ >= 40 && maxQ <= 44) {
    return { formId: 'nerd_form_b', total: FORM_RUBRICS.nerd_form_b.total, maxQ };
  }

  const lower = text.toLowerCase();
  if (FORM_RUBRICS.nerd_pilot_grade2.detect.test(lower)) {
    return { formId: 'nerd_pilot_grade2', total: FORM_RUBRICS.nerd_pilot_grade2.total, maxQ };
  }
  if (FORM_RUBRICS.nerd_form_b.detect.test(lower)) {
    return { formId: 'nerd_form_b', total: FORM_RUBRICS.nerd_form_b.total, maxQ };
  }

  if (
    /section 1.*number recognition/i.test(lower) &&
    /place value/i.test(lower) &&
    /word problem/i.test(lower)
  ) {
    return { formId: 'nerd_pilot_grade2', total: FORM_RUBRICS.nerd_pilot_grade2.total, maxQ };
  }

  // Unknown form — use highest Q number seen, or 0
  return { formId: null, total: maxQ > 0 ? maxQ : 0, maxQ };
}

export function detectNerdFormType(text: string): NerdFormId | null {
  return resolveScoringRubric(text).formId;
}

/** Count verdicts from ## Analysis Q-lines (dedupe by Q number). */
export function extractCorrectTotalFromAnalysis(analysis: string): {
  correct: number;
  total: number;
  attempted: number;
} | null {
  if (!analysis?.trim()) return null;
  const verdicts = new Map<number, 'c' | 'i' | 'p' | 'n'>();

  for (const raw of analysis.split(/\r?\n/)) {
    let line = raw.trim();
    if (!line) continue;
    line = line.replace(/^#{1,6}\s+/, '').replace(/^\s*[-*•]\s+/, '');
    line = line.replace(/^\*+/, '').replace(/\*+$/, '').trim();
    const qm = line.match(/^Q\s*(\d+)\s*:/i);
    if (!qm) continue;
    const qn = parseInt(qm[1], 10);
    if (qn < 1 || qn > 200) continue;

    const tail = line.replace(/\s+$/, '');
    const isCorrect = /Final answer is\s+Correct\.?\s*$/i.test(tail);
    const isIncorrect = /Final answer is\s+Incorrect\.?\s*$/i.test(tail);
    const isPartial = /Final answer is\s+Partial\.?\s*$/i.test(tail);
    const isNotAttempted = /Final answer is\s+Not attempted\.?\s*$/i.test(tail);
    if (!isCorrect && !isIncorrect && !isPartial && !isNotAttempted) continue;

    let v: 'c' | 'i' | 'p' | 'n';
    if (isCorrect) v = 'c';
    else if (isPartial) v = 'p';
    else if (isNotAttempted) v = 'n';
    else v = 'i';
    verdicts.set(qn, v);
  }

  if (verdicts.size === 0) return null;
  const keys = [...verdicts.keys()].sort((a, b) => a - b);
  const total = Math.max(...keys);
  const correct = keys.filter((k) => verdicts.get(k) === 'c').length;
  const attempted = keys.filter((k) => verdicts.get(k) !== 'n').length;
  return { correct, total, attempted };
}

export function parseGradeFractionFromSection(gradeBlob: string): {
  correct: number;
  total: number;
} | null {
  const lines = gradeBlob
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].replace(/^[*\-•\s]+/, '').replace(/\*+/g, '').trim();
    const m = line.match(/^(\d+)\s*\/\s*(\d+)\s*$/);
    if (m) {
      const correct = parseInt(m[1], 10);
      const total = parseInt(m[2], 10);
      if (total > 0 && total <= 200 && correct >= 0 && correct <= total) {
        return { correct, total };
      }
    }
  }
  const loose = gradeBlob.match(/\b(\d+)\s*\/\s*(\d+)\b/);
  if (loose) {
    const correct = parseInt(loose[1], 10);
    const total = parseInt(loose[2], 10);
    if (total > 0 && total <= 200 && correct >= 0 && correct <= total) {
      return { correct, total };
    }
  }
  return null;
}

export function parseAiFeedbackSections(text: string): {
  analysis: string;
  error_type: string;
  grade: string;
  remediation: string;
} {
  const sections = {
    analysis: '',
    error_type: '',
    grade: '',
    remediation: '',
  };
  if (!text?.trim()) return sections;

  const headerRe =
    /^#{1,3}\s*(Analysis|Error\s*Type|Grade|Remediation)\b\s*:?[^\S\r\n]*/gim;
  const headers: { title: string; index: number; bodyStart: number }[] = [];
  let hm: RegExpExecArray | null;
  const re = new RegExp(headerRe.source, headerRe.flags);
  while ((hm = re.exec(text)) !== null) {
    headers.push({
      title: hm[1],
      index: hm.index,
      bodyStart: hm.index + hm[0].length,
    });
  }
  if (headers.length === 0) return sections;

  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    const end = i + 1 < headers.length ? headers[i + 1].index : text.length;
    const body = text.slice(h.bodyStart, end).trim();
    const key = h.title.toLowerCase().replace(/\s+/g, '_') as keyof typeof sections;
    if (key in sections) sections[key] = body;
  }
  return sections;
}

/** Recompute score with canonical total; rewrite ## Grade for consistent re-analysis. */
export function normalizeStudentWorkFeedback(text: string): string {
  const { total: rubricTotal } = resolveScoringRubric(text);
  const sections = parseAiFeedbackSections(text);
  const fromLines = extractCorrectTotalFromAnalysis(sections.analysis);
  const fromGrade = parseGradeFractionFromSection(sections.grade);

  let correct = fromLines?.correct ?? fromGrade?.correct ?? 0;
  let total = rubricTotal > 0 ? rubricTotal : (fromLines?.total ?? fromGrade?.total ?? 0);

  // Never score /44 when analysis includes Q45+
  if (fromLines && fromLines.total > total) total = fromLines.total;
  if (rubricTotal >= 49) total = 49;
  else if (rubricTotal === 44 && (fromLines?.total ?? 0) <= 44) total = 44;

  if (fromLines) correct = fromLines.correct;
  else if (fromGrade) correct = fromGrade.correct;

  if (total <= 0) return text;

  correct = Math.min(correct, total);
  const normalizedGrade = `${correct}/${total}`;

  if (sections.grade.trim() === normalizedGrade) return text;

  const gradeHeaderRe = /^#{1,3}\s*Grade\b\s*:?[^\S\r\n]*/im;
  const gradeMatch = gradeHeaderRe.exec(text);
  if (!gradeMatch) return text;

  const gradeStart = gradeMatch.index + gradeMatch[0].length;
  const afterGrade = text.slice(gradeStart);
  const nextHeader = /^#{1,3}\s/m.exec(afterGrade);
  const gradeEnd =
    nextHeader && nextHeader.index != null
      ? gradeStart + nextHeader.index
      : text.length;

  return (
    text.slice(0, gradeStart) +
    `\n${normalizedGrade}\n` +
    text.slice(gradeEnd)
  );
}

/**
 * Score = correct / total. Uses canonical rubric totals for known N.E.R.D. forms
 * so the same worksheet always shows the same denominator.
 */
export function extractGradeFraction(text: string): {
  label: string;
  percent: number;
} | null {
  const { total: rubricTotal } = resolveScoringRubric(text);
  const sections = parseAiFeedbackSections(text);
  const fromLines = extractCorrectTotalFromAnalysis(sections.analysis);
  const fromGrade = parseGradeFractionFromSection(sections.grade);

  let correct = fromLines?.correct ?? fromGrade?.correct ?? null;
  let total =
    rubricTotal > 0
      ? rubricTotal
      : (fromLines?.total ?? fromGrade?.total ?? null);

  if (fromLines && total != null && fromLines.total > total) total = fromLines.total;
  if (rubricTotal >= 49) total = 49;

  if (fromLines) correct = fromLines.correct;
  else if (fromGrade && correct == null) correct = fromGrade.correct;

  if (correct == null || total == null || total <= 0) {
    if (fromGrade) {
      correct = fromGrade.correct;
      total = fromGrade.total;
    } else if (fromLines) {
      correct = fromLines.correct;
      total = fromLines.total;
    } else {
      const pctMatch = text.match(/(\d{1,3})\s*%/);
      if (pctMatch) {
        const val = parseInt(pctMatch[1], 10);
        if (val >= 0 && val <= 100) return { label: `${val}%`, percent: val };
      }
      return null;
    }
  }

  correct = Math.min(Math.max(0, correct), total);
  return {
    label: `${correct}/${total}`,
    percent: Math.min(100, Math.round((correct / total) * 100)),
  };
}

export const STUDENT_WORK_VISION_DETAIL = 'high' as const;
export const STUDENT_WORK_MAX_TOKENS = 12000;
export const STUDENT_WORK_TEMPERATURE = 0;
