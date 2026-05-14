/**
 * Admin Authentication Service
 * Uses Supabase Auth to authenticate and verifies admin role from profiles table.
 */

import { supabase } from '@/lib/supabase';
import { checkRateLimit, getRateLimitResetSeconds } from '@/lib/rateLimit';
import { AdminSession } from '@/types/admin';

const ADMIN_SESSION_KEY = 'mom_admin_session';
const SESSION_DURATION_HOURS = 8;

const ADMIN_ROLE_VALUES = new Set(['admin', 'super_admin', 'superadmin']);

const normalizeRole = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
};

const isAdminRole = (value: unknown): boolean => {
  const normalized = normalizeRole(value);
  return ADMIN_ROLE_VALUES.has(normalized);
};

const getUserFromAuthState = async () => {
  const userResult = await supabase.auth.getUser();
  if (userResult.data.user) return userResult.data.user;

  const sessionResult = await supabase.auth.getSession();
  return sessionResult.data.session?.user ?? null;
};

const resolveAdminStatus = async (userId: string, fallbackRole?: unknown): Promise<boolean> => {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  if (!profileError && isAdminRole(profile?.role)) {
    return true;
  }

  return isAdminRole(fallbackRole);
};

/**
 * Create and store admin session after successful Supabase auth + role check
 */
export const createAdminSession = (userId: string): AdminSession => {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_HOURS * 60 * 60 * 1000);
  
  const session: AdminSession = {
    isAuthenticated: true,
    loginTime: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    userId,
  };
  
  sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
  return session;
};

/**
 * Get current admin session
 */
export const getAdminSession = (): AdminSession | null => {
  const stored = sessionStorage.getItem(ADMIN_SESSION_KEY);
  if (!stored) return null;
  
  try {
    const session: AdminSession = JSON.parse(stored);
    
    if (new Date(session.expiresAt) < new Date()) {
      clearAdminSession();
      return null;
    }
    
    return session;
  } catch {
    return null;
  }
};

/**
 * Check if admin is authenticated (client-side quick check)
 */
export const isAdminAuthenticated = (): boolean => {
  const session = getAdminSession();
  return session?.isAuthenticated ?? false;
};

/**
 * Verify admin status against Supabase (server-side truth)
 */
export const verifyAdminRole = async (): Promise<boolean> => {
  try {
    const user = await getUserFromAuthState();
    if (!user) return false;

    return resolveAdminStatus(user.id, user.app_metadata?.role ?? user.user_metadata?.role);
  } catch {
    return false;
  }
};

/**
 * Clear admin session (logout)
 */
export const clearAdminSession = (): void => {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
};

/**
 * Admin login — authenticates via Supabase Auth and verifies admin role
 */
export const adminLogin = async (
  email: string, 
  password: string
): Promise<{ success: boolean; error?: string; session?: AdminSession }> => {
  if (!email || !password) {
    return { success: false, error: 'Email and password are required' };
  }

  // Rate limit: max 5 attempts per 5 minutes
  if (!checkRateLimit('admin-login', 5, 5 * 60 * 1000)) {
    const resetSec = getRateLimitResetSeconds('admin-login', 5 * 60 * 1000);
    return { success: false, error: `Too many login attempts. Try again in ${resetSec} seconds.` };
  }

  // Authenticate with Supabase
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: email.toLowerCase().trim(),
    password,
  });

  if (authError || !authData.user) {
    return { success: false, error: authError?.message || 'Invalid credentials' };
  }

  // Verify the user has admin role in profiles table
  const hasAdminAccess = await resolveAdminStatus(
    authData.user.id,
    authData.user.app_metadata?.role ?? authData.user.user_metadata?.role,
  );

  if (!hasAdminAccess) {
    // Sign out the non-admin user
    await supabase.auth.signOut();
    return { success: false, error: 'Access denied. Admin privileges required.' };
  }

  const session = createAdminSession(authData.user.id);
  return { success: true, session };
};

/**
 * Admin logout — clears both local session and Supabase session
 */
export const adminLogout = async (): Promise<void> => {
  clearAdminSession();
  await supabase.auth.signOut();
};
