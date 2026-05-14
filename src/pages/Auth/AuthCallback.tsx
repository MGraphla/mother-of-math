import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, getUserProfile, isPasswordRecoveryAccessToken } from "@/lib/supabase";
import type { UserProfile } from "@/lib/supabase";
import {
  syncGoogleOnboardingFlag,
  needsGoogleExtraProfile,
  getDashboardPath,
  userHasGoogleIdentity,
} from "@/context/AuthContext";
import type { User } from "@supabase/supabase-js";
import { AlertCircle, CheckCircle2, Shield, Sparkles } from "lucide-react";
import { LoadingAnimation } from "@/components/ui/LoadingAnimation";

const AuthCallback = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [isPasswordResetError, setIsPasswordResetError] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stepText, setStepText] = useState("Verifying your identity...");
  const hasNavigated = useRef(false);
  /** True while we're loading profile / syncing Google flag — avoids the failsafe timeout firing mid-flow. */
  const oauthHandlingRef = useRef(false);

  // ── Animated progress bar ────────────────────────────────
  useEffect(() => {
    if (status !== "loading") return;
    const interval = setInterval(() => {
      setProgress((prev) => (prev >= 90 ? prev : prev + Math.random() * 8 + 2));
    }, 350);
    return () => clearInterval(interval);
  }, [status]);

  useEffect(() => {
    if (status === "success") setProgress(100);
  }, [status]);

  // ── Core auth handling ───────────────────────────────────
  useEffect(() => {
    if (hasNavigated.current) return;

    // Check for error in URL params or hash (implicit flow)
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const errorParam = params.get("error") || hashParams.get("error");
    const errorCode = params.get("error_code") || hashParams.get("error_code");
    const errorDesc = params.get("error_description") || hashParams.get("error_description");

    if (errorParam) {
      setStatus("error");
      const isRecoveryError = errorCode === "otp_expired" || errorCode === "otp_disabled"
        || (errorDesc?.toLowerCase().includes("expired"))
        || (errorDesc?.toLowerCase().includes("invalid"))
        || localStorage.getItem('is_password_recovery') === 'true';
      setIsPasswordResetError(isRecoveryError);

      if (isRecoveryError) {
        setErrorMsg("This password reset link has expired or is invalid. Please request a new one.");
      } else {
        setErrorMsg(errorDesc || "Authentication failed. Please try again.");
      }
      return;
    }

    const pkceCode = params.get("code");

    // With PKCE, Supabase can miss or race `detectSessionInUrl` on slow networks.
    // Explicitly exchange the code when it is present and we do not yet have a session.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("[AuthCallback] Auth event:", event, session?.user?.id);
      if (hasNavigated.current) return;

      // Detect password recovery: Supabase fires PASSWORD_RECOVERY in some
      // flows, but with PKCE it often fires SIGNED_IN instead. The localStorage
      // flag (set in ForgotPassword before the email was sent) catches both.
      const hasRecoveryFlag = localStorage.getItem('is_password_recovery') === 'true';
      const recoveryJwt =
        session?.access_token && isPasswordRecoveryAccessToken(session.access_token);

      if (event === "PASSWORD_RECOVERY") {
        hasNavigated.current = true;
        setStatus("success");
        setStepText("Redirecting to reset password...");
        setTimeout(() => navigate("/reset-password", { replace: true }), 600);
        return;
      }
      if (
        (event === "SIGNED_IN" || event === "INITIAL_SESSION") &&
        hasRecoveryFlag &&
        session?.user
      ) {
        hasNavigated.current = true;
        setStatus("success");
        setStepText("Redirecting to reset password...");
        setTimeout(() => navigate("/reset-password", { replace: true }), 600);
        return;
      }
      // Recovery link opened on another device: no localStorage flag, but JWT is a recovery session.
      if (
        (event === "SIGNED_IN" || event === "INITIAL_SESSION") &&
        recoveryJwt &&
        session?.user
      ) {
        hasNavigated.current = true;
        setStatus("success");
        setStepText("Redirecting to reset password...");
        setTimeout(() => navigate("/reset-password", { replace: true }), 600);
        return;
      }

      // PKCE OAuth often delivers the session as INITIAL_SESSION; SIGNED_IN may also fire — both are handled once.
      if (
        (event === "SIGNED_IN" || event === "INITIAL_SESSION") &&
        session?.user
      ) {
        setStepText("Securing your session...");
        try {
          await navigateForUser(session.user);
        } catch (e: unknown) {
          console.error("[AuthCallback] navigateForUser:", e);
          oauthHandlingRef.current = false;
          setStatus("error");
          setErrorMsg(
            e instanceof Error ? e.message : "Could not finish sign-in. Please try again."
          );
        }
      }
    });

    void (async () => {
      try {
        const { data: first } = await supabase.auth.getSession();
        if (pkceCode && first.session?.user) {
          window.history.replaceState({}, document.title, window.location.pathname);
        } else if (pkceCode && !first.session?.user) {
          setStepText("Completing sign-in…");
          const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(
            window.location.href,
          );
          if (exchangeErr) {
            console.error("[AuthCallback] exchangeCodeForSession:", exchangeErr);
            setStatus("error");
            setErrorMsg(
              exchangeErr.message ||
                "Could not complete Google sign-in. Confirm this site URL is listed under Supabase → Authentication → URL Configuration (redirect URLs).",
            );
            return;
          }
          window.history.replaceState({}, document.title, window.location.pathname);
        }

        if (hasNavigated.current) return;
        const { data: after } = await supabase.auth.getSession();
        const u = after.session?.user;
        const token = after.session?.access_token;
        if (
          u &&
          token &&
          isPasswordRecoveryAccessToken(token) &&
          !hasNavigated.current
        ) {
          hasNavigated.current = true;
          setStatus("success");
          setStepText("Redirecting to reset password...");
          navigate("/reset-password", { replace: true });
          return;
        }
        if (u && !oauthHandlingRef.current && !hasNavigated.current) {
          setStepText("Securing your session…");
          try {
            await navigateForUser(u);
          } catch (e: unknown) {
            console.error("[AuthCallback] bootstrap navigateForUser:", e);
            oauthHandlingRef.current = false;
            setStatus("error");
            setErrorMsg(
              e instanceof Error ? e.message : "Could not finish sign-in. Please try again.",
            );
          }
        }
      } catch (e: unknown) {
        console.error("[AuthCallback] PKCE bootstrap:", e);
        setStatus("error");
        setErrorMsg(e instanceof Error ? e.message : "Sign-in failed. Please try again.");
      }
    })();

    // Fallback: if the onAuthStateChange fires before our listener or the session
    // was already set synchronously (e.g. INITIAL_SESSION), check manually.
    const fallbackCheck = async () => {
      if (hasNavigated.current) return;

      const { data: { session: s } } = await supabase.auth.getSession();

      setStepText("Checking session...");
      console.log("[AuthCallback] Fallback getSession:", s?.user?.id);

      // If the recovery flag is set and we have a session, go to reset page
      if (s?.user && localStorage.getItem('is_password_recovery') === 'true' && !hasNavigated.current) {
        hasNavigated.current = true;
        setStatus("success");
        setStepText("Redirecting to reset password...");
        setTimeout(() => navigate("/reset-password", { replace: true }), 600);
        return;
      }

      if (
        s?.user &&
        s.access_token &&
        isPasswordRecoveryAccessToken(s.access_token) &&
        !hasNavigated.current
      ) {
        hasNavigated.current = true;
        setStatus("success");
        setStepText("Redirecting to reset password...");
        setTimeout(() => navigate("/reset-password", { replace: true }), 600);
        return;
      }

      if (s?.user && !hasNavigated.current && !oauthHandlingRef.current) {
        setStepText("Session found...");
        try {
          await navigateForUser(s.user);
        } catch (e: unknown) {
          console.error("[AuthCallback] fallback navigateForUser:", e);
          oauthHandlingRef.current = false;
          setStatus("error");
          setErrorMsg(
            e instanceof Error ? e.message : "Could not finish sign-in. Please try again."
          );
        }
      }
    };

    // PKCE code exchange can take a moment; retry session a few times before giving up.
    const fallbackTimer = setTimeout(fallbackCheck, 800);
    const fallbackTimer2 = setTimeout(fallbackCheck, 2500);
    const fallbackTimer3 = setTimeout(fallbackCheck, 5000);

    // Only if we never got a session and never started post-login work (slow networks can need 20s+ for profile steps)
    const timeout = setTimeout(() => {
      if (!hasNavigated.current && !oauthHandlingRef.current) {
        setStatus("error");
        setErrorMsg(
          "Sign-in is taking too long. Please try again. If this persists, clear your browser cache and retry."
        );
      }
    }, 90000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(fallbackTimer);
      clearTimeout(fallbackTimer2);
      clearTimeout(fallbackTimer3);
      clearTimeout(timeout);
    };
  }, [navigate]);

  const navigateForUser = async (authUser: User) => {
    if (hasNavigated.current) return;
    if (oauthHandlingRef.current) return;
    oauthHandlingRef.current = true;
    // Normal OAuth / magic-link completion — clear stale reset flag so we never
    // mis-route a later Google sign-in to /reset-password.
    localStorage.removeItem("is_password_recovery");

    const isGoogle = userHasGoogleIdentity(authUser);
    /** Never block the OAuth redirect on a request that never settles (SW / network / RLS quirks). */
    const raceProfile = (ms: number) =>
      Promise.race([
        getUserProfile(authUser.id),
        new Promise<UserProfile | null>((resolve) => setTimeout(() => resolve(null), ms)),
      ]);

    try {
      setStepText("Loading your profile...");
      await new Promise((r) => setTimeout(r, 300));

      const perTryMs = isGoogle ? 4000 : 12000;
      let profile: UserProfile | null = await raceProfile(perTryMs);
      if (!profile) {
        await new Promise((r) => setTimeout(r, 500));
        profile = await raceProfile(perTryMs);
      }
      if (!profile) {
        await new Promise((r) => setTimeout(r, 800));
        profile = await raceProfile(perTryMs);
      }

      if (profile) {
        const synced = await Promise.race([
          syncGoogleOnboardingFlag(authUser, profile),
          new Promise<UserProfile | null>((resolve) =>
            setTimeout(() => resolve(profile), isGoogle ? 5000 : 10000),
          ),
        ]);
        profile = synced ?? profile;
      }

      setStatus("success");
      setStepText("Welcome!");
      await new Promise((r) => setTimeout(r, 200));

      if (hasNavigated.current) return;
      hasNavigated.current = true;

      if (needsGoogleExtraProfile(authUser, profile)) {
        navigate("/complete-profile", { replace: true });
      } else {
        navigate(getDashboardPath(profile), { replace: true });
      }
    } catch (e) {
      oauthHandlingRef.current = false;
      throw e;
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-emerald-50 via-white to-green-50 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-green-200/30 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-emerald-200/20 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-green-100/20 rounded-full blur-2xl" />

        {/* Floating particles */}
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 bg-green-400/20 rounded-full"
            style={{
              top: `${15 + i * 15}%`,
              left: `${10 + i * 16}%`,
              animation: `float ${3 + i * 0.5}s ease-in-out infinite alternate`,
              animationDelay: `${i * 0.3}s`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 w-full max-w-md mx-4">
        {/* Card */}
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl shadow-green-900/10 border border-white/60 p-8 sm:p-10">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <div className="relative">
              <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-green-500/25 rotate-3 transition-transform hover:rotate-0">
                <span className="text-3xl font-black text-white">M</span>
              </div>
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center shadow-md">
                <Sparkles className="w-3.5 h-3.5 text-yellow-800" />
              </div>
            </div>
          </div>

          {status === "error" ? (
            /* ── Error State ─────────────────────────── */
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center ring-4 ${isPasswordResetError ? 'bg-amber-50 ring-amber-100' : 'bg-red-50 ring-red-100'}`}>
                  <AlertCircle className={`w-8 h-8 ${isPasswordResetError ? 'text-amber-500' : 'text-red-500'}`} />
                </div>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  {isPasswordResetError ? 'Reset Link Expired' : 'Sign-in Failed'}
                </h2>
                {isPasswordResetError ? (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600 leading-relaxed">
                      This reset link has already been used or has expired.
                    </p>
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-left">
                      <p className="text-xs font-semibold text-amber-800 mb-1">What to do:</p>
                      <ol className="text-xs text-amber-700 space-y-1 list-decimal list-inside">
                        <li>Click <strong>"Request New Reset Link"</strong> below</li>
                        <li>Enter your email and click <strong>"Send Email Reset Link"</strong></li>
                        <li>Open the <strong>newest email</strong> from Mama Math</li>
                        <li>Click the link <strong>in this same browser</strong></li>
                      </ol>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 leading-relaxed">{errorMsg}</p>
                )}
              </div>
              <div className="pt-2 space-y-3">
                {isPasswordResetError ? (
                  <>
                    <button
                      onClick={() => {
                        hasNavigated.current = true;
                        navigate("/forgot-password", { replace: true });
                      }}
                      className="w-full py-3 px-6 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-semibold shadow-lg shadow-green-600/25 hover:shadow-green-600/40 transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0"
                    >
                      Request New Reset Link
                    </button>
                    <button
                      onClick={() => {
                        hasNavigated.current = true;
                        navigate("/sign-in", { replace: true });
                      }}
                      className="w-full py-2.5 px-6 text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors"
                    >
                      Back to Sign In
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      hasNavigated.current = true;
                      navigate("/sign-in", { replace: true });
                    }}
                    className="w-full py-3 px-6 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-semibold shadow-lg shadow-green-600/25 hover:shadow-green-600/40 transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0"
                  >
                    Back to Sign In
                  </button>
                )}
              </div>
            </div>
          ) : status === "success" ? (
            /* ── Success State ───────────────────────── */
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center ring-4 ring-green-100 animate-[scale-in_0.3s_ease-out]">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">Welcome Back!</h2>
                <p className="text-sm text-gray-500">Taking you to your dashboard...</p>
              </div>
              {/* Progress bar at 100% */}
              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all duration-500 ease-out"
                  style={{ width: "100%" }}
                />
              </div>
            </div>
          ) : (
            /* ── Loading State ───────────────────────── */
            <div className="text-center space-y-6">
              {/* Animated spinner */}
              <div className="flex justify-center">
                <div className="relative">
                  {/* Outer ring */}
                  <div className="w-16 h-16 rounded-full border-[3px] border-green-100" />
                  {/* Spinning arc */}
                  <div className="absolute inset-0 w-16 h-16 rounded-full border-[3px] border-transparent border-t-green-600 border-r-green-600 animate-spin" />
                  {/* Center icon */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Shield className="w-6 h-6 text-green-600 animate-pulse" />
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Signing You In</h2>
                <p className="text-sm text-gray-500 transition-opacity duration-300 min-h-[20px]">
                  {stepText}
                </p>
              </div>

              {/* Progress bar */}
              <div className="space-y-2">
                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-green-500 via-emerald-500 to-green-400 rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400 font-medium tabular-nums">
                  {Math.round(Math.min(progress, 100))}%
                </p>
              </div>

              {/* Security badge */}
              <div className="flex items-center justify-center gap-2 pt-2">
                <div className="flex items-center gap-1.5 bg-green-50 text-green-700 text-xs font-medium px-3 py-1.5 rounded-full border border-green-100">
                  <Shield className="w-3 h-3" />
                  <span>Secure connection</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-6">
          🧮 Mama Math &middot; Empowering education in Cameroon
        </p>
      </div>

      {/* Keyframe animations */}
      <style>{`
        @keyframes float {
          from { transform: translateY(0px) scale(1); opacity: 0.3; }
          to { transform: translateY(-20px) scale(1.5); opacity: 0.6; }
        }
        @keyframes scale-in {
          from { transform: scale(0.5); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default AuthCallback;
