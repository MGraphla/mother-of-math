import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth, getDashboardPath } from "@/context/AuthContext";
import { BookHeart, Mail, CheckCircle2, Loader2, RotateCcw, ShieldCheck } from "lucide-react";

const VerifyEmail = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { verifyOtp, resendOtp, profile } = useAuth();

  // Email passed via navigation state from SignUp, fallback to sessionStorage
  const email: string = (location.state as any)?.email ?? sessionStorage.getItem('verify_email') ?? "";

  // Persist email to sessionStorage so page refresh doesn't lose it
  useEffect(() => {
    if (email) sessionStorage.setItem('verify_email', email);
  }, [email]);

  const [token, setToken] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);

  // If there's no email, redirect back to signup
  useEffect(() => {
    if (!email) navigate("/sign-up", { replace: true });
  }, [email, navigate]);

  // Countdown for resend cooldown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setInterval(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearInterval(id);
  }, [resendCooldown]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // ── Verify ───────────────────────────────────────────
  const handleVerify = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = token.trim();
    if (trimmed.length < 6) {
      setError("Please enter your verification code.");
      return;
    }

    setIsVerifying(true);
    setError("");
    try {
      // verifyOtp now returns quickly — profile creation happens in background
      await verifyOtp(email, trimmed);

      // Verification succeeded! Show success state.
      setSuccess(true);
      sessionStorage.removeItem('verify_email');

      // Determine the correct dashboard from pending_profile (sessionStorage)
      // since the profile state hasn't propagated yet.
      const pendingRaw = sessionStorage.getItem('pending_profile');
      let role: string | null = null;
      if (pendingRaw) {
        try { role = JSON.parse(pendingRaw).role; } catch {}
      }
      if (!role) {
        role = profile?.role ?? null;
      }

      const dashPath = role === 'student' ? '/student'
        : role === 'parent' ? '/parent-dashboard'
        : '/dashboard';

      // Small delay for the success animation, then navigate
      setTimeout(() => {
        navigate(dashPath, { replace: true });
      }, 1800);
    } catch (err: any) {
      console.error("OTP verification error:", err);
      setError(err.message || "Invalid or expired code. Please try again.");
      setToken("");
      inputRef.current?.focus();
    } finally {
      setIsVerifying(false);
    }
  };

  // ── Resend ───────────────────────────────────────────
  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setIsResending(true);
    setError("");
    try {
      await resendOtp(email);
      setResendCooldown(60);
    } catch (err: any) {
      setError(err.message || "Failed to resend code.");
    } finally {
      setIsResending(false);
    }
  };

  // ── Render ───────────────────────────────────────────
  return (
    <div className="relative flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 via-green-50/30 to-emerald-50/40 p-4 overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute top-20 -left-20 h-72 w-72 rounded-full bg-green-200/40 blur-3xl pointer-events-none" />
      <div className="absolute bottom-20 -right-20 h-72 w-72 rounded-full bg-emerald-200/40 blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="border border-white/60 bg-white/80 backdrop-blur-xl shadow-2xl rounded-3xl overflow-hidden">
          {/* Header */}
          <div className="text-center pb-2 bg-gradient-to-b from-green-50/80 to-transparent pt-8 px-6">
            <Link to="/" className="inline-flex items-center justify-center gap-2 mb-4">
              <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-2 rounded-xl shadow-lg shadow-green-500/20">
                <BookHeart className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-extrabold bg-gradient-to-r from-green-600 to-emerald-500 bg-clip-text text-transparent">
                Mama Math
              </span>
            </Link>

            <AnimatePresence mode="wait">
              {success ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center gap-3 pb-8"
                >
                  <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center ring-4 ring-green-200">
                    <CheckCircle2 className="h-8 w-8 text-green-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">Email Verified!</h2>
                  <p className="text-gray-500 text-sm">
                    Your account is ready. Redirecting to your dashboard...
                  </p>
                  <Loader2 className="h-5 w-5 animate-spin text-green-500 mt-2" />
                </motion.div>
              ) : (
                <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg shadow-green-500/20">
                    <Mail className="h-7 w-7 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">Check your email</h2>
                  <p className="text-gray-500 text-sm mt-1 mb-1">
                    We sent a verification code to
                  </p>
                  <p className="font-semibold text-gray-800 text-sm">{email}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {!success && (
            <div className="px-6 pb-8 pt-4 space-y-5">
              <form onSubmit={handleVerify} className="space-y-5">
                {/* Token Input */}
                <div className="space-y-2">
                  <label htmlFor="verification-code" className="block text-sm font-medium text-gray-700 text-center">
                    Enter verification code
                  </label>
                  <input
                    ref={inputRef}
                    id="verification-code"
                    type="text"
                    inputMode="numeric"
                    value={token}
                    onChange={(e) => {
                      setToken(e.target.value.replace(/[^0-9]/g, ""));
                      setError("");
                    }}
                    placeholder="Enter your code here"
                    className={`w-full h-14 text-center text-2xl font-bold tracking-[0.3em] rounded-xl border-2 transition-all duration-200 outline-none bg-white/70
                      ${token ? "border-green-400 bg-green-50/30" : "border-gray-200"}
                      focus:border-green-500 focus:ring-4 focus:ring-green-500/20
                      ${error ? "border-red-300 bg-red-50/30" : ""}
                      placeholder:text-gray-300 placeholder:text-base placeholder:tracking-normal placeholder:font-normal
                    `}
                    autoComplete="one-time-code"
                    autoFocus
                  />
                  <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>Paste the full code from your email</span>
                  </div>
                </div>

                {/* Error */}
                <AnimatePresence>
                  {error && (
                    <motion.p
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="text-sm text-red-600 text-center bg-red-50 border border-red-100 p-3 rounded-xl"
                    >
                      {error}
                    </motion.p>
                  )}
                </AnimatePresence>

                {/* Verify button */}
                <button
                  type="submit"
                  disabled={isVerifying || token.length < 6}
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold text-base
                    shadow-lg shadow-green-600/25 hover:shadow-green-600/40
                    transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0
                    disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0
                    flex items-center justify-center gap-2"
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin text-white" />
                      <span className="text-white">Verifying...</span>
                    </>
                  ) : (
                    <span className="text-white">Verify Email</span>
                  )}
                </button>
              </form>

              {/* Resend */}
              <div className="text-center space-y-2 pt-1">
                <p className="text-sm text-gray-500">Didn't receive the code?</p>
                <button
                  onClick={handleResend}
                  disabled={isResending || resendCooldown > 0}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm
                    bg-green-50 text-green-700 border border-green-200
                    hover:bg-green-100 hover:border-green-300
                    transition-all duration-200
                    disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isResending ? (
                    <Loader2 className="h-4 w-4 animate-spin text-green-700" />
                  ) : (
                    <RotateCcw className="h-4 w-4 text-green-700" />
                  )}
                  <span className="text-green-700">
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
                  </span>
                </button>
              </div>

              <p className="text-xs text-gray-400 text-center">
                Check your spam/junk folder if you don't see the email.{" "}
                <Link to="/sign-up" className="text-green-600 hover:underline font-medium">
                  Try different email
                </Link>
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default VerifyEmail;
