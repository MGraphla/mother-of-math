import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { EmailOtpType, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { getPostAuthPath, useAuth } from '@/context/AuthContext';
import { toAuthError } from '@/lib/authErrors';
import { AuthLayout, AuthStatus, PrimaryButton, SecondaryButton } from '@/components/auth/AuthUI';
import { useAuthCopy } from './authCopy';

const APP_DEEP_LINK = 'motherofmath://auth/callback';
const EMAIL_OTP_TYPES: EmailOtpType[] = ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email'];

type Outcome =
  | { kind: 'working' }
  | { kind: 'app' }
  | { kind: 'verified' }
  | { kind: 'expired'; recovery: boolean }
  | { kind: 'error'; message: string };

/** A single-use code must only be exchanged once, even under React StrictMode. */
const handled = new Map<string, Promise<Outcome | { kind: 'session'; session: Session; recovery: boolean }>>();

const isRecoverySession = (session: Session | null): boolean => {
  try {
    const payload = JSON.parse(atob(session!.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return Array.isArray(payload.amr) && payload.amr.some((a: { method?: string }) => a?.method === 'recovery');
  } catch {
    return false;
  }
};

async function processUrl(href: string) {
  const url = new URL(href);
  const q = url.searchParams;
  const h = new URLSearchParams(url.hash.slice(1));
  const isConfirmLink = url.pathname.startsWith('/auth/confirm');

  // Mobile Google sign-in bounces through this page; the app holds the PKCE verifier.
  if (q.get('app') === 'motherofmath' || q.get('mobile_app') === '1') {
    window.location.replace(`${APP_DEEP_LINK}${url.search}${url.hash}`);
    return { kind: 'app' } as Outcome;
  }

  const errorCode = q.get('error_code') || h.get('error_code');
  const errorText = q.get('error_description') || h.get('error_description') || q.get('error') || h.get('error');
  if (errorText) {
    if (errorCode === 'otp_expired' || /expired|invalid/i.test(errorText)) {
      return { kind: 'expired', recovery: (q.get('type') || h.get('type')) === 'recovery' } as Outcome;
    }
    return { kind: 'error', message: errorText.replace(/\+/g, ' ') } as Outcome;
  }

  // Email links built from our templates: /auth/confirm?token_hash=…&type=…
  const tokenHash = q.get('token_hash');
  const type = q.get('type') as EmailOtpType | null;
  if (tokenHash && type && EMAIL_OTP_TYPES.includes(type)) {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error || !data.session) return { kind: 'expired', recovery: type === 'recovery' } as Outcome;
    return { kind: 'session', session: data.session, recovery: type === 'recovery' } as const;
  }

  // OAuth (and default-template email links): ?code=…
  const code = q.get('code');
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.session) {
      // The email was already confirmed by Supabase before redirecting here;
      // the code only fails when opened in a different browser than sign-up.
      if (isConfirmLink) return { kind: 'verified' } as Outcome;
      return { kind: 'error', message: toAuthError(error, 'Sign-in could not be completed.').message } as Outcome;
    }
    return { kind: 'session', session: data.session, recovery: isRecoverySession(data.session) } as const;
  }

  // Implicit-flow links (mobile-originated emails): #access_token=…&refresh_token=…
  const accessToken = h.get('access_token');
  const refreshToken = h.get('refresh_token');
  if (accessToken && refreshToken) {
    const { data, error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (error || !data.session) return { kind: 'expired', recovery: h.get('type') === 'recovery' } as Outcome;
    return { kind: 'session', session: data.session, recovery: h.get('type') === 'recovery' } as const;
  }

  const { data } = await supabase.auth.getSession();
  if (data.session) return { kind: 'session', session: data.session, recovery: false } as const;
  return { kind: 'error', message: '' } as Outcome;
}

const AuthCallback = () => {
  const c = useAuthCopy();
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'working' });

  useEffect(() => {
    let active = true;
    const href = window.location.href;
    if (!handled.has(href)) handled.set(href, processUrl(href));

    void handled.get(href)!.then(async (result) => {
      if (!active) return;
      if (result.kind !== 'session') {
        if (result.kind === 'error' && !result.message) {
          navigate('/sign-in', { replace: true });
          return;
        }
        setOutcome(result);
        return;
      }
      window.history.replaceState({}, document.title, window.location.pathname);
      if (result.recovery) {
        navigate('/reset-password', { replace: true });
        return;
      }
      const profile = await refreshProfile();
      if (active) navigate(getPostAuthPath(result.session.user, profile), { replace: true });
    });

    return () => {
      active = false;
    };
  }, [navigate, refreshProfile]);

  switch (outcome.kind) {
    case 'working':
      return <AuthStatus title={c.signingYouIn} />;
    case 'app':
      return <AuthStatus title={c.openingApp} subtitle={c.appNotOpened} />;
    case 'verified':
      return (
        <AuthLayout title={c.emailVerifiedTitle} subtitle={c.emailVerifiedSub}>
          <PrimaryButton type="button" onClick={() => navigate('/sign-in', { replace: true })}>
            {c.signIn}
          </PrimaryButton>
        </AuthLayout>
      );
    case 'expired':
      // Sign-in offers "send me a code" for unverified accounts; resets restart at /forgot-password.
      return (
        <AuthLayout title={c.linkExpiredTitle} subtitle={outcome.recovery ? c.linkExpiredSub : c.linkExpiredSignInSub}>
          <div className="space-y-3">
            <PrimaryButton
              type="button"
              onClick={() => navigate(outcome.recovery ? '/forgot-password' : '/sign-in', { replace: true })}
            >
              {outcome.recovery ? c.getNewCode : c.signIn}
            </PrimaryButton>
            {outcome.recovery ? (
              <SecondaryButton onClick={() => navigate('/sign-in', { replace: true })}>{c.backToSignIn}</SecondaryButton>
            ) : null}
          </div>
        </AuthLayout>
      );
    case 'error':
      return (
        <AuthLayout title={c.signInFailed} subtitle={outcome.message}>
          <PrimaryButton type="button" onClick={() => navigate('/sign-in', { replace: true })}>
            {c.backToSignIn}
          </PrimaryButton>
        </AuthLayout>
      );
  }
};

export default AuthCallback;
