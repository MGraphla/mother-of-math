/**
 * Monitor Auth — lightweight shared-password gate for the read-only
 * implementing-partner monitoring dashboard.
 *
 * Why not full Supabase auth?
 *   The monitor view is intentionally read-only and is given to outside
 *   partners (NGO / funder / implementer) who should never have a row in the
 *   `profiles` table or any Supabase user account. We therefore gate the UI
 *   with a shared password configured at build time via
 *   `VITE_MONITOR_EMAIL` and `VITE_MONITOR_PASSWORD`. All data queries use the
 *   anon key + the existing SECURITY DEFINER RPC functions, so no extra write
 *   capability is granted.
 */

const SESSION_KEY = 'mom_monitor_session_v1';
const SESSION_HOURS = 12;

/** Default sign-in email when `VITE_MONITOR_EMAIL` is unset (override in production). */
const DEFAULT_EMAIL = 'Enquiries@qeda.ng';

/** Default password when `VITE_MONITOR_PASSWORD` is unset (override in production). */
const DEFAULT_PASSWORD = 'qeda@@@br68iHb';

export interface MonitorSession {
  loginAt: string;
  expiresAt: string;
  partnerLabel?: string;
}

const getConfiguredPassword = (): string => {
  const fromEnv = import.meta.env.VITE_MONITOR_PASSWORD as string | undefined;
  return (fromEnv && fromEnv.trim()) || DEFAULT_PASSWORD;
};

const getConfiguredEmail = (): string => {
  const fromEnv = import.meta.env.VITE_MONITOR_EMAIL as string | undefined;
  return (fromEnv && fromEnv.trim()) || DEFAULT_EMAIL;
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
  email: string
): { success: boolean; error?: string } => {
  const em = email.trim();
  const pw = password.trim();
  if (!em || !pw) return { success: false, error: 'Email and password are required.' };

  const expectedEmail = getConfiguredEmail().toLowerCase();
  const expectedPassword = getConfiguredPassword();
  if (em.toLowerCase() !== expectedEmail || pw !== expectedPassword) {
    return { success: false, error: 'Invalid email or password.' };
  }

  const now = new Date();
  const session: MonitorSession = {
    loginAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + SESSION_HOURS * 60 * 60 * 1000).toISOString(),
    partnerLabel: em,
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return { success: true };
};

export const monitorLogout = (): void => {
  sessionStorage.removeItem(SESSION_KEY);
};
