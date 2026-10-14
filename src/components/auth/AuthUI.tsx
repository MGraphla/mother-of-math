import { forwardRef, useId, useRef, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import GoogleIcon from '@/components/icons/GoogleIcon';

/** Visual building blocks shared by every sign-in / sign-up / reset screen. */

export const BrandLogo = ({ className }: { className?: string }) => (
  <Link to="/" aria-label="Mama Math home" className={cn('inline-block', className)}>
    <picture>
      <source srcSet="/brand/mamamath-logo.webp" type="image/webp" />
      <img
        src="/brand/mamamath-logo.png"
        alt="Mama Math"
        width={720}
        height={267}
        className="h-auto w-[220px] sm:w-[260px]"
        decoding="async"
      />
    </picture>
  </Link>
);

export const AuthLayout = ({
  title,
  subtitle,
  children,
  footer,
  progress,
  wide = false,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  progress?: { step: number; total: number };
  wide?: boolean;
}) => (
  <main className="min-h-dvh bg-[#F4F6F5] px-4 py-8 sm:py-12 flex flex-col items-center">
    <div className={cn('w-full', wide ? 'max-w-[520px]' : 'max-w-[420px]')}>
      <div className="flex justify-center mb-6">
        <BrandLogo />
      </div>
      <section className="rounded-3xl bg-white px-6 py-8 sm:px-8 shadow-[0_1px_2px_rgba(16,24,20,0.04),0_12px_32px_-12px_rgba(16,24,20,0.12)]">
        {progress ? <StepBar step={progress.step} total={progress.total} /> : null}
        <h1 className="text-[1.6rem] leading-tight font-bold tracking-tight text-[#1F2420]">{title}</h1>
        {subtitle ? <p className="mt-1.5 text-[0.95rem] text-[#5F6B63]">{subtitle}</p> : null}
        <div className="mt-6">{children}</div>
      </section>
      {footer ? <div className="mt-6 text-center text-sm text-[#5F6B63]">{footer}</div> : null}
    </div>
  </main>
);

const StepBar = ({ step, total }: { step: number; total: number }) => (
  <div className="mb-6 flex gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={step}>
    {Array.from({ length: total }, (_, i) => (
      <span
        key={i}
        className={cn('h-1 flex-1 rounded-full transition-colors', i < step ? 'bg-primary' : 'bg-[#E5EAE7]')}
      />
    ))}
  </div>
);

const controlBase =
  'w-full h-12 rounded-xl border border-[#D9E0DB] bg-white px-4 text-[0.95rem] text-[#1F2420] placeholder:text-[#9AA39D] outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15 disabled:bg-[#F4F6F5] disabled:text-[#9AA39D]';

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: ReactNode;
  optional?: boolean;
  optionalLabel?: string;
  labelAside?: ReactNode;
};

const Label = ({ htmlFor, label, optional, optionalLabel, aside }: {
  htmlFor: string; label: string; optional?: boolean; optionalLabel?: string; aside?: ReactNode;
}) => (
  <div className="mb-1.5 flex items-baseline justify-between gap-2">
    <label htmlFor={htmlFor} className="text-sm font-medium text-[#1F2420]">
      {label}
      {optional ? <span className="ml-1 font-normal text-[#9AA39D]">{optionalLabel ?? '(optional)'}</span> : null}
    </label>
    {aside}
  </div>
);

export const Field = forwardRef<HTMLInputElement, FieldProps>(
  ({ label, hint, optional, optionalLabel, labelAside, className, id, ...props }, ref) => {
    const autoId = useId();
    const inputId = id ?? autoId;
    return (
      <div className={className}>
        <Label htmlFor={inputId} label={label} optional={optional} optionalLabel={optionalLabel} aside={labelAside} />
        <input ref={ref} id={inputId} className={controlBase} {...props} />
        {hint ? <p className="mt-1.5 text-xs text-[#7A857E]">{hint}</p> : null}
      </div>
    );
  },
);
Field.displayName = 'Field';

export const PasswordField = forwardRef<HTMLInputElement, FieldProps & { showLabel: string; hideLabel: string }>(
  ({ label, hint, labelAside, showLabel, hideLabel, className, id, ...props }, ref) => {
    const autoId = useId();
    const inputId = id ?? autoId;
    const [visible, setVisible] = useState(false);
    return (
      <div className={className}>
        <Label htmlFor={inputId} label={label} aside={labelAside} />
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={visible ? 'text' : 'password'}
            className={cn(controlBase, 'pr-16')}
            {...props}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#5F6B63] hover:bg-[#F4F6F5] hover:text-[#1F2420]"
            aria-controls={inputId}
            aria-pressed={visible}
          >
            {visible ? hideLabel : showLabel}
          </button>
        </div>
        {hint ? <p className="mt-1.5 text-xs text-[#7A857E]">{hint}</p> : null}
      </div>
    );
  },
);
PasswordField.displayName = 'PasswordField';

export const SelectField = ({
  label,
  options,
  placeholder,
  optional,
  optionalLabel,
  className,
  id,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  optional?: boolean;
  optionalLabel?: string;
}) => {
  const autoId = useId();
  const selectId = id ?? autoId;
  return (
    <div className={className}>
      <Label htmlFor={selectId} label={label} optional={optional} optionalLabel={optionalLabel} />
      <select
        id={selectId}
        className={cn(
          controlBase,
          'appearance-none pl-3 pr-8 bg-[length:11px] bg-[right_0.75rem_center] bg-no-repeat',
          "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' fill='none' stroke='%237A857E' stroke-width='1.6'/%3E%3C/svg%3E\")]",
        )}
        {...props}
      >
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
};

/** Segmented choice (role, verification channel, reset method). */
export function Choice<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label?: string;
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string; detail?: string }>;
}) {
  const hasDetail = options.some((o) => o.detail);
  return (
    <fieldset>
      {label ? <legend className="mb-1.5 text-sm font-medium text-[#1F2420]">{label}</legend> : null}
      <div className={cn('grid gap-2', hasDetail ? 'grid-cols-1' : 'grid-cols-2')} role="radiogroup">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(o.value)}
              className={cn(
                'rounded-xl border px-4 text-left transition',
                hasDetail ? 'py-3' : 'h-12 text-center',
                active
                  ? 'border-primary bg-primary/[0.06] ring-1 ring-primary'
                  : 'border-[#D9E0DB] bg-white hover:border-[#B9C4BD]',
              )}
            >
              <span className={cn('block text-[0.95rem] font-semibold', active ? 'text-[#00803A]' : 'text-[#1F2420]')}>
                {o.label}
              </span>
              {o.detail ? <span className="mt-0.5 block truncate text-sm text-[#5F6B63]">{o.detail}</span> : null}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** One real input (autofill + paste friendly) drawn as six boxes. */
export const CodeInput = ({
  value,
  onChange,
  onComplete,
  disabled,
  invalid,
  label,
  autoFocus = true,
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  label: string;
  autoFocus?: boolean;
}) => {
  const ref = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const len = 6;
  return (
    <div className="relative" onClick={() => ref.current?.focus()}>
      <input
        ref={ref}
        aria-label={label}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={len}
        value={value}
        disabled={disabled}
        autoFocus={autoFocus}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          const next = e.target.value.replace(/\D/g, '').slice(0, len);
          onChange(next);
          if (next.length === len) onComplete?.(next);
        }}
        className="absolute inset-0 h-full w-full cursor-text opacity-0"
      />
      <div className="grid grid-cols-6 gap-2" aria-hidden="true">
        {Array.from({ length: len }, (_, i) => {
          const char = value[i] ?? '';
          const isCaret = focused && i === Math.min(value.length, len - 1);
          return (
            <div
              key={i}
              className={cn(
                'flex h-14 items-center justify-center rounded-xl border text-2xl font-bold tabular-nums transition',
                invalid
                  ? 'border-red-300 bg-red-50/50 text-red-700'
                  : char
                    ? 'border-primary/50 bg-primary/[0.04] text-[#1F2420]'
                    : 'border-[#D9E0DB] bg-white',
                isCaret && !invalid && 'border-primary ring-4 ring-primary/15',
                disabled && 'opacity-60',
              )}
            >
              {char}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const PrimaryButton = ({
  children,
  loading,
  loadingText,
  className,
  disabled,
  type = 'submit',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean; loadingText?: string }) => (
  <button
    type={type}
    disabled={disabled || loading}
    aria-busy={loading || undefined}
    className={cn(
      'h-12 w-full rounded-xl bg-primary px-5 text-[0.95rem] font-semibold text-white transition hover:bg-[#008A37] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-60',
      className,
    )}
    {...props}
  >
    {loading && loadingText ? loadingText : children}
  </button>
);

export const SecondaryButton = ({
  children,
  className,
  type = 'button',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    type={type}
    className={cn(
      'h-12 w-full rounded-xl border border-[#D9E0DB] bg-white px-5 text-[0.95rem] font-semibold text-[#1F2420] transition hover:bg-[#F4F6F5] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60',
      className,
    )}
    {...props}
  >
    {children}
  </button>
);

export const GoogleButton = ({ label, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) => (
  <SecondaryButton {...props} className="flex items-center justify-center gap-3">
    <GoogleIcon className="h-[18px] w-[18px]" />
    {label}
  </SecondaryButton>
);

export const Divider = ({ label }: { label: string }) => (
  <div className="my-5 flex items-center gap-3 text-xs font-medium uppercase tracking-wider text-[#9AA39D]">
    <span className="h-px flex-1 bg-[#E5EAE7]" />
    {label}
    <span className="h-px flex-1 bg-[#E5EAE7]" />
  </div>
);

export const FormMessage = ({ children, tone = 'error' }: { children: ReactNode; tone?: 'error' | 'success' | 'info' }) =>
  children ? (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'rounded-xl px-4 py-3 text-sm',
        tone === 'error' && 'bg-red-50 text-red-700',
        tone === 'success' && 'bg-primary/[0.08] text-[#00803A]',
        tone === 'info' && 'bg-[#F4F6F5] text-[#3F4A43]',
      )}
    >
      {children}
    </div>
  ) : null;

export const TextLink = ({ to, children, className }: { to: string; children: ReactNode; className?: string }) => (
  <Link to={to} className={cn('font-semibold text-[#00803A] hover:underline underline-offset-4', className)}>
    {children}
  </Link>
);

export const TextButton = ({ children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    type="button"
    className={cn(
      'font-semibold text-[#00803A] hover:underline underline-offset-4 disabled:cursor-not-allowed disabled:text-[#9AA39D] disabled:no-underline',
      className,
    )}
    {...props}
  >
    {children}
  </button>
);

/** Full-page status (callbacks, redirects). */
export const AuthStatus = ({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) => (
  <AuthLayout title={title} subtitle={subtitle}>
    {children ?? (
      <div className="flex justify-center py-2" aria-hidden="true">
        <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#E5EAE7] border-t-primary" />
      </div>
    )}
  </AuthLayout>
);
