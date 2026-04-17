import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { supabase, isPasswordRecoveryAccessToken } from "@/lib/supabase";
import { Lock, Eye, EyeOff, CheckCircle2, ShieldCheck, AlertCircle, Loader2 } from "lucide-react";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [isVerifying, setIsVerifying] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState("");
  const initRan = useRef(false);
  /** True when URL had PKCE `code` from the reset email (same tab). */
  const pkceFromResetEmailRef = useRef(false);

  const sessionAllowsPasswordReset = (session: { access_token: string } | null) => {
    if (!session?.access_token) return false;
    if (isPasswordRecoveryAccessToken(session.access_token)) return true;
    if (pkceFromResetEmailRef.current) return true;
    // If the user arrived on /reset-password with a code param or was redirected
    // here by the recovery detection in AuthContext, trust the session.
    if (localStorage.getItem("is_password_recovery") === "true") return true;
    const hp = new URLSearchParams(window.location.hash.substring(1));
    return hp.get("type") === "recovery";
  };

  useEffect(() => {
    if (initRan.current) return;
    initRan.current = true;

    let cancelled = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (cancelled || !session) return;
        const allow =
          event === "PASSWORD_RECOVERY" ||
          sessionAllowsPasswordReset(session);
        if (!allow) return;
        localStorage.removeItem("is_password_recovery");
        setSessionReady(true);
        setIsVerifying(false);
      }
    );

    const init = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.substring(1));

      const urlError = urlParams.get("error") || hashParams.get("error");
      if (urlError) {
        const desc = urlParams.get("error_description") || hashParams.get("error_description");
        if (!cancelled) {
          setSessionError(
            desc?.replace(/\+/g, " ") ||
            "This password reset link is invalid or has expired."
          );
          setIsVerifying(false);
        }
        return;
      }

      // Check if detectSessionInUrl already established a session before we
      // try to exchange the code (the code is single-use).
      const { data: { session: existingSession } } = await supabase.auth.getSession();
      if (existingSession && sessionAllowsPasswordReset(existingSession)) {
        localStorage.removeItem("is_password_recovery");
        setSessionReady(true);
        setIsVerifying(false);
        window.history.replaceState({}, "", window.location.pathname);
        return;
      }

      const code = urlParams.get("code");
      const hashType = hashParams.get("type");

      // Also handle implicit flow recovery tokens in the hash
      if (hashType === "recovery" && existingSession) {
        pkceFromResetEmailRef.current = true;
        localStorage.removeItem("is_password_recovery");
        setSessionReady(true);
        setIsVerifying(false);
        window.history.replaceState({}, "", window.location.pathname);
        return;
      }

      if (code) {
        pkceFromResetEmailRef.current = true;
        try {
          const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeErr) {
            // Code may have already been consumed by detectSessionInUrl — check session again
            console.warn("[ResetPassword] Code exchange error:", exchangeErr.message);
            const { data: { session: retrySession } } = await supabase.auth.getSession();
            if (retrySession && sessionAllowsPasswordReset(retrySession)) {
              localStorage.removeItem("is_password_recovery");
              setSessionReady(true);
              setIsVerifying(false);
              window.history.replaceState({}, "", window.location.pathname);
              return;
            }
            pkceFromResetEmailRef.current = false;
          }
        } catch (err) {
          console.warn("[ResetPassword] Code exchange exception:", err);
          // Check session anyway — detectSessionInUrl may have handled it
          const { data: { session: retrySession } } = await supabase.auth.getSession();
          if (retrySession && sessionAllowsPasswordReset(retrySession)) {
            localStorage.removeItem("is_password_recovery");
            setSessionReady(true);
            setIsVerifying(false);
            window.history.replaceState({}, "", window.location.pathname);
            return;
          }
          pkceFromResetEmailRef.current = false;
        }
        window.history.replaceState({}, "", window.location.pathname);
      }

      // Also check localStorage flag — user may have been redirected here by
      // onAuthStateChange recovery detection (session already exists).
      if (localStorage.getItem("is_password_recovery") === "true") {
        const { data: { session: flagSession } } = await supabase.auth.getSession();
        if (flagSession) {
          pkceFromResetEmailRef.current = true;
          localStorage.removeItem("is_password_recovery");
          setSessionReady(true);
          setIsVerifying(false);
          return;
        }
      }

      for (let attempt = 0; attempt < 10; attempt++) {
        if (cancelled) return;
        const { data: { session } } = await supabase.auth.getSession();
        if (session && sessionAllowsPasswordReset(session)) {
          localStorage.removeItem("is_password_recovery");
          setSessionReady(true);
          setIsVerifying(false);
          return;
        }
        await new Promise((r) => setTimeout(r, attempt < 3 ? 500 : 1000));
      }

      if (!cancelled) {
        setSessionError(
          "Your password reset session has expired or the link is invalid. Please request a new one."
        );
        setIsVerifying(false);
      }
    };

    init();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) throw updateError;

      localStorage.removeItem("is_password_recovery");
      setSuccess(true);
      setTimeout(() => {
        navigate("/sign-in", { replace: true });
      }, 2500);
    } catch (err: any) {
      const msg = err.message || "";
      if (msg.toLowerCase().includes("session") || err.status === 401 || err.status === 403) {
        setSessionError("Your session has expired. Please request a new password reset link.");
        setSessionReady(false);
      } else {
        setError(msg || "Failed to update password. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isVerifying) {
    return (
      <div className="relative flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 via-green-50/30 to-emerald-50/20 p-4 overflow-hidden">
        <div className="absolute top-20 -left-20 h-72 w-72 rounded-full bg-green-200/40 blur-3xl pointer-events-none" />
        <div className="absolute bottom-20 -right-20 h-72 w-72 rounded-full bg-emerald-200/40 blur-3xl pointer-events-none" />
        <Card className="relative z-10 w-full max-w-md border border-white/60 bg-white/70 backdrop-blur-xl shadow-2xl rounded-2xl">
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <Loader2 className="h-10 w-10 text-green-600 animate-spin" />
            <p className="text-gray-600 font-medium">Verifying your reset link...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (sessionError && !sessionReady) {
    return (
      <div className="relative flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 via-green-50/30 to-emerald-50/20 p-4 overflow-hidden">
        <div className="absolute top-20 -left-20 h-72 w-72 rounded-full bg-green-200/40 blur-3xl pointer-events-none" />
        <div className="absolute bottom-20 -right-20 h-72 w-72 rounded-full bg-emerald-200/40 blur-3xl pointer-events-none" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 w-full max-w-md"
        >
          <Card className="border border-white/60 bg-white/70 backdrop-blur-xl shadow-2xl rounded-2xl">
            <CardHeader className="space-y-1 text-center pb-2">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 ring-4 ring-amber-100">
                <AlertCircle className="h-7 w-7 text-amber-500" />
              </div>
              <CardTitle className="text-2xl font-bold tracking-tight text-gray-900">
                Reset Link Expired
              </CardTitle>
              <CardDescription className="text-gray-500">
                This link has already been used or has expired.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pb-6">
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <p className="text-xs font-semibold text-amber-800 mb-1">What to do:</p>
                <ol className="text-xs text-amber-700 space-y-1 list-decimal list-inside">
                  <li>Click <strong>"Request New Reset Link"</strong> below</li>
                  <li>Enter your email → <strong>"Send Email Reset Link"</strong></li>
                  <li>Open the <strong>newest email</strong> from Mama Math</li>
                  <li>Click the link in <strong>this same browser</strong></li>
                </ol>
              </div>
              <Button
                onClick={() => navigate("/forgot-password", { replace: true })}
                className="w-full h-11 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold shadow-lg shadow-green-500/25"
              >
                Request New Reset Link
              </Button>
              <Link to="/sign-in" className="block text-center">
                <Button variant="ghost" className="w-full text-gray-600 hover:text-gray-900">
                  Back to Sign In
                </Button>
              </Link>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 via-green-50/30 to-emerald-50/20 p-4 overflow-hidden">
      <div className="absolute top-20 -left-20 h-72 w-72 rounded-full bg-green-200/40 blur-3xl pointer-events-none" />
      <div className="absolute bottom-20 -right-20 h-72 w-72 rounded-full bg-emerald-200/40 blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md"
      >
        <Card className="border border-white/60 bg-white/70 backdrop-blur-xl shadow-2xl rounded-2xl">
          <CardHeader className="space-y-1 text-center pb-2">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg shadow-green-500/20">
              {success ? (
                <CheckCircle2 className="h-7 w-7 text-white" />
              ) : (
                <ShieldCheck className="h-7 w-7 text-white" />
              )}
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight text-gray-900">
              {success ? "Password Updated!" : "Set New Password"}
            </CardTitle>
            <CardDescription className="text-gray-500">
              {success
                ? "Your password has been updated. Redirecting to sign in..."
                : "Enter your new password below."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {success ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-3 py-6"
              >
                <CheckCircle2 className="h-12 w-12 text-green-500" />
                <p className="text-green-700 text-center font-medium">
                  Redirecting to sign in...
                </p>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-gray-700 font-medium flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-green-600" /> New Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Min. 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="rounded-xl border-gray-200 focus:border-green-500 focus:ring-green-500/20 h-11 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {password && (
                    <div className="flex gap-1 mt-1">
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full transition-colors ${
                            password.length >= i * 3
                              ? password.length >= 12
                                ? "bg-green-500"
                                : password.length >= 8
                                ? "bg-yellow-500"
                                : "bg-red-400"
                              : "bg-gray-200"
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-gray-700 font-medium flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-green-600" /> Confirm Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirm ? "text" : "password"}
                      placeholder="Re-enter your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="rounded-xl border-gray-200 focus:border-green-500 focus:ring-green-500/20 h-11 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-red-500 text-sm bg-red-50 p-3 rounded-xl"
                  >
                    {error}
                  </motion.p>
                )}

                <Button
                  type="submit"
                  disabled={isSubmitting || password.length < 8}
                  className="w-full h-11 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold shadow-lg shadow-green-500/25 transition-all duration-200"
                >
                  {isSubmitting ? "Updating..." : "Update Password"}
                </Button>
              </form>
            )}
          </CardContent>
          {!success && (
            <div className="text-center text-sm text-gray-500 pb-6">
              <Link
                to="/sign-in"
                className="font-semibold text-green-600 hover:text-green-700 hover:underline transition-colors"
              >
                Back to Sign In
              </Link>
            </div>
          )}
        </Card>
      </motion.div>
    </div>
  );
};

export default ResetPassword;
