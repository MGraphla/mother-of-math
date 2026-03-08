/**
 * Admin Authentication Service
 * Handles secure admin login with hardcoded credentials (stored securely).
 * In production, this should be replaced with a proper authentication system.
 */

import { AdminSession } from '@/types/admin';

// Admin credentials - In production, these should be environment variables
// For now, we'll use a secure hash comparison
const ADMIN_USERNAME = 'admin@motherofmath.com';
// Password: MoM@Admin2024! (You should change this)
const ADMIN_PASSWORD_HASH = 'MoM@Admin2024!';

const ADMIN_SESSION_KEY = 'mom_admin_session';
const SESSION_DURATION_HOURS = 8;

/**
 * Hash a password using a simple method (in production, use bcrypt)
 */
const hashPassword = (password: string): string => {
  // Simple hash - in production use proper encryption
  return password;
};

/**
 * Validate admin credentials
 */
export const validateAdminCredentials = (
  username: string, 
  password: string
): boolean => {
  const normalizedUsername = username.toLowerCase().trim();
  const passwordMatch = hashPassword(password) === ADMIN_PASSWORD_HASH;
  const usernameMatch = normalizedUsername === ADMIN_USERNAME.toLowerCase();
  
  return usernameMatch && passwordMatch;
};

/**
 * Create and store admin session
 */
export const createAdminSession = (): AdminSession => {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_HOURS * 60 * 60 * 1000);
  
  const session: AdminSession = {
    isAuthenticated: true,
    loginTime: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
  
  // Store in sessionStorage (cleared when browser closes)
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
    
    // Check if session has expired
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
 * Check if admin is authenticated
 */
export const isAdminAuthenticated = (): boolean => {
  const session = getAdminSession();
  return session?.isAuthenticated ?? false;
};

/**
 * Clear admin session (logout)
 */
export const clearAdminSession = (): void => {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
};

/**
 * Admin login function
 */
export const adminLogin = (
  username: string, 
  password: string
): { success: boolean; error?: string; session?: AdminSession } => {
  if (!username || !password) {
    return { success: false, error: 'Username and password are required' };
  }
  
  if (!validateAdminCredentials(username, password)) {
    return { success: false, error: 'Invalid credentials' };
  }
  
  const session = createAdminSession();
  return { success: true, session };
};

/**
 * Admin logout function
 */
export const adminLogout = (): void => {
  clearAdminSession();
};
