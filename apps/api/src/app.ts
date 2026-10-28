import Fastify from 'fastify';
import { randomUUID } from 'node:crypto';
import type { HealthResponse } from '@meridiano/contracts';

export function createApp() {
  const app = Fastify({ logger: false, trustProxy: false, bodyLimit: 65536, requestIdHeader: false, genReqId: () => randomUUID() });
  app.addHook('onRequest', async (request, reply) => {
    reply.header('X-Request-Id', request.id);
    reply.header('Cache-Control', 'no-store');
  });
  app.get<{ Reply: HealthResponse }>('/api/v1/health', async () => ({ status: 'ok' }));
  app.setNotFoundHandler((request, reply) => {
    return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Recurso no disponible.', requestId: request.id } });
  });
  app.setErrorHandler((error, request, reply) => {
    const clientErrors = {
      400: { code: 'INVALID_REQUEST', message: 'Petición no válida.' },
      413: { code: 'PAYLOAD_TOO_LARGE', message: 'Petición demasiado grande.' },
      415: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Tipo de contenido no admitido.' },
    } as const;
    const code = typeof error === 'object' && error !== null && 'statusCode' in error ? error.statusCode : undefined;
    const status = code === 400 || code === 413 || code === 415 ? code : 500;
    const body = status === 500 ? { code: 'INTERNAL_ERROR', message: 'Error interno.' } : clientErrors[status];
    return reply.code(status).send({ error: { ...body, requestId: request.id } });
  });
  return app;
}
