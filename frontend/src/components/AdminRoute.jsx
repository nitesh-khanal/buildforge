import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Like ProtectedRoute, but also requires role === 'admin'. A logged-in
// customer who wanders to /admin gets bounced home rather than looped back
// to /login (they're authenticated fine — just not authorized for this).
export default function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="max-w-content mx-auto px-4 sm:px-6 py-24 text-center text-sm text-faint">Loading…</div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: `${location.pathname}${location.search}` }} replace />;
  }

  if (user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return children;
}
