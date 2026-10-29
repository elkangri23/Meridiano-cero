import type { InitialPlayerViewDto, RunListDto, SessionDto, CaseSummary } from '@meridiano/contracts';
import type { ArchiveApi, Filter } from './client';
import { ArchiveError } from './client';
import { browserIntents, createRunCoordinator } from './creation';
import type { CreationView, IntentStorage, CreationOutcome } from './creation';

type Phase = 'loading' | 'signed_out' | 'ready' | 'error' | 'logout_failed';
export interface ArchiveState {
  phase: Phase; profile: SessionDto['profile'] | null; page: RunListDto | null;
  cases: CaseSummary[]; creation: CreationView;
  opened: InitialPlayerViewDto | null; openingRunId: string | null;
  filter: Filter; cursor: string | null; previous: readonly (string | null)[]; notice: string;
}
const blank = (): ArchiveState => ({ phase: 'loading', profile: null, page: null, opened: null, openingRunId: null, cases: [], creation: { phase: 'idle', caseId: null, runId: null }, filter: 'all', cursor: null, previous: [], notice: 'Consultando el archivo…' });
type Ticket = { signal: AbortSignal; current: () => boolean };

export function createArchiveModel(api: ArchiveApi, storage: IntentStorage = browserIntents) {
  const creator = createRunCoordinator(api, storage);
  let state = blank(); let generation = 0; let disposed = false;
  let request: AbortController | null = null;
  let session: SessionDto | null = null; let pendingLogout: string | null = null; let logoutProfile: string | null = null;
  const listeners = new Set<() => void>();
  function set(next: ArchiveState) { state = next; for (const listener of listeners) listener(); }
  function begin(): Ticket {
    request?.abort(); request = new AbortController(); const version = ++generation;
    return { signal: request.signal, current: () => !disposed && version === generation };
  }
  function failed(ticket: Ticket, closing = false) {
    if (!ticket.current()) return;
    session = null;
    set({ ...blank(), phase: closing ? 'logout_failed' : 'error',
      notice: closing ? 'No se pudo confirmar el cierre. Los datos se han ocultado; reintenta cerrar sesión.' : 'No se pudo consultar el archivo. Reintenta actualizar la sesión.' });
  }
  async function page(ticket: Ticket, identity: SessionDto, filter: Filter, cursor: string | null, previous: readonly (string | null)[]) {
    const [result, catalog] = await Promise.all([api.list(filter, cursor, ticket.signal), api.cases(ticket.signal)]);
    if (!ticket.current()) return;
    if (result.profileId !== identity.profile.id) throw new ArchiveError('invalid');
    session = identity;
    set({ phase: 'ready', profile: identity.profile, page: result, opened: null, openingRunId: null, cases: catalog.items, creation: creator.view(identity.profile.id), filter, cursor, previous,
      notice: result.items.length ? 'Archivo actualizado.' : 'No hay partidas en este filtro.' });
  }
  async function open(local = false) {
    if (disposed) return;
    if (pendingLogout) return logout();
    const ticket = begin(); session = null; set(blank());
    try {
      const identity = local ? await api.connect(ticket.signal) : await api.me(ticket.signal);
      if (!ticket.current()) return;
      if (!identity) { set({ ...blank(), phase: 'signed_out', notice: 'La sesión no está iniciada.' }); return; }
      await page(ticket, identity, 'all', null, []);
    } catch { failed(ticket); }
  }
  async function navigate(filter: Filter, cursor: string | null, previous: readonly (string | null)[]) {
    if (disposed) return;
    if (!session) return open();
    const identity = session; const ticket = begin();
    set({ ...state, phase: 'loading', profile: identity.profile, page: null, opened: null, openingRunId: null, filter, cursor, previous, notice: 'Consultando el archivo…' });
    try { await page(ticket, identity, filter, cursor, previous); }
    catch { failed(ticket); }
  }
  async function openRun(runId: string) {
    if (disposed || !session || state.phase !== 'ready') return;
    if (!state.page?.items.some(item => item.runId === runId)) return;
    const ticket = begin();
    set({ ...state, phase: 'loading', opened: null, openingRunId: runId, notice: 'Consultando la ficha de la partida…' });
    try {
      const view = await api.initial(runId, ticket.signal);
      if (!ticket.current()) return;
      if (view.runId !== runId) throw new ArchiveError('invalid');
      set({ ...state, phase: 'ready', opened: view, openingRunId: null, notice: 'Ficha inicial consultada. El reloj no ha avanzado.' });
    } catch {
      if (ticket.current()) set({ ...state, phase: 'ready', opened: null, openingRunId: null,
        notice: 'No se pudo abrir la ficha. Puede tener progreso aún no compatible, no estar disponible o haber cambiado la sesión. Actualiza el archivo para comprobarlo.' });
    }
  }
  function closeRun() {
    if (disposed || (!state.opened && !state.openingRunId)) return;
    begin();
    set({ ...state, phase: 'ready', opened: null, openingRunId: null, notice: 'Ficha cerrada. El reloj no ha avanzado.' });
  }
  function clearCreationReference() {
    logoutProfile = session?.profile.id ?? logoutProfile;
    return logoutProfile === null || creator.forget(logoutProfile);
  }
  async function logout() {
    if (disposed) return;
    const csrf = pendingLogout ?? session?.csrfToken;
    const cleared = clearCreationReference();
    const ticket = begin(); session = null; pendingLogout = csrf ?? null;
    set({ ...blank(), notice: 'Cerrando sesión…' });
    try {
      if (csrf) await api.logout(csrf, ticket.signal);
      if (!ticket.current()) return;
      pendingLogout = null; logoutProfile = null;
      set({ ...blank(), phase: 'signed_out', notice: cleared ? 'Sesión cerrada.' : 'Sesión cerrada. No se pudo borrar la referencia local de creación.' });
    } catch { failed(ticket, true); }
  }
  function creationAllowed(caseId: string | null): boolean {
    if (caseId === null) return state.creation.phase === 'uncertain';
    return state.creation.phase === 'idle' && state.cases.some(item => item.caseId === caseId && item.canStart);
  }
  function showCreation(result: CreationOutcome) {
    set({ ...state, phase: 'ready', creation: { phase: result.phase, caseId: state.creation.caseId, runId: result.phase === 'created' ? result.runId : null },
      notice: result.phase === 'created' ? 'Creación confirmada. Actualiza el archivo para verla.' : 'Creación sin confirmar. Se conserva la misma referencia; comprobar no crea otra partida.' });
  }
  async function creation(caseId: string | null, resend: boolean) {
    if (disposed || !session || state.phase !== 'ready') return;
    if (!creationAllowed(caseId)) return;
    const identity = session; const ticket = begin();
    set({ ...state, phase: 'loading', creation: { phase: 'sending', caseId: caseId ?? state.creation.caseId, runId: null }, notice: 'Comprobando la creación…' });
    try {
      const result = caseId === null ? await creator.recover(identity, resend, ticket.signal) : await creator.start(caseId, identity, ticket.signal);
      if (!ticket.current()) return;
      showCreation(result);
    } catch {
      if (ticket.current()) set({ ...state, phase: 'ready', creation: { phase: 'blocked', caseId: state.creation.caseId, runId: null }, notice: 'No se pudo acceder a la referencia local. No se ha enviado una intención nueva.' });
    }
  }
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    openRun, closeRun,
    refresh: () => open(), connect: () => open(true), logout,
    createCase: (caseId: string) => creation(caseId, false),
    recoverCreation: (resend = false) => creation(null, resend),
    prepareCreation() { if (state.phase === 'ready' && state.creation.phase === 'created') set({ ...state, creation: { phase: 'idle', caseId: null, runId: null } }); },
    filter: (value: Filter) => navigate(value, null, []),
    next: () => state.page?.nextCursor ? navigate(state.filter, state.page.nextCursor, [...state.previous, state.cursor]) : Promise.resolve(),
    back: () => state.previous.length ? navigate(state.filter, state.previous.at(-1) ?? null, state.previous.slice(0, -1)) : Promise.resolve(),
    dispose() { disposed = true; generation++; request?.abort(); session = null; pendingLogout = null; listeners.clear(); state = blank(); },
  };
}
