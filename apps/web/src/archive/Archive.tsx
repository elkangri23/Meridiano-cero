import { InitialRun } from './InitialRun';
import { NewRun } from './NewRun';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { ChangeEvent } from 'react';
import { archiveApi } from './client';
import { createArchiveModel } from './model';
import type { ArchiveState } from './model';
import './archive.css';

const date = new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' });
export function Archive() {
  const [model] = useState(() => createArchiveModel(archiveApi));
  const state = useSyncExternalStore(model.subscribe, model.getSnapshot);
  useEffect(() => { void model.refresh(); return model.dispose; }, [model]);
  const opener = useRef<HTMLButtonElement | null>(null);
  const restoreFocus = useRef(false);
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
  return <main className="archive">
    <header className="archive-header"><span className="archive-mark" aria-hidden="true">M<span>0</span></span><div><p>MERIDIANO-CERO</p><h1>Archivo de partidas</h1></div></header>
    <p className="archive-banner">Consulta del archivo · La investigación aún no está disponible en esta pantalla.</p>
    <SessionBar state={state} model={model} />
    <p role="status" aria-live="polite" className="archive-notice">{state.notice}</p>
    {state.openingRunId && <button type="button" onClick={closeRun}>Cancelar consulta de ficha</button>}
    {state.opened && <InitialRun view={state.opened} close={closeRun} />}
    {state.profile && <NewRun key={state.profile.id} state={state} model={model} />}
    {state.profile && <section className="archive-list" aria-label="Partidas propias" aria-busy={busy}>
      <label>Mostrar <select value={state.filter} disabled={busy} onChange={filter}><option value="all">Todas</option><option value="active">Activas</option><option value="closed">Cerradas</option></select></label>
      {state.page && state.page.items.length > 0 && <div className="archive-scroll" role="region" aria-label="Tabla de partidas, desplazable" tabIndex={0}>
        <table><caption>Partidas de la cuenta actual</caption><thead><tr><th scope="col">Expediente</th><th scope="col">Referencia</th><th scope="col">Estado</th><th scope="col">Creación</th><th scope="col">Consulta</th></tr></thead>
          <tbody>{state.page.items.map(item => <tr key={item.runId}><td>{item.caseTitle ?? 'Expediente sin ficha disponible'}</td><td><code title={item.runId}>{item.runId.slice(0, 8)}</code></td><td>{item.status === 'active' ? 'Activa' : 'Cerrada'}</td><td><time dateTime={item.createdAt}>{date.format(new Date(item.createdAt))}</time></td><td><button type="button" disabled={busy} aria-label={'Consultar partida ' + item.runId.slice(0, 8)} onClick={event => { opener.current = event.currentTarget; void model.openRun(item.runId); }}>Consultar</button></td></tr>)}</tbody>
        </table>
      </div>}
      <nav className="archive-pages" aria-label="Páginas del archivo"><button type="button" disabled={busy || state.previous.length === 0} onClick={() => { void model.back(); }}>Anterior</button><span>Página {state.previous.length + 1}</span><button type="button" disabled={busy || !state.page?.nextCursor} onClick={() => { void model.next(); }}>Siguiente</button></nav>
    </section>}
    <footer>Un detective por partida · Las consultas del archivo no avanzan el reloj del caso.</footer>
  </main>;
}

function SessionBar({ state, model }: { state: ArchiveState; model: ReturnType<typeof createArchiveModel> }) {
  const busy = state.phase === 'loading';
  return (
    <section className="archive-session" aria-label="Sesión">
      <p>{state.profile ? 'Detective: ' + state.profile.displayName : 'Sin datos de sesión visibles'}</p>
      <div className="archive-actions">
        <button type="button" disabled={busy} onClick={() => { void model.refresh(); }}>Actualizar</button>
        {state.profile && <button type="button" disabled={busy} onClick={() => { void model.logout(); }}>Cerrar sesión</button>}
        {state.phase === 'logout_failed' && <button type="button" onClick={() => { void model.logout(); }}>Reintentar cierre</button>}
        {state.phase === 'signed_out' && import.meta.env.DEV && <button type="button" onClick={() => { void model.connect(); }}>Entrar en desarrollo local</button>}
      </div>
    </section>
  );
}
