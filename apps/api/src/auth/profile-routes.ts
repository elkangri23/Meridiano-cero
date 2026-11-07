import { isDetectiveAvatar, type DetectiveAvatar, type DetectiveProfileDto } from '@meridiano/contracts';
import { cookieToken, matches } from './session-security.ts';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { AppConfig } from '../config.ts';
import type { Database } from '../database/connection.ts';
import { detectiveProfiles } from '../database/schema.ts';
import { createSessionStore } from './store.ts';
import { eq } from 'drizzle-orm';

function deny(reply: FastifyReply, request: FastifyRequest, status: number, code: string) {
  return reply.code(status).send({ error: { code, message: 'Solicitud no autorizada o servicio no disponible.', requestId: request.id } });
}

/** Perfil de detective (§13): alias y avatar pixel art por jugador.
 * La fila se crea al primer guardado (upsert); hasta entonces GET devuelve
 * el avatar por defecto y sin alias. Al crear la fila sin alias explícito
 * se hereda el displayName de la cuenta (la columna no admite null).
 * El alias es el nombre que se enseña donde hoy sale el nombre del
 * detective; el avatar es una elección cerrada (sin subida de imágenes).
 * PATCH exige sesión + Origin + CSRF, como el resto de escrituras de la
 * cuenta. */
export function registerDetectiveProfile(app: FastifyInstance, config: AppConfig, database: Database): void {
  const store = createSessionStore(database);
  const attempts = new Map<string, { count: number; expires: number }>();

  app.get('/api/v1/profile/detective', async (request, reply) => {
    try {
      const session = await store.find(cookieToken(request.headers.cookie));
      if (!session) return deny(reply, request, 401, 'SESSION_REQUIRED');
      const found = await database.orm.select({
        alias: detectiveProfiles.alias,
        avatar: detectiveProfiles.avatar,
      }).from(detectiveProfiles).where(eq(detectiveProfiles.userId, session.profile.id));
      const row = found[0];
      const dto: DetectiveProfileDto = {
        alias: row?.alias ?? null,
        avatar: row && isDetectiveAvatar(row.avatar) ? row.avatar : 'detective',
        displayName: session.profile.displayName,
      };
      return dto;
    } catch { return deny(reply, request, 503, 'DEPENDENCY_UNAVAILABLE'); }
  });

  app.patch('/api/v1/profile/detective', {
    schema: {
      body: {
        type: 'object',
        properties: {
          alias: { type: 'string', minLength: 1, maxLength: 160 },
          avatar: { type: 'string', enum: ['detective', 'archivista', 'forense', 'inspector', 'rastreador'] },
        },
        additionalProperties: false,
        minProperties: 1,
      },
    },
    onRequest: async (request, reply) => {
      if (request.headers.origin !== config.origin) return deny(reply, request, 403, 'ORIGIN_REJECTED');
      const now = Date.now();
      for (const [key, entry] of attempts) if (entry.expires <= now) attempts.delete(key);
      const current = attempts.get(request.ip) ?? { count: 0, expires: now + 60000 };
      if (++current.count > 30 || attempts.size >= 1000) {
        reply.header('Retry-After', '60');
        return deny(reply, request, 429, 'RATE_LIMITED');
      }
      attempts.set(request.ip, current);
    },
    preValidation: async (request, reply) => {
      if (request.headers['content-type']?.split(';')[0]?.trim() !== 'application/json') return deny(reply, request, 415, 'UNSUPPORTED_MEDIA_TYPE');
    },
  }, async (request, reply) => {
    try {
      const session = await store.find(cookieToken(request.headers.cookie));
      if (!session) return deny(reply, request, 401, 'SESSION_REQUIRED');
      if (!matches(request.headers['x-csrf-token'], session.csrfToken)) return deny(reply, request, 403, 'CSRF_REJECTED');
      const body = request.body as { alias?: unknown; avatar?: unknown };
      const updates: { alias?: string; avatar?: DetectiveAvatar } = {};
      if (body.alias !== undefined) {
        if (typeof body.alias !== 'string' || body.alias.trim().length === 0 || body.alias.length > 160) {
          return deny(reply, request, 400, 'INVALID_REQUEST');
        }
        updates.alias = body.alias.trim();
      }
      if (body.avatar !== undefined) {
        if (!isDetectiveAvatar(body.avatar)) return deny(reply, request, 400, 'INVALID_REQUEST');
        updates.avatar = body.avatar;
      }
      await database.orm.insert(detectiveProfiles).values({
        userId: session.profile.id,
        alias: updates.alias ?? session.profile.displayName,
        avatar: updates.avatar ?? 'detective',
      }).onConflictDoUpdate({
        target: detectiveProfiles.userId,
        set: updates,
      });
      const found = await database.orm.select({
        alias: detectiveProfiles.alias,
        avatar: detectiveProfiles.avatar,
      }).from(detectiveProfiles).where(eq(detectiveProfiles.userId, session.profile.id));
      const row = found[0];
      if (!row) return deny(reply, request, 503, 'DEPENDENCY_UNAVAILABLE');
      const dto: DetectiveProfileDto = {
        alias: row.alias,
        avatar: isDetectiveAvatar(row.avatar) ? row.avatar : 'detective',
        displayName: session.profile.displayName,
      };
      return dto;
    } catch { return deny(reply, request, 503, 'DEPENDENCY_UNAVAILABLE'); }
  });
}
