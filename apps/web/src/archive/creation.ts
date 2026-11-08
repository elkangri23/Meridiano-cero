import { isIdempotencyKey } from '@meridiano/contracts';
import type { SessionDto } from '@meridiano/contracts';
import type { ArchiveApi, CreationParams, ExplorationMode } from './client';
import { ArchiveError } from './client';

export type Difficulty = 'easy' | 'normal' | 'hard';
const difficulties: readonly Difficulty[] = ['easy', 'normal', 'hard'];

export interface IntentStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
export const browserIntents: IntentStorage = {
  getItem: key => sessionStorage.getItem(key), setItem: (key, value) => sessionStorage.setItem(key, value), removeItem: key => sessionStorage.removeItem(key),
};
export class CreationBlocked extends Error { constructor() { super('CREATION_REFERENCE_UNAVAILABLE'); } }
// La intención guarda también la dificultad y el modo de exploración
// elegidos: sin ellos, un reintento tras cerrar la pestaña crearía la
// partida con los valores por defecto y el usuario no sabría con cuáles
// quedó. La forma antigua (sin difficulty) se sigue aceptando y equivale a
// normal; sin explorationMode equivale a guiada.
type Intent = { schemaVersion: 1; profileId: string; caseId: string; idempotencyKey: string; difficulty?: Difficulty; explorationMode?: ExplorationMode };
export type CreationView = { phase: 'idle' | 'sending' | 'uncertain' | 'created' | 'blocked'; caseId: string | null; runId: string | null };
export type CreationOutcome = { phase: 'created'; runId: string } | { phase: 'uncertain'; reason?: string };
const namespace = (profileId: string) => 'meridiano:create-run:v1:' + profileId;
function hasIntentKeys(record: Record<string, unknown>): boolean {
  const keys = Object.keys(record).sort().join(',');
  return keys === 'caseId,idempotencyKey,profileId,schemaVersion' ||
    keys === 'caseId,difficulty,idempotencyKey,profileId,schemaVersion' ||
    keys === 'caseId,explorationMode,idempotencyKey,profileId,schemaVersion' ||
    keys === 'caseId,difficulty,explorationMode,idempotencyKey,profileId,schemaVersion';
}
function hasIntentIdentity(record: Record<string, unknown>, profileId: string): boolean {
  return record.schemaVersion === 1 && record.profileId === profileId &&
    typeof record.caseId === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(record.caseId) && isIdempotencyKey(record.idempotencyKey);
}
function isDifficulty(value: unknown): value is Difficulty {
  return typeof value === 'string' && (difficulties as readonly string[]).includes(value);
}
function isExplorationMode(value: unknown): value is ExplorationMode {
  return value === 'guided' || value === 'free';
}
function validIntent(value: unknown, profileId: string): value is Intent {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return hasIntentKeys(record) && hasIntentIdentity(record, profileId) &&
    (record.difficulty === undefined || isDifficulty(record.difficulty)) &&
    (record.explorationMode === undefined || isExplorationMode(record.explorationMode));
}
function freshIntent(profileId: string, caseId: string, difficulty: Difficulty, explorationMode: ExplorationMode): Intent {
  return { schemaVersion: 1, profileId, caseId, difficulty, explorationMode, idempotencyKey: crypto.randomUUID() };
}
function creationParams(difficulty: Difficulty, intent: Intent, params?: Omit<CreationParams, 'difficulty'>): CreationParams {
  // Delito y contenido no van en la intención: se derivan del expediente
  // (caseId) y el servidor los valida al crear; un reintento tras recargar
  // los vuelve a derivar igual. El modo, en cambio, sí viaja: un reintento
  // sin params lo recuperaría como guiado.
  return { difficulty, explorationMode: params?.explorationMode ?? intent.explorationMode ?? 'guided', ...params };
}
function sameIntent(previous: Intent | null, caseId: string, difficulty: Difficulty, explorationMode: ExplorationMode): boolean {
  if (!previous) return true;
  return previous.caseId === caseId && (previous.difficulty ?? 'normal') === difficulty &&
    (previous.explorationMode ?? 'guided') === explorationMode;
}
export function createRunCoordinator(api: ArchiveApi, storage: IntentStorage) {
  function pending(profileId: string): Intent | null {
    try {
      const raw = storage.getItem(namespace(profileId));
      if (raw === null) return null;
      if (raw.length > 1024) throw new CreationBlocked();
      const value: unknown = JSON.parse(raw);
      if (!validIntent(value, profileId)) throw new CreationBlocked();
      return value;
    } catch { throw new CreationBlocked(); }
  }
  function remember(intent: Intent) {
    const raw = JSON.stringify(intent);
    try {
      storage.setItem(namespace(intent.profileId), raw);
      if (storage.getItem(namespace(intent.profileId)) !== raw) throw new CreationBlocked();
    } catch { throw new CreationBlocked(); }
  }
  function forget(profileId: string): boolean {
    try { storage.removeItem(namespace(profileId)); return storage.getItem(namespace(profileId)) === null; }
    catch { return false; }
  }
  async function inspect(intent: Intent, identity: SessionDto, signal: AbortSignal): Promise<CreationOutcome> {
    try {
      const result = await api.lookup(intent.idempotencyKey, identity, signal); signal.throwIfAborted();
      if (!result) return { phase: 'uncertain' };
      const stored = pending(intent.profileId);
      if (stored?.idempotencyKey !== intent.idempotencyKey || !forget(intent.profileId)) throw new CreationBlocked();
      return { phase: 'created', runId: result.runId };
    } catch (error) {
      if (signal.aborted) throw error;
      return { phase: 'uncertain' };
    }
  }
  async function send(intent: Intent, identity: SessionDto, signal: AbortSignal, params?: CreationParams): Promise<CreationOutcome> {
    signal.throwIfAborted();
    // El error de crear se guarda como motivo: antes se tragaba con
    // Promise.allSettled y la creación quedaba como «pendiente de confirmar»
    // sin explicar por qué. Un acuse perdido no prueba rollback: si la
    // creación falló por red tras crearse en el servidor, el ledger lo dirá.
    let reason: string | undefined;
    try {
      const fallback: CreationParams = { difficulty: intent.difficulty ?? 'normal', explorationMode: intent.explorationMode ?? 'guided' };
      await api.create(intent.caseId, intent.idempotencyKey, identity, signal, params ?? fallback);
    } catch (error) {
      if (error instanceof ArchiveError) reason = error.detail;
    }
    signal.throwIfAborted();
    const result = await inspect(intent, identity, signal);
    if (result.phase === 'uncertain' && reason) return { phase: 'uncertain', reason };
    return result;
  }
  return {
    pending, forget,
    // Olvidar la intención local es seguro: si la partida se creó en el
    // servidor, sigue apareciendo en el archivo. Es la salida del estado
    // «creación pendiente de confirmar» cuando el usuario quiere empezar
    // de cero (antes solo podía cerrar sesión).
    discard(profileId: string): boolean { return forget(profileId); },
    view(profileId: string): CreationView {
      try { const intent = pending(profileId); return { phase: intent ? 'uncertain' : 'idle', caseId: intent?.caseId ?? null, runId: null }; }
      catch { return { phase: 'blocked', caseId: null, runId: null }; }
    },
    async start(caseId: string, identity: SessionDto, signal: AbortSignal, difficulty: Difficulty = 'normal', params?: Omit<CreationParams, 'difficulty'>) {
      const previous = pending(identity.profile.id);
      const mode = params?.explorationMode ?? 'guided';
      // Otra elección (caso, dificultad o modo) no sobrescribe una intención
      // incierta: el usuario la resuelve (comprobar/reintentar) o la
      // descarta explícitamente. La forma antigua sin difficulty equivale a
      // normal, así que una intención guardada antes sigue siendo válida.
      if (!sameIntent(previous, caseId, difficulty, mode)) throw new CreationBlocked();
      const intent = previous ?? freshIntent(identity.profile.id, caseId, difficulty, mode);
      if (!previous) remember(intent);
      return send(intent, identity, signal, creationParams(difficulty, intent, params));
    },
    async recover(identity: SessionDto, resend: boolean, signal: AbortSignal) {
      const intent = pending(identity.profile.id);
      if (!intent) throw new CreationBlocked();
      const result = await inspect(intent, identity, signal);
      if (result.phase === 'created' || !resend) return result;
      return send(intent, identity, signal);
    },
  };
}
