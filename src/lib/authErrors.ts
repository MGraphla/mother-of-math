/** Turns Supabase / network errors into short, human messages for the auth screens. */

export class AuthFlowError extends Error {
  /** Machine-readable reason the UI can branch on. */
  code: 'email_not_confirmed' | 'already_registered' | 'not_registered' | 'network' | 'other';

  constructor(message: string, code: AuthFlowError['code'] = 'other') {
    super(message);
    this.name = 'AuthFlowError';
    this.code = code;
  }
}

const rules: Array<[RegExp, string, AuthFlowError['code']?]> = [
  [/invalid login credentials|invalid_grant/i, 'Wrong email or password.'],
  [/email not confirmed/i, 'Verify your email to continue.', 'email_not_confirmed'],
  [/already (registered|exists)|user already/i, 'This email is already registered. Sign in instead.', 'already_registered'],
  [/(token|otp).*(expired|invalid)|expired.*(token|otp|code)|invalid.*code/i, 'That code is wrong or has expired.'],
  [/rate limit|too many|security purposes|only request this/i, 'Too many attempts. Wait a minute and try again.'],
  [/password.*(weak|short|at least)|should be at least/i, 'Use a stronger password (at least 8 characters).'],
  [/same.*password|new password should be different/i, 'Choose a password you have not used before.'],
  [/failed to fetch|network|load failed|fetch failed|timed? ?out/i, 'No connection. Check your internet and try again.', 'network'],
];

export function toAuthError(err: unknown, fallback = 'Something went wrong. Please try again.'): AuthFlowError {
  if (err instanceof AuthFlowError) return err;
  const raw = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  for (const [re, message, code] of rules) {
    if (re.test(raw)) return new AuthFlowError(message, code);
  }
  // Server messages from our Edge Function are already written for people.
  return new AuthFlowError(raw && raw.length < 160 ? raw : fallback);
}

export const authErrorMessage = (err: unknown, fallback?: string) => toAuthError(err, fallback).message;
