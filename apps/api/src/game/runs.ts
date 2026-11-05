import { isIdempotencyKey, type RunCreationLookupDto } from '@meridiano/contracts';
import { hashDefinition } from '@meridiano/case-schema/server';
import { migrationFiles, matchesMigrationLedger } from '../database/migrations.ts';
import { createHash, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { validateCaseDefinition, type CaseDefinition } from '@meridiano/case-schema';
import { createInitialRun, ENGINE_VERSION } from '@meridiano/engine';
import type { Database } from '../database/connection.ts';
import type { CaseRun } from '@meridiano/case-schema';

export type RunStoreErrorCode = 'SESSION_REQUIRED' | 'SESSION_CHANGED' | 'NOT_FOUND' | 'IDEMPOTENCY_CONFLICT' | 'INVALID_REQUEST' |
  'CASE_NOT_READY' | 'DEPENDENCY_UNAVAILABLE' | 'ORIGIN_REJECTED' | 'CSRF_REJECTED' | 'SAVE_LIMIT_REACHED' | 'VERSION_CONFLICT' |
  'RUN_CLOSED' | 'SAVE_NOT_ACTIVE' | 'SAVE_INCOMPATIBLE' | 'INVALID_DESTINATION';

export class RunStoreError extends Error {
  readonly code: RunStoreErrorCode;
  /** Mensaje seguro para el usuario; solo se serializa para INVALID_DESTINATION. */
  readonly detail?: string;
  constructor(code: RunStoreErrorCode, detail?: string) {
    super(code);
    this.code = code;
    if (detail !== undefined) this.detail = detail;
  }
}

/** Agregado privado. Nunca serializar esta estructura como respuesta HTTP. */
export interface StoredRun {
  id: string;
  ownerId: string;
  definitionId: string;
  definitionHash: string;
  engineVersion: number;
  revision: number;
  branchId: string;
  status: 'active' | 'closed';
  /** Dificultad elegida al crear (migración 0007) y su plazo en minutos. */
  difficulty: 'easy' | 'normal' | 'hard';
  deadlineMinutes: number;
  engineState: unknown;
}
export const runColumns = `id, owner_id AS "ownerId", definition_id AS "definitionId",
  definition_hash AS "definitionHash", engine_version AS "engineVersion",
  revision, branch_id AS "branchId", engine_state AS "engineState",
  difficulty, deadline_minutes AS "deadlineMinutes",
  engine_state->>'status' AS status`;
// El estado autoritativo vive en engine_state (así lo lee run-list.ts); runs no
// tiene columna status. Sin este alias, StoredRun.status era undefined y los
// controles RUN_CLOSED de las rutas nunca se disparaban.
const columns = runColumns;

async function sessionOwner(client: PoolClient, digest: string): Promise<string> {
  if (!/^[a-f0-9]{64}$/.test(digest)) throw new RunStoreError('SESSION_REQUIRED');
  // Revocación y rotación esperan al commit; nueva operación verifica de nuevo.
  const result = await client.query<{ profile_id: string }>(
    `SELECT profile_id FROM sessions WHERE token_hash=$1 AND revoked_at IS NULL
     AND expires_at > clock_timestamp() FOR SHARE`, [digest]);
  const owner = result.rows[0]?.profile_id;
  if (!owner) throw new RunStoreError('SESSION_REQUIRED');
  return owner;
}

const expectedMigrations = migrationFiles().catch(() => undefined);
async function requireCompatibleSchema(client: PoolClient): Promise<void> {
  const expected = await expectedMigrations;
  if (!expected) throw new RunStoreError('DEPENDENCY_UNAVAILABLE');
  // Mismo lock que el migrador, compartido durante toda la operación.
  await client.query('SELECT pg_advisory_xact_lock_shared(28012026)');
  const ledger = await client.query<{ name: string; hash: string }>('SELECT name, hash FROM base_migrations ORDER BY name');
  if (!matchesMigrationLedger(expected, ledger.rows)) throw new RunStoreError('DEPENDENCY_UNAVAILABLE');
}

export async function inSession<T>(database: Database, digest: string,
  work: (client: PoolClient, ownerId: string) => Promise<T>, expectedOwnerId?: string): Promise<T> {
  const client = await database.pool.connect();
  let discard = false;
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout = '2s'");
    await requireCompatibleSchema(client);
    const ownerId = await sessionOwner(client, digest);
    if (expectedOwnerId !== undefined && expectedOwnerId !== ownerId) throw new RunStoreError('SESSION_CHANGED');
    const result = await work(client, ownerId);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { discard = true; }
    throw error;
  } finally { client.release(discard); }
}

function preparedHash(definition: CaseDefinition): string | undefined {
  try { return hashDefinition(definition); }
  // Conservar replay autorizado antes de decidir disponibilidad del contenido actual.
  catch { return undefined; }
}

export async function createStoredRun(database: Database, sessionDigest: string,
  definition: CaseDefinition, idempotencyKey: string, expectedOwnerId?: string): Promise<{ run: StoredRun; replayed: boolean }> {
  if (!isIdempotencyKey(idempotencyKey)) throw new RunStoreError('INVALID_REQUEST');
  const candidate = structuredClone(definition);
  const structureValid = validateCaseDefinition(candidate).valid;
  const definitionHash = structureValid ? preparedHash(candidate) : undefined;
  // El resumen cubre los parámetros efectivos (expediente, dificultad y
  // plazo): reintentar la misma clave con otra dificultad es conflicto, no
  // un replay silencioso de la primera creación.
  const requestDigest = createHash('sha256').update(JSON.stringify(['create_run', candidate.id, candidate.difficulty, candidate.deadlineMinutes])).digest('hex');
  return inSession(database, sessionDigest, async (client, ownerId) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [JSON.stringify([ownerId, idempotencyKey])]);
    const previous = await client.query<{ request_digest: string; run_id: string }>(
      'SELECT request_digest, run_id FROM run_creations WHERE owner_id=$1 AND idempotency_key=$2', [ownerId, idempotencyKey]);
    const operation = previous.rows[0];
    if (operation) {
      if (operation.request_digest !== requestDigest) throw new RunStoreError('IDEMPOTENCY_CONFLICT');
      return { run: await ownedRun(client, ownerId, operation.run_id), replayed: true };
    }
    if (!structureValid) {
      throw new RunStoreError('CASE_NOT_READY');
    }
    if (!definitionHash) throw new RunStoreError('DEPENDENCY_UNAVAILABLE');
    const id = randomUUID();
    const state = createInitialRun(candidate, ownerId, id, definitionHash);
    const result = await client.query<StoredRun>(
      `INSERT INTO runs(id, owner_id, definition_id, definition_hash, engine_version, branch_id, difficulty, deadline_minutes, engine_state)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb) RETURNING ${columns}`,
      [id, ownerId, candidate.id, definitionHash, state.engineVersion, randomUUID(), candidate.difficulty, candidate.deadlineMinutes, JSON.stringify(state)]);
    await client.query('INSERT INTO run_creations(owner_id, idempotency_key, request_digest, run_id) VALUES ($1,$2,$3,$4)',
      [ownerId, idempotencyKey, requestDigest, id]);
    const run = result.rows[0];
    if (!run) throw new Error('RUN_INSERT_FAILED');
    return { run, replayed: false };
  }, expectedOwnerId);
}

/**
 * Borrado de una partida propia (migración 0007): la app no tiene DELETE
 * sobre operation_records/runs/run_creations, así que el borrado ordenado lo
 * hace la función SECURITY DEFINER delete_run (propiedad de
 * meridiano_owner), que solo borra filas del propietario indicado. Devuelve
 * false si la partida no existe o no es del propietario (el llamador responde
 * 404 en ambos casos, sin distinguirlos).
 */
export async function deleteStoredRun(database: Database, sessionDigest: string, runId: string): Promise<boolean> {
  if (!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(runId)) throw new RunStoreError('NOT_FOUND');
  return inSession(database, sessionDigest, async (client, ownerId) => {
    const result = await client.query<{ delete_run: boolean }>(
      'SELECT delete_run($1, $2) AS delete_run', [runId, ownerId]);
    return result.rows[0]?.delete_run ?? false;
  });
}

async function ownedRun(client: PoolClient, ownerId: string, id: string): Promise<StoredRun> {
  if (!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id)) throw new RunStoreError('NOT_FOUND');
  const result = await client.query<StoredRun>(`SELECT ${columns} FROM runs WHERE id=$1 AND owner_id=$2`, [id, ownerId]);
  const run = result.rows[0];
  if (!run) throw new RunStoreError('NOT_FOUND');
  return run;
}

export function readStoredRun(database: Database, sessionDigest: string, runId: string): Promise<StoredRun> {
  return inSession(database, sessionDigest, (client, ownerId) => ownedRun(client, ownerId, runId));
}

// ── Forma del estado v14 ────────────────────────────────────────────────────────
// Fail-closed: un engine_state con claves desconocidas o tipos inválidos no se
// proyecta ni se ejecuta (no se reconstruye progreso ficticio ni se filtra el
// contenido). Solo se aplica a motores v14; los estados antiguos (v1–v13) los
// valida initialPlayerView con su igualdad estricta propia.
const runStateKeys = new Set([
  'id', 'ownerId', 'definitionId', 'definitionHash', 'engineVersion', 'eventOrdinal', 'tripCount',
  'version', 'minute', 'status', 'position', 'discoveries', 'evidenceRecords', 'inventory',
  'admissibility', 'npcRelations', 'conversationRecords', 'pendingRequests', 'warrants',
  'detentions', 'recoveredObjects', 'pendingBatch', 'finalReport',
]);
function isRecordValue(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}
function isCounter(value: unknown, min: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min;
}
const stateFields: Array<{ key: string; check: (value: unknown) => boolean }> = [
  { key: 'id', check: value => typeof value === 'string' && value.length > 0 },
  { key: 'ownerId', check: value => typeof value === 'string' && value.length > 0 },
  { key: 'definitionId', check: value => typeof value === 'string' && value.length > 0 },
  { key: 'definitionHash', check: value => typeof value === 'string' && value.length > 0 },
  { key: 'engineVersion', check: value => isCounter(value, 1) },
  { key: 'eventOrdinal', check: value => isCounter(value, 0) },
  { key: 'tripCount', check: value => isCounter(value, 0) },
  { key: 'version', check: value => isCounter(value, 1) },
  { key: 'minute', check: value => isCounter(value, 0) },
  { key: 'status', check: value => value === 'active' || value === 'closed' },
  { key: 'position', check: value => isRecordValue(value) && typeof value.cityId === 'string' && typeof value.locationId === 'string' },
  { key: 'discoveries', check: isStringList },
  { key: 'inventory', check: isStringList },
  { key: 'admissibility', check: isRecordValue },
  { key: 'npcRelations', check: isRecordValue },
  { key: 'conversationRecords', check: isStringList },
  { key: 'pendingRequests', check: value => Array.isArray(value) },
  { key: 'warrants', check: isStringList },
  { key: 'detentions', check: isStringList },
  { key: 'recoveredObjects', check: isStringList },
  { key: 'pendingBatch', check: value => value === null || isStringList(value) },
  { key: 'finalReport', check: value => value === null || isRecordValue(value) },
  { key: 'evidenceRecords', check: value => value === undefined || isRecordValue(value) },
];
export function assertRunShape(state: unknown): void {
  if (!isRecordValue(state)) throw new RunStoreError('DEPENDENCY_UNAVAILABLE');
  if (Object.keys(state).some(key => !runStateKeys.has(key))) throw new RunStoreError('DEPENDENCY_UNAVAILABLE');
  for (const field of stateFields) if (!field.check(state[field.key])) throw new RunStoreError('DEPENDENCY_UNAVAILABLE');
}

/**
 * CaseRun puro: solo las claves del motor. El motor hace spread del run que
 * recibe, así que pasarle el agregado (con revision/branchId/engineState)
 * contaminaría el engine_state persistido con campos del agregado.
 */
export function pureRun(run: CaseRun): CaseRun {
  const { id, ownerId, definitionId, definitionHash, engineVersion, eventOrdinal, tripCount, version, minute,
    status, position, discoveries, evidenceRecords, inventory, admissibility, npcRelations,
    conversationRecords, pendingRequests, warrants, detentions, recoveredObjects, pendingBatch, finalReport } = run;
  return { id, ownerId, definitionId, definitionHash, engineVersion, eventOrdinal, tripCount, version, minute,
    status, position, discoveries, ...(evidenceRecords !== undefined ? { evidenceRecords } : {}),
    inventory, admissibility, npcRelations, conversationRecords, pendingRequests, warrants, detentions,
    recoveredObjects, pendingBatch, finalReport };
}

export async function readFullRun(database: Database, sessionDigest: string, runId: string): Promise<StoredRun & CaseRun> {
  return inSession(database, sessionDigest, async (client, ownerId) => {
    // ownedRun valida el formato UUID: sin él, Postgres rechaza el literal y
    // la ruta devolvería 503 en vez de 404 para un id mal formado.
    const stored = await ownedRun(client, ownerId, runId);
    const state = stored.engineState as CaseRun;
    if (stored.engineVersion === ENGINE_VERSION) assertRunShape(state);
    return { ...state, id: stored.id, ownerId: stored.ownerId, definitionId: stored.definitionId, definitionHash: stored.definitionHash, engineVersion: stored.engineVersion, revision: stored.revision, branchId: stored.branchId, status: stored.status, difficulty: stored.difficulty, deadlineMinutes: stored.deadlineMinutes, engineState: stored.engineState };
  });
}

export function lookupRunCreation(database: Database, sessionDigest: string, key: string, expectedOwnerId?: string): Promise<RunCreationLookupDto> {
  if (!isIdempotencyKey(key)) throw new RunStoreError('INVALID_REQUEST');
  return inSession(database, sessionDigest, async (client, ownerId) => {
    // Solo filas confirmadas y recurso todavía propio; no leer engine_state.
    const result = await client.query<{ runId: string }>(
      `SELECT c.run_id AS "runId" FROM run_creations c
       JOIN runs r ON r.id=c.run_id AND r.owner_id=c.owner_id
       WHERE c.owner_id=$1 AND c.idempotency_key=$2`, [ownerId, key]);
    const creation = result.rows[0];
    if (!creation) throw new RunStoreError('NOT_FOUND');
    return { schemaVersion: 1, kind: 'create_run', status: 'committed', runId: creation.runId };
  }, expectedOwnerId);
}
