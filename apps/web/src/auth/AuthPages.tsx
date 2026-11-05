import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi, AuthError } from './client';
import type { AuthErrorKind, AuthSession } from './client';
import type { SessionDto } from '@meridiano/contracts';
import './auth.css';

const errorMessages: Record<AuthErrorKind, string> = {
  unavailable: 'No se pudo contactar con el servidor. Reinténtalo.',
  invalid: 'Revisa los datos del formulario.',
  email_taken: 'Ese correo ya tiene cuenta. Entra o recupera tu contraseña.',
  bad_credentials: 'Correo o contraseña incorrectos.',
  bad_token: 'El enlace ya no es válido. Pide uno nuevo.',
  rate_limited: 'Demasiados intentos. Espera unos minutos.',
  not_configured: 'El correo no está configurado en este servidor. Tu cuenta está creada; pide ayuda para verificarla.',
  session: 'La sesión caducó. Entra de nuevo.',
};

function messageOf(error: unknown): string {
  return error instanceof AuthError ? errorMessages[error.kind] : 'Error inesperado.';
}

function AuthShell({ title, children }: { title: string; children: ReactNode }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  return <main className="archive">
    <header className="archive-header"><span className="archive-mark" aria-hidden="true">M<span>0</span></span><div><p>MERIDIANO-CERO</p><h1 tabIndex={-1} ref={heading}>{title}</h1></div></header>
    <p className="archive-banner">Agencia de investigación internacional · Una cuenta por detective.</p>
    {children}
    <footer><Link to="/">Archivo de partidas</Link> · <Link to="/glosario">Glosario y reglas</Link></footer>
  </main>;
}

/** Si ya hay sesión, la página de acceso sobra: se vuelve al archivo. */
function useExistingSession(): SessionDto | null | undefined {
  const [session, setSession] = useState<SessionDto | null | undefined>(undefined);
  useEffect(() => {
    const controller = new AbortController();
    void authApi.me(controller.signal).then(setSession).catch(() => setSession(null));
    return () => controller.abort();
  }, []);
  return session;
}

export function RegisterPage() {
  const navigate = useNavigate();
  const existing = useExistingSession();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<AuthSession | null>(null);
  const [resent, setResent] = useState(false);
  useEffect(() => { if (existing) navigate('/', { replace: true }); }, [existing, navigate]);
  if (existing === undefined) return <AuthShell title="Crear cuenta"><p role="status">Comprobando la sesión…</p></AuthShell>;
  if (created) {
    return <AuthShell title="Revisa tu correo">
      <section className="auth-form">
        <p className="auth-ok" role="status">Cuenta creada como {created.profile.displayName}. Te hemos enviado un correo de verificación a {email}.</p>
        <p>El enlace caduca en 24 horas. Revisa también el spam: el remitente es la dirección de pruebas de Resend.</p>
        <p>Ya tienes sesión iniciada: puedes ir al archivo y empezar a jugar; verificar el correo queda pendiente.</p>
        <div className="archive-actions">
          <Link to="/">Ir al archivo</Link>
          <button type="button" disabled={busy} onClick={() => {
            setBusy(true); setError(''); setResent(false);
            void authApi.resendVerification(created, new AbortController().signal)
              .then(() => setResent(true)).catch(setError).finally(() => setBusy(false));
          }}>Reenviar correo</button>
        </div>
        {resent && <p className="auth-ok" role="status">Correo reenviado.</p>}
        {error && <p className="auth-error" role="alert">{messageOf(error)}</p>}
      </section>
    </AuthShell>;
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirm) { setError('Las contraseñas no coinciden.'); return; }
    setBusy(true); setError('');
    void authApi.register(email, displayName, password, new AbortController().signal)
      .then(setCreated).catch(setError).finally(() => setBusy(false));
  }
  return <AuthShell title="Crear cuenta">
    <form className="auth-form" onSubmit={submit}>
      <p>Una cuenta por detective. La contraseña tiene 12 caracteres como mínimo.</p>
      <label>Correo <input type="email" autoComplete="email" required maxLength={254} value={email} disabled={busy} onChange={event => setEmail(event.currentTarget.value)} /></label>
      <label>Nombre de detective <input type="text" autoComplete="nickname" required maxLength={64} value={displayName} disabled={busy} onChange={event => setDisplayName(event.currentTarget.value)} /></label>
      <label>Contraseña <input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={password} disabled={busy} onChange={event => setPassword(event.currentTarget.value)} /></label>
      <label>Repite la contraseña <input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={confirm} disabled={busy} onChange={event => setConfirm(event.currentTarget.value)} /></label>
      {error && <p className="auth-error" role="alert">{messageOf(error)}</p>}
      <button type="submit" disabled={busy}>Crear cuenta</button>
      <div className="auth-links"><span>¿Ya tienes cuenta?</span><Link to="/login">Entra</Link></div>
    </form>
  </AuthShell>;
}

export function LoginPage() {
  const navigate = useNavigate();
  const existing = useExistingSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (existing) navigate('/', { replace: true }); }, [existing, navigate]);
  if (existing === undefined) return <AuthShell title="Entrar"><p role="status">Comprobando la sesión…</p></AuthShell>;
  function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError('');
    void authApi.login(email, password, new AbortController().signal)
      .then(() => navigate('/')).catch(setError).finally(() => setBusy(false));
  }
  return <AuthShell title="Entrar">
    <form className="auth-form" onSubmit={submit}>
      <label>Correo <input type="email" autoComplete="email" required maxLength={254} value={email} disabled={busy} onChange={event => setEmail(event.currentTarget.value)} /></label>
      <label>Contraseña <input type="password" autoComplete="current-password" required maxLength={128} value={password} disabled={busy} onChange={event => setPassword(event.currentTarget.value)} /></label>
      {error && <p className="auth-error" role="alert">{messageOf(error)}</p>}
      <button type="submit" disabled={busy}>Entrar</button>
      <div className="auth-links"><Link to="/registro">Crear cuenta</Link><Link to="/recuperar">He olvidado la contraseña</Link></div>
    </form>
  </AuthShell>;
}

export function VerifyPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const attempted = useRef(false);
  const [state, setState] = useState<'checking' | 'ok' | 'failed' | 'missing'>(token ? 'checking' : 'missing');
  useEffect(() => {
    if (!token || attempted.current) return;
    attempted.current = true;
    void authApi.verifyEmail(token, new AbortController().signal)
      .then(() => setState('ok')).catch(() => setState('failed'));
  }, [token]);
  return <AuthShell title="Verificar correo">
    <section className="auth-form">
      {state === 'checking' && <p role="status">Comprobando el enlace…</p>}
      {state === 'ok' && <><p className="auth-ok" role="status">Correo verificado. Ya puedes jugar.</p><Link to="/">Ir al archivo</Link></>}
      {state === 'failed' && <><p className="auth-error" role="alert">El enlace ya no es válido. Pide uno nuevo desde tu cuenta.</p><div className="auth-links"><Link to="/login">Entrar</Link><Link to="/registro">Crear cuenta</Link></div></>}
      {state === 'missing' && <><p role="status">Falta el enlace de verificación. Revisa tu correo y abre el enlace completo.</p><div className="auth-links"><Link to="/login">Entrar</Link><Link to="/">Archivo</Link></div></>}
    </section>
  </AuthShell>;
}

export function RecoveryPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  if (token) {
    function submit(event: FormEvent) {
      event.preventDefault();
      if (newPassword !== confirm) { setError('Las contraseñas no coinciden.'); return; }
      setBusy(true); setError('');
      void authApi.confirmRecovery(token, newPassword, new AbortController().signal)
        .then(() => setDone(true)).catch(setError).finally(() => setBusy(false));
    }
    return <AuthShell title="Nueva contraseña">
      {done
        ? <section className="auth-form"><p className="auth-ok" role="status">Contraseña actualizada. Entra con la nueva contraseña.</p><Link to="/login">Entrar</Link></section>
        : <form className="auth-form" onSubmit={submit}>
          <p>El enlace caduca en 1 hora y solo vale una vez.</p>
          <label>Contraseña nueva <input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={newPassword} disabled={busy} onChange={event => setNewPassword(event.currentTarget.value)} /></label>
          <label>Repite la contraseña <input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={confirm} disabled={busy} onChange={event => setConfirm(event.currentTarget.value)} /></label>
          {error && <p className="auth-error" role="alert">{messageOf(error)}</p>}
          <button type="submit" disabled={busy}>Cambiar contraseña</button>
        </form>}
    </AuthShell>;
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError('');
    void authApi.requestRecovery(email, new AbortController().signal)
      .then(() => setDone(true)).catch(setError).finally(() => setBusy(false));
  }
  return <AuthShell title="Recuperar contraseña">
    {done
      ? <section className="auth-form"><p className="auth-ok" role="status">Si la cuenta existe, se ha enviado un enlace de recuperación.</p><Link to="/login">Volver a entrar</Link></section>
      : <form className="auth-form" onSubmit={submit}>
        <label>Correo <input type="email" autoComplete="email" required maxLength={254} value={email} disabled={busy} onChange={event => setEmail(event.currentTarget.value)} /></label>
        {error && <p className="auth-error" role="alert">{messageOf(error)}</p>}
        <button type="submit" disabled={busy}>Enviar enlace</button>
        <div className="auth-links"><Link to="/login">Volver a entrar</Link></div>
      </form>}
  </AuthShell>;
}
