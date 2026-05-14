import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth, needsGoogleExtraProfile } from '@/context/AuthContext';
import { LoadingAnimation } from '@/components/ui/LoadingAnimation';

interface ProtectedRouteProps {
  allowedRoles?: string[];
}

const ProtectedRoute = ({ allowedRoles }: ProtectedRouteProps = {}) => {
  const { isAuthenticated, isLoading, profile, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingAnimation fullScreen message="Verifying access..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/sign-in" state={{ from: location }} replace />;
  }

  // Role-based access control
  if (allowedRoles && allowedRoles.length > 0 && profile?.role) {
    if (!allowedRoles.includes(profile.role)) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  // Complete Profile is only for Google OAuth users, once, until they submit the wizard.
  if (profile?.role !== 'student' && needsGoogleExtraProfile(user, profile)) {
    return <Navigate to="/complete-profile" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
