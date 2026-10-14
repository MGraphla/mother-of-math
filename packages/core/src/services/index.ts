import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserProfile } from "../types";

export const fetchUserProfile = async (
  supabase: SupabaseClient,
  userId: string,
): Promise<UserProfile | null> => {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (error) return null;
  return data as UserProfile;
};

export const fetchUserModules = (role: UserProfile["role"]) => {
  const all = {
    teacher: [
      { id: "overview", title: "Overview", route: "/(roles)/teacher" },
      { id: "lesson-plan", title: "Lesson Plans", route: "/(roles)/teacher/lesson-plans" },
      { id: "upload", title: "Uploads", route: "/(roles)/teacher/uploads" },
      { id: "chatbot", title: "Chatbot", route: "/(roles)/teacher/chatbot" },
    ],
    student: [
      { id: "assignments", title: "Assignments", route: "/(roles)/student/assignments" },
      { id: "progress", title: "Progress", route: "/(roles)/student/progress" },
    ],
    parent: [{ id: "dashboard", title: "Parent Dashboard", route: "/(roles)/parent" }],
    admin: [{ id: "dashboard", title: "Admin Dashboard", route: "/(roles)/admin" }],
    monitor: [{ id: "dashboard", title: "Monitor Dashboard", route: "/(roles)/monitor" }],
  };

  return all[role] ?? [];
};
