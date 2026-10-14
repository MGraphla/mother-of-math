import { useEffect, useState } from 'react';
import { AuthStatus } from '@/components/auth/AuthUI';
import { useAuthCopy } from './authCopy';

const APP_DEEP_LINK = 'motherofmath://auth/callback';

/**
 * HTTPS bounce page for mobile Google sign-in. The PKCE verifier lives in the
 * app, so the code must NOT be exchanged here — forward query + hash untouched.
 */
const MobileAuthBridge = () => {
  const c = useAuthCopy();
  const [stalled, setStalled] = useState(false);

  useEffect(() => {
    window.location.replace(`${APP_DEEP_LINK}${window.location.search}${window.location.hash}`);
    const t = window.setTimeout(() => setStalled(true), 2500);
    return () => window.clearTimeout(t);
  }, []);

  return <AuthStatus title={c.openingApp} subtitle={stalled ? c.appNotOpened : undefined} />;
};

export default MobileAuthBridge;
