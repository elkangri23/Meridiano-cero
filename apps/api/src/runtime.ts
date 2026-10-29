import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { RuntimeState } from './lifecycle.ts';
import type { Telemetry } from './telemetry.ts';

export function registerRuntime(app: FastifyInstance, state: RuntimeState, telemetry?: Telemetry): void {
  const admitted = new WeakSet<FastifyRequest>();
  const started = new WeakMap<FastifyRequest, number>();
  let active = 0;
  function complete(request: FastifyRequest, statusCode: number) {
    if (admitted.delete(request)) active--;
    const start = started.get(request);
    if (start === undefined) return;
    started.delete(request);
    const path = request.routeOptions.url;
    const scope = path === '/api/v1/health' ? 'health' : path === '/api/v1/ready' ? 'readiness' : 'application';
    telemetry?.completed({ requestId: request.id, statusCode, durationMs: performance.now() - start, scope });
  }
  app.addHook('onRequest', async (request, reply) => {
    started.set(request, performance.now());
    if (request.url === '/api/v1/health' || request.url === '/api/v1/ready') return;
    if (state.draining || active >= 32) {
      reply.header('Retry-After', '1');
      return reply.code(503).send({ error: { code: 'DEPENDENCY_UNAVAILABLE', message: 'Servicio temporalmente no disponible.', requestId: request.id } });
    }
    active++;
    admitted.add(request);
  });
  app.addHook('onResponse', async (request, reply) => { complete(request, reply.statusCode); });
  app.addHook('onRequestAbort', async request => { complete(request, 503); });
  app.addHook('onTimeout', async request => { complete(request, 503); });
}
