import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AppConfig } from '../config.ts';
import type { Database } from '../database/connection.ts';
import { createSessionStore, tokenDigest } from '../auth/store.ts';
import { cookieToken, matches } from '../auth/session-security.ts';
import { caseSummary, findCase, listCases } from './catalog.ts';
import { initialPlayerView } from './initial-view.ts';
import { createStoredRun, readStoredRun, RunStoreError } from './runs.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function createBody(value: unknown): { caseId: string; idempotencyKey: string } {
  if (!isRecord(value)) throw new RunStoreError('INVALID_REQUEST');
  const keys = Object.keys(value).sort().join(',');
  if (keys !== 'caseId,idempotencyKey') throw new RunStoreError('INVALID_REQUEST');
  const { caseId, idempotencyKey } = value;
  if (typeof caseId !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(caseId) ||
      typeof idempotencyKey !== 'string' || !/^[A-Za-z0-9._:-]{16,128}$/.test(idempotencyKey)) throw new RunStoreError('INVALID_REQUEST');
  return { caseId, idempotencyKey };
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
  app.post('/api/v1/runs', { onRequest: authorize }, async (request, reply) => {
    const body = createBody(request.body);
    const definition = findCase(body.caseId);
    const result = await available(() => createStoredRun(database, digest(request), definition, body.idempotencyKey));
    return reply.code(result.replayed ? 200 : 201).send({ ...initialPlayerView(result.run), replayed: result.replayed });
  });
  app.get<{ Params: { runId: string } }>('/api/v1/runs/:runId', { onRequest: authorize }, async request => {
    const run = await available(() => readStoredRun(database, digest(request), request.params.runId));
    return initialPlayerView(run);
  });
}
