import { Navigate } from 'react-router-dom';
import { getPostAuthPath, useAuth } from '@/context/AuthContext';
import { AuthStatus } from '@/components/auth/AuthUI';
import { useAuthCopy } from './authCopy';

/** Legacy landing page from older confirmation emails — route to the right place. */
const AuthSuccess = () => {
  const c = useAuthCopy();
  const { user, profile, isLoading } = useAuth();
  if (isLoading) return <AuthStatus title={c.signingYouIn} />;
  return <Navigate to={user ? getPostAuthPath(user, profile) : '/sign-in'} replace />;
};

export default AuthSuccess;
