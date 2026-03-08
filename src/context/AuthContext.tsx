import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase, getUserProfile, upsertUserProfile } from '@/lib/supabase';
import type { UserProfile } from '@/lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

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

// Define the shape of the context
interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signUp: (email: string, password: string, profileData: Partial<UserProfile>) => Promise<void>;
  verifyOtp: (email: string, token: string) => Promise<void>;
  resendOtp: (email: string) => Promise<void>;
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
      const p = await getUserProfile(userId);
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

  const signUp = async (email: string, password: string, profileData: Partial<UserProfile>) => {
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

    if (error) throw new Error(error.message);

    // Detect duplicate / already-registered email.
    // Supabase returns a fake user with empty identities to prevent email enumeration.
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      throw new Error('An account with this email already exists. Please sign in instead.');
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
        } as UserProfile);
        await fetchProfile(data.user.id);
      } catch (e) {
        console.log('Profile upsert fallback skipped (trigger handled it):', e);
      }
    }
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
      // Fire-and-forget profile creation after a short delay
      setTimeout(async () => {
        try {
          let existingProfile = await getUserProfile(verifiedUser.id);
          if (!existingProfile) {
            console.log('No profile found — creating from saved data');
            const pendingRaw = sessionStorage.getItem('pending_profile');
            const meta = verifiedUser.user_metadata ?? {};
            const parsed = pendingRaw ? JSON.parse(pendingRaw) : {};

            const profilePayload: UserProfile = {
              id: verifiedUser.id,
              email: verifiedUser.email ?? email,
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
            };

            await upsertUserProfile(profilePayload);
            existingProfile = profilePayload;
            console.log('Profile created successfully after verification');
          }
          sessionStorage.removeItem('pending_profile');
          setProfile(existingProfile);
        } catch (e) {
          console.error('Background profile creation failed:', e);
        }
      }, 2000);
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
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    });
    if (error) throw new Error(error.message);
  };

  const value: AuthContextType = {
    user,
    session,
    profile,
    isLoading,
    isAuthenticated: !isLoading && !!user,
    signUp,
    verifyOtp,
    resendOtp,
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
    case 'student':
      return '/student';
    case 'parent':
      return '/parent-dashboard';
    default:
      return '/dashboard';
  }
};
