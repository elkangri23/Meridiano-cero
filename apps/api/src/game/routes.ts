import { listStoredRuns } from './run-list.ts';
import { isIdempotencyKey } from '@meridiano/contracts';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AppConfig } from '../config.ts';
import type { Database } from '../database/connection.ts';
import { createSessionStore, tokenDigest } from '../auth/store.ts';
import { cookieToken, matches } from '../auth/session-security.ts';
import { caseSummary, findCase, listCases, findDefinitionById } from './catalog.ts';
import { initialPlayerView } from './initial-view.ts';
import { createStoredRun, readStoredRun, readFullRun, lookupRunCreation, RunStoreError } from './runs.ts';
import { previewAction, resolveAction, projectToPlayerView, type Action } from '@meridiano/engine';
import { eq, and, desc, sql } from 'drizzle-orm';
import { manualSaves, operationRecords, runs } from '../database/schema.ts';
import type { CaseDefinition, CaseRun, StoredRun } from '@meridiano/case-schema';
import { createHash, randomUUID } from 'node:crypto';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function createBody(value: unknown): { caseId: string; idempotencyKey: string } {
  if (!isRecord(value)) throw new RunStoreError('INVALID_REQUEST');
  const keys = Object.keys(value).sort().join(',');
  if (keys !== 'caseId,idempotencyKey') throw new RunStoreError('INVALID_REQUEST');
  const { caseId, idempotencyKey } = value;
  if (typeof caseId !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(caseId) ||
      !isIdempotencyKey(idempotencyKey)) throw new RunStoreError('INVALID_REQUEST');
  return { caseId, idempotencyKey };
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

function saveBody(value: unknown): { name: string; expectedVersion: number; idempotencyKey: string; replaceSaveId?: string } {
  if (!isRecord(value)) throw new RunStoreError('INVALID_REQUEST');
  const name = value.name;
  const expectedVersion = value.expectedVersion;
  const idempotencyKey = value.idempotencyKey;
  const replaceSaveId = value.replaceSaveId;
  if (typeof name !== 'string' || name.trim().length === 0 || name.length > 80) throw new RunStoreError('INVALID_REQUEST');
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1) throw new RunStoreError('INVALID_REQUEST');
  if (!isIdempotencyKey(idempotencyKey)) throw new RunStoreError('INVALID_REQUEST');
  if (replaceSaveId !== undefined && (typeof replaceSaveId !== 'string' || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(replaceSaveId))) {
    throw new RunStoreError('INVALID_REQUEST');
  }
  return { name: name.trim(), expectedVersion, idempotencyKey, replaceSaveId };
}

function loadBody(value: unknown): { expectedVersion: number; idempotencyKey: string } {
  if (!isRecord(value)) throw new RunStoreError('INVALID_REQUEST');
  const expectedVersion = value.expectedVersion;
  const idempotencyKey = value.idempotencyKey;
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1) throw new RunStoreError('INVALID_REQUEST');
  if (!isIdempotencyKey(idempotencyKey)) throw new RunStoreError('INVALID_REQUEST');
  return { expectedVersion, idempotencyKey };
}

function patchBody(value: unknown): { name: string; expectedSaveVersion: number; idempotencyKey: string } {
  if (!isRecord(value)) throw new RunStoreError('INVALID_REQUEST');
  const name = value.name;
  const expectedSaveVersion = value.expectedSaveVersion;
  const idempotencyKey = value.idempotencyKey;
  if (typeof name !== 'string' || name.trim().length === 0 || name.length > 80) throw new RunStoreError('INVALID_REQUEST');
  if (!Number.isSafeInteger(expectedSaveVersion) || expectedSaveVersion < 1) throw new RunStoreError('INVALID_REQUEST');
  if (!isIdempotencyKey(idempotencyKey)) throw new RunStoreError('INVALID_REQUEST');
  return { name: name.trim(), expectedSaveVersion, idempotencyKey };
}

function deleteBody(value: unknown): { expectedSaveVersion: number; idempotencyKey: string } {
  if (!isRecord(value)) throw new RunStoreError('INVALID_REQUEST');
  const expectedSaveVersion = value.expectedSaveVersion;
  const idempotencyKey = value.idempotencyKey;
  if (!Number.isSafeInteger(expectedSaveVersion) || expectedSaveVersion < 1) throw new RunStoreError('INVALID_REQUEST');
  if (!isIdempotencyKey(idempotencyKey)) throw new RunStoreError('INVALID_REQUEST');
  return { expectedSaveVersion, idempotencyKey };
}

export function registerGameRoutes(app: FastifyInstance, config: AppConfig, database: Database, ready: () => Promise<boolean>): void {
  const store = createSessionStore(database);
  async function authorize(request: FastifyRequest): Promise<void> {
    if (!await ready()) throw new RunStoreError('DEPENDENCY_UNAVAILABLE');
    const session = await available(() => store.find(cookieToken(request.headers.cookie)));
    if (!session) throw new RunStoreError('SESSION_REQUIRED');
    if (request.method === 'POST') {
      if (request.headers.origin !== config.origin) throw new RunStoreError('ORIGIN_REJECTED');
      if (!matches(request.headers['x-csrf-token'], session.csrfToken)) throw new RunStoreError('CSRF_REJECTED');
    }
  }
  function digest(request: FastifyRequest): string {
    const token = cookieToken(request.headers.cookie);
    if (!token) throw new RunStoreError('SESSION_REQUIRED');
    return tokenDigest(token);
  }
  app.get<{ Querystring: Record<string, unknown> }>('/api/v1/cases', { onRequest: authorize }, async request => {
    const { limit, cursor, ...extra } = request.query;
    if (Object.keys(extra).length || cursor !== undefined ||
        (limit !== undefined && (typeof limit !== 'string' || !/^(?:[1-9][0-9]?|100)$/.test(limit)))) {
      throw new RunStoreError('INVALID_REQUEST');
    }
    // Un caso en el catálogo actual: no hay segunda página ni cursores emitidos.
    return { items: listCases(), nextCursor: null };
  });
  app.get<{ Params: { caseId: string } }>('/api/v1/cases/:caseId', { onRequest: authorize }, async request => caseSummary(request.params.caseId));
  app.get<{ Querystring: Record<string, unknown> }>('/api/v1/runs', { onRequest: authorize }, request =>
    available(() => listStoredRuns(database, digest(request), request.query)));
  app.post('/api/v1/runs', { onRequest: authorize }, async (request, reply) => {
    const body = createBody(request.body);
    const definition = findCase(body.caseId);
    const result = await available(() => createStoredRun(database, digest(request), definition, body.idempotencyKey, expectedProfile(request)));
    return reply.code(result.replayed ? 200 : 201).send({ ...initialPlayerView(result.run), replayed: result.replayed });
  });
  app.post<{ Querystring: Record<string, unknown> }>('/api/v1/run-creations/lookup', { onRequest: authorize }, async request => {
    if (Object.keys(request.query).length) throw new RunStoreError('INVALID_REQUEST');
    const key = lookupBody(request.body);
    return available(() => lookupRunCreation(database, digest(request), key, expectedProfile(request)));
  });
  app.get<{ Params: { runId: string } }>('/api/v1/runs/:runId', { onRequest: authorize }, async request => {
    const run = await available(() => readStoredRun(database, digest(request), request.params.runId));
    return initialPlayerView(run);
  });

  // POST /api/v1/runs/:runId/action - Preview or confirm action
  app.post<{ Params: { runId: string }; Body: { action: Action; confirm?: boolean } }>(
    '/api/v1/runs/:runId/action',
    { onRequest: authorize },
    async (request, reply) => {
      const run = await available(() => readFullRun(database, digest(request), request.params.runId));
      if (run.status === 'closed') return reply.code(409).send({ error: { code: 'RUN_CLOSED', message: 'La partida ya está cerrada.', requestId: request.id } });

      const { action, confirm } = request.body as { action: Action; confirm?: boolean };
      if (!action || typeof action.type !== 'string') {
        return reply.code(400).send({ error: { code: 'INVALID_ACTION', message: 'Acción requerida con tipo.', requestId: request.id } });
      }

      const definition = findDefinitionById(run.definitionId);
      const result = confirm === false ? previewAction(definition, run, action) : resolveAction(definition, run, action);

      // Si es preview, no actualiza el run almacenado
      if (confirm === false) {
        if (result.status === 'confirmation_required' && result.preview) {
          return reply.send({ ...projectToPlayerView(definition, result.run), preview: result.preview, events: result.events });
        }
        return reply.send({ ...projectToPlayerView(definition, result.run), events: result.events });
      }

      // Confirmar: actualizar run en base de datos
      // Nota: La implementación real debería persistir result.run
      // Por ahora devolvemos el resultado
      if (result.status === 'case_closed' && result.report) {
        return reply.send({ ...projectToPlayerView(definition, result.run), events: result.events, report: result.report });
      }
      return reply.send({ ...projectToPlayerView(definition, result.run), events: result.events });
    }
  );

  // GET /api/v1/runs/:runId/saves - List manual saves
  app.get<{ Params: { runId: string }; Querystring: { limit?: string; cursor?: string } }>(
    '/api/v1/runs/:runId/saves',
    { onRequest: authorize },
    async (request, reply) => {
      const run = await available(() => readStoredRun(database, digest(request), request.params.runId));
      if (run.status === 'closed') return reply.code(409).send({ error: { code: 'RUN_CLOSED', message: 'La partida ya está cerrada.', requestId: request.id } });

      const { limit = '25', cursor } = request.query;
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
      }).from(manualSaves)
        .where(and(eq(manualSaves.runId, request.params.runId), eq(manualSaves.status, 'active')))
        .orderBy(desc(manualSaves.createdAt))
        .limit(limitNum + 1);

      const items = saves.slice(0, limitNum).map(s => ({
        saveId: s.id,
        runId: request.params.runId,
        name: s.name,
        createdAt: s.createdAt.toISOString(),
        sourceRevision: s.sourceRevision,
        cityName: 'Madrid',
        minute: s.minute,
        status: s.status,
        metadataVersion: s.metadataVersion,
        canLoad: s.status === 'active',
      }));

      const nextCursor = saves.length > limitNum ? saves[limitNum].id : null;
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
      const ownerIdResult = await database.orm.select({ ownerId: runs.ownerId }).from(runs).where(eq(runs.id, request.params.runId)).limit(1);
      const ownerId = ownerIdResult[0]?.ownerId;
      if (!ownerId) throw new RunStoreError('NOT_FOUND');

      const existingByName = await database.orm.select({ id: manualSaves.id }).from(manualSaves)
        .where(and(eq(manualSaves.runId, request.params.runId), eq(manualSaves.name, body.name), eq(manualSaves.status, 'active'))).limit(1);

      const activeCount = await database.orm.select({ count: sql`count(*)` }).from(manualSaves)
        .where(and(eq(manualSaves.runId, request.params.runId), eq(manualSaves.status, 'active')));
      const activeCountNum = Number(activeCount[0]?.count ?? 0);

      const runFull = await available(() => readFullRun(database, digest(request), request.params.runId));
      const snapshot = runFull;
      const snapshotHash = computeSnapshotHash(snapshot);

      return database.orm.transaction(async (tx) => {
        if (body.replaceSaveId) {
          const replaced = await tx.update(manualSaves)
            .set({
              name: body.name,
              sourceRevision: runFull.revision,
              sourceBranchId: runFull.branchId,
              minute: runFull.minute,
              snapshot: runFull,
              snapshotHash,
              engineVersion: runFull.engineVersion,
              metadataVersion: sql`${manualSaves.metadataVersion} + 1`,
              updatedAt: new Date(),
              status: 'active',
            })
            .where(and(eq(manualSaves.id, body.replaceSaveId), eq(manualSaves.runId, request.params.runId)))
            .returning({ id: manualSaves.id });
          if (!replaced.length) throw new RunStoreError('NOT_FOUND');

          await tx.insert(operationRecords).values({
            runId: request.params.runId,
            ownerId: ownerId!,
            idempotencyKey: body.idempotencyKey,
            kind: 'save',
            requestDigest: createHash('sha256').update(JSON.stringify({ replace: body.replaceSaveId })).digest('hex'),
            resultPublic: { saveId: body.replaceSaveId, action: 'replace' },
            branchId: runFull.branchId,
            revision: runFull.revision,
          });

          return reply.code(200).send({ ...replaced[0], replayed: true });
        }

        if (activeCountNum >= 10 && !body.replaceSaveId) {
          throw new RunStoreError('SAVE_LIMIT_REACHED');
        }

        if (existingByName.length > 0) {
          throw new RunStoreError('INVALID_REQUEST');
        }

        const id = randomUUID();
        await tx.insert(manualSaves).values({
          id,
          runId: request.params.runId,
          ownerId: ownerId!,
          schemaVersion: 1,
          name: body.name,
          sourceRevision: runFull.revision,
          sourceBranchId: runFull.branchId,
          minute: runFull.minute,
          status: 'active',
          snapshot: runFull,
          snapshotHash,
          engineVersion: runFull.engineVersion,
          metadataVersion: 1,
        });

        await tx.insert(operationRecords).values({
          runId: request.params.runId,
          ownerId: ownerId!,
          idempotencyKey: body.idempotencyKey,
          kind: 'save',
          requestDigest: createHash('sha256').update(JSON.stringify({ create: body.name })).digest('hex'),
          resultPublic: { saveId: id },
          branchId: runFull.branchId,
          revision: runFull.revision,
        });

        return reply.code(201).send({ saveId: id, name: body.name, createdAt: new Date().toISOString(), sourceRevision: runFull.revision, metadataVersion: 1 });
      });
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
      if (!save.length) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Guardado no encontrado.', requestId: request.id } });
      const s = save[0];
      if (s.metadataVersion !== body.expectedSaveVersion) return reply.code(409).send({ error: { code: 'VERSION_CONFLICT', message: 'Versión de metadatos obsoleta.', requestId: request.id } });
      if (s.status !== 'active') return reply.code(400).send({ error: { code: 'SAVE_NOT_ACTIVE', message: 'El guardado no está activo.', requestId: request.id } });

      const ownerId = run.ownerId;
      const [updated] = await database.orm.update(manualSaves)
        .set({ name: body.name, metadataVersion: s.metadataVersion + 1, updatedAt: new Date() })
        .where(and(eq(manualSaves.id, request.params.saveId), eq(manualSaves.runId, request.params.runId)))
        .returning({ id: manualSaves.id, name: manualSaves.name, metadataVersion: manualSaves.metadataVersion, updatedAt: manualSaves.updatedAt });

      await database.orm.insert(operationRecords).values({
        runId: request.params.runId,
        ownerId,
        idempotencyKey: body.idempotencyKey,
        kind: 'save',
        requestDigest: createHash('sha256').update(JSON.stringify({ patch: body.name })).digest('hex'),
        resultPublic: { saveId: updated[0].id, action: 'patch' },
        branchId: run.branchId,
        revision: run.revision,
      });

      return reply.send({ saveId: updated[0].id, name: updated[0].name, metadataVersion: updated[0].metadataVersion });
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
      if (!save.length) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Guardado no encontrado.', requestId: request.id } });
      const s = save[0];
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

  // POST /api/v1/runs/:runId/saves/:saveId/load - Load save
  app.post<{ Params: { runId: string; saveId: string }; Body: { expectedVersion: number; idempotencyKey: string } }>(
    '/api/v1/runs/:runId/saves/:saveId/load',
    { onRequest: authorize },
    async (request, reply) => {
      const body = loadBody(request.body);
      const run = await available(() => readFullRun(database, digest(request), request.params.runId));
      if (run.status === 'closed') return reply.code(409).send({ error: { code: 'RUN_CLOSED', message: 'La partida ya está cerrada.', requestId: request.id } });

      const save = await database.orm.select().from(manualSaves)
        .where(and(eq(manualSaves.id, request.params.saveId), eq(manualSaves.runId, request.params.runId))).limit(1);
      if (!save.length) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Guardado no encontrado.', requestId: request.id } });
      const s = save[0];
      if (s.metadataVersion !== body.expectedVersion) return reply.code(409).send({ error: { code: 'VERSION_CONFLICT', message: 'Versión de metadatos obsoleta.', requestId: request.id } });
      if (s.status !== 'active') return reply.code(400).send({ error: { code: 'SAVE_NOT_ACTIVE', message: 'El guardado no está activo.', requestId: request.id } });

      const savedSnapshot = s.snapshot as CaseRun;
      if (savedSnapshot.engineVersion !== run.engineVersion || savedSnapshot.definitionHash !== run.definitionHash) {
        return reply.code(422).send({ error: { code: 'SAVE_INCOMPATIBLE', message: 'El guardado no es compatible con la partida actual.', requestId: request.id } });
      }

      const newBranchId = randomUUID();
      const newRun = { ...savedSnapshot, branchId: newBranchId, revision: run.revision + 1 };

      const view = projectToPlayerView(run.definitionId ? { id: run.definitionId } as any : { id: '' }, newRun);

      await database.orm.insert(operationRecords).values({
        runId: request.params.runId,
        ownerId: run.ownerId,
        idempotencyKey: body.idempotencyKey,
        kind: 'load',
        requestDigest: createHash('sha256').update(JSON.stringify({ load: request.params.saveId })).digest('hex'),
        resultPublic: { newBranchId, sourceSaveId: s.id },
        branchId: newBranchId,
        revision: run.revision + 1,
      });

      return reply.send({ ...view, operationId: `load-${randomUUID()}`, newBranchId });
    }
  );
}
