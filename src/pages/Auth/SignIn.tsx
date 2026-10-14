import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth, getPostAuthPath } from '@/context/AuthContext';
import { toAuthError } from '@/lib/authErrors';
import { supabase } from '@/lib/supabase';
import {
  AuthLayout,
  Divider,
  Field,
  FormMessage,
  GoogleButton,
  PasswordField,
  PrimaryButton,
  TextButton,
  TextLink,
} from '@/components/auth/AuthUI';
import { EMAIL_RE, useAuthCopy } from './authCopy';

const SignIn = () => {
  const c = useAuthCopy();
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, signInWithGoogle, startEmailVerification, user, profile, isLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [unverified, setUnverified] = useState(false);
  const [busy, setBusy] = useState<'password' | 'google' | 'verify' | null>(null);

  /** Return to the page that sent the user here, when it's an in-app path. */
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;

  useEffect(() => {
    if (!isLoading && user && !busy) {
      const target = getPostAuthPath(user, profile);
      navigate(from && target !== '/complete-profile' ? from : target, { replace: true });
    }
  }, [isLoading, user, profile, busy, from, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setUnverified(false);
    if (!EMAIL_RE.test(email.trim())) return setError(c.errEmail);
    if (!password) return setError(c.errPasswordShort);

    setBusy('password');
    try {
      const p = await signIn(email, password);
      const { data } = await supabase.auth.getSession();
      const target = getPostAuthPath(data.session?.user ?? null, p);
      navigate(from && target !== '/complete-profile' ? from : target, { replace: true });
    } catch (err) {
      const ae = toAuthError(err);
      if (ae.code === 'email_not_confirmed') setUnverified(true);
      setError(ae.message);
      setBusy(null);
    }
  };

  const handleVerify = async () => {
    setBusy('verify');
    try {
      await startEmailVerification(email);
      navigate('/verify-email');
    } catch (err) {
      setError(toAuthError(err).message);
      setBusy(null);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setBusy('google');
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(toAuthError(err).message);
      setBusy(null);
    }
  };

  return (
    <AuthLayout
      title={c.signInTitle}
      footer={
        <div className="space-y-3">
          <p>
            {c.newHere} <TextLink to="/sign-up">{c.createAccount}</TextLink>
          </p>
          <p>
            <TextLink to="/student-login" className="font-medium text-[#5F6B63]">
              {c.learner}
            </TextLink>
          </p>
        </div>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <Field
          label={c.email}
          type="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError('');
          }}
          required
        />
        <PasswordField
          label={c.password}
          showLabel={c.show}
          hideLabel={c.hide}
          autoComplete="current-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError('');
          }}
          labelAside={
            <TextLink to="/forgot-password" className="text-sm font-medium">
              {c.forgot}
            </TextLink>
          }
          required
        />

        <FormMessage>
          {error ? (
            <span>
              {error}
              {unverified ? (
                <>
                  {' '}
                  <TextButton onClick={handleVerify} disabled={busy !== null}>
                    {c.verifyNow}
                  </TextButton>
                </>
              ) : null}
            </span>
          ) : null}
        </FormMessage>

        <PrimaryButton loading={busy === 'password'} loadingText={c.signingIn} disabled={busy !== null}>
          {c.signInSubmit}
        </PrimaryButton>
      </form>

      <Divider label={c.or} />
      <GoogleButton label={c.google} onClick={handleGoogle} disabled={busy !== null} />
    </AuthLayout>
  );
};

export default SignIn;
