import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { AppConfig } from '../config.ts';
import type { Database } from '../database/connection.ts';
import { createSessionStore } from './store.ts';

function cookieToken(header: string | undefined): string | undefined {
  const values = (header ?? '').split(';').map(part => part.trim()).filter(part => part.startsWith('meridiano_session='));
  const token = values.length === 1 ? values[0]?.slice('meridiano_session='.length) : undefined;
  return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : undefined;
}
function matches(provided: unknown, expected: string): boolean {
  return typeof provided === 'string' && /^[A-Za-z0-9_-]{43}$/.test(provided) && provided.length === expected.length &&
    timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}
function deny(reply: FastifyReply, request: FastifyRequest, status: number, code: string) {
  return reply.code(status).send({ error: { code, message: 'Solicitud no autorizada o servicio no disponible.', requestId: request.id } });
}
export function registerLocalAuth(app: FastifyInstance, config: AppConfig, database: Database): void {
  const store = createSessionStore(database);
  const attempts = new Map<string, { count: number; expires: number }>();
  const body = { type: 'object', additionalProperties: false, maxProperties: 0 } as const;
  if (config.localAuth) app.post('/api/v1/auth/local-session', {
    schema: { body },
    onRequest: async (request, reply) => {
      if (request.headers.origin !== config.origin) return deny(reply, request, 403, 'ORIGIN_REJECTED');
      const now = Date.now();
      for (const [key, entry] of attempts) if (entry.expires <= now) attempts.delete(key);
      const current = attempts.get(request.ip) ?? { count: 0, expires: now + 60000 };
      if (++current.count > 10 || attempts.size >= 1000) {
        reply.header('Retry-After', '60');
        return deny(reply, request, 429, 'RATE_LIMITED');
      }
      attempts.set(request.ip, current);
    },
    preValidation: async (request, reply) => {
      if (request.headers['content-type']?.split(';')[0]?.trim() !== 'application/json') return deny(reply, request, 415, 'UNSUPPORTED_MEDIA_TYPE');
      if (typeof request.body !== 'object' || request.body === null || Array.isArray(request.body) || Object.keys(request.body).length) return deny(reply, request, 400, 'INVALID_REQUEST');
    },
  }, async (request, reply) => {
    try {
      const result = await store.create(cookieToken(request.headers.cookie));
      reply.header('Set-Cookie', 'meridiano_session=' + result.token + '; HttpOnly; SameSite=Lax; Path=/api/v1; Max-Age=28800');
      return { profile: result.profile, csrfToken: result.csrfToken };
    } catch { return deny(reply, request, 503, 'DEPENDENCY_UNAVAILABLE'); }
  });
  app.get('/api/v1/me', async (request, reply) => {
    try {
      const session = await store.find(cookieToken(request.headers.cookie));
      if (!session) return deny(reply, request, 401, 'SESSION_REQUIRED');
      return session;
    } catch { return deny(reply, request, 503, 'DEPENDENCY_UNAVAILABLE'); }
  });
  app.post('/api/v1/auth/logout', async (request, reply) => {
    if (request.headers.origin !== config.origin) return deny(reply, request, 403, 'ORIGIN_REJECTED');
    try {
      const token = cookieToken(request.headers.cookie);
      const session = await store.find(token);
      if (session && !matches(request.headers['x-csrf-token'], session.csrfToken)) return deny(reply, request, 403, 'CSRF_REJECTED');
      if (token && session) await store.revoke(token);
      reply.header('Set-Cookie', 'meridiano_session=; HttpOnly; SameSite=Lax; Path=/api/v1; Max-Age=0');
      return reply.code(204).send();
    } catch { return deny(reply, request, 503, 'DEPENDENCY_UNAVAILABLE'); }
  });
}
