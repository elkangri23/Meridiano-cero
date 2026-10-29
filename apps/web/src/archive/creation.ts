import { isIdempotencyKey } from '@meridiano/contracts';
import type { SessionDto } from '@meridiano/contracts';
import type { ArchiveApi } from './client';

export interface IntentStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
export const browserIntents: IntentStorage = {
  getItem: key => sessionStorage.getItem(key), setItem: (key, value) => sessionStorage.setItem(key, value), removeItem: key => sessionStorage.removeItem(key),
};
export class CreationBlocked extends Error { constructor() { super('CREATION_REFERENCE_UNAVAILABLE'); } }
type Intent = { schemaVersion: 1; profileId: string; caseId: string; idempotencyKey: string };
export type CreationView = { phase: 'idle' | 'sending' | 'uncertain' | 'created' | 'blocked'; caseId: string | null; runId: string | null };
export type CreationOutcome = { phase: 'created'; runId: string } | { phase: 'uncertain' };
const namespace = (profileId: string) => 'meridiano:create-run:v1:' + profileId;
function validIntent(value: unknown, profileId: string): value is Intent {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return Object.keys(record).sort().join(',') === 'caseId,idempotencyKey,profileId,schemaVersion' && record.schemaVersion === 1 &&
    record.profileId === profileId && typeof record.caseId === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(record.caseId) && isIdempotencyKey(record.idempotencyKey);
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
  async function send(intent: Intent, identity: SessionDto, signal: AbortSignal): Promise<CreationOutcome> {
    signal.throwIfAborted();
    // Un acuse perdido no prueba rollback: confirmar únicamente con el ledger.
    await Promise.allSettled([api.create(intent.caseId, intent.idempotencyKey, identity, signal)]);
    signal.throwIfAborted();
    return inspect(intent, identity, signal);
  }
  return {
    pending, forget,
    view(profileId: string): CreationView {
      try { const intent = pending(profileId); return { phase: intent ? 'uncertain' : 'idle', caseId: intent?.caseId ?? null, runId: null }; }
      catch { return { phase: 'blocked', caseId: null, runId: null }; }
    },
    async start(caseId: string, identity: SessionDto, signal: AbortSignal) {
      const previous = pending(identity.profile.id);
      if (previous && previous.caseId !== caseId) throw new CreationBlocked();
      const intent = previous ?? { schemaVersion: 1, profileId: identity.profile.id, caseId, idempotencyKey: crypto.randomUUID() };
      if (!previous) remember(intent);
      return send(intent, identity, signal);
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
