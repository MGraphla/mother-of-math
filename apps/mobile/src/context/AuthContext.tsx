import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { PropsWithChildren } from "react";
import type { Session, User } from "@supabase/supabase-js";
import * as QueryParams from "expo-auth-session/build/QueryParams";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { assertSupabaseReachable, toFriendlyNetworkError } from "../lib/network";
import { resolveAvatarUrl } from "../lib/avatar";
import {
  getAuthSessionReturnUrl,
  getMobileOAuthRedirectTo,
  withMobileOAuthRedirect,
} from "../lib/oauthRedirect";
import { getSupabaseUrl, supabase } from "../lib/supabase";
import {
  signupVerificationRequest,
  type SignupPhoneChannel,
} from "../services/signupVerification";

export type { SignupPhoneChannel };

WebBrowser.maybeCompleteAuthSession();
export type UserRole = "teacher" | "parent" | "student" | "admin" | "monitor";

/** Mirrors the columns the web app reads from `profiles`. */
export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  avatar_url?: string | null;
  gender?: string | null;
  country?: string | null;
  city?: string | null;
  school_name?: string | null;
  school_address?: string | null;
  school_type?: string | null;
  number_of_students?: number | null;
  number_of_classes?: number | null;
  subjects_taught?: string | null;
  grade_levels?: string | null;
  years_of_experience?: number | string | null;
  education_level?: string | null;
  phone_number?: string | null;
  whatsapp_number?: string | null;
  bio?: string | null;
  date_of_birth?: string | null;
  preferred_language?: string | null;
  google_extra_profile_completed?: boolean | null;
}

/** Everything the registration wizard can collect (matches web SignUp payload). */
export interface SignUpProfileInput {
  full_name: string;
  role: Extract<UserRole, "teacher" | "parent">;
  date_of_birth?: string | null;
  gender?: string | null;
  country?: string | null;
  city?: string | null;
  school_name?: string | null;
  school_address?: string | null;
  school_type?: string | null;
  number_of_students?: number | null;
  number_of_classes?: number | null;
  subjects_taught?: string | null;
  grade_levels?: string | null;
  years_of_experience?: number | null;
  education_level?: string | null;
  phone_number?: string | null;
  whatsapp_number?: string | null;
  bio?: string | null;
  preferred_language?: string | null;
}

export interface SignUpResult {
  /** False when Supabase returned a session immediately (email confirmation off). */
  needsVerification: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<Profile | null>;
  signInWithGoogle: () => Promise<Profile | null>;
  signUp: (email: string, password: string, profileData: SignUpProfileInput) => Promise<SignUpResult>;
  signUpWithPhoneVerification: (
    email: string,
    password: string,
    profileData: SignUpProfileInput,
    channel: SignupPhoneChannel,
    destinationRaw: string,
    country: string,
  ) => Promise<void>;
  verifySignupOtp: (email: string, token: string) => Promise<Profile | null>;
  verifySignupPhoneOtp: (email: string, token: string, password: string) => Promise<Profile | null>;
  resendSignupOtp: (email: string) => Promise<void>;
  resendSignupPhoneOtp: (
    email: string,
    channel: SignupPhoneChannel,
    destinationRaw: string,
    country: string,
  ) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<Profile | null>;
  updateProfile: (patch: Partial<Profile>) => Promise<Profile | null>;
}

const PROFILE_COLUMNS =
  "id,full_name,email,role,avatar_url,gender,country,city,school_name,school_address,school_type,number_of_students,number_of_classes,subjects_taught,grade_levels,years_of_experience,education_level,phone_number,whatsapp_number,bio,date_of_birth,preferred_language,google_extra_profile_completed";

const PENDING_PROFILE_KEY = "pending_profile";
const VERIFY_EMAIL_KEY = "verify_email";
const VERIFY_CHANNEL_KEY = "verify_channel";
const VERIFY_COUNTRY_KEY = "verify_country";
const VERIFY_DEST_KEY = "verify_dest_e164";

const AuthContext = createContext<AuthContextType | null>(null);

/** Minimum details a teacher/parent needs (same rule as the web app). */
export const isProfileComplete = (profile: Profile | null): boolean => {
  if (!profile) return false;
  const filled = (v: unknown) => v !== null && v !== undefined && String(v).trim() !== "";
  const base = filled(profile.full_name) && filled(profile.country) && filled(profile.phone_number);
  return profile.role === "teacher" ? base && filled(profile.school_name) : base;
};

export const userHasGoogleIdentity = (user: User | null): boolean => {
  if (!user?.identities?.length) return false;
  return user.identities.some((i) => i.provider === "google");
};

/** True when the user must finish /complete-profile before using the app. */
export const needsProfileCompletion = (user: User | null, profile: Profile | null): boolean => {
  if (!user) return false;
  if (!profile) return true;
  if (profile.role !== "teacher" && profile.role !== "parent") return false;
  return profile.google_extra_profile_completed === false || !isProfileComplete(profile);
};

/** Thrown by signIn when the account exists but the email was never verified. */
export class EmailNotConfirmedError extends Error {
  constructor() {
    super("Your email is not verified yet.");
    this.name = "EmailNotConfirmedError";
  }
}

// The sign-up password is kept in memory only (never in route params or storage)
// so SMS sign-ups can be signed in right after the code is confirmed.
let pendingSignupPassword: string | null = null;
export const peekSignupPassword = () => pendingSignupPassword;

/** Email buttons open the website's /auth/confirm, which works on any device. */
const SITE_URL = (process.env.EXPO_PUBLIC_SITE_URL ?? "https://mamamath.org").replace(/\/$/, "");

const fetchProfile = async (userId: string): Promise<Profile | null> => {
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", userId)
    .maybeSingle();
  if (data) return data as Profile;
  if (!error) return null;

  // Older databases may lack a column — retry with the core fields.
  const { data: minimal } = await supabase
    .from("profiles")
    .select("id,full_name,email,role")
    .eq("id", userId)
    .maybeSingle();
  return (minimal as Profile | null) ?? null;
};

/** Persist Google/OAuth photo onto the profile when the column is empty. */
const syncAvatarFromAuthUser = async (user: User, profile: Profile | null): Promise<Profile | null> => {
  if (!profile || profile.avatar_url) return profile;
  const avatarUrl = resolveAvatarUrl(null, user);
  if (!avatarUrl) return profile;
  try {
    const { error } = await supabase
      .from("profiles")
      .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
      .eq("id", user.id);
    if (error) return profile;
    return { ...profile, avatar_url: avatarUrl };
  } catch {
    return profile;
  }
};

const loadProfile = async (user: User): Promise<Profile | null> => {
  let profile = await fetchProfile(user.id);
  if (!profile) {
    // Creates the row from the verified account's sign-up details (DB function).
    const { error } = await supabase.rpc("ensure_my_profile");
    if (!error) profile = await fetchProfile(user.id);
  }
  return syncAvatarFromAuthUser(user, profile);
};

/** Codes already exchanged (single-use) — Linking and openAuthSessionAsync can both deliver one. */
const handledAuthCodes = new Set<string>();
let googleFlowActive = false;

const isAuthUrl = (url: string) => /[?#&](code|access_token|error)=/.test(url);

const createSessionFromUrl = async (url: string) => {
  const { params, errorCode } = QueryParams.getQueryParams(url);
  if (errorCode) throw new Error(String(errorCode));

  const access_token = params.access_token;
  const refresh_token = params.refresh_token;
  const code = params.code;

  if (access_token && refresh_token) {
    const { error } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });
    if (error) throw error;
    return;
  }

  if (code) {
    const key = String(code);
    if (handledAuthCodes.has(key)) return;
    handledAuthCodes.add(key);
    const { error } = await supabase.auth.exchangeCodeForSession(key);
    if (error) {
      // Another path may have exchanged it a moment earlier.
      const { data } = await supabase.auth.getSession();
      if (data.session) return;
      throw error;
    }
    return;
  }

  throw new Error(
    "Google sign-in returned to the app without a session code. Try again.",
  );
};

const isDuplicateEmailError = (message?: string) => {
  const msg = (message ?? "").toLowerCase();
  return (
    msg.includes("already") ||
    msg.includes("registered") ||
    msg.includes("exists") ||
    msg.includes("duplicate")
  );
};

const metadataFromProfile = (profileData: SignUpProfileInput) => ({
  full_name: profileData.full_name,
  role: profileData.role,
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
});

/**
 * The database trigger normally creates the profiles row from user_metadata. This
 * writes it directly as a fallback for projects where the trigger is absent.
 */
const upsertProfileRow = async (id: string, email: string, profileData: SignUpProfileInput) => {
  const now = new Date().toISOString();
  const { error } = await supabase.from("profiles").upsert(
    {
      id,
      email,
      ...metadataFromProfile(profileData),
      google_extra_profile_completed: true,
      created_at: now,
      updated_at: now,
    },
    { onConflict: "id" },
  );
  if (error) throw error;
};

const seedProfileFromAuthUser = async (user: User): Promise<Profile | null> => {
  const existing = await loadProfile(user);
  if (existing) return existing;

  const meta = user.user_metadata ?? {};
  const fullName =
    (typeof meta.full_name === "string" && meta.full_name.trim()) ||
    (typeof meta.name === "string" && meta.name.trim()) ||
    user.email?.split("@")[0] ||
    "Mama Math user";
  const seed: SignUpProfileInput = {
    full_name: fullName,
    role: meta.role === "parent" ? "parent" : "teacher",
    country: typeof meta.country === "string" ? meta.country : null,
    school_name: typeof meta.school_name === "string" ? meta.school_name : null,
    phone_number: typeof meta.phone_number === "string" ? meta.phone_number : null,
    preferred_language:
      typeof meta.preferred_language === "string" ? meta.preferred_language : "English",
  };

  try {
    await upsertProfileRow(user.id, user.email ?? "", seed);
    if (userHasGoogleIdentity(user)) {
      const avatarUrl = resolveAvatarUrl(null, user);
      await supabase
        .from("profiles")
        .update({
          google_extra_profile_completed: false,
          ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
        })
        .eq("id", user.id);
    }
  } catch (e) {
    console.warn("Profile seed failed:", e);
  }

  return await loadProfile(user);
};

const createProfileFromPending = async (verifiedUser: User, email: string) => {
  const pending = await AsyncStorage.getItem(PENDING_PROFILE_KEY);
  if (!pending) return null;
  try {
    const parsed = JSON.parse(pending) as SignUpProfileInput & { email: string };
    await upsertProfileRow(verifiedUser.id, parsed.email || email, parsed);
    await AsyncStorage.removeItem(PENDING_PROFILE_KEY);
    return await loadProfile(verifiedUser);
  } catch (e) {
    console.warn("Profile creation after verification failed:", e);
    return null;
  }
};

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const current = data.session;
      setSession(current);
      setUser(current?.user ?? null);
      if (current?.user) {
        setProfile(await loadProfile(current.user));
      }
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      // Defer async work to avoid Supabase JS deadlocks with setSession (common on RN OAuth).
      setTimeout(() => {
        void (async () => {
          setSession(nextSession);
          setUser(nextSession?.user ?? null);
          if (nextSession?.user) {
            setProfile(await loadProfile(nextSession.user));
          } else {
            setProfile(null);
          }
        })();
      }, 0);
    });

    const handleIncoming = (url: string | null) => {
      // The Google flow handles its own redirect; other links (enroll, etc.) aren't auth.
      if (!url || googleFlowActive || !isAuthUrl(url)) return;
      void createSessionFromUrl(url).catch((e) => console.warn("Deep link auth failed:", e));
    };
    const linkingSub = Linking.addEventListener("url", ({ url }) => handleIncoming(url));
    void Linking.getInitialURL().then(handleIncoming);

    return () => {
      sub.subscription.unsubscribe();
      linkingSub.remove();
    };
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      session,
      profile,
      loading,
      refreshProfile: async () => {
        const {
          data: { session: current },
        } = await supabase.auth.getSession();
        if (!current?.user) {
          setProfile(null);
          return null;
        }
        const next = await loadProfile(current.user);
        setProfile(next);
        setSession(current);
        setUser(current.user);
        return next;
      },

      signIn: async (email, password) => {
        const cleanEmail = email.trim().toLowerCase();
        if (!cleanEmail || !password) {
          throw new Error("Enter your email and password.");
        }
        if (!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
          throw new Error("App is missing Supabase configuration. Restart Expo after checking .env.");
        }

        try {
          await assertSupabaseReachable(getSupabaseUrl());

          const { data, error } = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password,
          });
          if (error) {
            if (/email not confirmed/i.test(error.message)) throw new EmailNotConfirmedError();
            if (/invalid login credentials/i.test(error.message)) {
              throw new Error("Wrong email or password.");
            }
            throw new Error(error.message || "Wrong email or password.");
          }
          if (!data.user) throw new Error("Sign in succeeded but no user was returned.");
          const nextProfile = await seedProfileFromAuthUser(data.user);
          setSession(data.session);
          setUser(data.user);
          setProfile(nextProfile);
          return nextProfile;
        } catch (error) {
          if (error instanceof EmailNotConfirmedError) throw error;
          throw toFriendlyNetworkError(error);
        }
      },

      signInWithGoogle: async () => {
        googleFlowActive = true;
        try {
          await assertSupabaseReachable(getSupabaseUrl());

          // HTTPS bridge with ?app=motherofmath — website forwards to deep link
          // without exchanging the PKCE code (that must happen on the phone).
          const redirectTo = getMobileOAuthRedirectTo();
          const sessionReturnUrl = getAuthSessionReturnUrl(redirectTo);

          const { data, error } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
              redirectTo,
              skipBrowserRedirect: true,
              queryParams: {
                access_type: "offline",
                prompt: "select_account",
              },
            },
          });
          if (error) throw new Error(error.message);
          if (!data.url) throw new Error("No OAuth URL returned from Google.");

          const authUrl = withMobileOAuthRedirect(data.url, redirectTo);

          const AUTH_TIMEOUT_MS = 120_000;
          const result = await Promise.race([
            WebBrowser.openAuthSessionAsync(authUrl, sessionReturnUrl, {
              showInRecents: true,
              preferEphemeralSession: false,
            }),
            new Promise<null>((resolve) =>
              setTimeout(() => resolve(null), AUTH_TIMEOUT_MS),
            ),
          ]);

          if (!result) {
            try {
              await WebBrowser.dismissAuthSession();
            } catch {
              /* ignore */
            }
            throw new Error(
              "Google sign-in timed out. Close the browser sheet and try again.",
            );
          }

          if (result.type !== "success" || !("url" in result) || !result.url) {
            return null;
          }

          if (result.url.includes("error=")) {
            const { params } = QueryParams.getQueryParams(result.url);
            throw new Error(
              String(params.error_description || params.error || "Google sign-in failed."),
            );
          }

          await createSessionFromUrl(result.url);

          const {
            data: { session: current },
          } = await supabase.auth.getSession();
          setSession(current);
          setUser(current?.user ?? null);

          if (!current?.user) {
            throw new Error("Google sign-in completed but no session was created.");
          }

          const next = await seedProfileFromAuthUser(current.user);

          setProfile(next);
          if (!next) {
            throw new Error("Signed in with Google, but your profile could not be loaded.");
          }
          return next;
        } catch (error) {
          throw toFriendlyNetworkError(error);
        } finally {
          googleFlowActive = false;
        }
      },

      signUp: async (email, password, profileData) => {
        const cleanEmail = email.trim().toLowerCase();

        await signupVerificationRequest({
          action: "check_signup_availability",
          email: cleanEmail,
          country: profileData.country ?? "Cameroon",
          phone_number: profileData.phone_number ?? "",
          whatsapp_number: profileData.whatsapp_number ?? "",
        });

        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            emailRedirectTo: `${SITE_URL}/auth/confirm`,
            data: metadataFromProfile(profileData),
          },
        });

        if (error) {
          if (isDuplicateEmailError(error.message)) {
            throw new Error("This email is already registered. Please sign in instead.");
          }
          throw new Error(error.message);
        }

        if (data.user?.identities && data.user.identities.length === 0) {
          throw new Error("This email is already registered. Please sign in instead.");
        }

        await AsyncStorage.setItem(
          PENDING_PROFILE_KEY,
          JSON.stringify({ email: cleanEmail, ...profileData }),
        );

        if (data.session && data.user) {
          try {
            await upsertProfileRow(data.user.id, cleanEmail, profileData);
          } catch {
            // Trigger already inserted the row.
          }
          setSession(data.session);
          setUser(data.user);
          setProfile(await loadProfile(data.user));
          await AsyncStorage.removeItem(PENDING_PROFILE_KEY);
          return { needsVerification: false };
        }

        return { needsVerification: true };
      },

      signUpWithPhoneVerification: async (
        email,
        password,
        profileData,
        channel,
        destinationRaw,
        country,
      ) => {
        const cleanEmail = email.trim().toLowerCase();
        await signupVerificationRequest({
          action: "start",
          email: cleanEmail,
          password,
          channel,
          country,
          destination: destinationRaw,
          profile: metadataFromProfile(profileData),
        });

        pendingSignupPassword = password;
        await AsyncStorage.setItem(
          PENDING_PROFILE_KEY,
          JSON.stringify({ email: cleanEmail, ...profileData }),
        );
      },

      verifySignupOtp: async (email, token) => {
        const TIMEOUT_MS = 12_000;
        let result: { data: { user: User | null; session: Session | null }; error: Error | null };

        try {
          result = (await Promise.race([
            supabase.auth.verifyOtp({
              email: email.trim(),
              token: token.trim(),
              type: "signup",
            }),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("__timeout__")), TIMEOUT_MS),
            ),
          ])) as typeof result;
        } catch (err) {
          if (!(err instanceof Error) || err.message !== "__timeout__") throw err;
          const {
            data: { session: s },
          } = await supabase.auth.getSession();
          if (s?.user) {
            result = { data: { user: s.user, session: s }, error: null };
          } else {
            throw new Error("Verification timed out. Please try again.");
          }
        }

        if (result.error) throw new Error(result.error.message);

        const verifiedUser = result.data.user;
        if (!verifiedUser) throw new Error("Verification succeeded but no user was returned.");

        setSession(result.data.session);
        setUser(verifiedUser);

        let next = await loadProfile(verifiedUser);
        if (!next) {
          next = await createProfileFromPending(verifiedUser, email.trim());
        } else {
          await AsyncStorage.removeItem(PENDING_PROFILE_KEY);
        }

        setProfile(next);
        return next;
      },

      verifySignupPhoneOtp: async (email, token, password) => {
        const code = token.replace(/\D/g, "");
        await signupVerificationRequest({
          action: "verify",
          email: email.trim().toLowerCase(),
          code,
        });
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });
        if (error) throw new Error(error.message);
        pendingSignupPassword = null;

        const verifiedUser = data.user;
        if (!verifiedUser) throw new Error("Sign-in succeeded but no user was returned.");

        setSession(data.session);
        setUser(verifiedUser);

        let next = await loadProfile(verifiedUser);
        if (!next) {
          next = await createProfileFromPending(verifiedUser, email.trim());
        } else {
          await AsyncStorage.removeItem(PENDING_PROFILE_KEY);
        }

        setProfile(next);
        return next;
      },

      resendSignupOtp: async (email) => {
        const { error } = await supabase.auth.resend({
          type: "signup",
          email: email.trim(),
          options: { emailRedirectTo: `${SITE_URL}/auth/confirm` },
        });
        if (error) throw new Error(error.message);
      },

      resendSignupPhoneOtp: async (email, channel, destinationRaw, country) => {
        await signupVerificationRequest({
          action: "resend",
          email: email.trim().toLowerCase(),
          channel,
          country,
          destination: destinationRaw,
        });
      },

      signOut: async () => {
        const { error } = await supabase.auth.signOut();
        setSession(null);
        setUser(null);
        setProfile(null);
        if (error) throw new Error(error.message);
      },

      updateProfile: async (patch) => {
        if (!user) throw new Error("You must be signed in to update your profile.");
        const { error } = await supabase
          .from("profiles")
          .update({ ...patch, updated_at: new Date().toISOString() })
          .eq("id", user.id);
        if (error) throw new Error(error.message);
        const next = await loadProfile(user);
        setProfile(next);
        return next;
      },
    }),
    [loading, profile, session, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
};

/** Persist verification routing state across the verify-email screen. */
export const storeVerifySession = async (params: {
  email: string;
  channel: "email" | "sms";
  country?: string;
  destE164?: string;
}) => {
  await AsyncStorage.setItem(VERIFY_EMAIL_KEY, params.email);
  await AsyncStorage.setItem(VERIFY_CHANNEL_KEY, params.channel);
  if (params.country) await AsyncStorage.setItem(VERIFY_COUNTRY_KEY, params.country);
  if (params.destE164) await AsyncStorage.setItem(VERIFY_DEST_KEY, params.destE164);
};

export const clearVerifySession = async () => {
  await AsyncStorage.multiRemove([
    VERIFY_EMAIL_KEY,
    VERIFY_CHANNEL_KEY,
    VERIFY_COUNTRY_KEY,
    VERIFY_DEST_KEY,
  ]);
};

export const readVerifySession = async () => {
  const [[, email], [, channel], [, country], [, destE164]] = await AsyncStorage.multiGet([
    VERIFY_EMAIL_KEY,
    VERIFY_CHANNEL_KEY,
    VERIFY_COUNTRY_KEY,
    VERIFY_DEST_KEY,
  ]);
  return {
    email: email ?? "",
    channel: (channel as "email" | "sms" | null) ?? "email",
    country: country ?? "Cameroon",
    destE164: destE164 ?? "",
  };
};
