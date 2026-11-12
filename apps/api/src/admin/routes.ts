import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { AppConfig } from '../config.ts';
import type { Database } from '../database/connection.ts';
import { createAdminAuthorizer } from './middleware.ts';

/**
 * Rutas de administración (Fase 1).
 *
 * Todas las rutas bajo /api/v1/admin/* están protegidas por
 * createAdminAuthorizer, que verifica sesión activa y rol admin/superadmin.
 * Los endpoints de usuarios/runs/metrics/etc. se implementarán en Fase 2+;
 * aquí devolvemos 501 con mensaje claro para evitar placeholders silenciosos.
 */
export function registerAdminRoutes(app: FastifyInstance, config: AppConfig, database: Database) {
  // Middleware global para todas las rutas admin
  app.addHook('onRequest', createAdminAuthorizer(config, database));

  // Health check - accesible para admin y superadmin
  app.get('/api/v1/admin/health', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.code(200).send({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? 'unknown',
    });
  });

  // ---- FASE 2+: endpoints con marcadores explícitos (no placeholders silenciosos)
  app.get('/api/v1/admin/users', (_request: FastifyRequest, reply: FastifyReply) => reply.code(501).send({ error: { code: 'NOT_IMPLEMENTED', message: 'Endpoint no implementado en Fase 1' } }));
  app.get('/api/v1/admin/users/:id', (_request: FastifyRequest, reply: FastifyReply) => reply.code(501).send({ error: { code: 'NOT_IMPLEMENTED', message: 'Endpoint no implementado en Fase 1' } }));
  app.patch('/api/v1/admin/users/:id', (_request: FastifyRequest, reply: FastifyReply) => reply.code(501).send({ error: { code: 'NOT_IMPLEMENTED', message: 'Endpoint no implementado en Fase 1' } }));
  app.delete('/api/v1/admin/users/:id/sessions', (_request: FastifyRequest, reply: FastifyReply) => reply.code(501).send({ error: { code: 'NOT_IMPLEMENTED', message: 'Endpoint no implementado en Fase 1' } }));

  app.get('/api/v1/admin/runs', (_request: FastifyRequest, reply: FastifyReply) => reply.code(501).send({ error: { code: 'NOT_IMPLEMENTED', message: 'Endpoint no implementado en Fase 1' } }));
  app.get('/api/v1/admin/runs/:id', (_request: FastifyRequest, reply: FastifyReply) => reply.code(501).send({ error: { code: 'NOT_IMPLEMENTED', message: 'Endpoint no implementado en Fase 1' } }));
  app.patch('/api/v1/admin/runs/:id', (_request: FastifyRequest, reply: FastifyReply) => reply.code(501).send({ error: { code: 'NOT_IMPLEMENTED', message: 'Endpoint no implementado en Fase 1' } }));

  app.get('/api/v1/admin/metrics', (_request: FastifyRequest, reply: FastifyReply) => reply.code(501).send({ error: { code: 'NOT_IMPLEMENTED', message: 'Endpoint no implementado en Fase 1' } }));
  app.get('/api/v1/admin/ai/metrics', (_request: FastifyRequest, reply: FastifyReply) => reply.code(501).send({ error: { code: 'NOT_IMPLEMENTED', message: 'Endpoint no implementado en Fase 1' } }));
  app.get('/api/v1/admin/ai/quotas', (_request: FastifyRequest, reply: FastifyReply) => reply.code(501).send({ error: { code: 'NOT_IMPLEMENTED', message: 'Endpoint no implementado en Fase 1' } }));
  app.patch('/api/v1/admin/ai/quotas/:id', (_request: FastifyRequest, reply: FastifyReply) => reply.code(501).send({ error: { code: 'NOT_IMPLEMENTED', message: 'Endpoint no implementado en Fase 1' } }));

  app.get('/api/v1/admin/audit', (_request: FastifyRequest, reply: FastifyReply) => reply.code(501).send({ error: { code: 'NOT_IMPLEMENTED', message: 'Endpoint no implementado en Fase 1' } }));
}