import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPostAuthPath, useAuth } from '@/context/AuthContext';
import { toAuthError } from '@/lib/authErrors';
import { supabase } from '@/lib/supabase';
import {
  AuthLayout,
  AuthStatus,
  FormMessage,
  PasswordField,
  PrimaryButton,
  SecondaryButton,
  TextLink,
} from '@/components/auth/AuthUI';
import { useAuthCopy } from './authCopy';

/**
 * Reached from the reset email's button (/auth/confirm verifies the link and
 * signs the user in first). Code-based resets finish inside /forgot-password.
 */
const ResetPassword = () => {
  const c = useAuthCopy();
  const navigate = useNavigate();
  const { user, isLoading, refreshProfile } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (isLoading) return <AuthStatus title={c.newPasswordTitle} />;
  if (done) return <AuthStatus title={c.passwordUpdated} />;

  if (!user) {
    return (
      <AuthLayout title={c.linkExpiredTitle} subtitle={c.linkExpiredSub}>
        <div className="space-y-3">
          <PrimaryButton type="button" onClick={() => navigate('/forgot-password', { replace: true })}>
            {c.getNewCode}
          </PrimaryButton>
          <SecondaryButton onClick={() => navigate('/sign-in', { replace: true })}>{c.backToSignIn}</SecondaryButton>
        </div>
      </AuthLayout>
    );
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) return setError(c.errPasswordShort);
    setBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setDone(true);
      const profile = await refreshProfile();
      navigate(getPostAuthPath(user, profile), { replace: true });
    } catch (err) {
      setError(toAuthError(err).message);
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title={c.newPasswordTitle}
      subtitle={<span className="break-all">{user.email}</span>}
      footer={<TextLink to="/sign-in">{c.backToSignIn}</TextLink>}
    >
      <form noValidate className="space-y-4" onSubmit={save}>
        <PasswordField
          label={c.newPassword}
          hint={c.passwordHint}
          showLabel={c.show}
          hideLabel={c.hide}
          autoComplete="new-password"
          autoFocus
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError('');
          }}
        />
        <FormMessage>{error}</FormMessage>
        <PrimaryButton loading={busy} loadingText={c.saving}>
          {c.savePassword}
        </PrimaryButton>
      </form>
    </AuthLayout>
  );
};

export default ResetPassword;
