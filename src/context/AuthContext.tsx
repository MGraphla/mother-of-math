import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, ensureProfile, upsertUserProfile } from '@/lib/supabase';
import type { UserProfile } from '@/lib/supabase';
import { AuthFlowError, toAuthError } from '@/lib/authErrors';
import { invokeSignupVerification } from '@/services/signupVerification';

export type { UserProfile };

export type VerificationChannel = 'email' | 'sms';

/** Everything the sign-up form collects; `role` is limited to self-service roles. */
export type SignUpInput = Partial<Omit<UserProfile, 'id' | 'email' | 'role'>> & {
  email: string;
  password: string;
  full_name: string;
  role: 'teacher' | 'parent';
  country: string;
  phone_number: string;
};

/** What the verify screen needs to resume after a refresh (never the password). */
export interface PendingVerification {
  email: string;
  channel: VerificationChannel;
  maskedPhone?: string;
}

const PENDING_KEY = 'mm_pending_verification';

export const readPendingVerification = (): PendingVerification | null => {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as PendingVerification) : null;
  } catch {
    return null;
  }
};

const writePendingVerification = (p: PendingVerification | null) => {
  try {
    if (p) sessionStorage.setItem(PENDING_KEY, JSON.stringify(p));
    else sessionStorage.removeItem(PENDING_KEY);
  } catch {
    /* storage unavailable (private mode) — the verify screen falls back to asking */
  }
};

// ── Profile rules (shared by routes and auth pages) ─────────────────────────

export const userHasGoogleIdentity = (user: User | null): boolean =>
  !!user?.identities?.some((i) => i.provider === 'google');

/** Minimum details a teacher/parent needs before using the dashboard. */
export const isProfileComplete = (profile: UserProfile | null): boolean => {
  if (!profile) return false;
  const filled = (v: unknown) => v !== null && v !== undefined && String(v).trim() !== '';
  const base = filled(profile.full_name) && filled(profile.country) && filled(profile.phone_number);
  return profile.role === 'teacher' ? base && filled(profile.school_name) : base;
};

/** True when the user must visit /complete-profile before anything else. */
export const needsProfileCompletion = (user: User | null, profile: UserProfile | null): boolean => {
  if (!user) return false;
  if (!profile) return true;
  if (profile.role !== 'teacher' && profile.role !== 'parent') return false;
  return profile.google_extra_profile_completed === false || !isProfileComplete(profile);
};

export const getDashboardPath = (profile: Pick<UserProfile, 'role'> | null): string => {
  switch (profile?.role) {
    case 'admin':
      return '/admin/dashboard';
    case 'student':
      return '/student';
    case 'parent':
      return '/parent-dashboard';
    default:
      return '/dashboard';
  }
};

/** Where to send a signed-in user right after authenticating. */
export const getPostAuthPath = (user: User | null, profile: UserProfile | null): string =>
  needsProfileCompletion(user, profile) ? '/complete-profile' : getDashboardPath(profile);

const signUpMetadata = (input: SignUpInput) => {
  const { email: _e, password: _p, ...profile } = input;
  return Object.fromEntries(
    Object.entries(profile).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  );
};

// ── Context ─────────────────────────────────────────────────────────────────

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<UserProfile | null>;
  signInWithGoogle: () => Promise<void>;
  /** Resolves `null` when no verification is needed (account is already signed in). */
  signUp: (input: SignUpInput, channel: VerificationChannel) => Promise<PendingVerification | null>;
  verifySignupCode: (code: string, password?: string) => Promise<UserProfile | null>;
  resendSignupCode: () => Promise<void>;
  /** Re-sends the email code for an existing, unverified account (e.g. after sign-in said so). */
  startEmailVerification: (email: string) => Promise<void>;
  /** Password given at sign-up, kept in memory only so SMS users can be signed in after the code. */
  hasPendingPassword: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<UserProfile | null>;
  saveProfile: (patch: Partial<UserProfile>) => Promise<UserProfile | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasPendingPassword, setHasPendingPassword] = useState(false);
  const pendingPassword = useRef<string | null>(null);
  const loadedFor = useRef<string | null>(null);

  const user = session?.user ?? null;

  useEffect(() => {
    let active = true;

    const apply = async (next: Session | null) => {
      setSession(next);
      if (!next?.user) {
        loadedFor.current = null;
        setProfile(null);
        setIsLoading(false);
        return;
      }
      // Block route guards only when the signed-in person changes.
      if (loadedFor.current !== next.user.id) setIsLoading(true);
      const p = await ensureProfile(next.user.id);
      if (!active) return;
      loadedFor.current = next.user.id;
      setProfile(p);
      setIsLoading(false);
    };

    void supabase.auth.getSession().then(({ data }) => apply(data.session));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === 'INITIAL_SESSION') return; // handled by getSession above
      if (event === 'TOKEN_REFRESHED') {
        setSession(next);
        return;
      }
      // Never await Supabase calls inside this callback (it deadlocks auth methods).
      setTimeout(() => void apply(next), 0);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const refreshProfile = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const u = data.session?.user;
    if (!u) {
      setProfile(null);
      return null;
    }
    const p = await ensureProfile(u.id);
    loadedFor.current = u.id;
    setProfile(p);
    return p;
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) throw toAuthError(error);
    const p = await ensureProfile(data.user.id);
    loadedFor.current = data.user.id;
    setSession(data.session);
    setProfile(p);
    return p;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) throw toAuthError(error);
  }, []);

  const signUp = useCallback(async (input: SignUpInput, channel: VerificationChannel) => {
    const email = input.email.trim().toLowerCase();
    const metadata = signUpMetadata(input);

    try {
      if (channel === 'sms') {
        const res = await invokeSignupVerification({
          action: 'start',
          email,
          password: input.password,
          channel: 'sms',
          country: input.country,
          destination: input.phone_number,
          profile: metadata,
        });
        const pending: PendingVerification = {
          email,
          channel: 'sms',
          maskedPhone: String(res.masked_phone ?? ''),
        };
        pendingPassword.current = input.password;
        setHasPendingPassword(true);
        writePendingVerification(pending);
        return pending;
      }

      await invokeSignupVerification({
        action: 'check_signup_availability',
        email,
        country: input.country,
        phone_number: input.phone_number,
      });

      const { data, error } = await supabase.auth.signUp({
        email,
        password: input.password,
        options: { emailRedirectTo: `${window.location.origin}/auth/confirm`, data: metadata },
      });
      if (error) throw error;
      if (data.user && data.user.identities?.length === 0) {
        throw new AuthFlowError('This email is already registered. Sign in instead.', 'already_registered');
      }
      if (data.session) {
        // Email confirmation is switched off in Supabase — already signed in.
        writePendingVerification(null);
        return null;
      }

      const pending: PendingVerification = { email, channel: 'email' };
      writePendingVerification(pending);
      return pending;
    } catch (e) {
      throw toAuthError(e, 'Could not create your account. Please try again.');
    }
  }, []);

  const verifySignupCode = useCallback(async (code: string, password?: string) => {
    const pending = readPendingVerification();
    if (!pending) throw new AuthFlowError('Your sign-up session has ended. Please start again.');
    const token = code.replace(/\D/g, '');

    try {
      let signedIn: User | null = null;
      if (pending.channel === 'email') {
        const { data, error } = await supabase.auth.verifyOtp({ email: pending.email, token, type: 'signup' });
        if (error) throw error;
        signedIn = data.user;
      } else {
        const pw = password || pendingPassword.current;
        if (!pw) throw new AuthFlowError('Enter your password to finish.');
        await invokeSignupVerification({ action: 'verify', email: pending.email, code: token });
        const { data, error } = await supabase.auth.signInWithPassword({ email: pending.email, password: pw });
        if (error) throw error;
        signedIn = data.user;
      }

      writePendingVerification(null);
      pendingPassword.current = null;
      setHasPendingPassword(false);

      if (!signedIn) return null;
      const p = await ensureProfile(signedIn.id);
      loadedFor.current = signedIn.id;
      setProfile(p);
      return p;
    } catch (e) {
      throw toAuthError(e, 'That code did not work. Please try again.');
    }
  }, []);

  const resendSignupCode = useCallback(async () => {
    const pending = readPendingVerification();
    if (!pending) throw new AuthFlowError('Your sign-up session has ended. Please start again.');
    try {
      if (pending.channel === 'email') {
        const { error } = await supabase.auth.resend({
          type: 'signup',
          email: pending.email,
          options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
        });
        if (error) throw error;
      } else {
        await invokeSignupVerification({ action: 'resend', email: pending.email });
      }
    } catch (e) {
      throw toAuthError(e, 'Could not send a new code.');
    }
  }, []);

  const startEmailVerification = useCallback(async (email: string) => {
    const clean = email.trim().toLowerCase();
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: clean,
      options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
    });
    if (error) throw toAuthError(error);
    writePendingVerification({ email: clean, channel: 'email' });
  }, []);

  const signOut = useCallback(async () => {
    // Clear local state even if the network call fails.
    await supabase.auth.signOut().catch(() => supabase.auth.signOut({ scope: 'local' }));
    loadedFor.current = null;
    setSession(null);
    setProfile(null);
  }, []);

  const saveProfile = useCallback(
    async (patch: Partial<UserProfile>) => {
      const { data } = await supabase.auth.getUser();
      const u = data.user;
      if (!u) throw new AuthFlowError('Please sign in again.');
      try {
        await upsertUserProfile({ ...patch, id: u.id, email: u.email ?? '' });
      } catch (e) {
        throw toAuthError(e, 'Could not save your details.');
      }
      return refreshProfile();
    },
    [refreshProfile],
  );

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      session,
      profile,
      isLoading,
      isAuthenticated: !isLoading && !!user,
      signIn,
      signInWithGoogle,
      signUp,
      verifySignupCode,
      resendSignupCode,
      startEmailVerification,
      hasPendingPassword,
      signOut,
      refreshProfile,
      saveProfile,
    }),
    [
      user, session, profile, isLoading, hasPendingPassword, signIn, signInWithGoogle, signUp,
      verifySignupCode, resendSignupCode, startEmailVerification, signOut, refreshProfile, saveProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
