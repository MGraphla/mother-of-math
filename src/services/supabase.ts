// Re-export everything from the canonical Supabase lib
export { supabase, getCurrentUser, getUserProfile, upsertUserProfile, signOutUser } from '@/lib/supabase';
export type { UserRole, UserProfile, StudentWork, LessonPlan } from '@/lib/supabase';
