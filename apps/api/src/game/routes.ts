import { listStoredRuns } from './run-list.ts';
import { isIdempotencyKey } from '@meridiano/contracts';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AppConfig } from '../config.ts';
import type { Database } from '../database/connection.ts';
import { createSessionStore, tokenDigest } from '../auth/store.ts';
import { cookieToken, matches } from '../auth/session-security.ts';
import { caseSummary, findCase, listCases, findDefinitionById, applyDifficulty, applyExplorationMode, definitionForRun, caseMeta } from './catalog.ts';
import { initialPlayerView } from './initial-view.ts';
import { createStoredRun, deleteStoredRun, readStoredRun, readFullRun, lookupRunCreation, RunStoreError } from './runs.ts';
import { ENGINE_VERSION, type Action } from '@meridiano/engine';
import type { Difficulty, Language } from '@meridiano/case-schema';
import { GDD_CRIME_TYPES, parseLanguage } from '@meridiano/case-schema';
import type { ContentRating, CrimeType, ExplorationMode } from '@meridiano/contracts';
import { commitAction, commitLoad } from './transitions.ts';
import { playerViewDto } from './player-view.ts';
import { loadRunTimeline } from './timeline.ts';
import { loadCareerProfile, loadOfficialResultForContent } from './career.ts';
import { contentHashForDefinition } from '@meridiano/case-schema/server';
import { eq, and, desc, sql } from 'drizzle-orm';
import { manualSaves, operationRecords } from '../database/schema.ts';
import type { CaseRun } from '@meridiano/case-schema';
import { createHash, randomUUID } from 'node:crypto';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseDifficulty(value: unknown): Difficulty {
  if (value === undefined) return 'normal';
  if (typeof value !== 'string' || !['easy', 'normal', 'hard'].includes(value)) throw new RunStoreError('INVALID_REQUEST');
  return value as Difficulty;
}

function parseCrimeType(value: unknown): CrimeType | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !(GDD_CRIME_TYPES as readonly string[]).includes(value)) throw new RunStoreError('INVALID_REQUEST');
  return value as CrimeType;
}

function parseContentRating(value: unknown): ContentRating | undefined {
  if (value === undefined) return undefined;
  if (value !== 'familiar' && value !== 'general') throw new RunStoreError('INVALID_REQUEST');
  return value;
}

function parseExplorationMode(value: unknown): ExplorationMode {
  if (value === undefined) return 'guided';
  if (typeof value !== 'string' || !['guided', 'free'].includes(value)) throw new RunStoreError('INVALID_REQUEST');
  return value as ExplorationMode;
}

function createBody(value: unknown): { caseId: string; idempotencyKey: string; difficulty: Difficulty; explorationMode: ExplorationMode; crimeType?: CrimeType | undefined; contentRating?: ContentRating | undefined } {
  if (!isRecord(value)) throw new RunStoreError('INVALID_REQUEST');
  const allowed = new Set(['caseId', 'difficulty', 'explorationMode', 'idempotencyKey', 'crimeType', 'contentRating']);
  if (!Object.keys(value).every(key => allowed.has(key))) throw new RunStoreError('INVALID_REQUEST');
  const { caseId, idempotencyKey, difficulty, explorationMode, crimeType, contentRating } = value;
  if (typeof caseId !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(caseId) ||
      !isIdempotencyKey(idempotencyKey)) throw new RunStoreError('INVALID_REQUEST');
  return { caseId, idempotencyKey, difficulty: parseDifficulty(difficulty), explorationMode: parseExplorationMode(explorationMode), crimeType: parseCrimeType(crimeType), contentRating: parseContentRating(contentRating) };
}

/** Delito y contenido elegidos deben coincidir con el expediente: son
 * parámetros reales de la creación, no adornos. El cliente los envía desde
 * el formulario; un reintento sin ellos sigue funcionando (se derivan del
 * expediente). */
async function assertCreationParams(database: Database, caseId: string, crimeType: CrimeType | undefined, contentRating: ContentRating | undefined): Promise<void> {
  const meta = await caseMeta(database.orm, caseId);
  if (crimeType !== undefined && crimeType !== meta.crimeType) {
    throw new RunStoreError('VALIDATION_ERROR', 'El delito elegido no corresponde al expediente elegido.');
  }
  if (contentRating !== undefined && contentRating !== meta.contentRating) {
    throw new RunStoreError('VALIDATION_ERROR', 'El contenido elegido no corresponde al expediente elegido.');
  }
}

function deleteRunBody(value: unknown): { confirm: boolean } {
  if (!isRecord(value) || Object.keys(value).join(',') !== 'confirm' || value.confirm !== true) {
    throw new RunStoreError('INVALID_REQUEST');
  }
  return { confirm: true };
}

function lookupBody(value: unknown): string {
  if (!isRecord(value) || Object.keys(value).join(',') !== 'idempotencyKey' || !isIdempotencyKey(value.idempotencyKey)) {
    throw new RunStoreError('INVALID_REQUEST');
  }
  return value.idempotencyKey;
}

function expectedProfile(request: FastifyRequest): string | undefined {
  const value = request.headers['x-expected-profile-id'];
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value)) throw new RunStoreError('INVALID_REQUEST');
  return value.toLowerCase();
}

async function available<T>(work: () => Promise<T>): Promise<T> {
  try { return await work(); }
  catch (error) {
    if (error instanceof RunStoreError) throw error;
    throw new RunStoreError('DEPENDENCY_UNAVAILABLE');
  }
}

function computeSnapshotHash(snapshot: unknown): string {
  const canonical = JSON.stringify(snapshot, Object.keys(snapshot as object).sort());
  return createHash('sha256').update(canonical).digest('hex');
}

function validSaveName(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 80;
}
function validVersion(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1;
}
function validReplaceSaveId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);
}

function saveBody(value: unknown): { name: string; expectedVersion: number; idempotencyKey: string; replaceSaveId?: string } {
  if (!isRecord(value)) throw new RunStoreError('INVALID_REQUEST');
  const name = value.name;
  const expectedVersion = value.expectedVersion;
  const idempotencyKey = value.idempotencyKey;
  const replaceSaveId = value.replaceSaveId;
  if (!validSaveName(name)) throw new RunStoreError('INVALID_REQUEST');
  if (!validVersion(expectedVersion)) throw new RunStoreError('INVALID_REQUEST');
  if (!isIdempotencyKey(idempotencyKey)) throw new RunStoreError('INVALID_REQUEST');
  if (replaceSaveId !== undefined) {
    if (!validReplaceSaveId(replaceSaveId)) throw new RunStoreError('INVALID_REQUEST');
  }
  return replaceSaveId !== undefined
    ? { name: name.trim(), expectedVersion, idempotencyKey, replaceSaveId }
    : { name: name.trim(), expectedVersion, idempotencyKey };
}

function loadBody(value: unknown): { expectedVersion: number; idempotencyKey: string } {
  if (!isRecord(value)) throw new RunStoreError('INVALID_REQUEST');
  const expectedVersion = value.expectedVersion;
  const idempotencyKey = value.idempotencyKey;
  if (typeof expectedVersion !== 'number' || !Number.isSafeInteger(expectedVersion) || expectedVersion < 1) throw new RunStoreError('INVALID_REQUEST');
  if (!isIdempotencyKey(idempotencyKey)) throw new RunStoreError('INVALID_REQUEST');
  return { expectedVersion, idempotencyKey };
}

function patchBody(value: unknown): { name: string; expectedSaveVersion: number; idempotencyKey: string } {
  if (!isRecord(value)) throw new RunStoreError('INVALID_REQUEST');
  const name = value.name;
  const expectedSaveVersion = value.expectedSaveVersion;
  const idempotencyKey = value.idempotencyKey;
  if (typeof name !== 'string' || name.trim().length === 0 || name.length > 80) throw new RunStoreError('INVALID_REQUEST');
  if (typeof expectedSaveVersion !== 'number' || !Number.isSafeInteger(expectedSaveVersion) || expectedSaveVersion < 1) throw new RunStoreError('INVALID_REQUEST');
  if (!isIdempotencyKey(idempotencyKey)) throw new RunStoreError('INVALID_REQUEST');
  return { name: name.trim(), expectedSaveVersion, idempotencyKey };
}

function deleteBody(value: unknown): { expectedSaveVersion: number; idempotencyKey: string } {
  if (!isRecord(value)) throw new RunStoreError('INVALID_REQUEST');
  const expectedSaveVersion = value.expectedSaveVersion;
  const idempotencyKey = value.idempotencyKey;
  if (typeof expectedSaveVersion !== 'number' || !Number.isSafeInteger(expectedSaveVersion) || expectedSaveVersion < 1) throw new RunStoreError('INVALID_REQUEST');
  if (!isIdempotencyKey(idempotencyKey)) throw new RunStoreError('INVALID_REQUEST');
  return { expectedSaveVersion, idempotencyKey };
}

function actionShape(value: Record<string, unknown>): Action {
  const { action } = value;
  if (!isRecord(action) || typeof action.type !== 'string' || action.type.length === 0 ||
      !isRecord(action.params)) throw new RunStoreError('INVALID_REQUEST');
  return action as unknown as Action;
}

function validExpectedVersion(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1;
}

function actionOptions(value: Record<string, unknown>): { confirm?: boolean; expectedVersion?: number; idempotencyKey?: string } {
  const { confirm, expectedVersion, idempotencyKey } = value;
  if (confirm !== undefined && typeof confirm !== 'boolean') throw new RunStoreError('INVALID_REQUEST');
  if (expectedVersion !== undefined && !validExpectedVersion(expectedVersion)) throw new RunStoreError('INVALID_REQUEST');
  if (idempotencyKey !== undefined && !isIdempotencyKey(idempotencyKey)) throw new RunStoreError('INVALID_REQUEST');
  const options: { confirm?: boolean; expectedVersion?: number; idempotencyKey?: string } = {};
  if (confirm !== undefined) options.confirm = confirm;
  if (expectedVersion !== undefined) options.expectedVersion = expectedVersion;
  if (idempotencyKey !== undefined) options.idempotencyKey = idempotencyKey;
  return options;
}

function actionBody(value: unknown): { action: Action; confirm?: boolean; expectedVersion?: number; idempotencyKey?: string } {
  if (!isRecord(value)) throw new RunStoreError('INVALID_REQUEST');
  const keys = Object.keys(value);
  const allowed = ['action', 'confirm', 'expectedVersion', 'idempotencyKey'];
  if (!keys.includes('action') || keys.some(key => !allowed.includes(key))) {
    throw new RunStoreError('INVALID_REQUEST');
  }
  return { action: actionShape(value), ...actionOptions(value) };
}

/** Guardados manuales activos de una partida (para saveCapabilities). */
async function saveCount(database: Database, runId: string): Promise<number> {
  const result = await database.pool.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM manual_saves WHERE run_id=$1 AND status='active'`, [runId]);
  return Number(result.rows[0]?.n ?? 0);
}

/** Reintento de crear/reemplazar un guardado: devuelve el resumen guardado o null. */
async function findSaveReplay(database: Database, runId: string, idempotencyKey: string, requestDigest: string): Promise<Record<string, unknown> | null> {
  const replay = await database.orm.select({
    requestDigest: operationRecords.requestDigest,
    resultPublic: operationRecords.resultPublic,
  }).from(operationRecords)
    .where(and(
      eq(operationRecords.runId, runId),
      eq(operationRecords.idempotencyKey, idempotencyKey),
      eq(operationRecords.kind, 'save'),
    )).limit(1);
  const found = replay[0];
  if (!found) return null;
  if (found.requestDigest !== requestDigest) throw new RunStoreError('IDEMPOTENCY_CONFLICT');
  return found.resultPublic as Record<string, unknown>;
}

/** Ciudad del snapshot de un guardado (posición guardada; 'Madrid' si se desconoce). */
function snapshotCityId(snapshot: unknown): string | undefined {
  if (!snapshot || typeof snapshot !== 'object') return undefined;
  const root = snapshot as Record<string, unknown>;
  const inner = root.engineState as Record<string, unknown> | undefined;
  const position = (root.position ?? inner?.position) as Record<string, unknown> | undefined;
  return typeof position?.cityId === 'string' ? position.cityId : undefined;
}

export function registerGameRoutes(app: FastifyInstance, config: AppConfig, database: Database, ready: () => Promise<boolean>): void {
  const store = createSessionStore(database);
  async function authorize(request: FastifyRequest): Promise<{ profileId: string }> {
    if (!await ready()) throw new RunStoreError('DEPENDENCY_UNAVAILABLE');
    const session = await available(() => store.find(cookieToken(request.headers.cookie)));
    if (!session) throw new RunStoreError('SESSION_REQUIRED');
    if (request.method === 'POST') {
      if (request.headers.origin !== config.origin) throw new RunStoreError('ORIGIN_REJECTED');
      if (!matches(request.headers['x-csrf-token'], session.csrfToken)) throw new RunStoreError('CSRF_REJECTED');
    }
    return { profileId: session.profile.id };
  }
  function digest(request: FastifyRequest): string {
    const token = cookieToken(request.headers.cookie);
    if (!token) throw new RunStoreError('SESSION_REQUIRED');
    return tokenDigest(token);
  }
  /** Idioma de la petición (cabecera `x-meridiano-language`): cualquier
   * otro valor o su ausencia es español. Viaja por petición, sin
   * persistirse: cambiarlo en Ajustes vuelve a pedir la vista en el
   * idioma nuevo. */
  function requestLanguage(request: FastifyRequest): Language {
    return parseLanguage(request.headers['x-meridiano-language']);
  }
  app.get<{ Querystring: Record<string, unknown> }>('/api/v1/cases', { onRequest: authorize }, async request => {
    const { limit, cursor, ...extra } = request.query;
    if (Object.keys(extra).length || cursor !== undefined ||
        (limit !== undefined && (typeof limit !== 'string' || !/^(?:[1-9][0-9]?|100)$/.test(limit)))) {
      throw new RunStoreError('INVALID_REQUEST');
    }
    const owner = await authorize(request);
    // Un caso en el catálogo actual: no hay segunda página ni cursores emitidos.
    return { items: await listCases(database.orm, owner.profileId, requestLanguage(request)), nextCursor: null };
  });
  app.get<{ Params: { caseId: string } }>('/api/v1/cases/:caseId', { onRequest: authorize }, async request => {
    const owner = await authorize(request);
    return caseSummary(database.orm, request.params.caseId, owner.profileId, requestLanguage(request));
  });
  app.get<{ Querystring: Record<string, unknown> }>('/api/v1/runs', { onRequest: authorize }, request =>
    available(() => listStoredRuns(database, digest(request), request.query, requestLanguage(request))));
  app.post('/api/v1/runs', { onRequest: authorize }, async (request, reply) => {
    const body = createBody(request.body);
    await assertCreationParams(database, body.caseId, body.crimeType, body.contentRating);
    const definition = applyExplorationMode(applyDifficulty(await findCase(database.orm, body.caseId), body.difficulty), body.explorationMode);
    const created = await available(() => createStoredRun(database, digest(request), definition, body.idempotencyKey, expectedProfile(request)));
    // La vista es la actual (en un replay puede haber progreso posterior).
    const run = await available(() => readFullRun(database, digest(request), created.run.id));
    const manualCount = await available(() => saveCount(database, run.id));
    const owner = await authorize(request);
    const official = await available(() => loadOfficialResultForContent(database.pool, owner.profileId, contentHashForDefinition(definition), run.id, requestLanguage(request)));
    const view = playerViewDto(definition, run, manualCount, [], official, requestLanguage(request));
    return reply.code(created.replayed ? 200 : 201).send({ ...view, replayed: created.replayed });
  });
  // DELETE /api/v1/runs/:runId - Borrar una partida propia (activa o
  // cerrada) con todos sus guardados y su registro de operaciones. Solo el
  // propietario; para cualquier otro es 404 sin distinguir. El borrado lo
  // ejecuta la función SECURITY DEFINER delete_run (migración 0007).
  app.delete<{ Params: { runId: string }; Body: { confirm: boolean } }>(
    '/api/v1/runs/:runId',
    { onRequest: authorize },
    async (request, reply) => {
      deleteRunBody(request.body);
      const deleted = await available(() => deleteStoredRun(database, digest(request), request.params.runId));
      if (!deleted) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Partida no encontrada.', requestId: request.id } });
      return reply.code(204).send();
    }
  );
  app.post<{ Querystring: Record<string, unknown> }>('/api/v1/run-creations/lookup', { onRequest: authorize }, async request => {
    if (Object.keys(request.query).length) throw new RunStoreError('INVALID_REQUEST');
    const key = lookupBody(request.body);
    return available(() => lookupRunCreation(database, digest(request), key, expectedProfile(request)));
  });
  app.get<{ Params: { runId: string } }>('/api/v1/runs/:runId', { onRequest: authorize }, async request => {
    const run = await available(() => readFullRun(database, digest(request), request.params.runId));
    // Motores antiguos: se conserva la vista inicial (503 si no es inicial virgen).
    if (run.engineVersion !== ENGINE_VERSION) return initialPlayerView(database.orm, run, requestLanguage(request));
    // La definición gobierna con los parámetros persistidos de esta partida
    // (dificultad, plazo y modo de exploración elegidos al crearla), no con
    // los del catálogo.
    const definition = await definitionForRun(database.orm, run.definitionId, run.difficulty, run.deadlineMinutes, run.explorationMode);
    const manualCount = await available(() => saveCount(database, run.id));
    // La cronología del informe final solo existe en partidas cerradas: se
    // reconstruye desde los registros de operaciones de la rama actual.
    const timeline = run.status === 'closed'
      ? await available(() => loadRunTimeline((sql, params) => database.pool.query(sql, params), run.id, run.branchId))
      : [];
    const owner = await authorize(request);
    const official = await available(() => loadOfficialResultForContent(database.pool, owner.profileId, contentHashForDefinition(definition), run.id, requestLanguage(request)));
    return playerViewDto(definition, run, manualCount, timeline, official, requestLanguage(request));
  });

  // GET /api/v1/career - Perfil de carrera del detective (GDD §13):
  // rango, puntos, reputación, medallas, casos, países, lugares,
  // sanciones y resultados oficiales, derivados de `official_results`.
  // Sin resultados oficiales, el perfil está vacío (rango Aspirante).
  app.get('/api/v1/career', { onRequest: authorize }, async request => {
    const owner = await authorize(request);
    return available(() => loadCareerProfile(database.pool, owner.profileId, requestLanguage(request)));
  });

  // POST /api/v1/runs/:runId/action - Preview (confirm=false) o confirmación.
  // confirm=true aplica con confirmAction y persiste en la misma transacción
  // que el registro de operación; un resultado sin transición (impossible,
  // clarification_required, confirmation_required) no persiste ni avanza revisión.
  app.post<{ Params: { runId: string }; Body: { action: Action; confirm?: boolean; expectedVersion?: number; idempotencyKey?: string } }>(
    '/api/v1/runs/:runId/action',
    { onRequest: authorize },
    async (request, reply) => {
      const body = actionBody(request.body);
      const result = await available(() => commitAction(database, digest(request), request.params.runId, body, requestLanguage(request)));
      return reply.send(result);
    }
  );

  // GET /api/v1/runs/:runId/saves - List manual saves
  app.get<{ Params: { runId: string }; Querystring: { limit?: string } }>(
    '/api/v1/runs/:runId/saves',
    { onRequest: authorize },
    async (request, reply) => {
      const run = await available(() => readStoredRun(database, digest(request), request.params.runId));
      if (run.status === 'closed') return reply.code(409).send({ error: { code: 'RUN_CLOSED', message: 'La partida ya está cerrada.', requestId: request.id } });

      const { limit = '25' } = request.query;
      const limitNum = Number(limit);
      if (!Number.isSafeInteger(limitNum) || limitNum < 1 || limitNum > 100) throw new RunStoreError('INVALID_REQUEST');

      const saves = await database.orm.select({
        id: manualSaves.id,
        name: manualSaves.name,
        createdAt: manualSaves.createdAt,
        sourceRevision: manualSaves.sourceRevision,
        minute: manualSaves.minute,
        status: manualSaves.status,
        metadataVersion: manualSaves.metadataVersion,
        snapshot: manualSaves.snapshot,
      }).from(manualSaves)
        .where(and(eq(manualSaves.runId, request.params.runId), eq(manualSaves.status, 'active')))
        .orderBy(desc(manualSaves.createdAt))
        .limit(limitNum + 1);

      const definition = await findDefinitionById(database.orm, run.definitionId);
      const items = saves.slice(0, limitNum).map(s => ({
        saveId: s.id,
        runId: request.params.runId,
        name: s.name,
        createdAt: s.createdAt.toISOString(),
        sourceRevision: s.sourceRevision,
        cityName: definition.cities.find(city => city.id === snapshotCityId(s.snapshot))?.name ?? 'Madrid',
        minute: s.minute,
        status: s.status,
        metadataVersion: s.metadataVersion,
        canLoad: s.status === 'active',
      }));

      const next = saves.length > limitNum ? saves[limitNum] : undefined;
      const nextCursor = next ? next.id : null;
      return reply.send({ items, manualLimit: 10, manualCount: items.length, nextCursor });
    }
  );

  // POST /api/v1/runs/:runId/saves - Create manual save
  app.post<{ Params: { runId: string }; Body: { name: string; expectedVersion: number; idempotencyKey: string; replaceSaveId?: string } }>(
    '/api/v1/runs/:runId/saves',
    { onRequest: authorize },
    async (request, reply) => {
      const run = await available(() => readFullRun(database, digest(request), request.params.runId));
      if (run.status === 'closed') return reply.code(409).send({ error: { code: 'RUN_CLOSED', message: 'La partida ya está cerrada.', requestId: request.id } });

      const body = saveBody(request.body);
      const ownerId = run.ownerId;
      const requestDigest = createHash('sha256')
        .update(JSON.stringify(body.replaceSaveId ? { replace: body.replaceSaveId } : { create: body.name }))
        .digest('hex');

      // Replay por idempotencia ANTES de rechazar una revisión vieja (GUARDADOS.md).
      const replayedSummary = await findSaveReplay(database, request.params.runId, body.idempotencyKey, requestDigest);
      if (replayedSummary) return reply.code(200).send({ ...replayedSummary, replayed: true });
      if (body.expectedVersion !== run.revision) throw new RunStoreError('VERSION_CONFLICT');

      const existingByName = await database.orm.select({ id: manualSaves.id }).from(manualSaves)
        .where(and(eq(manualSaves.runId, request.params.runId), eq(manualSaves.name, body.name), eq(manualSaves.status, 'active'))).limit(1);

      const activeCount = await database.orm.select({ count: sql`count(*)` }).from(manualSaves)
        .where(and(eq(manualSaves.runId, request.params.runId), eq(manualSaves.status, 'active')));
      const activeCountNum = Number(activeCount[0]?.count ?? 0);

      const target = body.replaceSaveId
        ? (await database.orm.select({
            id: manualSaves.id, createdAt: manualSaves.createdAt, metadataVersion: manualSaves.metadataVersion,
          }).from(manualSaves)
            .where(and(eq(manualSaves.id, body.replaceSaveId), eq(manualSaves.runId, request.params.runId))).limit(1))[0]
        : undefined;
      if (body.replaceSaveId && !target) throw new RunStoreError('NOT_FOUND');

      // El snapshot guarda el CaseRun puro, no el agregado (la carga lo restaura tal cual).
      const snapshot = run.engineState as CaseRun;
      const snapshotHash = computeSnapshotHash(snapshot);
      const now = new Date();

      // La respuesta se envía DESPUÉS del commit: responder dentro de la
      // transacción permitiría que el 201 llegase antes de que el guardado
      // fuese visible para otras conexiones.
      const created = await database.orm.transaction(async (tx) => {
        if (body.replaceSaveId && target) {
          const replaced = await tx.update(manualSaves)
            .set({
              name: body.name,
              sourceRevision: run.revision,
              sourceBranchId: run.branchId,
              minute: run.minute,
              snapshot,
              snapshotHash,
              engineVersion: run.engineVersion,
              metadataVersion: sql`${manualSaves.metadataVersion} + 1`,
              updatedAt: now,
              status: 'active',
            })
            .where(and(eq(manualSaves.id, body.replaceSaveId), eq(manualSaves.runId, request.params.runId)))
            .returning({ metadataVersion: manualSaves.metadataVersion });
          if (!replaced.length) throw new RunStoreError('NOT_FOUND');
          const replacedRow = replaced[0];
          if (!replacedRow) throw new RunStoreError('NOT_FOUND');
          const summary = {
            saveId: body.replaceSaveId, name: body.name, createdAt: target.createdAt.toISOString(),
            sourceRevision: run.revision, metadataVersion: replacedRow.metadataVersion,
          };

          await tx.insert(operationRecords).values({
            runId: request.params.runId,
            ownerId,
            idempotencyKey: body.idempotencyKey,
            kind: 'save',
            requestDigest,
            resultPublic: summary,
            branchId: run.branchId,
            revision: run.revision,
          });

          return { status: 200, summary };
        }

        if (activeCountNum >= 10) {
          throw new RunStoreError('SAVE_LIMIT_REACHED');
        }

        if (existingByName.length > 0) {
          throw new RunStoreError('INVALID_REQUEST');
        }

        const id = randomUUID();
        await tx.insert(manualSaves).values({
          id,
          runId: request.params.runId,
          ownerId,
          schemaVersion: 1,
          name: body.name,
          sourceRevision: run.revision,
          sourceBranchId: run.branchId,
          minute: run.minute,
          status: 'active',
          snapshot,
          snapshotHash,
          engineVersion: run.engineVersion,
          metadataVersion: 1,
        });
        const summary = {
          saveId: id, name: body.name, createdAt: now.toISOString(),
          sourceRevision: run.revision, metadataVersion: 1,
        };

        await tx.insert(operationRecords).values({
          runId: request.params.runId,
          ownerId,
          idempotencyKey: body.idempotencyKey,
          kind: 'save',
          requestDigest,
          resultPublic: summary,
          branchId: run.branchId,
          revision: run.revision,
        });

        return { status: 201, summary };
      });
      return reply.code(created.status).send(created.summary);
    }
  );

  // PATCH /api/v1/runs/:runId/saves/:saveId - Update save metadata
  app.patch<{ Params: { runId: string; saveId: string }; Body: { name: string; expectedSaveVersion: number; idempotencyKey: string } }>(
    '/api/v1/runs/:runId/saves/:saveId',
    { onRequest: authorize },
    async (request, reply) => {
      const body = patchBody(request.body);
      const run = await available(() => readStoredRun(database, digest(request), request.params.runId));
      if (run.status === 'closed') return reply.code(409).send({ error: { code: 'RUN_CLOSED', message: 'La partida ya está cerrada.', requestId: request.id } });

      const save = await database.orm.select().from(manualSaves)
        .where(and(eq(manualSaves.id, request.params.saveId), eq(manualSaves.runId, request.params.runId))).limit(1);
      const s = save[0];
      if (!s) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Guardado no encontrado.', requestId: request.id } });
      if (s.metadataVersion !== body.expectedSaveVersion) return reply.code(409).send({ error: { code: 'VERSION_CONFLICT', message: 'Versión de metadatos obsoleta.', requestId: request.id } });
      if (s.status !== 'active') return reply.code(400).send({ error: { code: 'SAVE_NOT_ACTIVE', message: 'El guardado no está activo.', requestId: request.id } });

      const ownerId = run.ownerId;
      const updatedResult = await database.orm.update(manualSaves)
        .set({ name: body.name, metadataVersion: s.metadataVersion + 1, updatedAt: new Date() })
        .where(and(eq(manualSaves.id, request.params.saveId), eq(manualSaves.runId, request.params.runId)))
        .returning({ id: manualSaves.id, name: manualSaves.name, metadataVersion: manualSaves.metadataVersion, updatedAt: manualSaves.updatedAt });
      const updated = updatedResult[0];
      if (!updated) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Guardado no encontrado.', requestId: request.id } });

      await database.orm.insert(operationRecords).values({
        runId: request.params.runId,
        ownerId,
        idempotencyKey: body.idempotencyKey,
        kind: 'save',
        requestDigest: createHash('sha256').update(JSON.stringify({ patch: body.name })).digest('hex'),
        resultPublic: { saveId: updated.id, action: 'patch' },
        branchId: run.branchId,
        revision: run.revision,
      });

      return reply.send({ saveId: updated.id, name: updated.name, metadataVersion: updated.metadataVersion });
    }
  );

  // DELETE /api/v1/runs/:runId/saves/:saveId - Delete save
  app.delete<{ Params: { runId: string; saveId: string }; Body: { expectedSaveVersion: number; idempotencyKey: string } }>(
    '/api/v1/runs/:runId/saves/:saveId',
    { onRequest: authorize },
    async (request, reply) => {
      const body = deleteBody(request.body);
      const run = await available(() => readStoredRun(database, digest(request), request.params.runId));
      if (run.status === 'closed') return reply.code(409).send({ error: { code: 'RUN_CLOSED', message: 'La partida ya está cerrada.', requestId: request.id } });

      const save = await database.orm.select().from(manualSaves)
        .where(and(eq(manualSaves.id, request.params.saveId), eq(manualSaves.runId, request.params.runId))).limit(1);
      const s = save[0];
      if (!s) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Guardado no encontrado.', requestId: request.id } });
      if (s.metadataVersion !== body.expectedSaveVersion) return reply.code(409).send({ error: { code: 'VERSION_CONFLICT', message: 'Versión de metadatos obsoleta.', requestId: request.id } });
      if (s.status !== 'active') return reply.code(400).send({ error: { code: 'SAVE_NOT_ACTIVE', message: 'El guardado no está activo.', requestId: request.id } });

      const ownerId = run.ownerId;
      await database.orm.update(manualSaves)
        .set({ status: 'deleted', updatedAt: new Date() })
        .where(and(eq(manualSaves.id, request.params.saveId), eq(manualSaves.runId, request.params.runId)));

      await database.orm.insert(operationRecords).values({
        runId: request.params.runId,
        ownerId,
        idempotencyKey: body.idempotencyKey,
        kind: 'save',
        requestDigest: createHash('sha256').update(JSON.stringify({ delete: true })).digest('hex'),
        resultPublic: { saveId: request.params.saveId, action: 'delete' },
        branchId: run.branchId,
        revision: run.revision,
      });

      return reply.code(204).send();
    }
  );

  // POST /api/v1/runs/:runId/saves/:saveId/load - Load save (nueva rama, revisión+1)
  app.post<{ Params: { runId: string; saveId: string }; Body: { expectedVersion: number; idempotencyKey: string } }>(
    '/api/v1/runs/:runId/saves/:saveId/load',
    { onRequest: authorize },
    async (request, reply) => {
      const body = loadBody(request.body);
      const result = await available(() =>
        commitLoad(database, digest(request), request.params.runId, request.params.saveId, body, requestLanguage(request)));
      return reply.send(result);
    }
  );
}
