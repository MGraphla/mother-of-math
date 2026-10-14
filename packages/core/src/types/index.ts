export type UserRole = "teacher" | "parent" | "student" | "admin" | "monitor";

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  country: string | null;
  school_name: string | null;
  phone_number: string | null;
  preferred_language: string | null;
  created_at: string;
  updated_at: string;
}

export interface DashboardModule {
  id: string;
  title: string;
  route: string;
  description: string;
}
