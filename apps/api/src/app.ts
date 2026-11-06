import { registerRuntime } from './runtime.ts';
import type { RuntimeState } from './lifecycle.ts';
import type { Telemetry } from './telemetry.ts';
import { registerGameRoutes } from './game/routes.ts';
import { registerAiRoutes } from './ai/routes.ts';
import { registerAiConnectionRoutes } from './ai/connections-routes.ts';
import { RunStoreError } from './game/runs.ts';
import type { AppConfig } from './config.ts';
import type { Database } from './database/connection.ts';
import { createReadiness } from './database/readiness.ts';
import { registerLocalAuth } from './auth/routes.ts';
import { registerPublicAuth } from './auth/public-auth.ts';
import type { Mailer } from './auth/mailer.ts';
import Fastify, { type FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import type { HealthResponse } from '@meridiano/contracts';

/** Solo INVALID_DESTINATION y VALIDATION_ERROR llevan mensaje propio (texto
 * seguro del validador); el resto usa el mensaje genérico para no filtrar
 * detalles. */
function runStoreErrorMessage(error: RunStoreError): string {
  return (error.code === 'INVALID_DESTINATION' || error.code === 'VALIDATION_ERROR') && error.detail
    ? error.detail
    : 'No se pudo completar la solicitud.';
}

export function createApp(options?: { config: AppConfig; database: Database; state?: RuntimeState; telemetry?: Telemetry; mailer?: Mailer | null }) {
  const app: FastifyInstance = Fastify({ logger: false, requestTimeout: 65_000, connectionTimeout: 65_000,
    // Plazos alineados de fuera a dentro con la IA: el proveedor admite
    // 60 s (AI_TIMEOUT_MS / timeoutMs por defecto), así que el servidor
    // debe dejarlo terminar (65 s) para que la respuesta del modelo o el
    // respaldo del director salgan; con 30 s una conversación lenta moría
    // aquí (el socket se cerraba sin respuesta y nginx devolvía 502) aunque
    // el cliente esperase más. Encima: nginx proxy_read_timeout 70 s en
    // /api/ y el cliente espera 75 s al conversar.
    // En producción la API solo escucha en 127.0.0.1 detrás de nginx: se
    // confía solo en el primer salto (nginx) para que request.ip sea la IP
    // real del cliente (los límites por IP del registro usan ese valor).
    // En desarrollo, sin proxy.
    trustProxy: options?.config.mode === 'production' ? (_address: string, hop: number) => hop === 0 : false,
    bodyLimit: 65536, requestIdHeader: false, genReqId: () => randomUUID() });
  app.addHook('onRequest', async (request, reply) => {
    reply.header('X-Request-Id', request.id);
    reply.header('Cache-Control', 'no-store');
  });
  const state = options?.state ?? { draining: false };
  registerRuntime(app, state, options?.telemetry);
  app.get<{ Reply: HealthResponse }>('/api/v1/health', async () => ({ status: 'ok' }));
  if (options) {
    const ready = createReadiness(options.database);
    app.get('/api/v1/ready', async (_request, reply) => {
      const available = !state.draining && await ready();
      return reply.code(available ? 200 : 503).send({ status: available ? 'ready' : 'not_ready' });
    });
    registerLocalAuth(app, options.config, options.database);
    // Registro público solo cuando la configuración lo activa (producción).
    // La sesión local de desarrollo no se registra en producción porque
    // config.localAuth es false allí (fail-closed en config.ts).
    if (options.config.registrationEnabled) registerPublicAuth(app, options.config, options.database, options.mailer ?? null);
    registerGameRoutes(app, options.config, options.database, ready);
    registerAiRoutes(app, options.config, options.database);
    registerAiConnectionRoutes(app, options.config, options.database);
  }
  app.setNotFoundHandler((request, reply) => {
    return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Recurso no disponible.', requestId: request.id } });
  });
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof RunStoreError) {
      const statuses = {
        SESSION_REQUIRED: 401, SESSION_CHANGED: 409, NOT_FOUND: 404, IDEMPOTENCY_CONFLICT: 409, INVALID_REQUEST: 400,
        CASE_NOT_READY: 409, DEPENDENCY_UNAVAILABLE: 503, ORIGIN_REJECTED: 403, CSRF_REJECTED: 403, SAVE_LIMIT_REACHED: 409,
        VERSION_CONFLICT: 409, RUN_CLOSED: 409, SAVE_NOT_ACTIVE: 400, SAVE_INCOMPATIBLE: 422, INVALID_DESTINATION: 400, VALIDATION_ERROR: 400,
      } as const;
      // Solo INVALID_DESTINATION y VALIDATION_ERROR llevan mensaje propio (ver runStoreErrorMessage).
      return reply.code(statuses[error.code]).send({ error: { code: error.code, message: runStoreErrorMessage(error), requestId: request.id } });
    }
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
