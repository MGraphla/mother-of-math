import { createClient } from "@supabase/supabase-js";

export const createSupabaseClient = (
  supabaseUrl: string,
  supabaseAnonKey: string,
  extraConfig: Record<string, unknown> = {},
) => {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase credentials.");
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
    ...extraConfig,
  });
};
