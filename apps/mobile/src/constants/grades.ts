export const PRIMARY_GRADE_LEVELS = [
  "Primary 1",
  "Primary 2",
  "Primary 3",
  "Primary 4",
  "Primary 5",
  "Primary 6",
] as const;

export type PrimaryGradeLevel = (typeof PRIMARY_GRADE_LEVELS)[number];

export const isPrimaryGradeLevel = (value: string): value is PrimaryGradeLevel =>
  (PRIMARY_GRADE_LEVELS as readonly string[]).includes(value);
