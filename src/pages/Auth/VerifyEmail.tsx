import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth, getPostAuthPath, readPendingVerification } from '@/context/AuthContext';
import { toAuthError } from '@/lib/authErrors';
import { supabase } from '@/lib/supabase';
import {
  AuthLayout,
  AuthStatus,
  CodeInput,
  FormMessage,
  PasswordField,
  PrimaryButton,
  TextButton,
  TextLink,
} from '@/components/auth/AuthUI';
import { fill, useAuthCopy } from './authCopy';

const RESEND_SECONDS = 60;

const VerifyEmail = () => {
  const c = useAuthCopy();
  const navigate = useNavigate();
  const { verifySignupCode, resendSignupCode, hasPendingPassword } = useAuth();
  const [pending] = useState(readPendingVerification);

  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [done, setDone] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);
  const inFlight = useRef(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  if (!pending) return <Navigate to="/sign-up" replace />;

  const needsPassword = pending.channel === 'sms' && !hasPendingPassword;
  const destination = pending.channel === 'email' ? pending.email : pending.maskedPhone || pending.email;

  const submit = async (value = code) => {
    if (inFlight.current) return;
    if (value.length !== 6) return setError(c.errCode);
    if (needsPassword && !password) return setError(c.errPasswordShort);

    inFlight.current = true;
    setVerifying(true);
    setError('');
    setNotice('');
    try {
      const profile = await verifySignupCode(value, password || undefined);
      setDone(true);
      const { data } = await supabase.auth.getSession();
      navigate(getPostAuthPath(data.session?.user ?? null, profile), { replace: true });
    } catch (err) {
      setError(toAuthError(err).message);
      setCode('');
    } finally {
      inFlight.current = false;
      setVerifying(false);
    }
  };

  const resend = async () => {
    setError('');
    setNotice('');
    try {
      await resendSignupCode();
      setNotice(c.codeResent);
      setCooldown(RESEND_SECONDS);
    } catch (err) {
      setError(toAuthError(err).message);
    }
  };

  if (done) return <AuthStatus title={c.verified} />;

  return (
    <AuthLayout
      title={c.codeTitle}
      subtitle={
        <>
          {c.codeSentTo} <span className="font-semibold text-[#1F2420] break-all">{destination}</span>
        </>
      }
      footer={<TextLink to="/sign-up">{c.differentEmail}</TextLink>}
    >
      <form
        noValidate
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <CodeInput
          label={c.codeLabel}
          value={code}
          invalid={!!error}
          disabled={verifying}
          onChange={(v) => {
            setCode(v);
            setError('');
          }}
          onComplete={(v) => {
            if (!needsPassword) void submit(v);
          }}
        />

        {needsPassword && (
          <PasswordField
            label={c.passwordToFinish}
            hint={c.passwordToFinishHint}
            showLabel={c.show}
            hideLabel={c.hide}
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError('');
            }}
          />
        )}

        <FormMessage>{error}</FormMessage>
        <FormMessage tone="success">{notice}</FormMessage>

        <PrimaryButton loading={verifying} loadingText={c.verifying}>
          {c.verify}
        </PrimaryButton>

        <p className="text-center text-sm text-[#5F6B63]">
          {cooldown > 0 ? (
            fill(c.resendIn, { s: cooldown })
          ) : (
            <TextButton onClick={resend}>{c.resend}</TextButton>
          )}
          {pending.channel === 'email' ? <span className="block mt-1">{c.checkSpam}</span> : null}
        </p>
      </form>
    </AuthLayout>
  );
};

export default VerifyEmail;
