/** Shared create/edit field catalog — mirrors web StudentAccountCreation FORM_FIELDS. */

export type StudentFormSection = "basic" | "guardian" | "school" | "health" | "additional";

export type StudentFormFieldType = "text" | "date" | "select" | "textarea" | "email" | "tel";

export interface StudentFormField {
  key: string;
  label: string;
  type: StudentFormFieldType;
  required?: boolean;
  placeholder?: string;
  options?: string[];
  section: StudentFormSection;
}

/** UI-only; not written to `students` row. */
export const SKIP_STUDENT_DB_FIELDS = new Set(["parent_phone_country"]);

export const STUDENT_FORM_SECTIONS: {
  id: StudentFormSection;
  title: string;
  description: string;
  defaultOpen: boolean;
}[] = [
  {
    id: "basic",
    title: "Basic Information",
    description: "Personal details about the student",
    defaultOpen: true,
  },
  {
    id: "guardian",
    title: "Guardian / Contact",
    description: "Parent or guardian's contact information",
    defaultOpen: true,
  },
  {
    id: "school",
    title: "School Information",
    description: "Academic and school details",
    defaultOpen: true,
  },
  {
    id: "health",
    title: "Health & Special Needs",
    description: "Medical and accessibility information",
    defaultOpen: false,
  },
  {
    id: "additional",
    title: "Additional Information",
    description: "Extra notes and history",
    defaultOpen: false,
  },
];

export const STUDENT_FORM_FIELDS: StudentFormField[] = [
  {
    key: "full_name",
    label: "Learner's Full Name",
    type: "text",
    required: true,
    placeholder: "e.g., Nfor Che Junior",
    section: "basic",
  },
  { key: "date_of_birth", label: "Date of Birth", type: "date", section: "basic", placeholder: "YYYY-MM-DD" },
  {
    key: "gender",
    label: "Gender",
    type: "select",
    options: ["Male", "Female", "Other"],
    section: "basic",
  },
  {
    key: "nationality",
    label: "Nationality",
    type: "text",
    placeholder: "e.g., Cameroonian",
    section: "basic",
  },
  {
    key: "place_of_birth",
    label: "Place of Birth",
    type: "text",
    placeholder: "e.g., Bamenda",
    section: "basic",
  },
  {
    key: "home_language",
    label: "Home Language",
    type: "text",
    placeholder: "e.g., Pidgin English",
    section: "basic",
  },

  {
    key: "parent_name",
    label: "Parent/Guardian Full Name",
    type: "text",
    placeholder: "e.g., Mrs. Ngum Comfort",
    section: "guardian",
  },
  {
    key: "parent_phone",
    label: "Parent/Guardian Phone",
    type: "tel",
    placeholder: "+237 or +234 mobile",
    section: "guardian",
  },
  {
    key: "parent_phone_country",
    label: "Guardian phone country (SMS)",
    type: "select",
    options: ["Cameroon", "Nigeria"],
    section: "guardian",
  },
  {
    key: "parent_email",
    label: "Parent/Guardian Email",
    type: "email",
    placeholder: "e.g., parent@email.com",
    section: "guardian",
  },
  {
    key: "parent_relationship",
    label: "Relationship to Learner",
    type: "select",
    options: ["Mother", "Father", "Guardian", "Uncle", "Aunt", "Grandparent", "Sibling", "Other"],
    section: "guardian",
  },
  {
    key: "home_address",
    label: "Home Address",
    type: "textarea",
    placeholder: "Full home address...",
    section: "guardian",
  },

  {
    key: "school_name",
    label: "School Name",
    type: "text",
    placeholder: "e.g., Government Primary School Bambili",
    section: "school",
  },
  {
    key: "grade_level",
    label: "Class/Grade Level",
    type: "select",
    required: true,
    options: ["Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5", "Primary 6"],
    section: "school",
  },
  {
    key: "class_name",
    label: "Class Name/Section",
    type: "text",
    placeholder: "e.g., Class 5A",
    section: "school",
  },
  {
    key: "admission_number",
    label: "Admission/Registration No.",
    type: "text",
    placeholder: "e.g., GPS/2024/001",
    section: "school",
  },
  {
    key: "academic_year",
    label: "Academic Year",
    type: "text",
    placeholder: "e.g., 2025/2026",
    section: "school",
  },

  {
    key: "blood_group",
    label: "Blood Group",
    type: "select",
    options: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Unknown"],
    section: "health",
  },
  {
    key: "medical_conditions",
    label: "Medical Conditions",
    type: "textarea",
    placeholder: "Any known medical conditions...",
    section: "health",
  },
  {
    key: "allergies",
    label: "Allergies",
    type: "text",
    placeholder: "e.g., None / Penicillin",
    section: "health",
  },
  {
    key: "special_needs",
    label: "Special Learning Needs",
    type: "textarea",
    placeholder: "Any learning disabilities or special needs...",
    section: "health",
  },
  {
    key: "disability_status",
    label: "Disability Status",
    type: "select",
    options: ["None", "Visual", "Hearing", "Physical", "Intellectual", "Multiple", "Other"],
    section: "health",
  },

  {
    key: "previous_school",
    label: "Previous School",
    type: "text",
    placeholder: "Name of previous school if any",
    section: "additional",
  },
  {
    key: "notes",
    label: "Additional Notes",
    type: "textarea",
    placeholder: "Any other relevant information about this student...",
    section: "additional",
  },
];

export const buildDefaultStudentForm = (profile?: {
  school_name?: string | null;
  grade_levels?: string | null;
  country?: string | null;
}): Record<string, string> => {
  const grade =
    (profile?.grade_levels || "")
      .split(",")
      .map((s) => s.trim())
      .find(Boolean) || "";
  return {
    school_name: profile?.school_name || "",
    grade_level: grade,
    parent_phone_country: profile?.country === "Nigeria" ? "Nigeria" : "Cameroon",
  };
};

export const formDataToStudentPayload = (
  formData: Record<string, string>,
  teacherId: string,
): Record<string, string> => {
  const studentData: Record<string, string> = { teacher_id: teacherId };
  for (const f of STUDENT_FORM_FIELDS) {
    if (SKIP_STUDENT_DB_FIELDS.has(f.key)) continue;
    const v = formData[f.key]?.trim();
    if (v) studentData[f.key] = v;
  }
  return studentData;
};
