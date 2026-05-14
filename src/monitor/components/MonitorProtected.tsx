import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { isMonitorAuthenticated } from '../auth/monitorAuth';

/**
 * Guard for /monitor/* routes. Redirects to /monitor/login when the
 * partner has no active session.
 */
const MonitorProtected = () => {
  const location = useLocation();
  if (!isMonitorAuthenticated()) {
    return <Navigate to="/monitor/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
};

export default MonitorProtected;
