/** Shared option lists for sign-up, complete-profile and Settings (kept identical to apps/mobile/src/lib/profileOptions.ts). */

export const COUNTRIES = ["Cameroon", "Nigeria"];

export const SCHOOL_TYPES = [
  "Public / Government",
  "Private",
  "Faith-based / Mission",
  "International",
  "Community",
  "Home School",
  "Other",
];

export const EDUCATION_LEVELS = [
  "High School Diploma",
  "Associate Degree",
  "Bachelor's Degree",
  "Master's Degree",
  "PhD / Doctorate",
  "Teaching Certificate",
  "Other",
];

export const LANGUAGES = [
  "English",
  "French",
  "Pidgin English",
  "Fulfulde",
  "Ewondo",
  "Duala",
  "Bassa",
  "Other",
];

export const GRADE_LEVELS = [
  "Primary 1",
  "Primary 2",
  "Primary 3",
  "Primary 4",
  "Primary 5",
  "Primary 6",
];

export const GENDERS = ["Female", "Male", "Other", "Prefer not to say"];

export const CLASS_COUNTS = [
  { value: "1", label: "1 class" },
  { value: "2", label: "2 classes" },
  { value: "3", label: "3 classes" },
  { value: "4", label: "4 classes" },
  { value: "5", label: "5+ classes" },
];

export const STUDENT_COUNTS = [
  { value: "20", label: "1-20 students" },
  { value: "50", label: "21-50 students" },
  { value: "100", label: "51-100 students" },
  { value: "200", label: "101-200 students" },
  { value: "500", label: "200+ students" },
];

export const PHONE_RULES: Record<string, { pattern: RegExp; example: string }> = {
  Cameroon: { pattern: /^(?:\+237|237)?\s*?[26]\d{8}$/, example: "+237 6XX XXX XXX" },
  Nigeria: {
    pattern: /^(?:\+234|234)?\s*?[789][01]\d{8}$|^0[789][01]\d{8}$/,
    example: "+234 8XX XXX XXXX",
  },
};

export const toOptions = (values: string[]) => values.map((v) => ({ value: v, label: v }));

export function validatePhone(phone: string, country: string): string | null {
  const cleaned = phone.replace(/\s+/g, "");
  if (!cleaned) return "Phone number is required.";
  const rule = PHONE_RULES[country];
  if (rule && !rule.pattern.test(cleaned)) {
    return `Please enter a valid ${country} phone number (e.g., ${rule.example}).`;
  }
  return null;
}

export function optionalPhoneError(phone: string, country: string, label = "phone"): string | null {
  if (!phone.trim()) return null;
  const rule = PHONE_RULES[country];
  if (rule && !rule.pattern.test(phone.replace(/\s+/g, ""))) {
    return `Please enter a valid ${country} ${label} number (e.g., ${rule.example}).`;
  }
  return null;
}

export function parseOptionalInt(raw: string): number | null {
  if (!raw.trim()) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}
