import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPostAuthPath, useAuth } from '@/context/AuthContext';
import { toAuthError } from '@/lib/authErrors';
import { supabase } from '@/lib/supabase';
import { COUNTRIES, PHONE_RULES, toOptions } from '@/lib/profileOptions';
import {
  resendReset,
  saveNewPassword,
  startEmailReset,
  startPhoneReset,
  verifyResetCode,
  type ResetTicket,
} from '@/services/passwordReset';
import {
  AuthLayout,
  AuthStatus,
  Choice,
  CodeInput,
  Field,
  FormMessage,
  PasswordField,
  PrimaryButton,
  SelectField,
  TextButton,
  TextLink,
} from '@/components/auth/AuthUI';
import { EMAIL_RE, fill, useAuthCopy } from './authCopy';

type Method = 'email' | 'sms';
type Step = 'start' | 'code' | 'password' | 'done';
const RESEND_SECONDS = 60;

const ForgotPassword = () => {
  const c = useAuthCopy();
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();

  const [step, setStep] = useState<Step>('start');
  const [method, setMethod] = useState<Method>('email');
  const [email, setEmail] = useState('');
  const [country, setCountry] = useState('Cameroon');
  const [phone, setPhone] = useState('');
  const [ticket, setTicket] = useState<ResetTicket | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notRegistered, setNotRegistered] = useState(false);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const inFlight = useRef(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  const clearMessages = () => {
    setError('');
    setNotice('');
    setNotRegistered(false);
  };

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    if (method === 'email' && !EMAIL_RE.test(email.trim())) return setError(c.errEmail);
    const rule = PHONE_RULES[country];
    if (method === 'sms' && rule && !rule.pattern.test(phone.replace(/\s+/g, ''))) {
      return setError(fill(c.errPhone, { country, example: rule.example }));
    }

    setBusy(true);
    try {
      const t = method === 'email' ? await startEmailReset(email) : await startPhoneReset(phone, country);
      setTicket(t);
      setCode('');
      setCooldown(RESEND_SECONDS);
      setStep('code');
    } catch (err) {
      const ae = toAuthError(err);
      if (ae.code === 'not_registered') {
        setNotRegistered(true);
        setError(method === 'email' ? c.noAccountEmail : c.noAccountPhone);
      } else {
        setError(ae.message);
      }
    } finally {
      setBusy(false);
    }
  };

  const checkCode = async (value = code) => {
    if (!ticket || inFlight.current) return;
    if (value.length !== 6) return setError(c.errCode);
    inFlight.current = true;
    clearMessages();
    setBusy(true);
    try {
      await verifyResetCode(ticket, value);
      setStep('password');
    } catch (err) {
      setError(toAuthError(err).message);
      setCode('');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const resend = async () => {
    if (!ticket) return;
    clearMessages();
    try {
      await resendReset(ticket);
      setNotice(c.codeResent);
      setCooldown(RESEND_SECONDS);
    } catch (err) {
      setError(toAuthError(err).message);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticket) return;
    clearMessages();
    if (password.length < 8) return setError(c.errPasswordShort);
    setBusy(true);
    try {
      await saveNewPassword(ticket, code, password);
      setStep('done');
      const profile = await refreshProfile();
      const { data } = await supabase.auth.getSession();
      navigate(data.session ? getPostAuthPath(data.session.user, profile) : '/sign-in', { replace: true });
    } catch (err) {
      const ae = toAuthError(err);
      setError(ae.message);
      // A wrong/expired SMS code is only discovered on save — go back to the code step.
      if (/code|expired|attempt/i.test(ae.message)) {
        setCode('');
        setStep('code');
      }
      setBusy(false);
    }
  };

  if (step === 'done') return <AuthStatus title={c.passwordUpdated} />;

  if (step === 'code' && ticket) {
    const destination = ticket.channel === 'email' ? ticket.email : ticket.maskedPhone;
    return (
      <AuthLayout
        title={c.codeTitle}
        subtitle={
          <>
            {c.codeSentTo} <span className="font-semibold text-[#1F2420] break-all">{destination}</span>
          </>
        }
        progress={{ step: 2, total: 3 }}
        footer={
          <TextButton onClick={() => { clearMessages(); setStep('start'); }}>{c.back}</TextButton>
        }
      >
        <form noValidate className="space-y-5" onSubmit={(e) => { e.preventDefault(); void checkCode(); }}>
          <CodeInput
            label={c.codeLabel}
            value={code}
            invalid={!!error}
            disabled={busy}
            onChange={(v) => { setCode(v); setError(''); }}
            onComplete={(v) => void checkCode(v)}
          />
          <FormMessage>{error}</FormMessage>
          <FormMessage tone="success">{notice}</FormMessage>
          <PrimaryButton loading={busy} loadingText={c.verifying}>{c.verify}</PrimaryButton>
          <p className="text-center text-sm text-[#5F6B63]">
            {cooldown > 0 ? fill(c.resendIn, { s: cooldown }) : <TextButton onClick={resend}>{c.resend}</TextButton>}
            {ticket.channel === 'email' ? <span className="block mt-1">{c.checkSpam}</span> : null}
          </p>
        </form>
      </AuthLayout>
    );
  }

  if (step === 'password') {
    return (
      <AuthLayout title={c.newPasswordTitle} progress={{ step: 3, total: 3 }}>
        <form noValidate className="space-y-4" onSubmit={save}>
          <PasswordField
            label={c.newPassword}
            hint={c.passwordHint}
            showLabel={c.show}
            hideLabel={c.hide}
            autoComplete="new-password"
            autoFocus
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(''); }}
          />
          <FormMessage>{error}</FormMessage>
          <PrimaryButton loading={busy} loadingText={c.saving}>{c.savePassword}</PrimaryButton>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={c.forgotTitle}
      subtitle={c.forgotSub}
      progress={{ step: 1, total: 3 }}
      footer={<TextLink to="/sign-in">{c.backToSignIn}</TextLink>}
    >
      <form noValidate className="space-y-4" onSubmit={sendCode}>
        <Choice<Method>
          value={method}
          onChange={(m) => { setMethod(m); clearMessages(); }}
          options={[
            { value: 'email', label: c.byEmail },
            { value: 'sms', label: c.bySms },
          ]}
        />
        {method === 'email' ? (
          <Field
            label={c.email}
            type="email"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            onChange={(e) => { setEmail(e.target.value); clearMessages(); }}
          />
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] gap-3">
            <SelectField label={c.country} value={country} onChange={(e) => setCountry(e.target.value)} options={toOptions(COUNTRIES)} />
            <Field
              label={c.phone}
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              placeholder={PHONE_RULES[country]?.example}
              value={phone}
              onChange={(e) => { setPhone(e.target.value); clearMessages(); }}
            />
          </div>
        )}
        <FormMessage>
          {error ? (
            <span>
              {error}
              {notRegistered ? <> <TextLink to="/sign-up">{c.createAccount}</TextLink></> : null}
            </span>
          ) : null}
        </FormMessage>
        <PrimaryButton loading={busy} loadingText={c.sending}>{c.sendCode}</PrimaryButton>
      </form>
    </AuthLayout>
  );
};

export default ForgotPassword;
