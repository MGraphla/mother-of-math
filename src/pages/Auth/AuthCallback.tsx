import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, getUserProfile } from "@/lib/supabase";
import { isProfileComplete, getDashboardPath } from "@/context/AuthContext";
import { AlertCircle, CheckCircle2, Shield, Sparkles } from "lucide-react";

const AuthCallback = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [isPasswordResetError, setIsPasswordResetError] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stepText, setStepText] = useState("Verifying your identity...");
  const hasNavigated = useRef(false);

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
      // Detect if this is a password-reset link expiry
      const isRecoveryError = errorCode === "otp_expired" || errorCode === "otp_disabled"
        || (errorDesc?.toLowerCase().includes("expired"))
        || (errorDesc?.toLowerCase().includes("invalid"));
      setIsPasswordResetError(isRecoveryError);

      if (isRecoveryError) {
        setErrorMsg("This password reset link has expired or is invalid. Please request a new one.");
      } else {
        setErrorMsg(errorDesc || "Authentication failed. Please try again.");
      }
      return;
    }

    // With implicit flow + detectSessionInUrl: true,
    // Supabase auto-detects the tokens in the URL hash and sets the session.
    // We listen for the auth state change via onAuthStateChange.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("[AuthCallback] Auth event:", event, session?.user?.id);
      if (hasNavigated.current) return;

      if (event === "PASSWORD_RECOVERY" && session?.user) {
        // User clicked the password reset link from email
        hasNavigated.current = true;
        setStatus("success");
        setStepText("Redirecting to reset password...");
        setTimeout(() => navigate("/reset-password", { replace: true }), 800);
        return;
      }

      if (event === "SIGNED_IN" && session?.user) {
        setStepText("Securing your session...");
        await navigateForUser(session.user.id);
      }
    });

    // Fallback: check if session is already established
    // (onAuthStateChange INITIAL_SESSION may fire before our listener is set)
    const fallbackCheck = async () => {
      if (hasNavigated.current) return;

      // Check if this is a password recovery flow from the URL hash
      const hash = new URLSearchParams(window.location.hash.substring(1));
      if (hash.get("type") === "recovery") {
        // Wait for session to be set, then redirect
        const { data: { session: s } } = await supabase.auth.getSession();
        if (s?.user && !hasNavigated.current) {
          hasNavigated.current = true;
          setStatus("success");
          setStepText("Redirecting to reset password...");
          setTimeout(() => navigate("/reset-password", { replace: true }), 800);
          return;
        }
      }

      setStepText("Checking session...");
      const { data: { session } } = await supabase.auth.getSession();
      console.log("[AuthCallback] Fallback getSession:", session?.user?.id);
      if (session?.user && !hasNavigated.current) {
        setStepText("Session found...");
        await navigateForUser(session.user.id);
      }
    };

    // Give the auto-detection a moment, then check
    const fallbackTimer = setTimeout(fallbackCheck, 1500);

    // Timeout: if nothing happens in 15s, show error
    const timeout = setTimeout(() => {
      if (!hasNavigated.current) {
        setStatus("error");
        setErrorMsg(
          "Sign-in is taking too long. Please try again. If this persists, clear your browser cache and retry."
        );
      }
    }, 15000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(fallbackTimer);
      clearTimeout(timeout);
    };
  }, [navigate]);

  const navigateForUser = async (userId: string) => {
    if (hasNavigated.current) return;

    // Give the Postgres trigger time to create the profile row
    setStepText("Loading your profile...");
    await new Promise((r) => setTimeout(r, 1000));

    let profile = await getUserProfile(userId);

    // Retry once if profile wasn't created yet by trigger
    if (!profile) {
      await new Promise((r) => setTimeout(r, 1500));
      profile = await getUserProfile(userId);
    }

    setStatus("success");
    setStepText("Welcome!");

    // Brief pause so the user sees the success state
    await new Promise((r) => setTimeout(r, 600));

    if (hasNavigated.current) return;
    hasNavigated.current = true;

    if (isProfileComplete(profile)) {
      navigate(getDashboardPath(profile), { replace: true });
    } else {
      navigate("/complete-profile", { replace: true });
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
                  {isPasswordResetError ? 'Link Expired' : 'Sign-in Failed'}
                </h2>
                <p className="text-sm text-gray-500 leading-relaxed">{errorMsg}</p>
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
