import { ReactNode, type ComponentType } from 'react';
import { Loader2, Inbox, TrendingUp, TrendingDown, Minus, AlertCircle, RefreshCw } from 'lucide-react';

/* ─── Page header ─────────────────────────────────────────── */
export const PageHeader = ({
  title,
  subtitle,
  actions,
  icon: Icon,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) => (
  <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
    <div className="flex items-start gap-3">
      {Icon && (
        <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-emerald-500/10 ring-1 ring-cyan-500/30">
          <Icon className="h-5 w-5 text-cyan-300" />
        </div>
      )}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-slate-400">{subtitle}</p>}
      </div>
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

/* ─── Surface card ────────────────────────────────────────── */
export const Card = ({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) => (
  <div
    className={[
      'rounded-2xl border border-slate-800/80 bg-gradient-to-b from-slate-900/70 to-slate-900/30 shadow-xl shadow-black/30 backdrop-blur',
      className,
    ].join(' ')}
  >
    {children}
  </div>
);

export const SectionTitle = ({
  title,
  hint,
  right,
}: {
  title: string;
  hint?: string;
  right?: ReactNode;
}) => (
  <div className="flex items-end justify-between gap-3 px-5 pt-5 pb-3">
    <div>
      <h2 className="text-sm font-semibold tracking-wide text-slate-200">{title}</h2>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
    {right}
  </div>
);

/* ─── KPI card ────────────────────────────────────────────── */
export const KpiCard = ({
  label,
  value,
  delta,
  hint,
  icon: Icon,
  tone = 'cyan',
}: {
  label: string;
  value: string | number;
  delta?: { value: number; direction: 'up' | 'down' | 'flat'; label?: string };
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: 'cyan' | 'emerald' | 'violet' | 'amber' | 'rose' | 'sky' | 'slate';
}) => {
  const toneMap = {
    cyan:    'from-cyan-500/20 to-cyan-500/0 ring-cyan-500/30 text-cyan-300',
    emerald: 'from-emerald-500/20 to-emerald-500/0 ring-emerald-500/30 text-emerald-300',
    violet:  'from-violet-500/20 to-violet-500/0 ring-violet-500/30 text-violet-300',
    amber:   'from-amber-500/20 to-amber-500/0 ring-amber-500/30 text-amber-300',
    rose:    'from-rose-500/20 to-rose-500/0 ring-rose-500/30 text-rose-300',
    sky:     'from-sky-500/20 to-sky-500/0 ring-sky-500/30 text-sky-300',
    slate:   'from-slate-500/20 to-slate-500/0 ring-slate-500/30 text-slate-300',
  } as const;

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</div>
          <div className="mt-1.5 text-3xl font-semibold tracking-tight text-white">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </div>
          {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
          {delta && (
            <div
              className={[
                'mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]',
                delta.direction === 'up'
                  ? 'bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/20'
                  : delta.direction === 'down'
                  ? 'bg-rose-500/10 text-rose-300 ring-1 ring-rose-500/20'
                  : 'bg-slate-500/10 text-slate-300 ring-1 ring-slate-500/20',
              ].join(' ')}
            >
              {delta.direction === 'up' ? (
                <TrendingUp className="h-3 w-3" />
              ) : delta.direction === 'down' ? (
                <TrendingDown className="h-3 w-3" />
              ) : (
                <Minus className="h-3 w-3" />
              )}
              {delta.value > 0 ? `+${delta.value}` : delta.value}
              {delta.label && <span className="text-slate-400">· {delta.label}</span>}
            </div>
          )}
        </div>
        {Icon && (
          <div
            className={[
              'flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ring-1',
              toneMap[tone],
            ].join(' ')}
          >
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </Card>
  );
};

/* ─── Loading / empty ─────────────────────────────────────── */
export const LoadingState = ({ label = 'Loading…' }: { label?: string }) => (
  <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-400">
    <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
    <span className="text-sm">{label}</span>
  </div>
);

/** Full-page error when the first load fails (no cached rows). */
export const MonitorFetchErrorPage = ({
  title,
  subtitle,
  icon: Icon,
  error,
  onRetry,
}: {
  title: string;
  subtitle?: string;
  icon?: ComponentType<{ className?: string }>;
  error: Error;
  onRetry: () => void;
}) => (
  <>
    <PageHeader title={title} subtitle={subtitle} icon={Icon} />
    <Card className="border-rose-500/40 bg-rose-950/30 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" />
          <div>
            <p className="text-sm font-medium text-rose-100">Could not load this view</p>
            <p className="mt-1 max-w-xl break-words text-xs text-rose-200/85">{error.message}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-rose-500/45 bg-rose-600/25 px-4 py-2.5 text-sm font-medium text-rose-50 transition-colors hover:bg-rose-600/35"
        >
          <RefreshCw className="h-4 w-4" />
          Try again
        </button>
      </div>
    </Card>
  </>
);

/** Inline banner when a background refresh fails but older data is still shown. */
export const MonitorFetchErrorBanner = ({
  error,
  onRetry,
}: {
  error: Error;
  onRetry: () => void;
}) => (
  <Card className="mb-5 border-rose-500/40 bg-rose-950/30 p-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-rose-100">Latest refresh failed</p>
          <p className="mt-0.5 break-words text-xs text-rose-200/80">{error.message}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-rose-500/40 bg-rose-600/20 px-3 py-2 text-sm font-medium text-rose-100 transition-colors hover:bg-rose-600/30"
      >
        <RefreshCw className="h-4 w-4" />
        Retry
      </button>
    </div>
  </Card>
);

export const EmptyState = ({
  title,
  hint,
}: {
  title: string;
  hint?: string;
}) => (
  <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-slate-400">
    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800/60 ring-1 ring-slate-700">
      <Inbox className="h-5 w-5 text-slate-500" />
    </div>
    <div className="text-sm font-medium text-slate-200">{title}</div>
    {hint && <div className="max-w-sm text-xs text-slate-500">{hint}</div>}
  </div>
);

/* ─── Badge ───────────────────────────────────────────────── */
export const Badge = ({
  children,
  tone = 'slate',
}: {
  children: ReactNode;
  tone?: 'slate' | 'cyan' | 'emerald' | 'violet' | 'amber' | 'rose' | 'sky';
}) => {
  const toneMap = {
    slate:   'bg-slate-700/40 text-slate-200 ring-slate-600/40',
    cyan:    'bg-cyan-500/10 text-cyan-300 ring-cyan-500/30',
    emerald: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30',
    violet:  'bg-violet-500/10 text-violet-300 ring-violet-500/30',
    amber:   'bg-amber-500/10 text-amber-300 ring-amber-500/30',
    rose:    'bg-rose-500/10 text-rose-300 ring-rose-500/30',
    sky:     'bg-sky-500/10 text-sky-300 ring-sky-500/30',
  } as const;
  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1',
        toneMap[tone],
      ].join(' ')}
    >
      {children}
    </span>
  );
};

/* ─── Simple search input ─────────────────────────────────── */
export const SearchInput = ({
  value,
  onChange,
  placeholder = 'Search…',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) => (
  <input
    type="text"
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    className="w-full rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-cyan-500/40 focus:ring-2 focus:ring-cyan-500/20"
  />
);
