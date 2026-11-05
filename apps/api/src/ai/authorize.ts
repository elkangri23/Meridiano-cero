// Autorización compartida de las rutas de IA: sesión por cookie y, en las
// escrituras, origen exacto + CSRF. Idéntica a la que ya usaban las rutas
// de juego/IA; extraída para no duplicarla en las rutas de conexiones.

import type { FastifyRequest } from 'fastify';
import type { AppConfig } from '../config.ts';
import type { Database } from '../database/connection.ts';
import { createSessionStore } from '../auth/store.ts';
import { cookieToken, matches } from '../auth/session-security.ts';
import { RunStoreError } from '../game/runs.ts';

export function createAuthorizer(config: AppConfig, database: Database) {
  const store = createSessionStore(database);
  return async function authorize(request: FastifyRequest): Promise<string> {
    const session = await store.find(cookieToken(request.headers.cookie));
    if (!session) throw new RunStoreError('SESSION_REQUIRED');
    if (request.method === 'POST' || request.method === 'PATCH' || request.method === 'DELETE') {
      if (request.headers.origin !== config.origin) throw new RunStoreError('ORIGIN_REJECTED');
      if (!matches(request.headers['x-csrf-token'], session.csrfToken)) throw new RunStoreError('CSRF_REJECTED');
    }
    return session.profile.id;
  };
}
