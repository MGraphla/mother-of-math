import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase, getUserProfile, upsertUserProfile, isPasswordRecoveryAccessToken } from '@/lib/supabase';
import type { UserProfile } from '@/lib/supabase';
import type { User, Session } from '@supabase/supabase-js';
import { signupVerificationRequest, type SignupPhoneChannel } from '@/services/signupVerification';

export type { SignupPhoneChannel };

export type { UserProfile };

/** Fields we consider required for a "complete" profile */
const REQUIRED_PROFILE_FIELDS: (keyof UserProfile)[] = [
  'full_name',
  'role',
  'country',
  'school_name',
  'phone_number',
];

export const isProfileComplete = (profile: UserProfile | null): boolean => {
  if (!profile) return false;
  return REQUIRED_PROFILE_FIELDS.every((f) => {
    const v = profile[f];
    return v !== null && v !== undefined && v !== '';
  });
};

/** True if this auth user signed in with Google (OAuth identity linked). */
export const userHasGoogleIdentity = (user: User | null): boolean => {
  if (!user?.identities?.length) return false;
  return user.identities.some((i) => i.provider === 'google');
};

/**
 * Google users must visit Complete Profile once while this flag is false.
 * Email/password users never need that page (flag stays true from signup).
 */
export const needsGoogleExtraProfile = (user: User | null, profile: UserProfile | null): boolean => {
  if (!user || !userHasGoogleIdentity(user)) return false;
  if (profile?.role === 'student') return false;
  // No row yet (slow trigger / stalled fetch): still send Google users to the wizard.
  if (!profile) return true;
  return profile.google_extra_profile_completed === false;
};

/**
 * New Google users get default true in DB but incomplete required fields — flip to false once
 * so they are routed to Complete Profile. No-op for email users or already-finished Google users.
 */
export const syncGoogleOnboardingFlag = async (
  user: User,
  profile: UserProfile | null,
): Promise<UserProfile | null> => {
  if (!profile || profile.role === 'student') return profile;
  if (!userHasGoogleIdentity(user)) return profile;
  if (profile.google_extra_profile_completed === false) return profile;
  if (!isProfileComplete(profile)) {
    try {
      await upsertUserProfile({ id: user.id, google_extra_profile_completed: false });
      return { ...profile, google_extra_profile_completed: false };
    } catch (e) {
      console.warn('syncGoogleOnboardingFlag:', e);
      return profile;
    }
  }
  return profile;
};

// Define the shape of the context
interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signUp: (email: string, password: string, profileData: Partial<UserProfile>) => Promise<void>;
  signUpWithPhoneVerification: (
    email: string,
    password: string,
    profileData: Partial<UserProfile>,
    channel: SignupPhoneChannel,
    destinationRaw: string,
    country: string,
  ) => Promise<void>;
  verifyOtp: (email: string, token: string) => Promise<void>;
  verifySignupPhoneOtp: (email: string, token: string, password: string) => Promise<void>;
  resendOtp: (email: string) => Promise<void>;
  resendSignupPhoneOtp: (
    email: string,
    channel: SignupPhoneChannel,
    destinationRaw: string,
    country: string,
  ) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch profile helper
  const fetchProfile = async (userId: string) => {
    try {
      let p = await getUserProfile(userId);
      const { data: { user: u } } = await supabase.auth.getUser();
      if (u?.id === userId && p) {
        p = await syncGoogleOnboardingFlag(u, p);
      }
      setProfile(p);
    } catch (e) {
      console.error('Error fetching profile:', e);
    }
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        fetchProfile(s.user.id).finally(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
    });

    // Listen for auth changes — NEVER block the callback with awaits,
    // because the Supabase client waits for onAuthStateChange to finish
    // before resolving auth methods like verifyOtp.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, s) => {
        setSession(s);
        setUser(s?.user ?? null);
        
        const recoveryJwt =
          s?.access_token && isPasswordRecoveryAccessToken(s.access_token);
        // Also check URL hash for recovery type (implicit flow / some Supabase versions)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const hashType = hashParams.get('type');
        const isRecovery =
          _event === 'PASSWORD_RECOVERY' ||
          hashType === 'recovery' ||
          (_event === 'SIGNED_IN' && localStorage.getItem('is_password_recovery') === 'true') ||
          (_event === 'SIGNED_IN' && recoveryJwt) ||
          (_event === 'INITIAL_SESSION' && recoveryJwt) ||
          (_event === 'INITIAL_SESSION' && localStorage.getItem('is_password_recovery') === 'true');

        if (isRecovery) {
          // Keep the flag set briefly so ResetPassword page can detect it,
          // then clear it after a short delay.
          if (!window.location.pathname.startsWith('/reset-password')) {
            // Use window.location.href instead of replace to ensure PWA/mobile
            // browsers handle the navigation correctly.
            window.location.href = '/reset-password';
          } else {
            // Already on reset-password page — just clear the flag
            localStorage.removeItem('is_password_recovery');
          }
          return;
        }

        if (s?.user) {
          // Fire-and-forget — don't block the auth state change
          fetchProfile(s.user.id)
            .catch((e) => console.error('Profile fetch in onAuthStateChange failed:', e))
            .finally(() => setIsLoading(false));
        } else {
          setProfile(null);
          setIsLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  /** After Supabase confirms the user (email OTP or phone flow + sign-in), ensure `profiles` row exists. */
  const scheduleProfileFromPending = (verifiedUser: User, emailFallback: string) => {
    setTimeout(async () => {
      try {
        let existingProfile = await getUserProfile(verifiedUser.id);
        if (!existingProfile) {
          console.log('No profile found — creating from saved data');
          const pendingRaw = sessionStorage.getItem('pending_profile');
          const meta = verifiedUser.user_metadata ?? {};
          const parsed = pendingRaw ? JSON.parse(pendingRaw) : {};

          const profilePayload: Partial<UserProfile> & { id: string } = {
            id: verifiedUser.id,
            email: verifiedUser.email ?? emailFallback,
            full_name: parsed.full_name ?? meta.full_name ?? '',
            role: parsed.role ?? meta.role ?? 'teacher',
            gender: parsed.gender ?? meta.gender ?? null,
            country: parsed.country ?? meta.country ?? null,
            city: parsed.city ?? meta.city ?? null,
            school_name: parsed.school_name ?? meta.school_name ?? null,
            school_address: parsed.school_address ?? meta.school_address ?? null,
            school_type: parsed.school_type ?? meta.school_type ?? null,
            number_of_students: parsed.number_of_students ?? meta.number_of_students ?? null,
            subjects_taught: parsed.subjects_taught ?? meta.subjects_taught ?? null,
            grade_levels: parsed.grade_levels ?? meta.grade_levels ?? null,
            years_of_experience: parsed.years_of_experience ?? meta.years_of_experience ?? null,
            education_level: parsed.education_level ?? meta.education_level ?? null,
            phone_number: parsed.phone_number ?? meta.phone_number ?? null,
            whatsapp_number: parsed.whatsapp_number ?? meta.whatsapp_number ?? null,
            bio: parsed.bio ?? meta.bio ?? null,
            date_of_birth: parsed.date_of_birth ?? meta.date_of_birth ?? null,
            avatar_url: null,
            preferred_language: parsed.preferred_language ?? meta.preferred_language ?? null,
            managed_student_ids: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            google_extra_profile_completed: true,
          };

          // Try full upsert first; if it fails (e.g. missing column), retry with core fields only.
          try {
            await upsertUserProfile(profilePayload);
          } catch (firstErr) {
            console.warn('Full profile upsert failed, retrying with core fields:', firstErr);
            await upsertUserProfile({
              id: profilePayload.id,
              email: profilePayload.email,
              full_name: profilePayload.full_name,
              role: profilePayload.role,
              country: profilePayload.country,
              school_name: profilePayload.school_name,
              phone_number: profilePayload.phone_number,
              created_at: profilePayload.created_at,
              updated_at: profilePayload.updated_at,
              google_extra_profile_completed: true,
            } as Partial<UserProfile> & { id: string });
          }

          existingProfile = await getUserProfile(verifiedUser.id);
          console.log('Profile created successfully after verification');
        }
        sessionStorage.removeItem('pending_profile');
        setProfile(existingProfile);
      } catch (e) {
        console.error('Background profile creation failed:', e);
      }
    }, 2000);
  };

  /** Same as scheduleProfileFromPending but awaitable — used by phone verify so profile exists before navigation. */
  const createProfileFromPending = async (verifiedUser: User, emailFallback: string) => {
    try {
      let existingProfile = await getUserProfile(verifiedUser.id);
      if (!existingProfile) {
        const pendingRaw = sessionStorage.getItem('pending_profile');
        const meta = verifiedUser.user_metadata ?? {};
        const parsed = pendingRaw ? JSON.parse(pendingRaw) : {};

        const profilePayload: Partial<UserProfile> & { id: string } = {
          id: verifiedUser.id,
          email: verifiedUser.email ?? emailFallback,
          full_name: parsed.full_name ?? meta.full_name ?? '',
          role: parsed.role ?? meta.role ?? 'teacher',
          gender: parsed.gender ?? meta.gender ?? null,
          country: parsed.country ?? meta.country ?? null,
          city: parsed.city ?? meta.city ?? null,
          school_name: parsed.school_name ?? meta.school_name ?? null,
          school_address: parsed.school_address ?? meta.school_address ?? null,
          school_type: parsed.school_type ?? meta.school_type ?? null,
          number_of_students: parsed.number_of_students ?? meta.number_of_students ?? null,
          subjects_taught: parsed.subjects_taught ?? meta.subjects_taught ?? null,
          grade_levels: parsed.grade_levels ?? meta.grade_levels ?? null,
          years_of_experience: parsed.years_of_experience ?? meta.years_of_experience ?? null,
          education_level: parsed.education_level ?? meta.education_level ?? null,
          phone_number: parsed.phone_number ?? meta.phone_number ?? null,
          whatsapp_number: parsed.whatsapp_number ?? meta.whatsapp_number ?? null,
          bio: parsed.bio ?? meta.bio ?? null,
          date_of_birth: parsed.date_of_birth ?? meta.date_of_birth ?? null,
          avatar_url: null,
          preferred_language: parsed.preferred_language ?? meta.preferred_language ?? null,
          managed_student_ids: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          google_extra_profile_completed: true,
        };

        try {
          await upsertUserProfile(profilePayload);
        } catch {
          await upsertUserProfile({
            id: profilePayload.id,
            email: profilePayload.email,
            full_name: profilePayload.full_name,
            role: profilePayload.role,
            country: profilePayload.country,
            school_name: profilePayload.school_name,
            phone_number: profilePayload.phone_number,
            created_at: profilePayload.created_at,
            updated_at: profilePayload.updated_at,
            google_extra_profile_completed: true,
          } as Partial<UserProfile> & { id: string });
        }

        existingProfile = await getUserProfile(verifiedUser.id);
      }
      sessionStorage.removeItem('pending_profile');
      setProfile(existingProfile);
    } catch (e) {
      console.error('Profile creation failed:', e);
    }
  };

  const signUp = async (email: string, password: string, profileData: Partial<UserProfile>) => {
    await signupVerificationRequest({
      action: 'check_signup_availability',
      email,
      country: profileData.country ?? 'Cameroon',
      phone_number: profileData.phone_number ?? '',
      whatsapp_number: profileData.whatsapp_number ?? '',
    });

    // Pass ALL profile data through user_metadata so the Postgres trigger
    // can create the profiles row automatically (bypasses RLS).
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/verify-email`,
        data: {
          full_name: profileData.full_name ?? '',
          role: profileData.role ?? 'teacher',
          gender: profileData.gender ?? null,
          country: profileData.country ?? null,
          city: profileData.city ?? null,
          school_name: profileData.school_name ?? null,
          school_address: profileData.school_address ?? null,
          school_type: profileData.school_type ?? null,
          number_of_students: profileData.number_of_students ?? null,
          number_of_classes: profileData.number_of_classes ?? null,
          subjects_taught: profileData.subjects_taught ?? null,
          grade_levels: profileData.grade_levels ?? null,
          years_of_experience: profileData.years_of_experience ?? null,
          education_level: profileData.education_level ?? null,
          phone_number: profileData.phone_number ?? null,
          whatsapp_number: profileData.whatsapp_number ?? null,
          bio: profileData.bio ?? null,
          date_of_birth: profileData.date_of_birth ?? null,
          preferred_language: profileData.preferred_language ?? null,
        },
      },
    });

    if (error) {
      const msg = (error.message ?? '').toLowerCase();
      if (
        msg.includes('already') ||
        msg.includes('registered') ||
        msg.includes('exists') ||
        msg.includes('duplicate')
      ) {
        throw new Error('This email is already registered. Please sign in instead.');
      }
      throw new Error(error.message);
    }

    // Detect duplicate / already-registered email.
    // Supabase returns a fake user with empty identities to prevent email enumeration.
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      throw new Error('This email is already registered. Please sign in instead.');
    }

    // Store profile data in sessionStorage so we can create the profile
    // after email verification (in case the Postgres trigger doesn't exist).
    sessionStorage.setItem(
      'pending_profile',
      JSON.stringify({ email, ...profileData })
    );

    // If the session is already available (email confirmation disabled), also
    // upsert the profile immediately so the dashboard is populated.
    if (data.session && data.user) {
      try {
        await upsertUserProfile({
          id: data.user.id,
          email,
          ...profileData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          google_extra_profile_completed: true,
        } as UserProfile);
        await fetchProfile(data.user.id);
      } catch (e) {
        console.log('Profile upsert fallback skipped (trigger handled it):', e);
      }
    }
  };

  /**
   * Sign up with SMS or WhatsApp verification (Infobip). Creates an unconfirmed auth user server-side
   * and sends a one-time code — avoids Supabase sending a duplicate confirmation email.
   */
  const signUpWithPhoneVerification = async (
    email: string,
    password: string,
    profileData: Partial<UserProfile>,
    channel: SignupPhoneChannel,
    destinationRaw: string,
    country: string,
  ) => {
    await signupVerificationRequest({
      action: 'start',
      email,
      password,
      channel,
      country,
      destination: destinationRaw,
      profile: {
        full_name: profileData.full_name ?? '',
        role: profileData.role ?? 'teacher',
        gender: profileData.gender ?? null,
        country: profileData.country ?? null,
        city: profileData.city ?? null,
        school_name: profileData.school_name ?? null,
        school_address: profileData.school_address ?? null,
        school_type: profileData.school_type ?? null,
        number_of_students: profileData.number_of_students ?? null,
        number_of_classes: profileData.number_of_classes ?? null,
        subjects_taught: profileData.subjects_taught ?? null,
        grade_levels: profileData.grade_levels ?? null,
        years_of_experience: profileData.years_of_experience ?? null,
        education_level: profileData.education_level ?? null,
        phone_number: profileData.phone_number ?? null,
        whatsapp_number: profileData.whatsapp_number ?? null,
        bio: profileData.bio ?? null,
        date_of_birth: profileData.date_of_birth ?? null,
        preferred_language: profileData.preferred_language ?? null,
      },
    });

    sessionStorage.setItem(
      'pending_profile',
      JSON.stringify({ email, ...profileData }),
    );
  };

  /** Verify an email OTP code (any length) */
  const verifyOtp = async (email: string, token: string) => {
    // Race the actual Supabase call against a timeout.
    // If the call hangs (known Supabase JS client issue), we check
    // whether a session was actually established.
    const TIMEOUT_MS = 12_000;
    let result: any = null;
    let timedOut = false;

    try {
      result = await Promise.race([
        supabase.auth.verifyOtp({ email, token, type: 'signup' }),
        new Promise((_, reject) =>
          setTimeout(() => {
            timedOut = true;
            reject(new Error('__timeout__'));
          }, TIMEOUT_MS)
        ),
      ]);
    } catch (err: any) {
      if (err.message !== '__timeout__') throw err;

      // The call timed out — but the OTP might have actually verified.
      // Check if Supabase set a session behind the scenes.
      console.warn('verifyOtp call timed out, checking session...');
      const { data: { session: s } } = await supabase.auth.getSession();
      if (s?.user) {
        console.log('Session found after timeout — OTP was actually valid');
        result = { data: { user: s.user, session: s }, error: null };
      } else {
        throw new Error('Verification timed out. Please try again.');
      }
    }

    if (result.error) throw new Error(result.error.message);

    // OTP is verified! Session is set. Profile creation in background.
    const verifiedUser = result.data?.user;
    if (verifiedUser) {
      scheduleProfileFromPending(verifiedUser, email);
    }
  };

  /** Verify phone channel OTP then sign in (password required; same as at sign-up). */
  const verifySignupPhoneOtp = async (email: string, token: string, password: string) => {
    const code = token.replace(/\D/g, '');
    await signupVerificationRequest({ action: 'verify', email, code });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    const {
      data: { session: s },
    } = await supabase.auth.getSession();
    const verifiedUser = s?.user;
    if (verifiedUser) {
      // Create profile synchronously so ProtectedRoute finds it before navigation.
      await createProfileFromPending(verifiedUser, email);
    }
  };

  /** Resend the OTP email */
  const resendOtp = async (email: string) => {
    // Try 'signup' type first
    let { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/verify-email`
      }
    });

    if (error) {
      console.warn('resendOtp signup type failed, trying email_change type:', error.message);
      // Fallback: sometimes 'signup' fails if the user is technically created but not verified
      // try 'email_change' or just simple retry if it was a flake
      const retry = await supabase.auth.resend({
        type: 'signup',
        email,
      });
      error = retry.error;
    }

    if (error) throw new Error(error.message);
  };

  const resendSignupPhoneOtp = async (
    email: string,
    channel: SignupPhoneChannel,
    destinationRaw: string,
    country: string,
  ) => {
    await signupVerificationRequest({
      action: 'resend',
      email,
      channel,
      country,
      destination: destinationRaw,
    });
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) throw new Error(error.message);
  };

  const logOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  const sendPasswordReset = async (email: string) => {
    // Mark that this browser is expecting a password reset so AuthCallback
    // and onAuthStateChange can route the user to /reset-password even
    // when Supabase fires SIGNED_IN instead of PASSWORD_RECOVERY (PKCE).
    localStorage.setItem('is_password_recovery', 'true');

    // Redirect to /auth/callback which has robust recovery detection logic
    // and will route the user to /reset-password. This avoids race conditions
    // between detectSessionInUrl and the ResetPassword page's own code exchange.
    // IMPORTANT: Both /auth/callback AND /reset-password must be listed under
    // Supabase → Authentication → URL Configuration → Redirect URLs.
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    });
    if (error) {
      localStorage.removeItem('is_password_recovery');
      throw new Error(error.message);
    }
  };

  const value: AuthContextType = {
    user,
    session,
    profile,
    isLoading,
    isAuthenticated: !isLoading && !!user,
    signUp,
    signUpWithPhoneVerification,
    verifyOtp,
    verifySignupPhoneOtp,
    resendOtp,
    resendSignupPhoneOtp,
    signIn,
    signInWithGoogle,
    signOut: logOut,
    sendPasswordReset,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

/**
 * Returns the correct dashboard path based on the user's role.
 */
export const getDashboardPath = (profile: UserProfile | null): string => {
  if (!profile) return '/dashboard';
  switch (profile.role) {
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
