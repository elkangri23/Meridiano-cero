import { Link, useSearchParams } from 'react-router-dom';
import { InitialRun } from './InitialRun';
import { NewRun } from './NewRun';
import { GenerationPanel } from './GenerationPanel';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { ChangeEvent } from 'react';
import { caseLabel } from '@meridiano/case-schema';
import type { DetectiveProfileDto, SessionDto } from '@meridiano/contracts';
import { archiveApi } from './client';
import { profileApi } from '../auth/client';
import { avatarLabel, ProfileSection } from '../auth/ProfileSection';
import { createArchiveModel } from './model';
import type { ArchiveState, ConnectionStatus } from './model';
import './archive.css';

const difficultyLabels: Record<string, string> = { easy: 'Fácil', normal: 'Normal', hard: 'Difícil' };

/** Delito y contenido del expediente de una partida («Robo internacional ·
 * Familiar»); «—» si el expediente ya no está en el catálogo. */
function caseLabelFor(state: ArchiveState, caseId: string): string {
  const entry = state.cases.find(item => item.caseId === caseId);
  if (!entry) return '—';
  return caseLabel(entry.crimeType, entry.contentRating);
}

function connectionStatusLabel(status: ConnectionStatus): string {
  switch (status) {
    case 'online': return 'Conectado';
    case 'offline': return 'Sin conexión';
    case 'reconnecting': return 'Reconectando...';
    default: return 'Desconocido';
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

function renderArchiveList(state: any, model: any, busy: boolean, filter: (e: any) => void, opener: any, closeRun: any, deleteTarget: string | null, setDeleteTarget: (runId: string | null) => void) {
  if (!state.profile) return null;

  return (
    <section className="archive-list" aria-label="Partidas propias" aria-busy={busy}>
      <p className="archive-overline">Partidas propias</p>
      <h2>Mis partidas</h2>
      <label>Mostrar <select value={state.filter} disabled={busy} onChange={filter}><option value="all">Todas</option><option value="active">Activas</option><option value="closed">Cerradas</option></select></label>
      <div className="archive-connection">
        <span style={{ color: connectionStatusColor(state.connectionStatus), fontWeight: 'bold' }}>
          {connectionStatusLabel(state.connectionStatus)}
        </span>
        {state.connectionStatus !== 'online' && (
          <button type="button" className="text-button" onClick={() => { void model.reconnect(); }} disabled={state.connectionStatus === 'reconnecting'}>
            Reintentar conexión
          </button>
        )}
        {state.lastError && <span className="archive-connection-error">{state.lastError}</span>}
      </div>
      <p role="status" aria-live="polite" className="archive-notice">{state.notice}</p>
      {state.openingRunId && <button type="button" onClick={closeRun}>Cancelar consulta de ficha</button>}
      {state.page && state.page.items.length > 0 && (
        <div className="archive-scroll" role="region" aria-label="Tabla de partidas, desplazable" tabIndex={0}>
          <table><caption>Partidas de la cuenta actual</caption><thead><tr><th scope="col">Expediente</th><th scope="col">Delito</th><th scope="col">Referencia</th><th scope="col">Estado</th><th scope="col">Dificultad</th><th scope="col">Reloj</th><th scope="col">Creación</th><th scope="col">Consulta</th><th scope="col">Jugar</th><th scope="col">Borrar</th></tr></thead>
            <tbody>{state.page.items.map((item: any) => <tr key={item.runId}><td>{item.caseTitle ?? 'Expediente sin ficha disponible'}</td><td>{caseLabelFor(state, item.caseId)}</td><td><code title={item.runId}>{item.runId.slice(0, 8)}</code></td><td>{item.status === 'active' ? 'Activa' : 'Cerrada'}</td><td>{difficultyLabels[item.difficulty] ?? item.difficulty}</td><td>{item.minute} min</td><td><time dateTime={item.createdAt}>{item.createdAt.toLocaleString()}</time></td><td><button type="button" disabled={busy} aria-label={'Consultar partida ' + item.runId.slice(0, 8)} onClick={event => { opener.current = event.currentTarget; void model.openRun(item.runId); }}>Consultar</button></td><td><Link to={'/runs/' + item.runId}>{item.status === 'active' ? 'Jugar' : 'Revisar'}</Link></td><td>{deleteTarget === item.runId ? <span><button type="button" disabled={busy} onClick={() => { setDeleteTarget(null); void model.deleteRun(item.runId); }}>Sí, borrar</button>{' '}<button type="button" disabled={busy} onClick={() => setDeleteTarget(null)}>Cancelar</button></span> : <button type="button" disabled={busy} aria-label={'Borrar partida ' + item.runId.slice(0, 8)} onClick={() => setDeleteTarget(item.runId)}>Borrar</button>}</td></tr>)}</tbody>
          </table>
        </div>
      )}
      <nav className="archive-pages" aria-label="Páginas del archivo"><button type="button" disabled={busy || state.previous.length === 0} onClick={() => { void model.back(); }}>Anterior</button><span>Página {state.previous.length + 1}</span><button type="button" disabled={busy || !state.page?.nextCursor} onClick={() => { void model.next(); }}>Siguiente</button></nav>
    </section>
  );
}

function UnverifiedHint({ profile }: { profile: { emailVerified: boolean } | null }) {
  if (!profile || profile.emailVerified) return null;
  return <p>Correo sin verificar. Revisa tu bandeja de entrada.</p>;
}

/** Resumen del detective para la barra de sesión: alias si lo hay, si no el
 * nombre de la cuenta, y la etiqueta del avatar. */
function detectiveSessionLine(profile: { displayName: string } | null, detectiveProfile: DetectiveProfileDto | null): string {
  if (!profile) return 'Sin sesión iniciada. Regístrate o entra para jugar.';
  const alias = detectiveProfile?.alias ?? profile.displayName;
  return detectiveProfile ? `Detective: ${alias} · Avatar: ${avatarLabel(detectiveProfile.avatar)}` : `Detective: ${alias}`;
}

function SessionBar({ state, model, detectiveProfile }: { state: any; model: any; detectiveProfile: DetectiveProfileDto | null }) {
  const busy = state.phase === 'loading';
  const isOffline = state.connectionStatus !== 'online';
  return (
    <section className="archive-session" aria-label="Sesión">
      <p>{detectiveSessionLine(state.profile, detectiveProfile)}</p>
      <UnverifiedHint profile={state.profile} />
      <div className="archive-actions">
        {!state.profile && <><Link to="/registro">Crear cuenta</Link><Link to="/login">Entrar</Link></>}
        <button type="button" disabled={busy} onClick={() => { void model.refresh(); }}>Actualizar</button>
        {state.profile && <button type="button" disabled={busy} onClick={() => { void model.logout(); }}>Cerrar sesión</button>}
        {isOffline && <button type="button" disabled={state.connectionStatus === 'reconnecting'} onClick={() => { void model.reconnect(); }}>
          {state.connectionStatus === 'reconnecting' ? 'Reconectando...' : 'Reconectar'}
        </button>}
        {state.phase === 'logout_failed' && <button type="button" onClick={() => { void model.logout(); }}>Reintentar cierre</button>}
        {state.phase === 'signed_out' && import.meta.env.DEV && <button type="button" onClick={() => { void model.connect(); }}>Entrar en desarrollo local</button>}
      </div>
    </section>
  );
}

function Archive() {
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
      <a className="skip-link" href="#command-input">Ir a la entrada de órdenes</a>
      <header className="archive-header"><span className="archive-mark" aria-hidden="true">M<span>0</span></span><div><p>Meridiano-cero · Agencia de investigación internacional</p><h1>Archivo de partidas</h1></div></header>
      <p className="archive-banner">Consulta del archivo · Aquí empiezas tus investigaciones y retomas las que tienes a medias.</p>
      <SessionBar state={state} model={model} detectiveProfile={detectiveProfile} />
      {verified && <p role="status" className="archive-notice">Correo verificado. Ya puedes jugar.</p>}
      <p role="status" aria-live="polite" className="archive-notice">{state.notice}</p>
      {state.openingRunId && <button type="button" onClick={closeRun}>Cancelar consulta de ficha</button>}
      {state.opened && <InitialRun view={state.opened} close={closeRun} />}
      {state.profile && <NewRun key={state.profile.id} state={state} model={model} />}
      {state.profile && <GenerationPanel key={state.profile.id + '-generation'} state={state} model={model} />}
      {state.profile && renderArchiveList(state, model, busy, filter, opener, closeRun, deleteTarget, setDeleteTarget)}
      {state.profile && identity && <section className="archive-list" aria-label="Mi perfil de detective">
        <p className="archive-overline">Perfil</p>
        <h2>Mi perfil de detective</h2>
        <ProfileSection identity={identity} profile={detectiveProfile} onSaved={setDetectiveProfile} />
      </section>}
      <footer><Link to="/glosario">Glosario y reglas</Link> · Un detective por partida · Las consultas del archivo no avanzan el reloj del caso.</footer>
    </main>
  );
}

export { Archive };
