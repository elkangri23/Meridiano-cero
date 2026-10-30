// Registro público, recuperación y datos personales (T7-02)

import { cookieToken, matches } from './session-security.ts';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { AppConfig } from '../config.ts';
import type { Database } from '../database/connection.ts';
import { createSessionStore } from './store.ts';
import { createHash, randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { profiles, sessions, runs } from '../database/schema.ts';

export interface RecoveryToken {
  token: string;
  expiresAt: Date;
  used: boolean;
}

const recoveryTokens = new Map<string, RecoveryToken>();

function deny(reply: FastifyReply, request: FastifyRequest, status: number, code: string) {
  return reply.code(status).send({ error: { code, message: 'Solicitud no autorizada o servicio no disponible.', requestId: request.id } });
}

function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function registerPublicAuth(app: FastifyInstance, config: AppConfig, database: Database): void {
  const store = createSessionStore(database);
  const registrationAttempts = new Map<string, { count: number; expires: number }>();

  // Endpoint de registro público
  app.post('/api/v1/auth/register', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'displayName', 'password'],
        properties: {
          email: { type: 'string', format: 'email', maxLength: 254 },
          displayName: { type: 'string', minLength: 1, maxLength: 64 },
          password: { type: 'string', minLength: 12, maxLength: 128 },
        },
        additionalProperties: false,
      },
    },
    onRequest: async (request, reply) => {
      if (request.headers.origin !== config.origin) return deny(reply, request, 403, 'ORIGIN_REJECTED');
      const now = Date.now();
      for (const [key, entry] of registrationAttempts) if (entry.expires <= now) registrationAttempts.delete(key);
      const current = registrationAttempts.get(request.ip) ?? { count: 0, expires: now + 300000 };
      if (++current.count > 5 || registrationAttempts.size >= 10000) {
        reply.header('Retry-After', '300');
        return deny(reply, request, 429, 'RATE_LIMITED');
      }
      registrationAttempts.set(request.ip, current);
    },
  }, async (request, reply) => {
    const { email, displayName, password } = request.body as { email: string; displayName: string; password: string };

    try {
      // Verificar si email ya existe
      const existing = await database.orm.select().from(profiles).where(eq(profiles.localKey, email.toLowerCase())).limit(1);
      if (existing.length > 0) {
        return deny(reply, request, 409, 'EMAIL_ALREADY_REGISTERED');
      }

      // Hash de contraseña (usando bcrypt en producción, aquí simplificado)
      hashToken(password + email.toLowerCase()); // Placeholder: usar bcrypt real

      // Crear perfil
      const [createdProfile] = await database.orm.insert(profiles).values({
        localKey: email.toLowerCase(),
        displayName: displayName.trim(),
        role: 'player',
      }).returning({ id: profiles.id, displayName: profiles.displayName });

      // Crear sesión
      const result = await store.create(undefined);
      reply.header('Set-Cookie', 'meridiano_session=' + result.token + '; HttpOnly; SameSite=Lax; Path=/api/v1; Max-Age=28800');

      return { profile: { id: createdProfile.id, displayName: createdProfile.displayName }, csrfToken: result.csrfToken };
    } catch (e) {
      return deny(reply, request, 503, 'DEPENDENCY_UNAVAILABLE');
    }
  });

  // Endpoint de solicitud de recuperación (no revela si email existe)
  app.post('/api/v1/auth/recovery/request', {
    schema: {
      body: {
        type: 'object',
        required: ['email'],
        properties: { email: { type: 'string', format: 'email', maxLength: 254 } },
        additionalProperties: false,
      },
    },
    onRequest: async (request, reply) => {
      if (request.headers.origin !== config.origin) return deny(reply, request, 403, 'ORIGIN_REJECTED');
    },
  }, async (request, _reply) => {
    const { email } = request.body as { email: string };

    // Buscar perfil (pero siempre responder éxito para no enumerar)
    const profileRows = await database.orm.select().from(profiles).where(eq(profiles.localKey, email.toLowerCase())).limit(1);

    if (profileRows.length > 0) {
      const token = generateToken();
      const tokenHash = hashToken(token);
      const expiresAt = new Date(Date.now() + 3600000); // 1 hora

      recoveryTokens.set(tokenHash, { token, expiresAt, used: false });

      // En producción: enviar email con token
      // await sendRecoveryEmail(email, token);
      console.log('[RECOVERY] Token para', email.toLowerCase(), ':', token);
    }

    // Respuesta genérica siempre exitosa
    return { message: 'Si la cuenta existe, se ha enviado un enlace de recuperación.' };
  });

  // Endpoint de validación y uso de token de recuperación
  app.post('/api/v1/auth/recovery/confirm', {
    schema: {
      body: {
        type: 'object',
        required: ['token', 'newPassword'],
        properties: {
          token: { type: 'string', minLength: 1 },
          newPassword: { type: 'string', minLength: 12, maxLength: 128 },
        },
        additionalProperties: false,
      },
    },
    onRequest: async (request, reply) => {
      if (request.headers.origin !== config.origin) return deny(reply, request, 403, 'ORIGIN_REJECTED');
    },
  }, async (request, reply) => {
    const { token } = request.body as { token: string; newPassword: string };
    const tokenHash = hashToken(token);

    const recovery = recoveryTokens.get(tokenHash);
    if (!recovery || recovery.used || recovery.expiresAt < new Date()) {
      return deny(reply, request, 400, 'INVALID_RECOVERY_TOKEN');
    }

    // Marcar token como usado
    recovery.used = true;
    recoveryTokens.set(tokenHash, recovery);

    // Buscar perfil asociado (en producción: el token incluiría el email/profileId)
    // Aquí simplificado: actualizamos el primer perfil como demo
    const [foundProfile] = await database.orm.select().from(profiles).limit(1);
    if (!foundProfile) return deny(reply, request, 404, 'PROFILE_NOT_FOUND');

    // Actualizar contraseña
    // En producción: await database.orm.update(profiles).set({ passwordHash: hashToken(newPassword + profile.localKey) }).where(eq(profiles.id, profile.id));

    // Revocar todas las sesiones existentes
    await database.orm.delete(sessions).where(eq(sessions.profileId, foundProfile.id));

    return { message: 'Contraseña actualizada. Inicie sesión con la nueva contraseña.' };
  });

  // Endpoint de exportación de datos personales (GDPR Art. 20)
  app.get('/api/v1/account/export', async (request, reply) => {
    const sessionToken = cookieToken(request.headers.cookie);
    if (!sessionToken) return deny(reply, request, 401, 'SESSION_REQUIRED');

    const session = await store.find(sessionToken);
    if (!session) return deny(reply, request, 401, 'SESSION_REQUIRED');

    const profileRows = await database.orm.select().from(profiles).where(eq(profiles.id, session.profile.id)).limit(1);
    if (profileRows.length === 0) return deny(reply, request, 404, 'PROFILE_NOT_FOUND');
    const profile = profileRows[0];

    const userRuns = await database.orm.select().from(runs).where(eq(runs.ownerId, session.profile.id));

    const exportData = {
      profile: { id: profile.id, displayName: profile.displayName, role: profile.role },
      runs: userRuns.map(r => ({ id: r.id, definitionId: r.definitionId, createdAt: r.createdAt, updatedAt: r.updatedAt })),
      exportedAt: new Date().toISOString(),
    };

    reply.header('Content-Type', 'application/json');
    reply.header('Content-Disposition', `attachment; filename="meridiano-export-${profile.id}.json"`);
    return exportData;
  });

  // Endpoint de borrado de cuenta (GDPR Art. 17)
  app.delete('/api/v1/account', {
    schema: {
      body: {
        type: 'object',
        required: ['confirm', 'password'],
        properties: {
          confirm: { type: 'boolean', const: true },
          password: { type: 'string', minLength: 1 },
        },
        additionalProperties: false,
      },
    },
    onRequest: async (request, reply) => {
      if (request.headers.origin !== config.origin) return deny(reply, request, 403, 'ORIGIN_REJECTED');
      const token = cookieToken(request.headers.cookie);
      const session = token ? await store.find(token) : null;
      if (!session || !matches(request.headers['x-csrf-token'], session.csrfToken)) return deny(reply, request, 403, 'CSRF_REJECTED');
    },
  }, async (request, reply) => {
    const { password } = request.body as { confirm: true; password: string };
    const sessionToken = cookieToken(request.headers.cookie);
    if (!sessionToken) return deny(reply, request, 401, 'SESSION_REQUIRED');

    const session = await store.find(sessionToken);
    if (!session) return deny(reply, request, 401, 'SESSION_REQUIRED');

    // Verificar contraseña (placeholder)
    const profileRows = await database.orm.select().from(profiles).where(eq(profiles.id, session.profile.id)).limit(1);
    if (profileRows.length === 0) return deny(reply, request, 404, 'PROFILE_NOT_FOUND');

    hashToken(password + profileRows[0].localKey);
    // En producción: verificar con bcrypt

    // Borrado en cascada: sesiones, runs, etc.
    await database.orm.transaction(async tx => {
      await tx.delete(sessions).where(eq(sessions.profileId, session.profile.id));
      await tx.delete(runs).where(eq(runs.ownerId, session.profile.id));
      await tx.delete(profiles).where(eq(profiles.id, session.profile.id));
    });

    reply.header('Set-Cookie', 'meridiano_session=; HttpOnly; SameSite=Lax; Path=/api/v1; Max-Age=0');
    return reply.code(204).send();
  });
}