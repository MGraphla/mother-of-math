import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, KeyRound, ShieldCheck, AlertCircle, Lock } from 'lucide-react';
import { isMonitorAuthenticated, monitorLogin } from '../auth/monitorAuth';

const MonitorLogin = () => {
  const navigate = useNavigate();
  const [partner, setPartner] = useState('');
  const [code, setCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isMonitorAuthenticated()) navigate('/monitor/overview', { replace: true });
  }, [navigate]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = monitorLogin(code, partner);
    setSubmitting(false);
    if (!result.success) {
      setError(result.error ?? 'Login failed.');
      return;
    }
    navigate('/monitor/overview', { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#070a16] text-slate-100 flex items-center justify-center px-4 py-10">
      {/* Backdrop glows */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-[420px] w-[420px] rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-32 h-[480px] w-[480px] rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo block */}
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-emerald-500 shadow-xl shadow-cyan-500/30">
            <ShieldCheck className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
            Mother of Math · Partner Monitor
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Secure, read-only monitoring dashboard
          </p>
        </div>

        {/* Card */}
        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-6 shadow-2xl shadow-black/40 backdrop-blur"
        >
          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <label className="block text-xs uppercase tracking-[0.18em] text-slate-500">
            Organisation / Partner name
          </label>
          <div className="mt-2 mb-4 flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/60 px-3">
            <Lock className="h-4 w-4 text-slate-500" />
            <input
              type="text"
              value={partner}
              onChange={(e) => setPartner(e.target.value)}
              placeholder="e.g. Implementing Partner Inc."
              className="h-11 w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 outline-none"
            />
          </div>

          <label className="block text-xs uppercase tracking-[0.18em] text-slate-500">
            Access code
          </label>
          <div className="mt-2 mb-5 flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/60 px-3">
            <KeyRound className="h-4 w-4 text-slate-500" />
            <input
              type={showCode ? 'text' : 'password'}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="••••••••••••"
              required
              className="h-11 w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 outline-none"
            />
            <button
              type="button"
              onClick={() => setShowCode((s) => !s)}
              className="rounded p-1 text-slate-500 hover:text-slate-200"
              aria-label={showCode ? 'Hide access code' : 'Show access code'}
            >
              {showCode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-emerald-500 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition-transform hover:scale-[1.01] disabled:opacity-60"
          >
            {submitting ? 'Verifying…' : 'Open dashboard'}
          </button>

          <p className="mt-5 text-center text-[11px] text-slate-500">
            Read-only access. No teacher records can be created, edited or deleted from
            this portal.
          </p>
        </form>
      </div>
    </div>
  );
};

export default MonitorLogin;
