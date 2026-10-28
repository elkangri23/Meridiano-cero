import Fastify from 'fastify';
import { randomUUID } from 'node:crypto';
import type { HealthResponse } from '@meridiano/contracts';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './db/schema.js';
import { Pool } from 'pg';

export interface ReadyCheck { ok: boolean; detail?: string }

export function createApp(options?: { readyCheck?: () => Promise<ReadyCheck>; pool?: Pool }) {
  const db = options?.pool ? drizzle({ client: options.pool, schema }) : undefined;
  const app = Fastify({ logger: false, trustProxy: false, bodyLimit: 65536, requestIdHeader: false, genReqId: () => randomUUID() });
  app.addHook('onRequest', async (request, reply) => {
    reply.header('X-Request-Id', request.id);
    reply.header('Cache-Control', 'no-store');
  });
  app.get<{ Reply: HealthResponse }>('/api/v1/health', async () => ({ status: 'ok' }));
  app.get('/api/v1/ready', async (_request, reply) => {
    if (options?.readyCheck) {
      const result = await options.readyCheck();
      if (!result.ok) {
        return reply.code(503).send({ status: 'not_ready', detail: result.detail });
      }
    }
    return reply.send({ status: 'ready' });
  });

  app.post('/api/v1/auth/local-session', async (req, reply) => {
    if (!db) return reply.code(503).send({ error: { code: 'INTERNAL_ERROR', message: 'DB no inicializada' } });
    const { username, password } = req.body as { username: string; password: string };
    const [profiles] = await db.select().from(schema.profiles).where(schema.profiles.username.eq(username));
    if (profiles.length === 0 || !(await schema.profiles.passwordHash.equals(password))) {
      return reply.code(401).send({ error: { code: 'AUTH_ERROR', message: 'Credenciales inválidas' } });
    }
    const [profile] = profiles;
    const tokenHash = randomUUID();
    await db.insert(schema.sessions).values({
      profileId: profile.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
    });
    reply.setCookie('meridiano_session', tokenHash, {
      httpOnly: true,
      secure: options?.pool?.config?.host !== '127.0.0.1' || false,
      path: '/api/v1',
      sameSite: 'lax',
      expires: new Date(Date.now() + 8 * 60 * 60 * 1000),
    });
    return reply.send({ profile: { id: profile.id, username: profile.username }, session: { token: tokenHash } });
  });

  app.post('/api/v1/auth/logout', async (req, reply) => {
    if (!db) return reply.code(503).send({ error: { code: 'INTERNAL_ERROR', message: 'DB no inicializada' } });
    const cookie = req.cookies?.meridiano_session;
    if (!cookie) return reply.code(204).send();
    await db.delete(schema.sessions).where(schema.sessions.tokenHash.eq(cookie));
    reply.clearCookie('meridiano_session', { path: '/api/v1', httpOnly: true });
    return reply.code(204).send();
  });

  app.get('/api/v1/me', async (req, reply) => {
    if (!db) return reply.code(503).send({ error: { code: 'INTERNAL_ERROR', message: 'DB no inicializada' } });
    const cookie = req.cookies?.meridiano_session;
    if (!cookie) return reply.code(401).send({ error: { code: 'SESSION_REQUIRED', message: 'Sesión ausente' } });
    const [session] = await db.select().from(schema.sessions).where(schema.sessions.tokenHash.eq(cookie));
    if (!session || session.expiresAt < new Date()) return reply.code(401).send({ error: { code: 'SESSION_EXPIRED', message: 'Sesión caducada' } });
    const [profile] = await db.select().from(schema.profiles).where(schema.profiles.id.eq(session.profileId));
    return reply.send({ profile: { id: profile.id, username: profile.username } });
  });

  app.post('/api/v1/runs', async (req, reply) => {
    if (!db) return reply.code(503).send({ error: { code: 'INTERNAL_ERROR', message: 'DB no inicializada' } });
    const cookie = req.cookies?.meridiano_session;
    if (!cookie) return reply.code(401).send({ error: { code: 'SESSION_REQUIRED', message: 'Sesión ausente' } });
    const [session] = await db.select().from(schema.sessions).where(schema.sessions.tokenHash.eq(cookie));
    if (!session || session.expiresAt < new Date()) return reply.code(401).send({ error: { code: 'SESSION_EXPIRED', message: 'Sesión caducada' } });
    const [profile] = await db.select().from(schema.profiles).where(schema.profiles.id.eq(session.profileId));
    const run = await db.insert(schema.runs).values({
      ownerId: profile.id,
      definitionId: 'astrolabio-tres-ciudades',
      definitionHash: 'placeholder_hash',
      engineVersion: 1,
      version: 1,
      minute: 0,
      status: 'active',
      state: JSON.stringify({ discoveries: [], inventory: [], admissibility: {}, npcRelations: {}, conversationRecords: [], pendingRequests: [], warrants: [], detentions: [], recoveredObjects: [], pendingBatch: null, finalReport: null }),
    }).returning({ id: schema.runs.id });
    return reply.send({ runId: run[0].id });
  });

  app.get('/api/v1/runs/:runId', async (req, reply) => {
    if (!db) return reply.code(503).send({ error: { code: 'INTERNAL_ERROR', message: 'DB no inicializada' } });
    const [run] = await db.select().from(schema.runs).where(schema.runs.id.eq(req.params.runId));
    if (!run) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Run no encontrado' } });
    return reply.send({ run });
  });

  app.post('/api/v1/runs/:runId/action', async (req, reply) => {
    if (!db) return reply.code(503).send({ error: { code: 'INTERNAL_ERROR', message: 'DB no inicializada' } });
    const cookie = req.cookies?.meridiano_session;
    if (!cookie) return reply.code(401).send({ error: { code: 'SESSION_REQUIRED', message: 'Sesión ausente' } });
    const [session] = await db.select().from(schema.sessions).where(schema.sessions.tokenHash.eq(cookie));
    if (!session || session.expiresAt < new Date()) return reply.code(401).send({ error: { code: 'SESSION_EXPIRED', message: 'Sesión caducada' } });
    const [profile] = await db.select().from(schema.profiles).where(schema.profiles.id.eq(session.profileId));
    if (run.ownerId !== profile.id) return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'No autorizado' } });

    const { type, params } = req.body as { type: string; params: unknown };
    let result;
    switch (type) {
      case 'inspect': {
        const location = schema.locations.find((l) => l.id === params.targetId);
        if (!location || !location.accessible) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Location no accessible' } });
        const newDiscoveries = schema.runs.discoveries.includes(params.targetId)
          ? schema.runs.discoveries
          : [...schema.runs.discoveries, params.targetId];
        result = { status: 'applied', run: { ...schema.runs, discoveries: newDiscoveries }, events: [{ ordinal: 1, minute: schema.runs.minute, type: 'inspect', payload: { targetId: params.targetId } }] };
        break;
      case 'collect': {
        const [ev] = schema.evidence.find((e) => e.id === params.evidenceId);
        if (!ev) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Evidence no encontrada' } });
        if (schema.runs.inventory.includes(params.evidenceId)) return reply.code(400).send({ error: { code: 'ALREADY_COLLECTED', message: 'Ya recogida' } });
        const newInventory = [...schema.runs.inventory, params.evidenceId];
        const newAdmissibility = { ...schema.runs.admissibility, [params.evidenceId]: ev.admissible };
        result = { status: 'applied', run: { ...schema.runs, inventory: newInventory, admissibility: newAdmissibility }, events: [{ ordinal: 1, minute: schema.runs.minute, type: 'collect', payload: { evidenceId: params.evidenceId, type: ev.type } }] };
        break;
      case 'talk':
        const [npc] = schema.npcs.find((n) => n.id === params.npcId);
        if (!npc) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'NPC no encontrado' } });
        const newRecords = [...schema.runs.conversationRecords, `talk:${params.npcId}@${schema.runs.minute}`];
        const newRelations = { ...schema.runs.npcRelations, [params.npcId]: npc.cooperation };
        result = { status: 'applied', run: { ...schema.runs, conversationRecords: newRecords, npcRelations: newRelations }, events: [{ ordinal: 1, minute: schema.runs.minute, type: 'talk', payload: { npcId: params.npcId } }] };
        break;
      default:
        return reply.code(400).send({ error: { code: 'ACTION_NOT_SUPPORTED', message: 'Acción no soportada' } });
    }
    return reply.send(result);
  });

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