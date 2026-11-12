import { Link, Outlet, useLocation } from 'react-router-dom';
import './AdminLayout.css';

/**
 * Layout principal del panel de administración.
 * Diseñado para seguir el estilo visual de Meridiano-cero (MS-DOS).
 */
export function AdminLayout() {
  const location = useLocation();

  const navItems = [
    { path: '/admin', label: 'Dashboard', icon: '📊' },
    { path: '/admin/users', label: 'Usuarios', icon: '👥' },
    { path: '/admin/runs', label: 'Partidas', icon: '🎮' },
    { path: '/admin/ai', label: 'IA', icon: '🤖' },
    { path: '/admin/audit', label: 'Auditoría', icon: '📋' },
  ] as const;

  return (
    <div className="admin-layout">
      <header className="admin-header">
        <div className="admin-header-left">
          <span className="admin-logo" aria-hidden="true">M₀</span>
          <h1 className="admin-title">Panel de Administración</h1>
        </div>
        <div className="admin-header-right">
          <span className="admin-username">Usuario</span>
          <span className="admin-role-badge">ADMIN</span>
          <Link to="/archivo" className="admin-logout" title="Volver al juego">
            🏠
          </Link>
        </div>
      </header>

      <nav className="admin-sidebar" aria-label="Navegación del panel">
        <ul className="admin-nav-list">
          {navItems.map((item) => (
            <li key={item.path}>
              <Link
                to={item.path}
                className={`admin-nav-link ${location.pathname === item.path ? 'active' : ''}`}
                aria-current={location.pathname === item.path ? 'page' : undefined}
              >
                <span className="admin-nav-icon" aria-hidden="true">{item.icon}</span>
                <span className="admin-nav-label">{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <main className="admin-main">
        <Outlet />
      </main>

      <footer className="admin-footer">
        <span>Meridiano-cero v{import.meta.env.VITE_APP_VERSION ?? 'beta'}</span>
      </footer>
    </div>
  );
}