import { PRIMARY_GRADE_LEVELS } from '@/types';

/** Canonical DB field keys for bulk import */
export type BulkStudentFieldKey =
  | 'full_name'
  | 'grade_level'
  | 'date_of_birth'
  | 'gender'
  | 'nationality'
  | 'place_of_birth'
  | 'home_language'
  | 'parent_name'
  | 'parent_phone'
  | 'parent_email'
  | 'parent_relationship'
  | 'home_address'
  | 'school_name'
  | 'class_name'
  | 'admission_number'
  | 'academic_year'
  | 'blood_group'
  | 'medical_conditions'
  | 'allergies'
  | 'special_needs'
  | 'disability_status'
  | 'previous_school'
  | 'notes';

export interface BulkFieldSpec {
  key: BulkStudentFieldKey;
  label: string;
  sheetAliases: string[];
  required: boolean;
}

export const BULK_IMPORT_FIELDS: BulkFieldSpec[] = [
  { key: 'full_name', label: 'Full name', sheetAliases: ['Full Name*', 'Full Name', 'full_name', 'Name', 'Learner Name'], required: true },
  { key: 'grade_level', label: 'Grade / class level', sheetAliases: ['Grade Level*', 'Grade Level', 'grade_level', 'Class', 'Level'], required: true },
  { key: 'date_of_birth', label: 'Date of birth', sheetAliases: ['Date of Birth', 'DOB', 'Birthdate'], required: false },
  { key: 'gender', label: 'Gender', sheetAliases: ['Gender'], required: false },
  { key: 'nationality', label: 'Nationality', sheetAliases: ['Nationality'], required: false },
  { key: 'place_of_birth', label: 'Place of birth', sheetAliases: ['Place of Birth'], required: false },
  { key: 'home_language', label: 'Home language', sheetAliases: ['Home Language'], required: false },
  { key: 'parent_name', label: 'Parent/guardian name', sheetAliases: ['Parent/Guardian Name', 'Parent Name', 'Guardian'], required: false },
  { key: 'parent_phone', label: 'Parent phone', sheetAliases: ['Parent Phone', 'Phone', 'Guardian Phone'], required: false },
  { key: 'parent_email', label: 'Parent email', sheetAliases: ['Parent Email', 'Email'], required: false },
  { key: 'parent_relationship', label: 'Relationship', sheetAliases: ['Parent Relationship', 'Relationship'], required: false },
  { key: 'home_address', label: 'Home address', sheetAliases: ['Home Address', 'Address'], required: false },
  { key: 'school_name', label: 'School name', sheetAliases: ['School Name', 'School'], required: false },
  { key: 'class_name', label: 'Class name', sheetAliases: ['Class Name', 'Section'], required: false },
  { key: 'admission_number', label: 'Admission number', sheetAliases: ['Admission Number', 'Admission No'], required: false },
  { key: 'academic_year', label: 'Academic year', sheetAliases: ['Academic Year'], required: false },
  { key: 'blood_group', label: 'Blood group', sheetAliases: ['Blood Group'], required: false },
  { key: 'medical_conditions', label: 'Medical conditions', sheetAliases: ['Medical Conditions'], required: false },
  { key: 'allergies', label: 'Allergies', sheetAliases: ['Allergies'], required: false },
  { key: 'special_needs', label: 'Special learning needs', sheetAliases: ['Special Learning Needs', 'Special Needs'], required: false },
  { key: 'disability_status', label: 'Disability status', sheetAliases: ['Disability Status'], required: false },
  { key: 'previous_school', label: 'Previous school', sheetAliases: ['Previous School'], required: false },
  { key: 'notes', label: 'Notes', sheetAliases: ['Notes'], required: false },
];

export type ColumnMapping = Partial<Record<BulkStudentFieldKey, string>>;

/** Map each canonical field to a source column header (or "" = skip) */
export function autoMapColumns(sourceHeaders: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const lower = new Map(sourceHeaders.map((h) => [h.trim().toLowerCase(), h]));

  for (const spec of BULK_IMPORT_FIELDS) {
    let found: string | undefined;
    for (const al of spec.sheetAliases) {
      const hit = lower.get(al.trim().toLowerCase());
      if (hit) {
        found = hit;
        break;
      }
    }
    if (found) mapping[spec.key] = found;
  }

  return mapping;
}

function cell(row: Record<string, unknown>, header: string | undefined): string {
  if (!header) return '';
  const v = row[header];
  if (v === undefined || v === null) return '';
  return String(v).trim();
}

export interface BulkMappedRow {
  rowNumber: number;
  payload: Record<string, string | null>;
}

export interface BulkValidationIssue {
  rowNumber: number;
  field: string;
  message: string;
}

/** Apply mapping to one raw sheet row → DB-ready payload */
export function mapRowToPayload(
  rawRow: Record<string, unknown>,
  mapping: ColumnMapping,
  rowNumber: number,
  defaults: { school_name?: string | null; grade_level?: string | null },
): BulkMappedRow {
  const payload: Record<string, string | null> = {};

  for (const spec of BULK_IMPORT_FIELDS) {
    const header = mapping[spec.key];
    const s = cell(rawRow, header);
    if (s) (payload as Record<string, string | null>)[spec.key] = s;
    else (payload as Record<string, string | null>)[spec.key] = null;
  }

  if (!payload.grade_level && defaults.grade_level) {
    const g = defaults.grade_level.split(',')[0]?.trim();
    if (g) payload.grade_level = g;
  }
  if (!payload.school_name && defaults.school_name) {
    payload.school_name = defaults.school_name;
  }

  return { rowNumber, payload };
}

export function validateMappedPayload(
  payload: Record<string, string | null>,
  rowNumber: number,
): BulkValidationIssue[] {
  const issues: BulkValidationIssue[] = [];
  if (!payload.full_name?.trim()) {
    issues.push({ rowNumber, field: 'full_name', message: 'Full name is required' });
  }
  if (!payload.grade_level?.trim()) {
    issues.push({ rowNumber, field: 'grade_level', message: 'Grade level is required' });
  } else if (!PRIMARY_GRADE_LEVELS.includes(payload.grade_level.trim())) {
    issues.push({
      rowNumber,
      field: 'grade_level',
      message: `Invalid grade level "${payload.grade_level}". Must be one of: ${PRIMARY_GRADE_LEVELS.slice(0, 6).join(', ')}…`,
    });
  }
  return issues;
}

export function validateAllRows(
  mapped: BulkMappedRow[],
): { issues: BulkValidationIssue[]; validRows: BulkMappedRow[] } {
  const issues: BulkValidationIssue[] = [];
  const validRows: BulkMappedRow[] = [];
  for (const m of mapped) {
    const rowIssues = validateMappedPayload(m.payload, m.rowNumber);
    if (rowIssues.length) issues.push(...rowIssues);
    else validRows.push(m);
  }
  return { issues, validRows };
}

export function issuesToErrorCsv(issues: BulkValidationIssue[]): string {
  const headers = ['row_number', 'field', 'message'];
  const lines = [headers.join(',')];
  for (const i of issues) {
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    lines.push([i.rowNumber, esc(i.field), esc(i.message)].join(','));
  }
  return lines.join('\n');
}
