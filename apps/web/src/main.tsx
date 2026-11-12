import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Archive } from './archive/Archive';
import { Landing } from './landing/Landing';
import { Creditos } from './creditos/CreditosPage';
import { Glosario } from './glosario/GlosarioPage';
import { Prototype } from './prototype/Prototype';
import { GameScreen } from './game/GameScreen';
import { LoginPage, RecoveryPage, RegisterPage, VerifyPage } from './auth/AuthPages';
import { I18nProvider } from './i18n';
import { usePreferences } from './preferences';
import { AuthProvider } from './auth/AuthContext';
import { AdminGuard } from './admin/AdminGuard';
import { AdminLayout } from './admin/AdminLayout';
import { DashboardPage } from './admin/DashboardPage';
import './style.css';

function App() {
  const { preferences } = usePreferences();
  return (
    <I18nProvider language={preferences.language}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/archivo" element={<Archive />} />
            <Route path="/glosario" element={<Glosario />} />
            <Route path="/creditos" element={<Creditos />} />
            <Route path="/prototype" element={<Prototype />} />
            <Route path="/runs/:runId" element={<GameScreen />} />
            <Route path="/registro" element={<RegisterPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/verificar" element={<VerifyPage />} />
            <Route path="/recuperar" element={<RecoveryPage />} />

            {/* Rutas del panel de administración */}
            <Route path="/admin" element={<AdminGuard />}>
              <Route element={<AdminLayout />}>
                <Route index element={<DashboardPage />} />
                <Route path="users" element={<div className="admin-placeholder">Próximamente: Gestión de usuarios</div>} />
                <Route path="runs" element={<div className="admin-placeholder">Próximamente: Gestión de partidas</div>} />
                <Route path="ai" element={<div className="admin-placeholder">Próximamente: Configuración IA</div>} />
                <Route path="audit" element={<div className="admin-placeholder">Próximamente: Auditoría</div>} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </I18nProvider>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('No existe el contenedor de la aplicación.');
const application = createRoot(root);
application.render(<App />);