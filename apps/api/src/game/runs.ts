import { isIdempotencyKey, type RunCreationLookupDto } from '@meridiano/contracts';
import { hashDefinition } from '@meridiano/case-schema/server';
import { migrationFiles, matchesMigrationLedger } from '../database/migrations.ts';
import { createHash, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { validateCaseDefinition, type CaseDefinition } from '@meridiano/case-schema';
import { createInitialRun } from '@meridiano/engine';
import type { Database } from '../database/connection.ts';
import type { CaseRun } from '@meridiano/case-schema';

export type RunStoreErrorCode = 'SESSION_REQUIRED' | 'SESSION_CHANGED' | 'NOT_FOUND' | 'IDEMPOTENCY_CONFLICT' | 'INVALID_REQUEST' |
  'CASE_NOT_READY' | 'DEPENDENCY_UNAVAILABLE' | 'ORIGIN_REJECTED' | 'CSRF_REJECTED';

export class RunStoreError extends Error {
  readonly code: RunStoreErrorCode;
  constructor(code: RunStoreErrorCode) {
    super(code);
    this.code = code;
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
  engineState: unknown;
}
const columns = `id, owner_id AS "ownerId", definition_id AS "definitionId",
  definition_hash AS "definitionHash", engine_version AS "engineVersion",
  revision, branch_id AS "branchId", engine_state AS "engineState"`;

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
  const requestDigest = createHash('sha256').update(JSON.stringify(['create_run', candidate.id])).digest('hex');
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
      `INSERT INTO runs(id, owner_id, definition_id, definition_hash, engine_version, branch_id, engine_state)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb) RETURNING ${columns}`,
      [id, ownerId, candidate.id, definitionHash, state.engineVersion, randomUUID(), JSON.stringify(state)]);
    await client.query('INSERT INTO run_creations(owner_id, idempotency_key, request_digest, run_id) VALUES ($1,$2,$3,$4)',
      [ownerId, idempotencyKey, requestDigest, id]);
    const run = result.rows[0];
    if (!run) throw new Error('RUN_INSERT_FAILED');
    return { run, replayed: false };
  }, expectedOwnerId);
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

export async function readFullRun(database: Database, sessionDigest: string, runId: string): Promise<CaseRun> {
  return inSession(database, sessionDigest, async (client, ownerId) => {
    const result = await client.query(
      `SELECT ${columns}, engine_state FROM runs WHERE id=$1 AND owner_id=$2`, [runId, ownerId]);
    const row = result.rows[0];
    if (!row) throw new RunStoreError('NOT_FOUND');
    const state = row.engine_state as CaseRun;
    return { ...state, id: row.id, ownerId: row.ownerId, definitionId: row.definitionId, definitionHash: row.definitionHash, engineVersion: row.engineVersion, revision: row.revision, branchId: row.branchId };
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
