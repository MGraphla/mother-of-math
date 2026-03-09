import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase credentials. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'implicit',
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// ── Types ──────────────────────────────────────────────────

export type UserRole = 'teacher' | 'parent' | 'student';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  gender: string | null;
  country: string | null;
  city: string | null;
  school_name: string | null;
  school_address: string | null;
  school_type: string | null;
  number_of_students: number | null;
  subjects_taught: string | null;
  grade_levels: string | null;
  years_of_experience: number | null;
  education_level: string | null;
  phone_number: string | null;
  whatsapp_number: string | null;
  bio: string | null;
  date_of_birth: string | null;
  avatar_url: string | null;
  preferred_language: string | null;
  managed_student_ids: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface StudentWork {
  id: string;
  student_name: string;
  subject: string;
  image_url: string;
  parent_id: string;
  teacher_id?: string;
  student_id?: string;        // links to students.id
  feedback?: string;
  error_type?: string;
  remediation?: string;
  created_at: string;
  // Optional extended fields
  file_name?: string;
  file_type?: string;
  file_size?: number;
  grade?: string;
  status?: string;
}

export interface LessonPlan {
  id: string;
  title: string;
  objectives: string;
  materials: string;
  steps: string;
  assessment: string;
  teacher_id: string;
  grade_level: string;
  created_at: string;
}

// ── Helper functions ──────────────────────────────────────

export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    console.error('Error fetching current user:', error);
    return null;
  }
  return user;
};

export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }

  return data as UserProfile;
};

export const upsertUserProfile = async (profile: Partial<UserProfile> & { id: string }) => {
  const { error } = await supabase
    .from('profiles')
    .upsert({ ...profile, updated_at: new Date().toISOString() }, { onConflict: 'id' });

  if (error) {
    console.error('Error upserting user profile:', error);
    throw error;
  }
};

export const signOutUser = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  return true;
};

// ── Chat Conversations ───────────────────────────────────

export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  grade: string;
  created_at: string;
  updated_at: string;
}

export interface ConversationMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  image_url?: string | null;
  rating?: number | null;       // 1 = helpful, -1 = not helpful
  bookmarked?: boolean | null;  // true = pinned / bookmarked
  created_at: string;
}

/** Create or auto-create `conversations` and `conversation_messages` tables via upsert */
export const createConversation = async (userId: string, title: string, grade: string): Promise<Conversation | null> => {
  const { data, error } = await supabase
    .from('conversations')
    .insert({ user_id: userId, title, grade, updated_at: new Date().toISOString() })
    .select()
    .single();

  if (error) { console.error('Error creating conversation:', error); return null; }
  return data as Conversation;
};

export const getConversations = async (userId: string): Promise<Conversation[]> => {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) { console.error('Error fetching conversations:', error); return []; }
  return (data || []) as Conversation[];
};

export const updateConversationTitle = async (id: string, title: string) => {
  const { error } = await supabase
    .from('conversations')
    .update({ title, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) { console.error('Error updating conversation title:', error); throw error; }
};

export const deleteConversation = async (id: string) => {
  // Delete messages first then conversation
  await supabase.from('conversation_messages').delete().eq('conversation_id', id);
  const { error } = await supabase.from('conversations').delete().eq('id', id);
  if (error) { console.error('Error deleting conversation:', error); throw error; }
};

export const touchConversation = async (id: string) => {
  await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', id);
};

export const addMessage = async (
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
  imageUrl?: string | null
): Promise<ConversationMessage | null> => {
  const { data, error } = await supabase
    .from('conversation_messages')
    .insert({ conversation_id: conversationId, role, content, image_url: imageUrl || null })
    .select()
    .single();

  if (error) { console.error('Error adding message:', error); return null; }
  // Also touch the conversation timestamp
  await touchConversation(conversationId);
  return data as ConversationMessage;
};

export const getMessages = async (conversationId: string): Promise<ConversationMessage[]> => {
  const { data, error } = await supabase
    .from('conversation_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) { console.error('Error fetching messages:', error); return []; }
  return (data || []) as ConversationMessage[];
};

// ── Message feedback (rating) ────────────────────────────

/** Set rating on a message: 1 = helpful, -1 = not helpful, null = reset */
export const updateMessageRating = async (messageId: string, rating: number | null) => {
  const { error } = await supabase
    .from('conversation_messages')
    .update({ rating })
    .eq('id', messageId);

  if (error) { console.error('Error updating message rating:', error); throw error; }
};

// ── Bookmarks ────────────────────────────────────────────

/** Toggle the bookmarked flag on a message */
export const toggleMessageBookmark = async (messageId: string, bookmarked: boolean) => {
  const { error } = await supabase
    .from('conversation_messages')
    .update({ bookmarked })
    .eq('id', messageId);

  if (error) { console.error('Error toggling bookmark:', error); throw error; }
};

/** Fetch all bookmarked messages for a user (across all conversations) */
export const getBookmarkedMessages = async (
  userId: string
): Promise<(ConversationMessage & { conversation_title?: string })[]> => {
  // First get the user's conversations
  const { data: convos, error: convosError } = await supabase
    .from('conversations')
    .select('id, title')
    .eq('user_id', userId);

  if (convosError || !convos?.length) return [];

  const convoIds = convos.map((c: any) => c.id);
  const convoMap = Object.fromEntries(convos.map((c: any) => [c.id, c.title]));

  const { data, error } = await supabase
    .from('conversation_messages')
    .select('*')
    .in('conversation_id', convoIds)
    .eq('bookmarked', true)
    .order('created_at', { ascending: false });

  if (error) { console.error('Error fetching bookmarks:', error); return []; }

  return (data || []).map((m: any) => ({
    ...m,
    conversation_title: convoMap[m.conversation_id] || 'Untitled',
  }));
};

// ── Student Work CRUD ────────────────────────────────────

export const uploadStudentWorkFile = async (userId: string, file: File): Promise<string> => {
  const fileExt = file.name.split('.').pop() || 'bin';
  const filePath = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;

  const { error } = await supabase.storage
    .from('student-works')
    .upload(filePath, file, { cacheControl: '3600', upsert: false });

  if (error) throw error;

  const { data } = supabase.storage.from('student-works').getPublicUrl(filePath);
  return data.publicUrl;
};

export const deleteStudentWorkFile = async (imageUrl: string) => {
  try {
    const match = imageUrl.match(/student-works\/(.+)$/);
    if (match) {
      await supabase.storage.from('student-works').remove([decodeURIComponent(match[1])]);
    }
  } catch (e) { console.error('Storage delete error:', e); }
};

export const createStudentWork = async (
  work: Partial<StudentWork> & { image_url: string }
): Promise<StudentWork | null> => {
  const { data, error } = await supabase
    .from('student_works')
    .insert(work)
    .select()
    .single();

  if (error) { console.error('Error creating student work:', error); throw error; }
  return data as StudentWork;
};

export const getStudentWorks = async (teacherId: string): Promise<StudentWork[]> => {
  const { data, error } = await supabase
    .from('student_works')
    .select('*')
    .eq('teacher_id', teacherId)
    .order('created_at', { ascending: false });

  if (error) { console.error('Error fetching student works:', error); return []; }
  return (data || []) as StudentWork[];
};

export const updateStudentWork = async (id: string, updates: Partial<StudentWork>) => {
  const { error } = await supabase
    .from('student_works')
    .update(updates)
    .eq('id', id);

  if (error) { console.error('Error updating student work:', error); throw error; }
};

export const deleteStudentWork = async (id: string) => {
  const { error } = await supabase
    .from('student_works')
    .delete()
    .eq('id', id);

  if (error) { console.error('Error deleting student work:', error); throw error; }
};

/**
 * Get AI analysis results for a student, identified by their access token.
 * Tries the RPC function first (requires migration SQL to be run).
 * Falls back to querying by student_name if the RPC is not available.
 */
export const getStudentWorksByToken = async (
  accessToken: string,
  studentName: string
): Promise<StudentWork[]> => {
  // Try RPC first (requires supabase-student-works-migration.sql to be run)
  const { data: rpcData, error: rpcError } = await supabase
    .rpc('get_works_for_student', { p_access_token: accessToken });

  if (!rpcError && rpcData) {
    return rpcData as StudentWork[];
  }

  // Fallback: query by student_name (works without migration)
  const { data, error } = await supabase
    .from('student_works')
    .select('*')
    .eq('student_name', studentName)
    .order('created_at', { ascending: false });

  if (error) { console.error('Error fetching student works by name:', error); return []; }
  return (data || []) as StudentWork[];
};
