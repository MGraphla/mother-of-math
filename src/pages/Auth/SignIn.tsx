import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth, getDashboardPath } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import GoogleIcon from "@/components/icons/GoogleIcon";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Sparkles,
} from "lucide-react";

const SignIn = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { signIn, signInWithGoogle, profile, isAuthenticated } = useAuth();
  const { t } = useLanguage();

  // If already authenticated, redirect to the appropriate dashboard
  useEffect(() => {
    if (isAuthenticated && profile) {
      navigate(getDashboardPath(profile), { replace: true });
    }
  }, [isAuthenticated, profile, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      await signIn(email, password);
      // onAuthStateChange will update profile; useEffect above handles redirect
    } catch (error: any) {
      console.error("Error signing in:", error);
      setErrorMessage(error.message || "Invalid email or password. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsSubmitting(true);
      setErrorMessage("");
      await signInWithGoogle();
    } catch (error: any) {
      console.error("Error signing in with Google:", error);
      setErrorMessage(error.message || "Failed to sign in with Google.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass =
    "h-11 bg-white/70 border border-gray-200 rounded-xl px-4 text-sm focus:ring-2 focus:ring-green-500/30 focus:border-green-500 transition-all placeholder:text-gray-400";
  const labelClass = "text-sm font-medium text-gray-700 flex items-center gap-1.5";

  const mathSymbols = ['π', '∑', '√', '∞', 'Δ', '÷', '×', '+', '=', '%', '∫', 'θ'];
  const sparkleCount = 8;

  return (
    <div className="relative flex items-center justify-center min-h-screen p-4 overflow-hidden" style={{ background: 'linear-gradient(135deg, #064e3b 0%, #065f46 30%, #047857 55%, #1a3a2a 100%)' }}>

      {/* African Kente geometric pattern overlay - now slowly drifting */}
      <motion.div
        className="absolute inset-[-20%] opacity-[0.06] pointer-events-none"
        animate={{ x: [0, 30, 0], y: [0, 20, 0] }}
        transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Crect width='80' height='80' fill='none'/%3E%3Cline x1='0' y1='20' x2='80' y2='20' stroke='%23fbbf24' stroke-width='2'/%3E%3Cline x1='0' y1='40' x2='80' y2='40' stroke='%2334d399' stroke-width='2'/%3E%3Cline x1='0' y1='60' x2='80' y2='60' stroke='%23fbbf24' stroke-width='2'/%3E%3Cline x1='20' y1='0' x2='20' y2='80' stroke='%2334d399' stroke-width='2'/%3E%3Cline x1='40' y1='0' x2='40' y2='80' stroke='%23fbbf24' stroke-width='2'/%3E%3Cline x1='60' y1='0' x2='60' y2='80' stroke='%2334d399' stroke-width='2'/%3E%3Cpolygon points='20%2C14 26%2C20 20%2C26 14%2C20' fill='%23fbbf24'/%3E%3Cpolygon points='40%2C34 46%2C40 40%2C46 34%2C40' fill='%2334d399'/%3E%3Cpolygon points='60%2C14 66%2C20 60%2C26 54%2C20' fill='%23fbbf24'/%3E%3Cpolygon points='20%2C54 26%2C60 20%2C66 14%2C60' fill='%2334d399'/%3E%3Cpolygon points='60%2C54 66%2C60 60%2C66 54%2C60' fill='%23fbbf24'/%3E%3C/svg%3E")`, backgroundRepeat: 'repeat', backgroundSize: '80px 80px' }}
      />

      {/* Animated amber/gold glowing orbs */}
      <motion.div className="absolute top-[-80px] right-[-80px] w-[420px] h-[420px] rounded-full pointer-events-none" animate={{ scale: [1, 1.15, 1], opacity: [0.25, 0.4, 0.25] }} transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }} style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.5) 0%, rgba(245,158,11,0.15) 60%, transparent 100%)' }} />
      <motion.div className="absolute bottom-[-100px] left-[-100px] w-[500px] h-[500px] rounded-full pointer-events-none" animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.35, 0.2] }} transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut', delay: 2 }} style={{ background: 'radial-gradient(circle, rgba(52,211,153,0.4) 0%, rgba(16,185,129,0.1) 60%, transparent 100%)' }} />
      <motion.div className="absolute top-1/2 left-[-60px] w-[300px] h-[300px] rounded-full pointer-events-none" animate={{ scale: [1, 1.1, 1], opacity: [0.15, 0.28, 0.15] }} transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut', delay: 4 }} style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.35) 0%, transparent 70%)' }} />

      {/* Floating math symbols - with rotation */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {mathSymbols.map((sym, i) => (
          <motion.span
            key={i}
            className="absolute font-bold text-white/10 select-none"
            style={{ left: `${(i * 8.3) % 100}%`, top: `${(i * 13 + 10) % 90}%`, fontSize: `${20 + (i % 3) * 12}px` }}
            animate={{ y: [0, -40, 0], opacity: [0.05, 0.2, 0.05], rotate: [0, 360] }}
            transition={{ duration: 12 + i * 1.5, repeat: Infinity, ease: 'easeInOut', delay: i * 0.5 }}
          >
            {sym}
          </motion.span>
        ))}
      </div>

      {/* Shooting sparkle particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: sparkleCount }).map((_, i) => (
          <motion.div
            key={`sparkle-${i}`}
            className="absolute w-1 h-1 bg-amber-300 rounded-full"
            style={{ left: `${10 + i * 11}%`, top: '-5%' }}
            animate={{
              y: ['0vh', '110vh'],
              x: [0, (i % 2 === 0 ? 30 : -30)],
              opacity: [0, 1, 1, 0],
              scale: [0.5, 1.2, 1, 0.5],
            }}
            transition={{
              duration: 4 + i * 0.8,
              repeat: Infinity,
              ease: 'linear',
              delay: i * 1.2,
            }}
          />
        ))}
      </div>

      {/* Top-left decorative triangle accent */}
      <div className="absolute top-0 left-0 w-0 h-0 pointer-events-none" style={{ borderLeft: '120px solid rgba(251,191,36,0.12)', borderBottom: '120px solid transparent' }} />
      {/* Bottom-right decorative triangle accent */}
      <div className="absolute bottom-0 right-0 w-0 h-0 pointer-events-none" style={{ borderRight: '150px solid rgba(52,211,153,0.1)', borderTop: '150px solid transparent' }} />

      {/* Pulsing glow behind the card */}
      <motion.div
        className="absolute w-[500px] h-[500px] rounded-full pointer-events-none"
        animate={{ scale: [1, 1.15, 1], opacity: [0.15, 0.3, 0.15] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.25) 0%, transparent 60%)' }}
      />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="bg-white/80 backdrop-blur-xl border border-white/60 rounded-3xl shadow-2xl shadow-green-900/5 overflow-hidden">
          {/* Header */}
          <div className="relative px-6 pt-8 pb-6 text-center bg-gradient-to-b from-green-50/80 to-transparent">
            <Link to="/" className="inline-flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-full overflow-hidden shadow-lg shadow-green-500/20 flex-shrink-0">
                <img src="/mama%20math.svg" alt="MAMA" className="w-full h-full object-cover" />
              </div>
              <span className="text-lg font-extrabold bg-gradient-to-r from-green-600 to-emerald-500 bg-clip-text text-transparent">
                Mama Math
              </span>
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
              {t('auth.welcomeBack')}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {t('auth.signInContinue')}
            </p>
          </div>

          {/* Form */}
          <div className="px-6 pb-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className={labelClass}>
                  <Mail className="h-3.5 w-3.5 text-green-600" /> {t('auth.email')}
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className={inputClass}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label htmlFor="password" className={labelClass}>
                    <Lock className="h-3.5 w-3.5 text-green-600" /> {t('auth.password')}
                  </Label>
                  <Link
                    to="/forgot-password"
                    className="text-xs text-green-600 hover:text-green-700 font-medium hover:underline transition-colors"
                  >
                    {t('auth.forgotPassword')}
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className={`${inputClass} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Error */}
              <AnimatePresence>
                {errorMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm"
                  >
                    {errorMessage}
                  </motion.div>
                )}
              </AnimatePresence>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-11 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg shadow-green-500/25 font-semibold transition-all duration-300"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {t('auth.signingIn')}
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    {t('auth.signIn')} <ArrowRight className="h-4 w-4 ml-1" />
                  </span>
                )}
              </Button>
            </form>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-3 text-gray-400 font-medium">{t('auth.orContinueWith')}</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full h-11 rounded-xl border-gray-200 hover:bg-gray-50 font-medium text-gray-700 transition-all"
              onClick={handleGoogleSignIn}
              disabled={isSubmitting}
            >
              <GoogleIcon className="mr-2 h-4 w-4" />
              {t('auth.continueWithGoogle')}
            </Button>

            {/* Student login link */}
            <div className="mt-4 text-center">
              <Link
                to="/student-login"
                className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-green-600 transition-colors font-medium"
              >
                <Sparkles className="h-3 w-3" /> {t('auth.studentSignIn')}
              </Link>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-gray-100 px-6 py-4 text-center bg-gray-50/50">
            <p className="text-sm text-gray-500">
              {t('auth.dontHaveAccount')}{" "}
              <Link
                to="/sign-up"
                className="font-semibold text-green-600 hover:text-green-700 hover:underline transition-colors"
              >
                {t('auth.signUpFree')}
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default SignIn;
