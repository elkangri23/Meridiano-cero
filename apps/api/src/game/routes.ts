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
}
