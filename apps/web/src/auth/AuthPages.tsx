import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi, AuthError } from './client';
import type { AuthErrorKind, AuthSession } from './client';
import type { LocaleKey, SessionDto, TranslateFn } from '@meridiano/contracts';
import { useTranslation } from '../i18n';
import './auth.css';

const errorKeys: Record<AuthErrorKind, LocaleKey> = {
  unavailable: 'auth.error.unavailable',
  invalid: 'auth.error.invalid',
  email_taken: 'auth.error.email_taken',
  bad_credentials: 'auth.error.bad_credentials',
  bad_token: 'auth.error.bad_token',
  rate_limited: 'auth.error.rate_limited',
  not_configured: 'auth.error.not_configured',
  session: 'auth.error.session',
};

function messageOf(error: unknown, t: TranslateFn): string {
  // Las comprobaciones del propio formulario (contraseñas distintas) ya
  // dejan el mensaje traducido como cadena: se enseña tal cual, no como
  // «Error inesperado.».
  if (typeof error === 'string') return error;
  return error instanceof AuthError ? t(errorKeys[error.kind]) : t('auth.error.unexpected');
}

function AuthShell({ title, children }: { title: string; children: ReactNode }) {
  const t = useTranslation();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  return <main className="archive">
    <header className="archive-header"><span className="archive-mark" aria-hidden="true">M<span>0</span></span><div><p>MERIDIANO-CERO</p><h1 tabIndex={-1} ref={heading}>{title}</h1></div></header>
    <p className="archive-banner">{t('auth.banner')}</p>
    {children}
    <footer><Link to="/archivo">{t('archive.title')}</Link> · <Link to="/glosario">{t('archive.glossary')}</Link></footer>
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
  const t = useTranslation();
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
  useEffect(() => { if (existing) navigate('/archivo', { replace: true }); }, [existing, navigate]);
  if (existing === undefined) return <AuthShell title={t('archive.createAccount')}><p role="status">{t('auth.checkingSession')}</p></AuthShell>;
  if (created) {
    return <AuthShell title={t('auth.checkEmail')}>
      <section className="auth-form">
        <p className="auth-ok" role="status">{t('auth.accountCreated', { name: created.profile.displayName, email })}</p>
        <p>{t('auth.verifyNote')}</p>
        <p>{t('auth.sessionStarted')}</p>
        <div className="archive-actions">
          <Link to="/archivo">{t('auth.goArchive')}</Link>
          <button type="button" disabled={busy} onClick={() => {
            setBusy(true); setError(''); setResent(false);
            void authApi.resendVerification(created, new AbortController().signal)
              .then(() => setResent(true)).catch(setError).finally(() => setBusy(false));
          }}>{t('auth.resend')}</button>
        </div>
        {resent && <p className="auth-ok" role="status">{t('auth.resent')}</p>}
        {error && <p className="auth-error" role="alert">{messageOf(error, t)}</p>}
      </section>
    </AuthShell>;
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirm) { setError(t('auth.passwordsMismatch')); return; }
    setBusy(true); setError('');
    void authApi.register(email, displayName, password, new AbortController().signal)
      .then(setCreated).catch(setError).finally(() => setBusy(false));
  }
  return <AuthShell title={t('archive.createAccount')}>
    <form className="auth-form" onSubmit={submit}>
      <p>{t('auth.registerIntro')}</p>
      <label>{t('auth.email')} <input type="email" autoComplete="email" required maxLength={254} value={email} disabled={busy} onChange={event => setEmail(event.currentTarget.value)} /></label>
      <label>{t('auth.displayName')} <input type="text" autoComplete="nickname" required maxLength={64} value={displayName} disabled={busy} onChange={event => setDisplayName(event.currentTarget.value)} /></label>
      <label>{t('auth.password')} <input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={password} disabled={busy} onChange={event => setPassword(event.currentTarget.value)} /></label>
      <label>{t('auth.confirmPassword')} <input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={confirm} disabled={busy} onChange={event => setConfirm(event.currentTarget.value)} /></label>
      {error && <p className="auth-error" role="alert">{messageOf(error, t)}</p>}
      <button type="submit" disabled={busy}>{t('archive.createAccount')}</button>
      <div className="auth-links"><span>{t('auth.haveAccount')}</span><Link to="/login">{t('archive.login')}</Link></div>
    </form>
  </AuthShell>;
}

export function LoginPage() {
  const t = useTranslation();
  const navigate = useNavigate();
  const existing = useExistingSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (existing) navigate('/archivo', { replace: true }); }, [existing, navigate]);
  if (existing === undefined) return <AuthShell title={t('archive.login')}><p role="status">{t('auth.checkingSession')}</p></AuthShell>;
  function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError('');
    void authApi.login(email, password, new AbortController().signal)
      .then(() => navigate('/archivo')).catch(setError).finally(() => setBusy(false));
  }
  return <AuthShell title={t('archive.login')}>
    <form className="auth-form" onSubmit={submit}>
      <label>{t('auth.email')} <input type="email" autoComplete="email" required maxLength={254} value={email} disabled={busy} onChange={event => setEmail(event.currentTarget.value)} /></label>
      <label>{t('auth.password')} <input type="password" autoComplete="current-password" required maxLength={128} value={password} disabled={busy} onChange={event => setPassword(event.currentTarget.value)} /></label>
      {error && <p className="auth-error" role="alert">{messageOf(error, t)}</p>}
      <button type="submit" disabled={busy}>{t('archive.login')}</button>
      <div className="auth-links"><Link to="/registro">{t('archive.createAccount')}</Link><Link to="/recuperar">{t('auth.forgotPassword')}</Link></div>
    </form>
  </AuthShell>;
}

export function VerifyPage() {
  const t = useTranslation();
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
  return <AuthShell title={t('auth.verifyTitle')}>
    <section className="auth-form">
      {state === 'checking' && <p role="status">{t('auth.checkingLink')}</p>}
      {state === 'ok' && <><p className="auth-ok" role="status">{t('archive.verified')}</p><Link to="/archivo">{t('auth.goArchive')}</Link></>}
      {state === 'failed' && <><p className="auth-error" role="alert">{t('auth.linkInvalid')}</p><div className="auth-links"><Link to="/login">{t('archive.login')}</Link><Link to="/registro">{t('archive.createAccount')}</Link></div></>}
      {state === 'missing' && <><p role="status">{t('auth.linkMissing')}</p><div className="auth-links"><Link to="/login">{t('archive.login')}</Link><Link to="/archivo">{t('auth.archiveShort')}</Link></div></>}
    </section>
  </AuthShell>;
}

export function RecoveryPage() {
  const t = useTranslation();
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
      if (newPassword !== confirm) { setError(t('auth.passwordsMismatch')); return; }
      setBusy(true); setError('');
      void authApi.confirmRecovery(token, newPassword, new AbortController().signal)
        .then(() => setDone(true)).catch(setError).finally(() => setBusy(false));
    }
    return <AuthShell title={t('auth.newPasswordTitle')}>
      {done
        ? <section className="auth-form"><p className="auth-ok" role="status">{t('auth.passwordUpdated')}</p><Link to="/login">{t('archive.login')}</Link></section>
        : <form className="auth-form" onSubmit={submit}>
          <p>{t('auth.recoveryNote')}</p>
          <label>{t('auth.newPassword')} <input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={newPassword} disabled={busy} onChange={event => setNewPassword(event.currentTarget.value)} /></label>
          <label>{t('auth.confirmPassword')} <input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={confirm} disabled={busy} onChange={event => setConfirm(event.currentTarget.value)} /></label>
          {error && <p className="auth-error" role="alert">{messageOf(error, t)}</p>}
          <button type="submit" disabled={busy}>{t('auth.changePassword')}</button>
        </form>}
    </AuthShell>;
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError('');
    void authApi.requestRecovery(email, new AbortController().signal)
      .then(() => setDone(true)).catch(setError).finally(() => setBusy(false));
  }
  return <AuthShell title={t('auth.recoverTitle')}>
    {done
      ? <section className="auth-form"><p className="auth-ok" role="status">{t('auth.recoverySent')}</p><Link to="/login">{t('auth.backToLogin')}</Link></section>
      : <form className="auth-form" onSubmit={submit}>
        <label>{t('auth.email')} <input type="email" autoComplete="email" required maxLength={254} value={email} disabled={busy} onChange={event => setEmail(event.currentTarget.value)} /></label>
        {error && <p className="auth-error" role="alert">{messageOf(error, t)}</p>}
        <button type="submit" disabled={busy}>{t('auth.sendLink')}</button>
        <div className="auth-links"><Link to="/login">{t('auth.backToLogin')}</Link></div>
      </form>}
  </AuthShell>;
}
