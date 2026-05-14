import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useAuth, getDashboardPath } from "@/context/AuthContext";
import { supabase, getUserProfile } from "@/lib/supabase";
import {
  Mail,
  MessageSquare,
  ArrowLeft,
  CheckCircle2,
  Phone,
  Loader2,
  ShieldCheck,
  Eye,
  EyeOff,
  Lock,
  RefreshCw,
  ChevronRight,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────
type Step = "method" | "email_form" | "email_sent" | "phone_form" | "otp_form" | "password_form" | "done";

const RESEND_COOLDOWN_S = 60;

const COUNTRIES = [
  { label: "Cameroon (+237)", value: "Cameroon" },
  { label: "Nigeria (+234)", value: "Nigeria" },
  { label: "Other (enter with +)", value: "Other" },
];

// ── Edge function helper ─────────────────────────────────────
function mapVerificationInvokeError(bodyError: string, fallback: string): string {
  const m = (bodyError || fallback).trim();
  if (/unknown action/i.test(m)) {
    return "Password reset could not verify this code because the server is running an older verification build. Deploy the latest signup-verification Edge Function, then try again.";
  }
  return m || fallback;
}

async function invokeVerification(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.functions.invoke("signup-verification", { body });
  const bodyError =
    data && typeof data === "object" && "error" in data
      ? String((data as { error: string }).error)
      : "";
  if (error) {
    throw new Error(
      mapVerificationInvokeError(
        bodyError,
        error instanceof Error ? error.message : String(error),
      ),
    );
  }
  const d = data as Record<string, unknown>;
  if (d && "ok" in d && d.ok === false) {
    throw new Error(mapVerificationInvokeError(bodyError, "Request failed."));
  }
  return d ?? {};
}

// ── Component ────────────────────────────────────────────────
const ForgotPassword = () => {
  const navigate = useNavigate();
  const { sendPasswordReset } = useAuth();

  const [step, setStep] = useState<Step>("method");

  // ── Email path state
  const [email, setEmail] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState("");

  // ── SMS path state
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("Cameroon");
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [phoneError, setPhoneError] = useState("");
  const [maskedPhone, setMaskedPhone] = useState("");
  const [emailToken, setEmailToken] = useState(""); // challenge key (user's account email)

  // ── OTP state
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [otpError, setOtpError] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendLoading, setResendLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Password state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdError, setPwdError] = useState("");

  // ── Resend cooldown timer ────────────────────────────────────
  useEffect(() => {
    if (resendCooldown <= 0) return;
    cooldownRef.current = setInterval(() => {
      setResendCooldown((s) => {
        if (s <= 1) { clearInterval(cooldownRef.current!); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => { if (cooldownRef.current) clearInterval(cooldownRef.current); };
  }, [resendCooldown]);

  // ── Email path ───────────────────────────────────────────────
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError("");
    setEmailLoading(true);
    try {
      await sendPasswordReset(email.trim());
      setStep("email_sent");
    } catch (err: any) {
      setEmailError(err.message || "Failed to send reset email. Please try again.");
    } finally {
      setEmailLoading(false);
    }
  };

  // ── SMS path — send code ─────────────────────────────────────
  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError("");
    if (!phone.trim()) { setPhoneError("Please enter your phone number."); return; }
    setPhoneLoading(true);
    try {
      const result = await invokeVerification({
        action: "start_password_reset_by_phone",
        phone: phone.trim(),
        country,
        channel: "sms",
      });
      setMaskedPhone(String(result.masked_phone ?? phone));
      setEmailToken(String(result.email_token ?? ""));
      setStep("otp_form");
      setResendCooldown(RESEND_COOLDOWN_S);
      setOtp(["", "", "", "", "", ""]);
      setTimeout(() => inputRefs.current[0]?.focus(), 150);
    } catch (err: any) {
      setPhoneError(err.message || "Could not send code. Please check your number and try again.");
    } finally {
      setPhoneLoading(false);
    }
  };

  // ── OTP helpers ──────────────────────────────────────────────
  const handleOtpChange = (i: number, val: string) => {
    const d = val.replace(/\D/g, "").slice(-1);
    const next = [...otp]; next[i] = d;
    setOtp(next); setOtpError("");
    if (d && i < 5) inputRefs.current[i + 1]?.focus();
  };

  const handleOtpKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[i] && i > 0) inputRefs.current[i - 1]?.focus();
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!digits) return;
    e.preventDefault();
    const next = [...otp];
    digits.split("").forEach((d, i) => { next[i] = d; });
    setOtp(next);
    inputRefs.current[Math.min(digits.length, 5)]?.focus();
  };

  const handleOtpSubmit = async () => {
    const code = otp.join("");
    if (code.length < 6) { setOtpError("Please enter all 6 digits."); return; }
    setOtpError(""); setOtpLoading(true);
    try {
      // Validate the code server-side BEFORE asking for a new password.
      // The challenge row is not consumed here; verify_and_set_password does
      // the final atomic verify-and-update on submit.
      await invokeVerification({
        action:      "verify_password_reset_otp",
        email_token: emailToken,
        code,
      });
      setStep("password_form");
    } catch (err: any) {
      const msg = String(err?.message || "Invalid code. Please try again.");
      setOtpError(msg);
      // If the code was wrong, blank it so the user re-enters.
      if (msg.toLowerCase().includes("invalid") || msg.toLowerCase().includes("expired")) {
        setOtp(["", "", "", "", "", ""]);
        setTimeout(() => inputRefs.current[0]?.focus(), 50);
      }
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setResendLoading(true); setOtpError(""); setOtp(["", "", "", "", "", ""]);
    try {
      await invokeVerification({ action: "resend_password_reset_by_phone", email_token: emailToken, channel: "sms" });
      setResendCooldown(RESEND_COOLDOWN_S);
      setTimeout(() => inputRefs.current[0]?.focus(), 150);
    } catch (err: any) {
      setOtpError(err.message || "Failed to resend. Please try again.");
    } finally {
      setResendLoading(false);
    }
  };

  // ── Password submit — verifies OTP + sets new password in one call ──
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError("");
    if (newPassword.length < 8) { setPwdError("Password must be at least 8 characters."); return; }
    if (newPassword !== confirmPassword) { setPwdError("Passwords do not match."); return; }
    const code = otp.join("");
    if (code.length < 6) {
      // Send them back to OTP step if somehow code got lost.
      setStep("otp_form");
      setOtpError("Please enter the 6-digit code first.");
      return;
    }
    setPwdLoading(true);
    try {
      await invokeVerification({
        action:       "verify_and_set_password",
        email_token:  emailToken,
        code,
        new_password: newPassword,
      });

      // Password is now stored on the auth user. Sign the user in fresh with
      // the new credentials — this proves the password really works AND
      // delivers them straight to their dashboard (no manual sign-in).
      // Clear any stale local session first.
      await supabase.auth.signOut({ scope: "local" }).catch(() => {});
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email:    emailToken,
        password: newPassword,
      });

      setStep("done");
      if (signInErr) {
        // Password was saved but auto sign-in failed — fall back to manual.
        console.warn("[ForgotPassword] auto sign-in failed:", signInErr.message);
        setTimeout(() => navigate("/sign-in", { replace: true }), 2500);
        return;
      }

      // Route to the user's role-specific dashboard.
      try {
        const { data: { user: u } } = await supabase.auth.getUser();
        const profile = u ? await getUserProfile(u.id) : null;
        setTimeout(() => navigate(getDashboardPath(profile), { replace: true }), 1500);
      } catch {
        setTimeout(() => navigate("/dashboard", { replace: true }), 1500);
      }
    } catch (err: any) {
      const msg = String(err.message || "");
      // If the error is about the code, send back to OTP step.
      if (msg.toLowerCase().includes("code") || msg.toLowerCase().includes("attempt") || msg.toLowerCase().includes("expired")) {
        setStep("otp_form");
        setOtp(["", "", "", "", "", ""]);
        setOtpError(msg || "Invalid code. Please try again.");
      } else {
        setPwdError(msg || "Failed to update password. Please try again.");
      }
    } finally {
      setPwdLoading(false);
    }
  };

  // ── Password strength indicator ──────────────────────────────
  const pwdStrength = (p: string) => {
    if (p.length === 0) return 0;
    if (p.length < 6) return 1;
    if (p.length < 8) return 2;
    if (p.length < 12) return 3;
    return 4;
  };
  const strengthColor = ["", "bg-red-400", "bg-orange-400", "bg-yellow-500", "bg-green-500"];
  const strengthLabel = ["", "Too short", "Weak", "Good", "Strong"];

  // ── Shared decorations ───────────────────────────────────────
  const Bg = () => (
    <>
      <div className="absolute top-20 -left-20 h-72 w-72 rounded-full bg-green-200/40 blur-3xl pointer-events-none" />
      <div className="absolute bottom-20 -right-20 h-72 w-72 rounded-full bg-emerald-200/40 blur-3xl pointer-events-none" />
    </>
  );

  const wrap = (children: React.ReactNode) => (
    <div className="relative flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 via-green-50/30 to-emerald-50/20 p-4 overflow-hidden">
      <Bg />
      <motion.div
        key={step}
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="relative z-10 w-full max-w-md"
      >
        {children}
      </motion.div>
    </div>
  );

  // ════════════════════════════════════════════════════════════
  // STEP: method selection
  // ════════════════════════════════════════════════════════════
  if (step === "method") return wrap(
    <Card className="border border-white/60 bg-white/70 backdrop-blur-xl shadow-2xl rounded-2xl overflow-hidden">
      <CardHeader className="space-y-1 text-center pb-2">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg">
          <ShieldCheck className="h-7 w-7 text-white" />
        </div>
        <CardTitle className="text-2xl font-bold text-gray-900">Forgot Password?</CardTitle>
        <CardDescription className="text-gray-500">
          How would you like to reset your password?
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pb-6">
        {/* Email option */}
        <button
          onClick={() => setStep("email_form")}
          className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-gray-200 hover:border-green-400 hover:bg-green-50 transition-all group text-left"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-100 group-hover:bg-blue-200 transition-colors">
            <Mail className="h-5 w-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-gray-800">Reset via Email</p>
            <p className="text-xs text-gray-500">Receive a reset link to your inbox</p>
          </div>
          <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-green-600 transition-colors" />
        </button>

        {/* SMS option */}
        <button
          onClick={() => setStep("phone_form")}
          className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-gray-200 hover:border-green-400 hover:bg-green-50 transition-all group text-left"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-green-100 group-hover:bg-green-200 transition-colors">
            <MessageSquare className="h-5 w-5 text-green-600" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-gray-800">Reset via SMS</p>
            <p className="text-xs text-gray-500">Receive a code on your registered phone</p>
          </div>
          <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-green-600 transition-colors" />
        </button>

        <div className="text-center pt-2">
          <Link to="/sign-in" className="inline-flex items-center gap-1 text-sm font-semibold text-green-600 hover:text-green-700 hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Sign In
          </Link>
        </div>
      </CardContent>
    </Card>
  );

  // ════════════════════════════════════════════════════════════
  // STEP: email form
  // ════════════════════════════════════════════════════════════
  if (step === "email_form") return wrap(
    <Card className="border border-white/60 bg-white/70 backdrop-blur-xl shadow-2xl rounded-2xl">
      <CardHeader className="space-y-1 text-center pb-2">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg">
          <Mail className="h-7 w-7 text-white" />
        </div>
        <CardTitle className="text-2xl font-bold text-gray-900">Reset via Email</CardTitle>
        <CardDescription className="text-gray-500">Enter your account email address.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleEmailSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="font-medium text-gray-700">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="your.email@example.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setEmailError(""); }}
              required
              autoFocus
              className="rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500/20 h-11"
            />
          </div>
          <AnimatePresence>
            {emailError && (
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="text-red-500 text-sm bg-red-50 p-2.5 rounded-xl">
                {emailError}
              </motion.p>
            )}
          </AnimatePresence>
          <Button type="submit" disabled={emailLoading}
            className="w-full h-11 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold shadow-lg shadow-blue-500/25">
            {emailLoading
              ? <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Sending…</span>
              : "Send Reset Link"}
          </Button>
        </form>
      </CardContent>
      <div className="text-center text-sm pb-6">
        <button onClick={() => setStep("method")}
          className="inline-flex items-center gap-1 font-semibold text-green-600 hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
      </div>
    </Card>
  );

  // ════════════════════════════════════════════════════════════
  // STEP: email sent success
  // ════════════════════════════════════════════════════════════
  if (step === "email_sent") return wrap(
    <Card className="border border-white/60 bg-white/70 backdrop-blur-xl shadow-2xl rounded-2xl">
      <CardContent className="flex flex-col items-center gap-4 py-10 px-6">
        <CheckCircle2 className="h-16 w-16 text-green-500" />
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-1">Check Your Inbox</h2>
          <p className="text-gray-500 text-sm">
            A reset link has been sent to{" "}
            <span className="font-semibold text-gray-700">{email}</span>.
            Click the link to set a new password.
          </p>
        </div>
        <Link to="/sign-in" className="w-full">
          <Button variant="outline" className="w-full rounded-xl gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to Sign In
          </Button>
        </Link>
      </CardContent>
    </Card>
  );

  // ════════════════════════════════════════════════════════════
  // STEP: phone form (enter phone number)
  // ════════════════════════════════════════════════════════════
  if (step === "phone_form") return wrap(
    <Card className="border border-white/60 bg-white/70 backdrop-blur-xl shadow-2xl rounded-2xl">
      <CardHeader className="space-y-1 text-center pb-2">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg">
          <Phone className="h-7 w-7 text-white" />
        </div>
        <CardTitle className="text-2xl font-bold text-gray-900">Reset via Phone</CardTitle>
        <CardDescription className="text-gray-500">
          Enter the phone number linked to your account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handlePhoneSubmit} className="space-y-4">
          {/* Country */}
          <div className="space-y-2">
            <Label className="font-medium text-gray-700">Country</Label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20"
            >
              {COUNTRIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* Phone number */}
          <div className="space-y-2">
            <Label htmlFor="phone" className="font-medium text-gray-700">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              placeholder={country === "Cameroon" ? "6XXXXXXXX" : country === "Nigeria" ? "08XXXXXXXXX" : "+XX XXXXXXXXXX"}
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setPhoneError(""); }}
              required
              autoFocus
              className="rounded-xl border-gray-200 focus:border-green-500 focus:ring-green-500/20 h-11"
            />
          </div>

          <AnimatePresence>
            {phoneError && (
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="text-red-500 text-sm bg-red-50 p-2.5 rounded-xl">
                {phoneError}
              </motion.p>
            )}
          </AnimatePresence>

          <Button type="submit" disabled={phoneLoading}
            className="w-full h-11 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold shadow-lg shadow-green-500/25">
            {phoneLoading
              ? <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Sending Code…</span>
              : "Send Verification Code"}
          </Button>
        </form>
      </CardContent>
      <div className="text-center text-sm pb-6">
        <button onClick={() => setStep("method")}
          className="inline-flex items-center gap-1 font-semibold text-green-600 hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
      </div>
    </Card>
  );

  // ════════════════════════════════════════════════════════════
  // STEP: OTP entry
  // ════════════════════════════════════════════════════════════
  if (step === "otp_form") {
    const codeFilled = otp.every((d) => d !== "");
    return wrap(
      <Card className="border border-white/60 bg-white/70 backdrop-blur-xl shadow-2xl rounded-2xl">
        <CardHeader className="space-y-1 text-center pb-2">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg">
            <MessageSquare className="h-7 w-7 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">Enter Verification Code</CardTitle>
          <CardDescription className="text-gray-500">
            A 6-digit code was sent via <span className="font-semibold">SMS</span> to{" "}
            <span className="font-semibold text-gray-700">{maskedPhone}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* OTP boxes */}
          <div className="flex justify-center gap-2" onPaste={handleOtpPaste}>
            {otp.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleOtpChange(i, e.target.value)}
                onKeyDown={(e) => handleOtpKey(i, e)}
                className={`w-11 text-center text-xl font-bold rounded-xl border-2 bg-white outline-none transition-all ${
                  digit ? "border-green-500 bg-green-50 text-green-700" : "border-gray-200"
                } focus:border-green-500 focus:ring-2 focus:ring-green-500/20`}
                style={{ height: "3.25rem" }}
              />
            ))}
          </div>

          <AnimatePresence>
            {otpError && (
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="text-red-500 text-sm bg-red-50 p-3 rounded-xl text-center">
                {otpError}
              </motion.p>
            )}
          </AnimatePresence>

          <Button onClick={handleOtpSubmit} disabled={!codeFilled || otpLoading}
            className="w-full h-11 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold shadow-lg shadow-green-500/25">
            {otpLoading
              ? <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Verifying…</span>
              : "Continue"}
          </Button>

          {/* Resend */}
          <div className="flex items-center justify-center gap-1.5 text-sm text-gray-500">
            <span>Didn't receive it?</span>
            <button type="button" onClick={() => handleResend()}
              disabled={resendCooldown > 0 || resendLoading}
              className="text-green-600 font-semibold hover:underline disabled:opacity-50 flex items-center gap-1">
              {resendLoading
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending…</>
                : resendCooldown > 0
                ? <><RefreshCw className="h-3.5 w-3.5" /> Resend in {resendCooldown}s</>
                : <><RefreshCw className="h-3.5 w-3.5" /> Resend</>}
            </button>
          </div>
        </CardContent>
        <div className="text-center text-sm pb-6">
          <button onClick={() => setStep("phone_form")}
            className="inline-flex items-center gap-1 font-semibold text-green-600 hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
        </div>
      </Card>
    );
  }

  // ════════════════════════════════════════════════════════════
  // STEP: new password form
  // ════════════════════════════════════════════════════════════
  if (step === "password_form") {
    const strength = pwdStrength(newPassword);
    return wrap(
      <Card className="border border-white/60 bg-white/70 backdrop-blur-xl shadow-2xl rounded-2xl">
        <CardHeader className="space-y-1 text-center pb-2">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg">
            <Lock className="h-7 w-7 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">Create New Password</CardTitle>
          <CardDescription className="text-gray-500">
            Choose a strong password for your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            {/* New password */}
            <div className="space-y-2">
              <Label htmlFor="newpwd" className="font-medium text-gray-700 flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-green-600" /> New Password
              </Label>
              <div className="relative">
                <Input
                  id="newpwd"
                  type={showPwd ? "text" : "password"}
                  placeholder="Minimum 8 characters"
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); setPwdError(""); }}
                  required
                  autoFocus
                  className="rounded-xl border-gray-200 focus:border-green-500 focus:ring-green-500/20 h-11 pr-10"
                />
                <button type="button" onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {/* Strength bar */}
              {newPassword && (
                <div className="space-y-1">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i}
                        className={`h-1 flex-1 rounded-full transition-colors ${i <= strength ? strengthColor[strength] : "bg-gray-200"}`} />
                    ))}
                  </div>
                  <p className={`text-xs font-medium ${strength >= 3 ? "text-green-600" : "text-gray-500"}`}>
                    {strengthLabel[strength]}
                  </p>
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div className="space-y-2">
              <Label htmlFor="confirmpwd" className="font-medium text-gray-700 flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-green-600" /> Confirm Password
              </Label>
              <div className="relative">
                <Input
                  id="confirmpwd"
                  type={showConfirm ? "text" : "password"}
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setPwdError(""); }}
                  required
                  className="rounded-xl border-gray-200 focus:border-green-500 focus:ring-green-500/20 h-11 pr-10"
                />
                <button type="button" onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {confirmPassword && newPassword && confirmPassword.length >= 4 && (
                <p className={`text-xs font-medium flex items-center gap-1 ${newPassword === confirmPassword ? "text-green-600" : "text-red-500"}`}>
                  {newPassword === confirmPassword ? <><CheckCircle2 className="h-3 w-3" /> Passwords match</> : "Passwords do not match"}
                </p>
              )}
            </div>

            <AnimatePresence>
              {pwdError && (
                <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="text-red-500 text-sm bg-red-50 p-3 rounded-xl">
                  {pwdError}
                </motion.p>
              )}
            </AnimatePresence>

            <Button type="submit"
              disabled={pwdLoading || newPassword.length < 8 || newPassword !== confirmPassword}
              className="w-full h-11 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold shadow-lg shadow-green-500/25">
              {pwdLoading
                ? <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Saving…</span>
                : "Save New Password"}
            </Button>
          </form>
        </CardContent>
        <div className="text-center text-sm pb-6">
          <button onClick={() => setStep("otp_form")}
            className="inline-flex items-center gap-1 font-semibold text-green-600 hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
        </div>
      </Card>
    );
  }

  // ════════════════════════════════════════════════════════════
  // STEP: done
  // ════════════════════════════════════════════════════════════
  return wrap(
    <Card className="border border-white/60 bg-white/70 backdrop-blur-xl shadow-2xl rounded-2xl">
      <CardContent className="flex flex-col items-center gap-5 py-10 px-6 text-center">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
        >
          <CheckCircle2 className="h-20 w-20 text-green-500" />
        </motion.div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-1">Password Changed!</h2>
          <p className="text-gray-500 text-sm">
            Your new password is active. Signing you in and taking you to your dashboard…
          </p>
        </div>
        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full"
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 1.5, ease: "linear" }}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default ForgotPassword;
