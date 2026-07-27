import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Eye,
  EyeOff,
  KeyRound,
  AlertCircle,
  Mail,
  ArrowRight,
} from 'lucide-react';
import { isMonitorAuthenticated, monitorLogin } from '../auth/monitorAuth';
import { QedaGlyph } from '../components/QedaBrand';
import { MAMA_MATH_LOGO_URL, MONITOR_LOGIN_BG_URL } from '../branding';

/** QEDA wordmark + colour-bar palette (login page accents). */
const QEDA = {
  blue: '#0B5CB5',
  blueLight: '#3B9AE8',
  blueSoft: '#8EC5F0',
  green: '#0FA968',
  greenLight: '#5ED99E',
  red: '#E52528',
  yellow: '#FFD400',
  yellowSoft: '#FFE566',
} as const;

const MonitorLogin = () => {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isMonitorAuthenticated()) navigate('/monitor/overview', { replace: true });
  }, [navigate]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    // Tiny delay so users see the animated state
    setTimeout(() => {
      const result = monitorLogin(password, email);
      setSubmitting(false);
      if (!result.success) {
        setError(result.error ?? 'Login failed.');
        return;
      }
      navigate('/monitor/overview', { replace: true });
    }, 450);
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#06140b] text-slate-100">
      {/* ── Background image layer ─────────────────────────────────── */}
      <div className="absolute inset-0">
        <img
          src={MONITOR_LOGIN_BG_URL}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        {/* Vignettes & brand overlay — lighter so the photo stays visible */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#04180e]/68 via-[#04180e]/42 to-[#0a1f14]/28" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#04180e]/78 via-[#04180e]/22 to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(11,92,181,0.14),transparent_55%),radial-gradient(circle_at_80%_70%,rgba(255,212,0,0.1),transparent_55%)]" />
      </div>

      {/* ── Animated glow orbs ─────────────────────────────────────── */}
      {!reduceMotion && (
        <>
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -top-32 -right-24 h-[420px] w-[420px] rounded-full blur-3xl"
            style={{ backgroundColor: `${QEDA.blueLight}33` }}
            animate={{ y: [0, 30, 0], x: [0, -20, 0], scale: [1, 1.08, 1] }}
            transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -bottom-32 -left-20 h-[460px] w-[460px] rounded-full blur-3xl"
            style={{ backgroundColor: `${QEDA.yellow}2E` }}
            animate={{ y: [0, -25, 0], x: [0, 25, 0], scale: [1, 1.12, 1] }}
            transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            aria-hidden
            className="pointer-events-none absolute top-1/3 left-1/2 h-[260px] w-[260px] -translate-x-1/2 rounded-full blur-3xl"
            style={{ backgroundColor: `${QEDA.green}2E` }}
            animate={{ scale: [1, 1.18, 1], opacity: [0.6, 0.9, 0.6] }}
            transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
          />
        </>
      )}

      {/* ── Floating particles ─────────────────────────────────────── */}
      {!reduceMotion && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {Array.from({ length: 18 }).map((_, i) => (
            <motion.span
              key={i}
              className="absolute h-1 w-1 rounded-full shadow-[0_0_8px_rgba(59,154,232,0.85)]"
              style={{ backgroundColor: QEDA.blueSoft }}
              initial={{
                x: `${(i * 53) % 100}%`,
                y: '110%',
                opacity: 0,
              }}
              animate={{
                y: '-10%',
                opacity: [0, 1, 1, 0],
              }}
              transition={{
                duration: 9 + (i % 5) * 2,
                repeat: Infinity,
                delay: (i % 7) * 1.2,
                ease: 'linear',
              }}
            />
          ))}
        </div>
      )}

      {/* ── Content layout ─────────────────────────────────────────── */}
      <div className="relative z-10 flex min-h-screen flex-col lg:flex-row">
        {/* Left brand panel — static hero, logo aligned with type */}
        <section className="relative hidden min-h-screen w-[52%] flex-col items-stretch justify-center border-r border-[#3B9AE8]/15 bg-gradient-to-r from-black/22 via-black/15 to-transparent xl:w-[55%] 2xl:w-3/5 lg:flex">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-[#3B9AE8]/30 to-transparent"
          />
          <div className="relative z-[1] flex w-full flex-col justify-center px-10 py-14 xl:px-14 xl:py-16 2xl:pl-20 2xl:pr-16">
            <div className="flex w-full max-w-[min(100%,44rem)] 2xl:max-w-[50rem] items-stretch gap-5 xl:gap-7 2xl:gap-8 select-none">
              <div
                aria-hidden
                className="w-1 shrink-0 self-stretch rounded-full bg-gradient-to-b from-[#0B5CB5] via-[#0FA968] to-[#FFD400] shadow-[0_0_26px_rgba(11,92,181,0.45)]"
              />
              <div className="min-w-0 flex-1">
                <div className="mb-8 xl:mb-10 2xl:mb-11">
                  <QedaGlyph
                    size="lg"
                    src={MAMA_MATH_LOGO_URL}
                    className="justify-start [&_img]:max-h-[5.5rem] [&_img]:w-auto [&_img]:max-w-[min(100%,22rem)] xl:[&_img]:max-h-32 2xl:[&_img]:max-h-[8rem] 2xl:[&_img]:max-w-[min(100%,26rem)]"
                  />
                </div>

                <div className="rounded-2xl border border-[#3B9AE8]/15 bg-black/22 p-7 shadow-[0_20px_60px_rgba(0,0,0,0.4)] backdrop-blur-[10px] xl:p-9 2xl:p-10">
                  <h2 className="text-balance text-[clamp(1.75rem,2.5vw+1rem,3.25rem)] font-black uppercase leading-[1.05] tracking-[-0.02em] text-white [text-shadow:0_1px_0_rgba(0,0,0,0.25),0_8px_32px_rgba(0,0,0,0.5)]">
                    Welcome to MAMA MATH Monitoring Dashboard…
                  </h2>
                  <p className="mt-5 text-pretty text-[clamp(1.05rem,0.6vw+0.9rem,1.35rem)] font-medium leading-snug tracking-[0.01em] text-[#C5E8F5]/95 xl:mt-6">
                    Mama Math empowers teachers and parents across Cameroonn and Nigeria with AI-assisted maths teaching, curriculum-aligned lesson plans, and tools to support every learner.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Right login panel */}
        <section className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6 sm:py-12 lg:py-10">
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-md lg:max-w-2xl xl:max-w-3xl"
          >
            {/* Mobile-only top brand */}
            <div className="mb-6 flex flex-col items-center lg:hidden">
              <QedaGlyph size="lg" src={MAMA_MATH_LOGO_URL} />
            </div>

            <motion.form
              onSubmit={onSubmit}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25, duration: 0.6 }}
              className="relative rounded-3xl border border-[#3B9AE8]/18 bg-[#08120e]/80 p-6 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] backdrop-blur-xl sm:p-8 lg:rounded-[1.75rem] lg:bg-black/22 lg:p-10 lg:shadow-[0_36px_100px_-24px_rgba(0,0,0,0.75)] xl:p-12"
            >
              {/* Animated border glow */}
              {!reduceMotion && (
                <motion.div
                  aria-hidden
                  className="pointer-events-none absolute -inset-px rounded-3xl opacity-60 lg:rounded-[1.75rem]"
                  style={{
                    background:
                      'conic-gradient(from 0deg, rgba(11,92,181,0) 0%, rgba(11,92,181,0.55) 16%, rgba(15,169,104,0.48) 38%, rgba(255,212,0,0.42) 60%, rgba(229,37,40,0.32) 78%, rgba(11,92,181,0) 100%)',
                    WebkitMask:
                      'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
                    WebkitMaskComposite: 'xor',
                    maskComposite: 'exclude',
                    padding: '1px',
                  }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
                />
              )}

              <div className="mb-6 text-center lg:mb-8">
                <h2 className="text-2xl font-bold tracking-tight text-white lg:text-3xl xl:text-4xl">
                  Welcome back
                </h2>
                <p className="mt-1 text-sm text-[#8EC5F0]/75 lg:mt-2 lg:text-base">
                  Sign in to the Mama Math monitoring dashboard
                </p>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: -8, height: 0 }}
                    transition={{ duration: 0.25 }}
                    className="mb-4 flex items-start gap-2 overflow-hidden rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200 lg:mb-5 lg:gap-3 lg:rounded-xl lg:px-4 lg:py-3 lg:text-base"
                  >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 lg:h-5 lg:w-5" />
                    <span>{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-4 lg:space-y-6">
                <div>
                  <label
                    htmlFor="monitor-email"
                    className="block text-[11px] font-medium uppercase tracking-[0.18em] text-[#5ED99E]/80 lg:text-xs lg:tracking-[0.22em]"
                  >
                    Email
                  </label>
                  <div className="group mt-2 flex items-center gap-2 rounded-xl border border-[#0B5CB5]/28 bg-black/30 px-3 transition-all focus-within:border-[#3B9AE8]/55 focus-within:ring-2 focus-within:ring-[#3B9AE8]/18 lg:mt-3 lg:gap-3 lg:rounded-2xl lg:px-4 lg:py-0.5 lg:focus-within:ring-[3px]">
                    <Mail className="h-4 w-4 shrink-0 text-[#5ED99E]/65 transition-colors group-focus-within:text-[#8EC5F0] lg:h-5 lg:w-5" />
                    <input
                      id="monitor-email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Partner email"
                      className="h-11 w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 outline-none lg:h-14 lg:text-base"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="monitor-password"
                    className="block text-[11px] font-medium uppercase tracking-[0.18em] text-[#5ED99E]/80 lg:text-xs lg:tracking-[0.22em]"
                  >
                    Password
                  </label>
                  <div className="group mt-2 flex items-center gap-2 rounded-xl border border-[#0B5CB5]/28 bg-black/30 px-3 transition-all focus-within:border-[#3B9AE8]/55 focus-within:ring-2 focus-within:ring-[#3B9AE8]/18 lg:mt-3 lg:gap-3 lg:rounded-2xl lg:px-4 lg:py-0.5 lg:focus-within:ring-[3px]">
                    <KeyRound className="h-4 w-4 shrink-0 text-[#5ED99E]/65 transition-colors group-focus-within:text-[#8EC5F0] lg:h-5 lg:w-5" />
                    <input
                      id="monitor-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      required
                      className="h-11 w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 outline-none lg:h-14 lg:text-base"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="rounded p-1 text-[#5ED99E]/60 transition-colors hover:text-[#FFE566] lg:p-2"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4 lg:h-5 lg:w-5" /> : <Eye className="h-4 w-4 lg:h-5 lg:w-5" />}
                    </button>
                  </div>
                </div>
              </div>

              <motion.button
                type="submit"
                disabled={submitting}
                whileHover={reduceMotion ? undefined : { scale: 1.015 }}
                whileTap={reduceMotion ? undefined : { scale: 0.985 }}
                className="group relative mt-7 flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl text-sm font-semibold text-[#061018] shadow-[0_8px_28px_rgba(11,92,181,0.35)] transition-all hover:shadow-[0_10px_36px_rgba(15,169,104,0.35)] disabled:opacity-70 lg:mt-9 lg:h-14 lg:gap-2.5 lg:rounded-2xl lg:text-base"
                style={{
                  background: `linear-gradient(90deg, ${QEDA.blue} 0%, ${QEDA.green} 48%, ${QEDA.yellow} 100%)`,
                }}
              >
                {!reduceMotion && (
                  <motion.span
                    aria-hidden
                    className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent"
                    animate={{ x: ['-100%', '200%'] }}
                    transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 1.4, ease: 'easeInOut' }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2 lg:gap-2.5">
                  {submitting ? (
                    <>
                      <motion.span
                        className="h-4 w-4 rounded-full border-2 border-[#0B5CB5]/35 border-t-[#0B5CB5] lg:h-5 lg:w-5"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                      />
                      Verifying access…
                    </>
                  ) : (
                    <>
                      Enter dashboard
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 lg:h-5 lg:w-5" />
                    </>
                  )}
                </span>
              </motion.button>

              <p className="mt-6 text-center text-[11px] leading-relaxed text-[#8EC5F0]/48 lg:mt-8 lg:text-sm lg:leading-relaxed">
                This is the dashboard for Mama Math — you can view of teaching activity, learners,
                and platform usage. For your security, sessions
                end automatically after 12 hours.
              </p>
            </motion.form>
          </motion.div>
        </section>
      </div>
    </div>
  );
};

export default MonitorLogin;
