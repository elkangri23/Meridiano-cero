import { Navigate, Outlet } from 'react-router-dom';
import { useAuthContext } from '../auth/AuthContext';

/**
 * Guard de ruta para el panel de administración.
 * Redirige a /login si no hay sesión o el perfil no tiene rol admin/superadmin.
 */
export function AdminGuard() {
  const { session, loading, profile } = useAuthContext();

  if (loading) {
    return (
      <div className="admin-loading" role="status" aria-live="polite">
        <span className="admin-loading-text">Cargando…</span>
      </div>
    );
  }

  if (!session || !profile) {
    return <Navigate to="/login" replace />;
  }

  // El rol debe ser 'admin' o 'superadmin'
  const role = (profile as unknown as { role?: string }).role;
  if (role !== 'admin' && role !== 'superadmin') {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
