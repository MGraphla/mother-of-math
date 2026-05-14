/**
 * Monitor Auth — lightweight shared-password gate for the read-only
 * implementing-partner monitoring dashboard.
 *
 * Why not full Supabase auth?
 *   The monitor view is intentionally read-only and is given to outside
 *   partners (NGO / funder / implementer) who should never have a row in the
 *   `profiles` table or any Supabase user account. We therefore gate the UI
 *   with a shared password configured at build time via
 *   `VITE_MONITOR_PASSWORD`. All data queries use the anon key + the existing
 *   SECURITY DEFINER RPC functions, so no extra write capability is granted.
 */

const SESSION_KEY = 'mom_monitor_session_v1';
const SESSION_HOURS = 12;

// Default fallback so partners can be onboarded immediately even if the
// env var has not been set yet. The expectation is that the project owner
// rotates `VITE_MONITOR_PASSWORD` before sharing the URL.
const DEFAULT_PASSWORD = 'mom-monitor-2026';

export interface MonitorSession {
  loginAt: string;
  expiresAt: string;
  partnerLabel?: string;
}

const getConfiguredPassword = (): string => {
  const fromEnv = import.meta.env.VITE_MONITOR_PASSWORD as string | undefined;
  return (fromEnv && fromEnv.trim()) || DEFAULT_PASSWORD;
};

export const getMonitorSession = (): MonitorSession | null => {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MonitorSession;
    if (new Date(parsed.expiresAt) < new Date()) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const isMonitorAuthenticated = (): boolean => !!getMonitorSession();

export const monitorLogin = (
  password: string,
  partnerLabel?: string
): { success: boolean; error?: string } => {
  if (!password) return { success: false, error: 'Access code required.' };
  const expected = getConfiguredPassword();
  if (password.trim() !== expected) {
    return { success: false, error: 'Invalid access code.' };
  }
  const now = new Date();
  const session: MonitorSession = {
    loginAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + SESSION_HOURS * 60 * 60 * 1000).toISOString(),
    partnerLabel: partnerLabel?.trim() || 'Implementing Partner',
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return { success: true };
};

export const monitorLogout = (): void => {
  sessionStorage.removeItem(SESSION_KEY);
};
