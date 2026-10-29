import { createRoot } from 'react-dom/client';
import { Archive } from './archive/Archive';
import './style.css';

const root = document.getElementById('root');
if (!root) throw new Error('No existe el contenedor de la aplicación.');
const application = createRoot(root);
if (import.meta.env.DEV && globalThis.location.pathname === '/prototype') {
  void import('./prototype/Prototype').then(({ Prototype }) => { application.render(<Prototype />); });
} else { application.render(<Archive />); }
