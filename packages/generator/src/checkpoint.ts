// Checkpoint store para pipeline de generación (T4-01)
// Persistencia de estados intermedios con leases y heartbeats

import type { CaseDraft, CheckpointStore } from './pipeline.js';

// ============================================================================
// Interfaz de almacenamiento
// ============================================================================

export interface CheckpointStorage {
  get(id: string): Promise<string | null>;
  set(id: string, value: string): Promise<void>;
  delete(id: string): Promise<void>;
  keys(): Promise<string[]>;
}

// ============================================================================
// Implementación en memoria (para desarrollo/test)
// ============================================================================

export function createInMemoryCheckpointStore(): CheckpointStore {
  const store = new Map<string, CaseDraft>();

  return {
    async save(draft: CaseDraft): Promise<void> {
      store.set(draft.id, { ...draft, updatedAt: new Date().toISOString() });
    },

    async load(id: string): Promise<CaseDraft | null> {
      const draft = store.get(id);
      return draft ? { ...draft } : null;
    },

    async list(): Promise<CaseDraft[]> {
      return Array.from(store.values()).map(d => ({ ...d }));
    },

    async delete(id: string): Promise<void> {
      store.delete(id);
    },
  };
}

// ============================================================================
// Implementación con localStorage (para navegador)
// ============================================================================

function getLocalStorage(): any {
  if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis) {
    return (globalThis as any).localStorage;
  }
  return null;
}

export function createLocalStorageCheckpointStore(prefix = 'meridiano-generator-'): CheckpointStore {
  const storage: CheckpointStorage = {
    async get(id: string): Promise<string | null> {
      const ls = getLocalStorage();
      if (!ls) return null;
      return ls.getItem(`${prefix}${id}`);
    },
    async set(id: string, value: string): Promise<void> {
      const ls = getLocalStorage();
      if (!ls) return;
      ls.setItem(`${prefix}${id}`, value);
    },
    async delete(id: string): Promise<void> {
      const ls = getLocalStorage();
      if (!ls) return;
      ls.removeItem(`${prefix}${id}`);
    },
    async keys(): Promise<string[]> {
      const ls = getLocalStorage();
      if (!ls) return [];
      const allKeys: string[] = [];
      for (let i = 0; i < ls.length; i++) {
        const key = ls.key(i);
        if (key?.startsWith(prefix)) allKeys.push(key.slice(prefix.length));
      }
      return allKeys;
    },
  };

  return createCheckpointStoreFromStorage(storage);
}

// ============================================================================
// Implementación genérica desde almacenamiento
// ============================================================================

export function createCheckpointStoreFromStorage(storage: CheckpointStorage): CheckpointStore {
  return {
    async save(draft: CaseDraft): Promise<void> {
      const data = JSON.stringify({ ...draft, updatedAt: new Date().toISOString() });
      await storage.set(draft.id, data);
    },

    async load(id: string): Promise<CaseDraft | null> {
      const data = await storage.get(id);
      if (!data) return null;
      try {
        return JSON.parse(data) as CaseDraft;
      } catch {
        return null;
      }
    },

    async list(): Promise<CaseDraft[]> {
      const keys = await storage.keys();
      const drafts: CaseDraft[] = [];
      for (const key of keys) {
        const draft = await storage.get(key);
        if (draft) {
          try {
            drafts.push(JSON.parse(draft));
          } catch {
            // Ignorar entradas corruptas
          }
        }
      }
      return drafts.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },

    async delete(id: string): Promise<void> {
      await storage.delete(id);
    },
  };
}

// ============================================================================
// Store con leases y heartbeats (para producción con PostgreSQL)
// ============================================================================

export interface LeaseConfig {
  leaseDurationMs: number;
  heartbeatIntervalMs: number;
  maxMissedHeartbeats: number;
}

export interface LeasedCheckpoint extends CaseDraft {
  lease?: {
    holder: string;
    acquiredAt: string;
    expiresAt: string;
    heartbeats: number;
  };
}

export function createLeasedCheckpointStore(
  storage: CheckpointStorage,
  config: LeaseConfig
): CheckpointStore & {
  acquireLease(id: string, holder: string): Promise<boolean>;
  releaseLease(id: string, holder: string): Promise<void>;
  heartbeat(id: string, holder: string): Promise<boolean>;
  recoverExpiredLeases(): Promise<string[]>;
} {
  const baseStore = createCheckpointStoreFromStorage(storage);

  async function loadWithLease(id: string): Promise<LeasedCheckpoint | null> {
    const draft = await baseStore.load(id);
    return draft as LeasedCheckpoint | null;
  }

  return {
    ...baseStore,

    async save(draft: CaseDraft): Promise<void> {
      await baseStore.save(draft);
    },

    async load(id: string): Promise<CaseDraft | null> {
      return baseStore.load(id);
    },

    async list(): Promise<CaseDraft[]> {
      return baseStore.list();
    },

    async delete(id: string): Promise<void> {
      await baseStore.delete(id);
    },

    async acquireLease(id: string, holder: string): Promise<boolean> {
      const draft = await loadWithLease(id);
      if (!draft) return false;

      const now = new Date();
      const expiresAt = new Date(now.getTime() + config.leaseDurationMs);

      if (draft.lease) {
        const leaseExpires = new Date(draft.lease.expiresAt);
        if (leaseExpires > now && draft.lease.holder !== holder) {
          return false; // Lease activo de otro holder
        }
      }

      const leased: LeasedCheckpoint = {
        ...draft,
        lease: {
          holder,
          acquiredAt: now.toISOString(),
          expiresAt: expiresAt.toISOString(),
          heartbeats: 0,
        },
      };

      await storage.set(id, JSON.stringify(leased));
      return true;
    },

    async releaseLease(id: string, holder: string): Promise<void> {
      const draft = await loadWithLease(id);
      if (!draft || !draft.lease || draft.lease.holder !== holder) return;

      const { lease, ...rest } = draft;
      await storage.set(id, JSON.stringify(rest));
    },

    async heartbeat(id: string, holder: string): Promise<boolean> {
      const draft = await loadWithLease(id);
      if (!draft || !draft.lease || draft.lease.holder !== holder) return false;

      const now = new Date();
      const expiresAt = new Date(now.getTime() + config.leaseDurationMs);

      draft.lease.expiresAt = expiresAt.toISOString();
      draft.lease.heartbeats++;

      await storage.set(id, JSON.stringify(draft));
      return true;
    },

    async recoverExpiredLeases(): Promise<string[]> {
      const now = new Date();
      const allKeys = await storage.keys();
      const recovered: string[] = [];

      for (const key of allKeys) {
        const draft = await loadWithLease(key);
        if (!draft || !draft.lease) continue;

        const expiresAt = new Date(draft.lease.expiresAt);
        if (expiresAt <= now) {
          // Lease expirado - resetear
          const { lease, ...rest } = draft;
          rest.updatedAt = new Date().toISOString();
          await storage.set(key, JSON.stringify(rest));
          recovered.push(key);
        }
      }

      return recovered;
    },
  };
}

// ============================================================================
// Factory principal
// ============================================================================

export function createCheckpointStore(options?: {
  type?: 'memory' | 'localStorage' | 'storage';
  storage?: CheckpointStorage;
  prefix?: string;
  leaseConfig?: LeaseConfig;
}): CheckpointStore {
  if (options?.type === 'localStorage') {
    return createLocalStorageCheckpointStore(options.prefix);
  }

  if (options?.type === 'storage' && options.storage) {
    if (options.leaseConfig) {
      return createLeasedCheckpointStore(options.storage, options.leaseConfig);
    }
    return createCheckpointStoreFromStorage(options.storage);
  }

  return createInMemoryCheckpointStore();
}