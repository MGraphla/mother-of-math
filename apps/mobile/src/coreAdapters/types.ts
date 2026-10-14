export type UserRole = "teacher" | "parent" | "student" | "admin" | "monitor";

export interface UserProfile {
  id?: string;
  full_name?: string;
  email?: string;
  role: UserRole;
}
