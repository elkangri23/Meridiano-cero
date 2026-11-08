// Transiciones persistentes de partida (Fase A): confirmar acciones y cargar
// guardados dentro de una transacción, con control de revisión e idempotencia.
// La revisión HTTP pertenece al agregado persistido (GUARDADOS.md): cada comando
// que modifica estado la incrementa una vez, aunque el motor registre varios
// pasos internos; la versión interna del motor (run.version) se conserva tal
// cual la calcula el motor y NO se reescribe al cargar un guardado.
import { createHash, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { confirmAction, ENGINE_VERSION, resolveAction, type Action, type ActionResult } from '@meridiano/engine';
import type { CaseRun, Language } from '@meridiano/case-schema';
import { contentHashForDefinition } from '@meridiano/case-schema/server';
import { isIdempotencyKey, type ActionResponseDto, type OfficialResultDto, type PublicEvent, type SaveLoadResponseDto } from '@meridiano/contracts';
import type { Database } from '../database/connection.ts';
import { assertRunShape, inSession, pureRun, runColumns, RunStoreError, type StoredRun } from './runs.ts';
import { findDefinitionById, definitionForRun } from './catalog.ts';
import { playerViewDto, projectEvents } from './player-view.ts';
import { loadRunTimeline } from './timeline.ts';
import { loadOfficialResultForContent, recordOfficialResult } from './career.ts';

type FullRun = StoredRun & CaseRun;
type Definition = Awaited<ReturnType<typeof findDefinitionById>>;

async function lockedRun(client: PoolClient, ownerId: string, runId: string): Promise<FullRun> {
  // Mismo guarda que ownedRun: un id mal formado es 404, no un error de Postgres.
  if (!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(runId)) throw new RunStoreError('NOT_FOUND');
  const result = await client.query(
    `SELECT ${runColumns}, engine_state FROM runs WHERE id=$1 AND owner_id=$2 FOR UPDATE`, [runId, ownerId]);
  const row = result.rows[0];
  if (!row) throw new RunStoreError('NOT_FOUND');
  const state = row.engine_state as CaseRun;
  if (row.engineVersion === ENGINE_VERSION) assertRunShape(state);
  return {
    ...state,
    id: row.id, ownerId: row.ownerId, definitionId: row.definitionId, definitionHash: row.definitionHash,
    engineVersion: row.engineVersion, revision: row.revision, branchId: row.branchId, status: row.status,
    difficulty: row.difficulty, deadlineMinutes: row.deadlineMinutes, explorationMode: row.explorationMode,
    engineState: row.engine_state,
  };
}

async function manualSaveCount(client: PoolClient, runId: string): Promise<number> {
  const result = await client.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM manual_saves WHERE run_id=$1 AND status='active'`, [runId]);
  return Number(result.rows[0]?.n ?? 0);
}

function actionDigest(action: Action, expectedVersion?: number): string {
  return createHash('sha256').update(JSON.stringify(['action', action, expectedVersion ?? null])).digest('hex');
}

type StoredActionResult = {
  outcome: ActionResponseDto['outcome'];
  operationId: string;
  version: number;
  events: ActionResponseDto['events'];
  report?: ActionResponseDto['report'];
  pausedAt?: number;
  reason?: string;
};

function toResponse(definition: Definition, run: FullRun, manualCount: number, result: ActionResult, officialResult: OfficialResultDto | null = null, language: Language = 'es'): ActionResponseDto {
  const view = playerViewDto(definition, run, manualCount, [], officialResult, language);
  const base: ActionResponseDto = { ...view, outcome: result.status, events: projectEvents(definition, result.events, language) };
  if (result.status === 'confirmation_required') return { ...base, preview: result.preview };
  if (result.status === 'case_closed') return { ...base, report: result.report };
  if (result.status === 'clarification_required') return { ...base, question: result.question };
  if (result.status === 'impossible') return { ...base, reason: result.reason };
  if (result.status === 'batch_paused') return { ...base, pausedAt: result.pausedAt, reason: result.reason };
  return base;
}

async function findActionReplay(client: PoolClient, runId: string, key: string, digest: string): Promise<StoredActionResult | null> {
  const replayed = await client.query<{ request_digest: string; result_public: StoredActionResult }>(
    `SELECT request_digest, result_public FROM operation_records WHERE run_id=$1 AND idempotency_key=$2`,
    [runId, key]);
  const row = replayed.rows[0];
  if (!row) return null;
  if (row.request_digest !== digest) throw new RunStoreError('IDEMPOTENCY_CONFLICT');
  return row.result_public;
}

type AppliedResult = Extract<ActionResult, { status: 'applied' | 'case_closed' | 'batch_paused' }>;

async function persistAction(
  client: PoolClient, ownerId: string, run: FullRun, definition: Definition,
  result: AppliedResult, opKey: string, requestDigest: string, language: Language = 'es',
): Promise<{ operationId: string; events: ActionResponseDto['events']; newRun: FullRun; stored: StoredActionResult }> {
  const newRevision = run.revision + 1;
  const operationId = randomUUID();
  // Los resúmenes de eventos se guardan en el idioma de esta petición:
  // una repetición por idempotencia los devuelve tal cual, aunque la
  // vista se reproyecte en otro idioma (límite documentado).
  const events = projectEvents(definition, result.events, language);
  const stored: StoredActionResult = {
    outcome: result.status,
    operationId,
    version: newRevision,
    events,
    ...(result.status === 'case_closed' ? { report: result.report } : {}),
    ...(result.status === 'batch_paused' ? { pausedAt: result.pausedAt, reason: result.reason } : {}),
  };
  const updated = await client.query(
    `UPDATE runs SET engine_state=$1::jsonb, revision=$2, updated_at=now()
     WHERE id=$3 AND owner_id=$4 AND revision=$5`,
    [JSON.stringify(result.run), newRevision, run.id, ownerId, run.revision]);
  if (updated.rowCount !== 1) throw new RunStoreError('VERSION_CONFLICT');
  const newRun: FullRun = {
    ...result.run,
    id: run.id, ownerId, definitionId: run.definitionId, definitionHash: run.definitionHash,
    engineVersion: result.run.engineVersion, revision: newRevision, branchId: run.branchId,
    status: result.run.status, difficulty: run.difficulty, deadlineMinutes: run.deadlineMinutes,
    explorationMode: run.explorationMode,
    engineState: result.run,
  };
  await client.query(
    `INSERT INTO operation_records(id, run_id, owner_id, idempotency_key, kind, request_digest,
      result_public, branch_id, revision)
     VALUES ($1,$2,$3,$4,'action',$5,$6::jsonb,$7,$8)`,
    [operationId, run.id, ownerId, opKey, requestDigest, JSON.stringify(stored), run.branchId, newRevision]);
  // Cierre definitivo (DEC-020): el primer resultado oficial se persiste
  // en la misma transacción que el cierre, así que cierre y registro son
  // atómicos; si el contenido ya tenía resultado oficial, el conflicto
  // no crea fila ni sustituye la primera (esta partida es práctica).
  if (result.status === 'case_closed') {
    await recordOfficialResult(client, ownerId, newRun, definition, result.report, operationId);
  }
  return { operationId, events, newRun, stored };
}

function previewActionResponse(definition: Definition, run: FullRun, manualCount: number, action: Action, officialResult: OfficialResultDto | null = null, language: Language = 'es'): ActionResponseDto {
  const preview = resolveAction(definition, pureRun(run), action, language);
  return { ...toResponse(definition, run, manualCount, preview, officialResult, language), requiresConfirmation: preview.status === 'confirmation_required' };
}

/** Cronología de la rama actual para proyectar una partida cerrada: vacía
 * mientras la partida sigue activa (el informe final no existe todavía). */
async function closedRunTimeline(
  query: (sql: string, params: unknown[]) => Promise<{ rows: Array<{ result_public: unknown }> }>,
  run: FullRun,
): Promise<PublicEvent[]> {
  return run.status === 'closed' ? loadRunTimeline(query, run.id, run.branchId) : [];
}

function replayActionResponse(definition: Definition, run: FullRun, manualCount: number, stored: StoredActionResult, timeline: PublicEvent[] = [], officialResult: OfficialResultDto | null = null, language: Language = 'es'): ActionResponseDto {
  const view = playerViewDto(definition, run, manualCount, timeline, officialResult, language);
  const { outcome, events, operationId, report, pausedAt, reason } = stored;
  // El informe que se enseña es el de la vista (completo y con cronología),
  // no el guardado en el registro de la acción, que es el del motor sin
  // cronología.
  const fullReport = view.finalReport ?? report;
  return {
    ...view, outcome, events, operationId, replayed: true,
    ...(fullReport ? { report: fullReport } : {}),
    ...(pausedAt !== undefined ? { pausedAt, reason } : {}),
  };
}

function isNoTransition(result: ActionResult): result is Extract<ActionResult, { status: 'impossible' | 'clarification_required' | 'confirmation_required' }> {
  return result.status === 'impossible' || result.status === 'clarification_required' ||
    result.status === 'confirmation_required';
}

function appliedActionResponse(
  definition: Definition, newRun: FullRun, manualCount: number, result: AppliedResult,
  operationId: string, events: ActionResponseDto['events'], stored: StoredActionResult,
  timeline: PublicEvent[] = [], officialResult: OfficialResultDto | null = null, language: Language = 'es',
): ActionResponseDto {
  const view = playerViewDto(definition, newRun, manualCount, timeline, officialResult, language);
  const fullReport = view.finalReport ?? stored.report;
  return {
    ...view, outcome: result.status, events, operationId,
    ...(fullReport ? { report: fullReport } : {}),
    ...(stored.pausedAt !== undefined ? { pausedAt: stored.pausedAt, reason: stored.reason } : {}),
  };
}

/** Tras un cierre, el resultado oficial de este contenido ya existe
 * (lo acaba de registrar esta acción o lo registró otra partida): se
 * recarga para que la respuesta lo traiga; en cualquier otro caso se
 * devuelve el que ya se cargó al inicio. */
async function officialAfterAction(
  client: PoolClient, ownerId: string, contentHash: string, runId: string,
  status: string, official: OfficialResultDto | null, language: Language = 'es',
): Promise<OfficialResultDto | null> {
  if (status !== 'case_closed') return official;
  return loadOfficialResultForContent(client, ownerId, contentHash, runId, language);
}

export async function commitAction(
  database: Database,
  digest: string,
  runId: string,
  input: { action: Action; confirm?: boolean; expectedVersion?: number; idempotencyKey?: string },
  language: Language = 'es',
): Promise<ActionResponseDto> {
  if (input.idempotencyKey !== undefined && !isIdempotencyKey(input.idempotencyKey)) {
    throw new RunStoreError('INVALID_REQUEST');
  }
  return inSession(database, digest, async (client, ownerId) => {
    const run = await lockedRun(client, ownerId, runId);
    if (run.status === 'closed') throw new RunStoreError('RUN_CLOSED');
    const definition = await definitionForRun(database.orm, run.definitionId, run.difficulty, run.deadlineMinutes, run.explorationMode);
    const manualCount = await manualSaveCount(client, runId);
    // Resultado oficial de este contenido para el perfil (DEC-020): el
    // de otra partida anterior si existe; si esta acción cierra el caso,
    // se recarga tras persistir para traer el recién registrado.
    const contentHash = contentHashForDefinition(definition);
    let official = await loadOfficialResultForContent(client, ownerId, contentHash, run.id, language);

    // Preview explícito: solo lectura, sin persistencia ni registro.
    if (input.confirm === false) {
      return previewActionResponse(definition, run, manualCount, input.action, official, language);
    }

    // Replay por idempotencia ANTES de rechazar una revisión vieja (GUARDADOS.md).
    if (input.idempotencyKey) {
      const stored = await findActionReplay(client, runId, input.idempotencyKey, actionDigest(input.action, input.expectedVersion));
      if (stored) {
        const timeline = await closedRunTimeline((sql, params) => client.query(sql, params), run);
        return replayActionResponse(definition, run, manualCount, stored, timeline, official, language);
      }
    }
    if (input.expectedVersion !== undefined && input.expectedVersion !== run.revision) {
      throw new RunStoreError('VERSION_CONFLICT');
    }

    const result = confirmAction(definition, pureRun(run), input.action, language);
    // Sin transición: no persiste, no registra operación, no avanza revisión.
    if (isNoTransition(result)) return toResponse(definition, run, manualCount, result, official, language);
    // applied | case_closed | batch_paused: el estado cambió; persistir.
    if (result.run.version <= run.version) throw new RunStoreError('DEPENDENCY_UNAVAILABLE');
    const { operationId, events, newRun, stored } = await persistAction(
      client, ownerId, run, definition, result,
      input.idempotencyKey ?? randomUUID(), actionDigest(input.action, input.expectedVersion), language);
    // La cronología se carga tras persistir, así la acción de cierre ya
    // está en los registros y el informe la incluye desde el primer momento.
    const timeline = await closedRunTimeline((sql, params) => client.query(sql, params), newRun);
    official = await officialAfterAction(client, ownerId, contentHash, run.id, result.status, official, language);
    return appliedActionResponse(definition, newRun, manualCount, result, operationId, events, stored, timeline, official, language);
  });
}

type StoredLoadResult = { operationId: string; newBranchId: string; version: number };

async function findLoadReplay(client: PoolClient, runId: string, key: string, digest: string): Promise<StoredLoadResult | null> {
  const replayed = await client.query<{ request_digest: string; result_public: StoredLoadResult }>(
    `SELECT request_digest, result_public FROM operation_records WHERE run_id=$1 AND idempotency_key=$2`,
    [runId, key]);
  const row = replayed.rows[0];
  if (!row) return null;
  if (row.request_digest !== digest) throw new RunStoreError('IDEMPOTENCY_CONFLICT');
  return row.result_public;
}

/** Extrae el CaseRun de un snapshot (puro o agregado antiguo con engineState). */
function extractSnapshot(raw: unknown): Partial<CaseRun> | null {
  if (!raw || typeof raw !== 'object') return null;
  const root = raw as { engineState?: unknown };
  const candidate = root.engineState && typeof root.engineState === 'object' ? root.engineState : raw;
  return candidate as Partial<CaseRun>;
}

/** Lee y valida el snapshot de un guardado activo. */
async function readSaveSnapshot(client: PoolClient, runId: string, saveId: string, run: FullRun): Promise<CaseRun> {
  const save = await client.query<{ snapshot: unknown; status: string }>(
    `SELECT snapshot, status FROM manual_saves WHERE id=$1 AND run_id=$2`, [saveId, runId]);
  const row = save.rows[0];
  if (!row) throw new RunStoreError('NOT_FOUND');
  if (row.status !== 'active') throw new RunStoreError('SAVE_NOT_ACTIVE');
  const snapshot = extractSnapshot(row.snapshot);
  if (!snapshot || snapshot.id !== runId || snapshot.definitionHash !== run.definitionHash ||
      snapshot.engineVersion !== run.engineVersion) {
    throw new RunStoreError('SAVE_INCOMPATIBLE');
  }
  // Un snapshot con forma inválida (p. ej. manipulado) no se restaura.
  assertRunShape(snapshot);
  return snapshot as CaseRun;
}

async function persistLoad(
  client: PoolClient, ownerId: string, run: FullRun, restored: CaseRun,
  key: string, digest: string,
): Promise<{ operationId: string; newBranchId: string; newRun: FullRun }> {
  const newBranchId = randomUUID();
  const newRevision = run.revision + 1;
  const operationId = randomUUID();
  const stored: StoredLoadResult = { operationId, newBranchId, version: newRevision };
  const updated = await client.query(
    `UPDATE runs SET engine_state=$1::jsonb, revision=$2, branch_id=$3, updated_at=now()
     WHERE id=$4 AND owner_id=$5 AND revision=$6`,
    [JSON.stringify(restored), newRevision, newBranchId, run.id, ownerId, run.revision]);
  if (updated.rowCount !== 1) throw new RunStoreError('VERSION_CONFLICT');
  await client.query(
    `INSERT INTO operation_records(id, run_id, owner_id, idempotency_key, kind, request_digest,
      result_public, branch_id, revision)
     VALUES ($1,$2,$3,$4,'load',$5,$6::jsonb,$7,$8)`,
    [operationId, run.id, ownerId, key, digest, JSON.stringify(stored), newBranchId, newRevision]);
  const newRun: FullRun = {
    ...restored,
    id: run.id, ownerId, definitionId: run.definitionId, definitionHash: run.definitionHash,
    engineVersion: restored.engineVersion, revision: newRevision, branchId: newBranchId,
    status: restored.status, difficulty: run.difficulty, deadlineMinutes: run.deadlineMinutes,
    explorationMode: run.explorationMode,
    engineState: restored,
  };
  return { operationId, newBranchId, newRun };
}

export async function commitLoad(
  database: Database,
  digest: string,
  runId: string,
  saveId: string,
  input: { expectedVersion: number; idempotencyKey: string },
  language: Language = 'es',
): Promise<SaveLoadResponseDto> {
  if (!isIdempotencyKey(input.idempotencyKey)) throw new RunStoreError('INVALID_REQUEST');
  return inSession(database, digest, async (client, ownerId) => {
    const run = await lockedRun(client, ownerId, runId);
    if (run.status === 'closed') throw new RunStoreError('RUN_CLOSED');
    const definition = await definitionForRun(database.orm, run.definitionId, run.difficulty, run.deadlineMinutes, run.explorationMode);
    const loadDigest = createHash('sha256').update(JSON.stringify(['load', saveId])).digest('hex');

    // Replay por idempotencia ANTES de rechazar una revisión vieja.
    const replayed = await findLoadReplay(client, runId, input.idempotencyKey, loadDigest);
    if (replayed) {
      const manualCount = await manualSaveCount(client, runId);
      const official = await loadOfficialResultForContent(client, ownerId, contentHashForDefinition(definition), run.id, language);
      const view = playerViewDto(definition, run, manualCount, [], official, language);
      return { ...view, operationId: replayed.operationId, newBranchId: replayed.newBranchId };
    }
    if (input.expectedVersion !== run.revision) throw new RunStoreError('VERSION_CONFLICT');

    const snapshot = await readSaveSnapshot(client, runId, saveId, run);
    // La revisión HTTP es del agregado (+1); la versión interna del motor se
    // conserva tal cual estaba en el guardado (GUARDADOS.md). El snapshot se
    // restaura puro, sin campos del agregado que pudiera arrastrar.
    const restored: CaseRun = pureRun({ ...snapshot, id: runId });
    const { operationId, newBranchId, newRun } = await persistLoad(
      client, ownerId, run, restored, input.idempotencyKey, loadDigest);
    const manualCount = await manualSaveCount(client, runId);
    const official = await loadOfficialResultForContent(client, ownerId, contentHashForDefinition(definition), run.id, language);
    const view = playerViewDto(definition, newRun, manualCount, [], official, language);
    return { ...view, operationId, newBranchId };
  });
}
