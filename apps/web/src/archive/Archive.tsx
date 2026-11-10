import { Link, useSearchParams } from 'react-router-dom';
import { InitialRun } from './InitialRun';
import { NewRun } from './NewRun';
import { GenerationPanel } from './GenerationPanel';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { ChangeEvent, RefObject } from 'react';
import { caseLabel } from '@meridiano/contracts';
import type { DetectiveProfileDto, SessionDto, TranslateFn } from '@meridiano/contracts';
import { archiveApi } from './client';
import { profileApi } from '../auth/client';
import { avatarLabel, ProfileSection } from '../auth/ProfileSection';
import { CareerSection } from './CareerSection';
import { createArchiveModel } from './model';
import type { ArchiveState, ConnectionStatus } from './model';
import { useTranslation } from '../i18n';
import './archive.css';

/** Delito y contenido del expediente de una partida («Robo internacional ·
 * Familiar»); «—» si el expediente ya no está en el catálogo. */
function caseLabelFor(state: ArchiveState, caseId: string, t: TranslateFn): string {
  const entry = state.cases.find(item => item.caseId === caseId);
  if (!entry) return '—';
  return caseLabel(entry.crimeType, entry.contentRating, t);
}

function connectionStatusLabel(status: ConnectionStatus, t: TranslateFn): string {
  switch (status) {
    case 'online': return t('labels.connection.online');
    case 'offline': return t('labels.connection.offline');
    case 'reconnecting': return t('labels.connection.reconnecting');
    default: return t('labels.connection.unknown');
  }
}
function connectionStatusColor(status: ConnectionStatus): string {
  switch (status) {
    case 'online': return '#ffff55';
    case 'offline': return '#ff5555';
    case 'reconnecting': return '#ffff55';
    default: return '#aaaaaa';
  }
}

type ArchiveModel = ReturnType<typeof createArchiveModel>;

function renderArchiveList(state: ArchiveState, model: ArchiveModel, busy: boolean, filter: (event: ChangeEvent<HTMLSelectElement>) => void, opener: RefObject<HTMLButtonElement | null>, closeRun: () => void, deleteTarget: string | null, setDeleteTarget: (runId: string | null) => void, t: TranslateFn) {
  if (!state.profile) return null;

  return (
    <section className="archive-list" aria-label={t('archive.ownRuns')} aria-busy={busy}>
      <p className="archive-overline">{t('archive.ownRuns')}</p>
      <h2>{t('archive.myRuns')}</h2>
      <label>{t('archive.show')} <select value={state.filter} disabled={busy} onChange={filter}><option value="all">{t('common.all')}</option><option value="active">{t('archive.filter.active')}</option><option value="closed">{t('archive.filter.closed')}</option></select></label>
      <div className="archive-connection">
        <span style={{ color: connectionStatusColor(state.connectionStatus), fontWeight: 'bold' }}>
          {connectionStatusLabel(state.connectionStatus, t)}
        </span>
        {state.connectionStatus !== 'online' && (
          <button type="button" className="text-button" onClick={() => { void model.reconnect(); }} disabled={state.connectionStatus === 'reconnecting'}>
            {t('archive.retryConnection')}
          </button>
        )}
        {state.lastError && <span className="archive-connection-error">{state.lastError}</span>}
      </div>
      <p role="status" aria-live="polite" className="archive-notice">{state.notice}</p>
      {state.openingRunId && <button type="button" onClick={closeRun}>{t('archive.cancelOpenRun')}</button>}
      {state.page && state.page.items.length > 0 && (
        <div className="archive-scroll" role="region" aria-label={t('archive.runsTable')} tabIndex={0}>
          <table><caption>{t('archive.runsCaption')}</caption><thead><tr><th scope="col">{t('archive.col.case')}</th><th scope="col">{t('archive.col.crime')}</th><th scope="col">{t('archive.col.ref')}</th><th scope="col">{t('archive.col.status')}</th><th scope="col">{t('archive.col.difficulty')}</th><th scope="col">{t('archive.col.clock')}</th><th scope="col">{t('archive.col.created')}</th><th scope="col">{t('archive.col.open')}</th><th scope="col">{t('archive.col.play')}</th><th scope="col">{t('archive.col.delete')}</th></tr></thead>
            <tbody>{state.page.items.map((item) => <tr key={item.runId}><td>{item.caseTitle ?? t('archive.caseNoSheet')}</td><td>{caseLabelFor(state, item.caseId, t)}</td><td><code title={item.runId}>{item.runId.slice(0, 8)}</code></td><td>{item.status === 'active' ? t('common.active') : t('common.closed')}</td><td>{t(item.difficulty === 'easy' ? 'labels.difficulty.easy' : item.difficulty === 'hard' ? 'labels.difficulty.hard' : 'labels.difficulty.normal')}</td><td>{t('common.minutes', { count: item.minute })}</td><td><time dateTime={item.createdAt}>{item.createdAt.toLocaleString()}</time></td><td><button type="button" disabled={busy} aria-label={t('archive.openRun', { ref: item.runId.slice(0, 8) })} onClick={event => { opener.current = event.currentTarget; void model.openRun(item.runId); }}>{t('archive.open')}</button></td><td><Link to={'/runs/' + item.runId}>{item.status === 'active' ? t('archive.play') : t('archive.review')}</Link></td><td>{deleteTarget === item.runId ? <span><button type="button" disabled={busy} onClick={() => { setDeleteTarget(null); void model.deleteRun(item.runId); }}>{t('archive.confirmDelete')}</button>{' '}<button type="button" disabled={busy} onClick={() => setDeleteTarget(null)}>{t('common.cancel')}</button></span> : <button type="button" disabled={busy} aria-label={t('archive.deleteRun', { ref: item.runId.slice(0, 8) })} onClick={() => setDeleteTarget(item.runId)}>{t('archive.delete')}</button>}</td></tr>)}</tbody>
          </table>
        </div>
      )}
      <nav className="archive-pages" aria-label={t('archive.pages')}><button type="button" disabled={busy || state.previous.length === 0} onClick={() => { void model.back(); }}>{t('common.back')}</button><span>{t('archive.page', { page: state.previous.length + 1 })}</span><button type="button" disabled={busy || !state.page?.nextCursor} onClick={() => { void model.next(); }}>{t('common.next')}</button></nav>
    </section>
  );
}

function UnverifiedHint({ profile }: { profile: { emailVerified: boolean } | null }) {
  const t = useTranslation();
  if (!profile || profile.emailVerified) return null;
  return <p>{t('archive.unverified')}</p>;
}

/** Resumen del detective para la barra de sesión: alias si lo hay, si no el
 * nombre de la cuenta, y la etiqueta del avatar. */
function detectiveSessionLine(profile: { displayName: string } | null, detectiveProfile: DetectiveProfileDto | null, t: TranslateFn): string {
  if (!profile) return t('archive.signedOut');
  const alias = detectiveProfile?.alias ?? profile.displayName;
  return detectiveProfile ? t('archive.detectiveLine', { alias, avatar: avatarLabel(detectiveProfile.avatar, t) }) : t('archive.detectiveLineNoAvatar', { alias });
}

function SessionBar({ state, model, detectiveProfile }: { state: ArchiveState; model: ArchiveModel; detectiveProfile: DetectiveProfileDto | null }) {
  const t = useTranslation();
  const busy = state.phase === 'loading';
  const isOffline = state.connectionStatus !== 'online';
  return (
    <section className="archive-session" aria-label={t('archive.session')}>
      {/* Al cargar, el perfil aún es null y la línea enseñaba «Sin sesión
        iniciada» un instante aunque la sesión se recuperara sola: mientras
        se consulta, se dice que se está consultando. */}
      <p>{busy ? t('archive.notice.loading') : detectiveSessionLine(state.profile, detectiveProfile, t)}</p>
      <UnverifiedHint profile={state.profile} />
      <div className="archive-actions">
        {!state.profile && <><Link to="/registro">{t('archive.createAccount')}</Link><Link to="/login">{t('archive.login')}</Link></>}
        <button type="button" disabled={busy} onClick={() => { void model.refresh(); }}>{t('archive.refresh')}</button>
        {state.profile && <button type="button" disabled={busy} onClick={() => { void model.logout(); }}>{t('archive.logout')}</button>}
        {isOffline && <button type="button" disabled={state.connectionStatus === 'reconnecting'} onClick={() => { void model.reconnect(); }}>
          {state.connectionStatus === 'reconnecting' ? t('archive.notice.reconnecting') : t('archive.reconnect')}
        </button>}
        {state.phase === 'logout_failed' && <button type="button" onClick={() => { void model.logout(); }}>{t('archive.retryLogout')}</button>}
        {state.phase === 'signed_out' && import.meta.env.DEV && <button type="button" onClick={() => { void model.connect(); }}>{t('archive.devLogin')}</button>}
      </div>
    </section>
  );
}

function Archive() {
  const t = useTranslation();
  const [model] = useState(() => createArchiveModel(archiveApi));
  const [searchParams] = useSearchParams();
  const verified = searchParams.get('verified') === '1';
  const state = useSyncExternalStore(model.subscribe, model.getSnapshot);
  useEffect(() => { void model.refresh(); return model.dispose; }, [model]);
  // Perfil de detective (§13): la sesión (con csrfToken) se lee aparte
  // porque el modelo del archivo solo expone el perfil sin el token.
  const [identity, setIdentity] = useState<SessionDto | null>(null);
  const [detectiveProfile, setDetectiveProfile] = useState<DetectiveProfileDto | null>(null);
  useEffect(() => {
    if (!state.profile) { setIdentity(null); setDetectiveProfile(null); return; }
    const controller = new AbortController();
    (async () => {
      const session = await archiveApi.me(controller.signal).catch(() => null);
      if (controller.signal.aborted || !session) return;
      setIdentity(session);
      const profile = await profileApi.get(controller.signal).catch(() => null);
      if (!controller.signal.aborted && profile) setDetectiveProfile(profile);
    })();
    return () => controller.abort();
  }, [state.profile]);
  const opener = useRef<HTMLButtonElement | null>(null);
  const restoreFocus = useRef(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  useEffect(() => {
    if (restoreFocus.current && state.phase === 'ready') {
      restoreFocus.current = false; opener.current?.focus();
    }
  }, [state.phase, state.opened, state.openingRunId]);
  function closeRun() { restoreFocus.current = true; model.closeRun(); }
  const busy = state.phase === 'loading';
  function filter(event: ChangeEvent<HTMLSelectElement>) {
    const value = event.currentTarget.value;
    if (value === 'all' || value === 'active' || value === 'closed') void model.filter(value);
  }

  return (
    <main className="archive">
      <a className="skip-link" href="#command-input">{t('archive.skipLink')}</a>
      <header className="archive-header"><span className="archive-mark" aria-hidden="true">M<span>0</span></span><div><p>{t('archive.subtitle')}</p><h1>{t('archive.title')}</h1></div></header>
      <p className="archive-banner">{t('archive.banner')}</p>
      <SessionBar state={state} model={model} detectiveProfile={detectiveProfile} />
      {verified && <p role="status" className="archive-notice">{t('archive.verified')}</p>}
      <p role="status" aria-live="polite" className="archive-notice">{state.notice}</p>
      {state.openingRunId && <button type="button" onClick={closeRun}>{t('archive.cancelOpenRun')}</button>}
      {state.opened && <InitialRun view={state.opened} close={closeRun} />}
      {state.profile && <NewRun key={state.profile.id} state={state} model={model} />}
      {state.profile && <GenerationPanel key={state.profile.id + '-generation'} state={state} model={model} />}
      {state.profile && renderArchiveList(state, model, busy, filter, opener, closeRun, deleteTarget, setDeleteTarget, t)}
      {state.profile && identity && <section className="archive-list" aria-label={t('archive.profileTitle')}>
        <p className="archive-overline">{t('archive.profileOverline')}</p>
        <h2>{t('archive.profileTitle')}</h2>
        <ProfileSection identity={identity} profile={detectiveProfile} onSaved={setDetectiveProfile} />
      </section>}
      {state.profile && <CareerSection />}
      <footer><Link to="/glosario">{t('archive.glossary')}</Link> · <Link to="/creditos">{t('archive.credits')}</Link> · {t('archive.footer')}</footer>
    </main>
  );
}

export { Archive };
