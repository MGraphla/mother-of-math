/**
 * Shared grading utilities used by both teacher and student assignment views.
 */

export interface ParsedAiFeedback {
  analysis: string;
  error_type: string;
  grade: string;
  remediation: string;
}

/**
 * Parse AI-generated feedback into structured sections.
 * The AI feedback uses markdown headers like ## Analysis, ## Error Type, etc.
 */
export const parseAiFeedback = (raw: string): ParsedAiFeedback => {
  const result: ParsedAiFeedback = {
    analysis: '',
    error_type: '',
    grade: '',
    remediation: '',
  };
  const sectionMap: Record<string, keyof ParsedAiFeedback> = {
    'analysis': 'analysis',
    'error type': 'error_type',
    'grade': 'grade',
    'remediation': 'remediation',
  };
  const regex = /##\s*(Analysis|Error Type|Grade|Remediation)\s*\n([\s\S]*?)(?=##\s|$)/gi;
  let match;
  while ((match = regex.exec(raw)) !== null) {
    const key = sectionMap[match[1].trim().toLowerCase()];
    if (key) result[key] = match[2].trim();
  }
  return result;
};

/** Math subjects available in Cameroon primary curriculum */
export const MATH_SUBJECTS = [
  'Mathematics',
  'Numbers & Operations',
  'Geometry & Shapes',
  'Measurement',
  'Data & Graphs',
  'Algebra',
  'Problem Solving',
] as const;

export type MathSubject = typeof MATH_SUBJECTS[number];

/** Rubric criterion for criteria-based grading */
export interface RubricCriterion {
  id: string;
  name: string;
  maxScore: number;
  description?: string;
}

/** Default rubric criteria for math assignments */
export const DEFAULT_RUBRIC_CRITERIA: RubricCriterion[] = [
  { id: 'accuracy', name: 'Accuracy', maxScore: 40, description: 'Correctness of answers and calculations' },
  { id: 'method', name: 'Method/Process', maxScore: 30, description: 'Showing work and using correct methods' },
  { id: 'presentation', name: 'Presentation', maxScore: 20, description: 'Neatness, organization, and clarity' },
  { id: 'completeness', name: 'Completeness', maxScore: 10, description: 'All questions attempted' },
];
