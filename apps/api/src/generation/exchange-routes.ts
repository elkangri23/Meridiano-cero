// Rutas de intercambio de expedientes (T4-05 expuesto): descargar el
// expediente propio y importar un fichero. La descarga es explícita y solo
// del dueño autorizado (DEC-011): nunca se sirve el expediente completo en
// la proyección normal de juego. La importación valida antes de registrar.
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { serializeExport, MAX_IMPORT_SIZE_BYTES } from '@meridiano/generator';
import type { AppConfig } from '../config.ts';
import type { Database } from '../database/connection.ts';
import { createSessionStore } from '../auth/store.ts';
import { cookieToken, matches } from '../auth/session-security.ts';
import { RunStoreError } from '../game/runs.ts';
import { exportCase, importCase } from './exchange.ts';

export function registerCaseExchangeRoutes(app: FastifyInstance, config: AppConfig, database: Database, ready: () => Promise<boolean>): void {
  const store = createSessionStore(database);
  async function authorize(request: FastifyRequest): Promise<{ profileId: string }> {
    if (!await ready()) throw new RunStoreError('DEPENDENCY_UNAVAILABLE');
    const session = await store.find(cookieToken(request.headers.cookie));
    if (!session) throw new RunStoreError('SESSION_REQUIRED');
    if (request.method === 'POST') {
      if (request.headers.origin !== config.origin) throw new RunStoreError('ORIGIN_REJECTED');
      if (!matches(request.headers['x-csrf-token'], session.csrfToken)) throw new RunStoreError('CSRF_REJECTED');
    }
    return { profileId: session.profile.id };
  }

  app.get<{ Params: { caseId: string } }>('/api/v1/cases/:caseId/export', { onRequest: authorize }, async (request, reply) => {
    const owner = await authorize(request);
    const exported = await exportCase(database.orm, owner.profileId, request.params.caseId);
    reply.header('Content-Disposition', `attachment; filename="meridiano-caso-${exported.caseId}.json"`);
    return reply.type('application/json').send(serializeExport(exported));
  });

  // El límite global del cuerpo es 64 KiB: la importación admite hasta
  // 2 MiB (MAX_IMPORT_SIZE_BYTES); por encima, 413 PAYLOAD_TOO_LARGE.
  app.post('/api/v1/cases/import', { onRequest: authorize, bodyLimit: MAX_IMPORT_SIZE_BYTES + 4096 }, async (request, reply) => {
    const owner = await authorize(request);
    const result = await importCase(database.orm, owner.profileId, request.body);
    return reply.code(result.alreadyExisted ? 200 : 201).send(result);
  });
}
