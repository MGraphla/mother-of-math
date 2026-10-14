import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth, needsProfileCompletion, getDashboardPath } from '@/context/AuthContext';
import { LoadingAnimation } from '@/components/ui/LoadingAnimation';

interface ProtectedRouteProps {
  allowedRoles?: string[];
}

const ProtectedRoute = ({ allowedRoles }: ProtectedRouteProps = {}) => {
  const { isLoading, profile, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingAnimation fullScreen message="Verifying access..." />;
  }

  if (!user) {
    return <Navigate to="/sign-in" state={{ from: location }} replace />;
  }

  if (needsProfileCompletion(user, profile)) {
    return <Navigate to="/complete-profile" replace />;
  }

  // Send people to their own dashboard (never to the route they were just refused).
  if (allowedRoles?.length && (!profile?.role || !allowedRoles.includes(profile.role))) {
    return <Navigate to={getDashboardPath(profile)} replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
