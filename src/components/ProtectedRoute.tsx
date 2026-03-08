import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth, isProfileComplete } from '@/context/AuthContext';

const ProtectedRoute = () => {
  const { isAuthenticated, isLoading, profile } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="h-8 w-8 border-4 border-green-200 border-t-green-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/sign-in" state={{ from: location }} replace />;
  }

  // Students skip the profile-complete check (their accounts are created by teachers)
  if (profile?.role !== 'student' && !isProfileComplete(profile)) {
    return <Navigate to="/complete-profile" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
