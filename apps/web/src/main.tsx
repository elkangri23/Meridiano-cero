import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { isHealthResponse } from '@meridiano/contracts';
import './style.css';

const messages = { idle: 'Sin comprobar.', loading: 'Comprobando…', online: 'La API responde. Base de datos y sesión aún no implementadas.', unavailable: 'No se pudo comprobar la API. Revisa el proceso de desarrollo.' } as const;
function App() {
  const [status, setStatus] = useState<keyof typeof messages>('idle');
  async function checkApi(): Promise<void> {
    setStatus('loading');
    try {
      const response = await fetch('/api/v1/health', { signal: AbortSignal.timeout(3000), cache: 'no-store' });
      const body: unknown = await response.json();
      if (!response.ok || !isHealthResponse(body)) throw new Error('Respuesta inválida.');
      setStatus('online');
    } catch { setStatus('unavailable'); }
  }
  return <main>
    <p className="eyebrow">BASE DE DESARROLLO · FASE 1</p>
    <h1>Meridiano-cero</h1>
    <p>Preparando el entorno del juego de investigación.</p>
    <p>Esta pantalla verifica la conexión web/API. Todavía no hay partida jugable.</p>
    <button type="button" disabled={status === 'loading'} onClick={() => { void checkApi(); }}>Comprobar API</button>
    <p role="status" aria-live="polite">{messages[status]}</p>
  </main>;
}
const root = document.getElementById('root');
if (!root) throw new Error('No existe el contenedor de la aplicación.');
createRoot(root).render(<App />);
