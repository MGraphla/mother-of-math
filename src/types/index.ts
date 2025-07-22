import { UserProfile } from "@/context/AuthContext";
import { Timestamp } from 'firebase/firestore';

export interface Interview {
  id: string;
  userId: string;
  role: string;
  level: string;
  topic: string;
  focus: string;
  time: number;
  questions: string[];
  transcript?: { role: 'user' | 'assistant'; content: string }[];
  createdAt?: Timestamp;
  feedback?: string;
}

export interface Assignment {
  id: string;
  title: string;
  description: string;
  due_date: string;
  created_at: string;
  teacher_id: string;
  subject: string;
  grade_level: string;
  // Optional list of specific student IDs this assignment is for
  // If empty, it's for all students under the teacher
  assigned_student_ids?: string[];
}

export interface AssignmentSubmission {
  id: string;
  assignment_id: string;
  student_id: string;
  submitted_at: string;
  status: 'submitted' | 'graded' | 'returned';
  // URL to the uploaded file (PDF, image, etc.)
  submission_file_url: string;
  // Student's self-assessment or notes
  student_notes?: string;
  score?: number | null; // Added to store the mark/grade for the submission
}

export interface FeedbackItem {
  id: string;
  submission_id: string;
  created_at: string;
  // The specific error or issue being addressed
  error_description: string;
  // Teacher's correction or guidance
  correction: string;
  // Optional page number or location in the submission
  location?: string;
  // Category of error (e.g., "calculation", "concept", "procedure")
  error_type: string;
  // Severity of the error (1-5, with 5 being most critical)
  severity: number;
}

// Helper function to determine if a user is a teacher
export const isTeacher = (profile: UserProfile | null): boolean => {
  return profile?.role === 'teacher';
};

// Helper function to determine if a user is a student
export const isStudent = (profile: UserProfile | null): boolean => {
  return profile?.role === 'student';
};

// Helper function to determine if a user is a parent
export const isParent = (profile: UserProfile | null): boolean => {
  return profile?.role === 'parent';
};

// Primary grade levels for the application
export const PRIMARY_GRADE_LEVELS = [
  "Primary 1",
  "Primary 2",
  "Primary 3",
  "Primary 4",
  "Primary 5",
  "Primary 6"
];

// Helper function to determine if a teacher manages a specific student
export const teacherManagesStudent = (teacher: UserProfile, studentId: string): boolean => {
  return teacher.managed_student_ids?.includes(studentId) || false;
};
