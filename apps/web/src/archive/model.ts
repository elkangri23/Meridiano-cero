import type { PlayerViewDto, RunListDto, SessionDto, CaseSummary, CaseImportResultDto, GenerationJobDto } from '@meridiano/contracts';
import type { ArchiveApi, CreationParams, Filter, GenerationJobParams } from './client';
import { ArchiveError } from './client';
import { browserIntents, createRunCoordinator } from './creation';
import type { CreationView, IntentStorage, CreationOutcome, Difficulty } from './creation';
import { translateUi } from '../preferences';

export type ConnectionStatus = 'online' | 'offline' | 'reconnecting' | 'unknown';

type Phase = 'loading' | 'signed_out' | 'ready' | 'error' | 'logout_failed';
export interface ArchiveState {
  phase: Phase; profile: SessionDto['profile'] | null; page: RunListDto | null;
  cases: CaseSummary[]; creation: CreationView;
  jobs: GenerationJobDto[];
  opened: PlayerViewDto | null; openingRunId: string | null;
  filter: Filter; cursor: string | null; previous: readonly (string | null)[]; notice: string;
  connectionStatus: ConnectionStatus;
  lastError: string | null;
}
const blank = (): ArchiveState => ({ phase: 'loading', profile: null, page: null, opened: null, openingRunId: null, cases: [], creation: { phase: 'idle', caseId: null, runId: null }, jobs: [], filter: 'all', cursor: null, previous: [], notice: translateUi('archive.notice.loading'), connectionStatus: 'unknown', lastError: null });

/** Aviso al terminar un job de generación: sustituye el «Generación en
 * cola» que se puso al crearlo. Sin título conocido, el aviso no promete
 * un expediente concreto. */
function jobFinishedNotice(job: GenerationJobDto, cases: CaseSummary[]): string {
  if (job.status === 'done') {
    const title = job.caseId ? cases.find(item => item.caseId === job.caseId)?.title : null;
    return title
      ? translateUi('archive.notice.jobDone', { title })
      : translateUi('archive.notice.jobDoneNoTitle');
  }
  if (job.status === 'failed') return job.error ? translateUi('archive.notice.jobFailed', { error: job.error }) : translateUi('archive.notice.jobFailedNoError');
  return translateUi('archive.notice.jobCancelled');
}

function importNotice(result: CaseImportResultDto): string {
  const warnings = result.warnings.length ? translateUi('archive.notice.importWarnings', { warnings: result.warnings.join(' ') }) : '';
  const known = result.alreadyExisted ? translateUi('archive.notice.importKnown') : '';
  return translateUi('archive.notice.import', { title: result.title, known, warnings });
}
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
    const wasOnline = state.connectionStatus === 'online';
    set({ ...blank(), phase: closing ? 'logout_failed' : 'error',
      notice: closing ? translateUi('archive.notice.closeFailed') : translateUi('archive.notice.loadFailed'),
      connectionStatus: wasOnline ? 'reconnecting' : 'offline',
      lastError: translateUi('archive.notice.retrying') });
  }

  async function reconnect(): Promise<void> {
    if (disposed) return;
    const ticket = begin();
    set({ ...state, phase: 'loading', connectionStatus: 'reconnecting', notice: translateUi('archive.notice.reconnecting') });
    try {
      const identity = await api.connect(ticket.signal);
      if (!ticket.current()) return;
      if (!identity) { set({ ...blank(), phase: 'signed_out', connectionStatus: 'offline', notice: translateUi('archive.notice.signedOut') }); return; }
      await page(ticket, identity, 'all', null, []);
      set({ ...state, connectionStatus: 'online', lastError: null });
    } catch {
      if (ticket.current()) {
        set({ ...state, connectionStatus: 'offline', notice: translateUi('archive.notice.reconnectFailed') });
      }
    }
  }

  async function page(ticket: Ticket, identity: SessionDto, filter: Filter, cursor: string | null, previous: readonly (string | null)[]) {
    const [result, catalog, jobs] = await Promise.all([api.list(filter, cursor, ticket.signal), api.cases(ticket.signal), api.generationJobs(ticket.signal)]);
    if (!ticket.current()) return;
    if (result.profileId !== identity.profile.id) throw new ArchiveError('invalid');
    session = identity;
    set({ phase: 'ready', profile: identity.profile, page: result, opened: null, openingRunId: null, cases: catalog.items, creation: creator.view(identity.profile.id), jobs: jobs.items, filter, cursor, previous,
      notice: result.items.length ? translateUi('archive.notice.updated') : translateUi('archive.notice.noRuns'),
      connectionStatus: 'online',
      lastError: null });
  }
  async function open(local = false) {
    if (disposed) return;
    if (pendingLogout) return logout();
    const ticket = begin(); session = null; set(blank());
    try {
      const identity = local ? await api.connect(ticket.signal) : await api.me(ticket.signal);
      if (!ticket.current()) return;
      if (!identity) { set({ ...blank(), phase: 'signed_out', notice: translateUi('archive.notice.signedOut') }); return; }
      await page(ticket, identity, 'all', null, []);
    } catch { failed(ticket); }
  }
  async function navigate(filter: Filter, cursor: string | null, previous: readonly (string | null)[]) {
    if (disposed) return;
    if (!session) return open();
    const identity = session; const ticket = begin();
    set({ ...state, phase: 'loading', profile: identity.profile, page: null, opened: null, openingRunId: null, filter, cursor, previous, notice: translateUi('archive.notice.loading'),
      connectionStatus: state.connectionStatus,
      lastError: state.lastError });
    try { await page(ticket, identity, filter, cursor, previous); }
    catch { failed(ticket); }
  }
  async function openRun(runId: string) {
    if (disposed || !session || state.phase !== 'ready') return;
    if (!state.page?.items.some(item => item.runId === runId)) return;
    const ticket = begin();
    set({ ...state, phase: 'loading', opened: null, openingRunId: runId, notice: translateUi('archive.notice.openingRun'),
      connectionStatus: state.connectionStatus,
      lastError: state.lastError });
    try {
      const view = await api.initial(runId, ticket.signal);
      if (!ticket.current()) return;
      if (view.runId !== runId) throw new ArchiveError('invalid');
      set({ ...state, phase: 'ready', opened: view, openingRunId: null, notice: translateUi('archive.notice.runOpened'),
        connectionStatus: state.connectionStatus,
        lastError: state.lastError });
    } catch {
      if (ticket.current()) set({ ...state, phase: 'ready', opened: null, openingRunId: null,
        notice: translateUi('archive.notice.openRunFailed'),
        connectionStatus: state.connectionStatus,
        lastError: state.lastError });
    }
  }
  function closeRun() {
    if (disposed || (!state.opened && !state.openingRunId)) return;
    begin();
    set({ ...state, phase: 'ready', opened: null, openingRunId: null, notice: translateUi('archive.notice.runClosed'),
      connectionStatus: state.connectionStatus,
      lastError: state.lastError });
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
    set({ ...blank(), notice: translateUi('archive.notice.loggingOut') });
    try {
      if (csrf) await api.logout(csrf, ticket.signal);
      if (!ticket.current()) return;
      pendingLogout = null; logoutProfile = null;
      set({ ...blank(), phase: 'signed_out', notice: cleared ? translateUi('archive.notice.loggedOut') : translateUi('archive.notice.loggedOutNoRef') });
    } catch { failed(ticket, true); }
  }
  function creationAllowed(caseId: string | null): boolean {
    if (caseId === null) return state.creation.phase === 'uncertain';
    return state.creation.phase === 'idle' && state.cases.some(item => item.caseId === caseId && item.canStart);
  }
  function showCreation(result: CreationOutcome) {
    set({ ...state, phase: 'ready', creation: { phase: result.phase, caseId: state.creation.caseId, runId: result.phase === 'created' ? result.runId : null },
      notice: result.phase === 'created' ? translateUi('archive.notice.creationConfirmed')
        : result.reason ? translateUi('archive.notice.creationUnconfirmed', { reason: result.reason }) : translateUi('archive.notice.creationUnconfirmedNoReason') });
  }
  async function attemptCreation(caseId: string | null, resend: boolean, difficulty: Difficulty, identity: SessionDto, ticket: Ticket, params?: Omit<CreationParams, 'difficulty'>): Promise<CreationOutcome | null> {
    try {
      const result = caseId === null ? await creator.recover(identity, resend, ticket.signal) : await creator.start(caseId, identity, ticket.signal, difficulty, params);
      return ticket.current() ? result : null;
    } catch {
      if (ticket.current()) set({ ...state, phase: 'ready', creation: { phase: 'blocked', caseId: state.creation.caseId, runId: null }, notice: translateUi('archive.notice.creationBlocked') });
      return null;
    }
  }
  async function creation(caseId: string | null, resend: boolean, difficulty: Difficulty = 'normal', params?: Omit<CreationParams, 'difficulty'>) {
    if (disposed || !session || state.phase !== 'ready') return;
    if (!creationAllowed(caseId)) return;
    const identity = session; const ticket = begin();
    set({ ...state, phase: 'loading', creation: { phase: 'sending', caseId: caseId ?? state.creation.caseId, runId: null }, notice: translateUi('archive.notice.creating') });
    const result = await attemptCreation(caseId, resend, difficulty, identity, ticket, params);
    if (result) showCreation(result);
  }
  async function deleteRun(runId: string) {
    if (disposed || !session || state.phase !== 'ready') return;
    const identity = session; const ticket = begin();
    set({ ...state, notice: translateUi('archive.notice.deletingRun') });
    try {
      await api.deleteRun(runId, identity, ticket.signal);
      if (!ticket.current()) return;
      await open();
      if (state.phase === 'ready') set({ ...state, notice: translateUi('archive.notice.runDeleted') });
    } catch {
      if (ticket.current()) set({ ...state, notice: translateUi('archive.notice.deleteRunFailed') });
    }
  }
  // Generación de casos (T4-08): crear un job, refrescar su estado y
  // cancelarlo. Al terminar un job, el catálogo se recarga para que el
  // expediente nuevo aparezca en el formulario de nueva partida, y el
  // aviso «Generación en cola» se sustituye por el resultado: antes se
  // quedaba fijo aunque el job ya hubiera terminado.
  async function refreshJobs() {
    if (disposed || !session || state.phase !== 'ready') return;
    const ticket = begin();
    try {
      const [jobs, catalog] = await Promise.all([api.generationJobs(ticket.signal), api.cases(ticket.signal)]);
      if (!ticket.current()) return;
      const finished = jobs.items.find(job => (job.status === 'done' || job.status === 'failed' || job.status === 'cancelled') &&
        state.jobs.some(previous => previous.jobId === job.jobId && (previous.status === 'queued' || previous.status === 'running')));
      const notice = finished ? jobFinishedNotice(finished, catalog.items) : state.notice;
      set({ ...state, jobs: jobs.items, cases: catalog.items, notice });
    } catch { /* el panel reintenta en su siguiente tick; no se rompe el archivo */ }
  }
  async function createGeneration(params: GenerationJobParams) {
    if (disposed || !session || state.phase !== 'ready') return;
    const identity = session; const ticket = begin();
    set({ ...state, notice: translateUi('archive.notice.requestingGeneration') });
    try {
      const job = await api.createGenerationJob(params, identity, ticket.signal);
      if (!ticket.current()) return;
      set({ ...state, jobs: [job, ...state.jobs], notice: translateUi('archive.notice.generationQueued') });
    } catch (error) {
      if (!ticket.current()) return;
      const detail = error instanceof ArchiveError ? error.detail : undefined;
      set({ ...state, notice: detail ?? translateUi('archive.notice.generationFailed') });
    }
  }
  async function cancelGeneration(jobId: string) {
    if (disposed || !session || state.phase !== 'ready') return;
    const identity = session; const ticket = begin();
    try {
      const job = await api.cancelGenerationJob(jobId, identity, ticket.signal);
      if (!ticket.current()) return;
      set({ ...state, jobs: state.jobs.map(item => item.jobId === job.jobId ? job : item), notice: translateUi('archive.notice.jobCancelled') });
    } catch {
      if (ticket.current()) set({ ...state, notice: translateUi('archive.notice.cancelGenerationFailed') });
    }
  }
  // Intercambio de expedientes (T4-05 expuesto): descargar el propio y
  // importar uno validado. La descarga la dispara el componente con el
  // blob; la importación recarga el catálogo para que el expediente nuevo
  // aparezca en el formulario de nueva partida.
  async function exportCase(caseId: string): Promise<{ blob: Blob; filename: string } | null> {
    if (disposed || !session || state.phase !== 'ready') return null;
    const identity = session; const ticket = begin();
    try {
      const blob = await api.exportCase(caseId, identity, ticket.signal);
      if (!ticket.current()) return null;
      set({ ...state, notice: translateUi('archive.notice.caseExported') });
      return { blob, filename: `meridiano-caso-${caseId}.json` };
    } catch (error) {
      if (!ticket.current()) return null;
      const detail = error instanceof ArchiveError ? error.detail : undefined;
      set({ ...state, notice: detail ?? translateUi('archive.notice.exportFailed') });
      return null;
    }
  }
  async function importCase(fileText: string): Promise<void> {
    if (disposed || !session || state.phase !== 'ready') return;
    const identity = session; const ticket = begin();
    set({ ...state, notice: translateUi('archive.notice.validatingImport') });
    try {
      const result = await api.importCase(fileText, identity, ticket.signal);
      if (!ticket.current()) return;
      const catalog = await api.cases(ticket.signal);
      if (!ticket.current()) return;
      set({ ...state, cases: catalog.items, notice: importNotice(result) });
    } catch (error) {
      if (!ticket.current()) return;
      const detail = error instanceof ArchiveError ? error.detail : undefined;
      set({ ...state, notice: detail ? translateUi('archive.notice.importFailed', { detail }) : translateUi('archive.notice.importFailedNoDetail') });
    }
  }
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    openRun, closeRun,
    refresh: () => open(), connect: () => open(true), logout,
    reconnect,
    createCase: (caseId: string, difficulty: Difficulty = 'normal', params?: Omit<CreationParams, 'difficulty'>) => creation(caseId, false, difficulty, params),
    recoverCreation: (resend = false) => creation(null, resend),
    prepareCreation() { if (state.phase === 'ready' && state.creation.phase === 'created') set({ ...state, creation: { phase: 'idle', caseId: null, runId: null } }); },
    // Descarta la referencia local de una creación pendiente o bloqueada y
    // devuelve el formulario de «Nueva partida». La partida, si llegó a
    // crearse en el servidor, sigue en el archivo.
    discardCreation() {
      if (disposed || !session || state.phase !== 'ready') return;
      if (state.creation.phase !== 'uncertain' && state.creation.phase !== 'blocked') return;
      if (!creator.discard(session.profile.id)) return;
      set({ ...state, creation: { phase: 'idle', caseId: null, runId: null }, notice: translateUi('archive.notice.creationDiscarded') });
    },
    deleteRun,
    refreshJobs, createGeneration, cancelGeneration,
    exportCase, importCase,
    filter: (value: Filter) => navigate(value, null, []),
    next: () => state.page?.nextCursor ? navigate(state.filter, state.page.nextCursor, [...state.previous, state.cursor]) : Promise.resolve(),
    back: () => state.previous.length ? navigate(state.filter, state.previous.at(-1) ?? null, state.previous.slice(0, -1)) : Promise.resolve(),
    dispose() { disposed = true; generation++; request?.abort(); session = null; pendingLogout = null; listeners.clear(); state = blank(); },
  };
}
