import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Archive } from './archive/Archive';
import { Glosario } from './glosario/GlosarioPage';
import { Prototype } from './prototype/Prototype';
import { GameScreen } from './game/GameScreen';
import { LoginPage, RecoveryPage, RegisterPage, VerifyPage } from './auth/AuthPages';
import './style.css';

const root = document.getElementById('root');
if (!root) throw new Error('No existe el contenedor de la aplicación.');
const application = createRoot(root);
application.render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Archive />} />
      <Route path="/glosario" element={<Glosario />} />
      <Route path="/prototype" element={<Prototype />} />
      <Route path="/runs/:runId" element={<GameScreen />} />
      <Route path="/registro" element={<RegisterPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/verificar" element={<VerifyPage />} />
      <Route path="/recuperar" element={<RecoveryPage />} />
    </Routes>
  </BrowserRouter>
);