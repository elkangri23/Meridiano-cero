// Registro público, verificación de email, recuperación y datos
// personales (T7-02; reescritura real en Fase B).
//
// La versión anterior era código muerto con tres defectos graves: el hash de
// la contraseña se calculaba y se descartaba (nunca se guardaba), el token
// de recuperación vivía solo en memoria (se perdía al reiniciar) y su
// confirmación actualizaba "el primer perfil" de la base. Aquí las
// credenciales se guardan con Argon2id, los tokens de un solo uso viven en
// base de datos y cada token apunta a su perfil. El envío de correo solo
// ocurre si hay RESEND_API_KEY y MAIL_FROM (ver mailer.ts); sin ellas la
// verificación queda pendiente y se registra EMAIL_NOT_CONFIGURED, sin
// exponer nunca el token en logs ni en respuestas.

import argon2 from 'argon2';
import { cookieToken, matches } from './session-security.ts';
import type { Mailer } from './mailer.ts';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { AppConfig } from '../config.ts';
import type { Database } from '../database/connection.ts';
import { createSessionStore } from './store.ts';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { emailVerifications, profiles, recoveryTokens, sessions, runs } from '../database/schema.ts';

function deny(reply: FastifyReply, request: FastifyRequest, status: number, code: string) {
  return reply.code(status).send({ error: { code, message: 'Solicitud no autorizada o servicio no disponible.', requestId: request.id } });
}

function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function sessionCookie(config: AppConfig, token: string): string {
  const secure = config.mode === 'production' ? '; Secure' : '';
  return `meridiano_session=${token}; HttpOnly; SameSite=Lax; Path=/api/v1; Max-Age=28800${secure}`;
}

function clearSessionCookie(config: AppConfig): string {
  const secure = config.mode === 'production' ? '; Secure' : '';
  return `meridiano_session=; HttpOnly; SameSite=Lax; Path=/api/v1; Max-Age=0${secure}`;
}

function rateLimit(max: number, windowMs: number) {
  const attempts = new Map<string, { count: number; expires: number }>();
  return (request: FastifyRequest, reply: FastifyReply): boolean => {
    const now = Date.now();
    for (const [key, entry] of attempts) if (entry.expires <= now) attempts.delete(key);
    const current = attempts.get(request.ip) ?? { count: 0, expires: now + windowMs };
    if (++current.count > max || attempts.size >= 10000) {
      reply.header('Retry-After', String(Math.ceil(windowMs / 1000)));
      void deny(reply, request, 429, 'RATE_LIMITED');
      return false;
    }
    attempts.set(request.ip, current);
    return true;
  };
}

export function registerPublicAuth(app: FastifyInstance, config: AppConfig, database: Database, mailer: Mailer | null = null): void {
  const store = createSessionStore(database);
  const registerLimit = rateLimit(5, 300000);
  const loginLimit = rateLimit(10, 60000);

  async function sendVerificationEmail(email: string, token: string): Promise<void> {
    if (!mailer) {
      console.log('EMAIL_NOT_CONFIGURED');
      return;
    }
    const url = `${config.origin}/api/v1/auth/verify-email?token=${token}`;
    try {
      await mailer.sendMail(email, 'Verifica tu cuenta de Meridiano-cero',
        `Para verificar tu cuenta abre este enlace (válido 24 horas):\n${url}\n\nSi no creaste esta cuenta, ignora este mensaje.`);
    } catch {
      console.log('EMAIL_SEND_FAILED');
    }
  }

  async function sendRecoveryEmail(email: string, token: string): Promise<void> {
    if (!mailer) {
      console.log('EMAIL_NOT_CONFIGURED');
      return;
    }
    const url = `${config.origin}/api/v1/auth/recovery?token=${token}`;
    try {
      await mailer.sendMail(email, 'Recuperación de contraseña de Meridiano-cero',
        `Para elegir una contraseña nueva abre este enlace (válido 1 hora):\n${url}\n\nSi no pediste este cambio, ignora este mensaje.`);
    } catch {
      console.log('EMAIL_SEND_FAILED');
    }
  }

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
      if (!registerLimit(request, reply)) return;
    },
  }, async (request, reply) => {
    const { email, displayName, password } = request.body as { email: string; displayName: string; password: string };
    const normalizedEmail = email.toLowerCase();

    try {
      const existing = await database.orm.select({ id: profiles.id }).from(profiles).where(eq(profiles.localKey, normalizedEmail)).limit(1);
      if (existing.length > 0) return deny(reply, request, 409, 'EMAIL_ALREADY_REGISTERED');

      const passwordHash = await argon2.hash(password);
      const [createdProfile] = await database.orm.insert(profiles).values({
        localKey: normalizedEmail,
        displayName: displayName.trim(),
        role: 'player',
        passwordHash,
      }).returning({ id: profiles.id, displayName: profiles.displayName, role: profiles.role });
      if (!createdProfile) return deny(reply, request, 503, 'DEPENDENCY_UNAVAILABLE');

      const token = generateToken();
      await database.orm.insert(emailVerifications).values({
        tokenHash: hashToken(token),
        profileId: createdProfile.id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
      await sendVerificationEmail(normalizedEmail, token);

      const result = await store.createForProfile(createdProfile);
      reply.header('Set-Cookie', sessionCookie(config, result.token));
      return { profile: { id: createdProfile.id, displayName: createdProfile.displayName, emailVerified: false }, csrfToken: result.csrfToken };
    } catch {
      return deny(reply, request, 503, 'DEPENDENCY_UNAVAILABLE');
    }
  });

  // Endpoint de inicio de sesión
  app.post('/api/v1/auth/login', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', maxLength: 254 },
          password: { type: 'string', minLength: 1, maxLength: 128 },
        },
        additionalProperties: false,
      },
    },
    onRequest: async (request, reply) => {
      if (request.headers.origin !== config.origin) return deny(reply, request, 403, 'ORIGIN_REJECTED');
      if (!loginLimit(request, reply)) return;
    },
  }, async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string };
    try {
      const found = await database.orm.select().from(profiles).where(eq(profiles.localKey, email.toLowerCase())).limit(1);
      const profile = found[0];
      // Respuesta genérica para no revelar si el email existe o si tiene contraseña.
      if (!profile?.passwordHash) return deny(reply, request, 401, 'INVALID_CREDENTIALS');
      const ok = await argon2.verify(profile.passwordHash, password).catch(() => false);
      if (!ok) return deny(reply, request, 401, 'INVALID_CREDENTIALS');
      const result = await store.createForProfile(profile, cookieToken(request.headers.cookie));
      reply.header('Set-Cookie', sessionCookie(config, result.token));
      return { profile: { id: profile.id, displayName: profile.displayName, emailVerified: profile.emailVerifiedAt !== null }, csrfToken: result.csrfToken };
    } catch {
      return deny(reply, request, 503, 'DEPENDENCY_UNAVAILABLE');
    }
  });

  // Verificación de email (POST para clientes, GET para el enlace del correo).
  async function consumeVerificationToken(token: string): Promise<{ ok: boolean; alreadyVerified?: boolean }> {
    const tokenHash = hashToken(token);
    const rows = await database.orm.select().from(emailVerifications).where(eq(emailVerifications.tokenHash, tokenHash)).limit(1);
    const row = rows[0];
    if (!row || row.usedAt || row.expiresAt < new Date()) return { ok: false };
    const updated = await database.orm.transaction(async tx => {
      const marked = await tx.update(emailVerifications).set({ usedAt: new Date() })
        .where(and(eq(emailVerifications.tokenHash, tokenHash), isNull(emailVerifications.usedAt))).returning({ profileId: emailVerifications.profileId });
      if (marked.length === 0) return false;
      const profileId = marked[0]?.profileId;
      if (!profileId) return false;
      const profileRows = await tx.select({ emailVerifiedAt: profiles.emailVerifiedAt }).from(profiles).where(eq(profiles.id, profileId)).limit(1);
      const alreadyVerified = profileRows[0]?.emailVerifiedAt !== null;
      await tx.update(profiles).set({ emailVerifiedAt: new Date() }).where(eq(profiles.id, profileId));
      return { alreadyVerified };
    });
    if (updated === false) return { ok: false };
    return { ok: true, alreadyVerified: updated.alreadyVerified };
  }
  app.post('/api/v1/auth/verify-email', {
    schema: {
      body: { type: 'object', required: ['token'], properties: { token: { type: 'string', minLength: 1 } }, additionalProperties: false },
    },
    onRequest: async (request, reply) => {
      if (request.headers.origin !== config.origin) return deny(reply, request, 403, 'ORIGIN_REJECTED');
    },
  }, async (request, reply) => {
    const { token } = request.body as { token: string };
    try {
      const result = await consumeVerificationToken(token);
      if (!result.ok) return deny(reply, request, 400, 'INVALID_VERIFICATION_TOKEN');
      return { verified: true };
    } catch {
      return deny(reply, request, 503, 'DEPENDENCY_UNAVAILABLE');
    }
  });
  app.get('/api/v1/auth/verify-email', async (request, reply) => {
    const token = (request.query as { token?: unknown }).token;
    if (typeof token !== 'string' || !token) return deny(reply, request, 400, 'INVALID_VERIFICATION_TOKEN');
    try {
      const result = await consumeVerificationToken(token);
      if (!result.ok) return deny(reply, request, 400, 'INVALID_VERIFICATION_TOKEN');
      return reply.code(302).header('Location', `${config.origin}/?verified=1`).send();
    } catch {
      return deny(reply, request, 503, 'DEPENDENCY_UNAVAILABLE');
    }
  });

  // Reenvío del correo de verificación (requiere sesión).
  app.post('/api/v1/auth/verify-email/resend', {
    schema: { body: { type: 'object', additionalProperties: false, maxProperties: 0 } },
    onRequest: async (request, reply) => {
      if (request.headers.origin !== config.origin) return deny(reply, request, 403, 'ORIGIN_REJECTED');
    },
  }, async (request, reply) => {
    if (!mailer) return deny(reply, request, 503, 'EMAIL_NOT_CONFIGURED');
    try {
      const session = await store.find(cookieToken(request.headers.cookie));
      if (!session) return deny(reply, request, 401, 'SESSION_REQUIRED');
      const profileRows = await database.orm.select().from(profiles).where(eq(profiles.id, session.profile.id)).limit(1);
      const profile = profileRows[0];
      if (!profile || profile.emailVerifiedAt) return { message: 'Si la cuenta necesita verificación, se ha enviado el correo.' };
      await database.orm.delete(emailVerifications).where(eq(emailVerifications.profileId, profile.id));
      const token = generateToken();
      await database.orm.insert(emailVerifications).values({
        tokenHash: hashToken(token),
        profileId: profile.id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
      await sendVerificationEmail(profile.localKey, token);
      return { message: 'Si la cuenta necesita verificación, se ha enviado el correo.' };
    } catch {
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
    try {
      const profileRows = await database.orm.select().from(profiles).where(eq(profiles.localKey, email.toLowerCase())).limit(1);
      const profile = profileRows[0];
      if (profile) {
        await database.orm.delete(recoveryTokens).where(eq(recoveryTokens.profileId, profile.id));
        const token = generateToken();
        await database.orm.insert(recoveryTokens).values({
          tokenHash: hashToken(token),
          profileId: profile.id,
          expiresAt: new Date(Date.now() + 3600000), // 1 hora
        });
        await sendRecoveryEmail(email.toLowerCase(), token);
      }
    } catch {
      // Respuesta genérica aunque falle la base de datos o el correo.
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
    const { token, newPassword } = request.body as { token: string; newPassword: string };
    try {
      const tokenHash = hashToken(token);
      const done = await database.orm.transaction(async tx => {
        const marked = await tx.update(recoveryTokens).set({ usedAt: new Date() })
          .where(and(eq(recoveryTokens.tokenHash, tokenHash), isNull(recoveryTokens.usedAt))).returning({ profileId: recoveryTokens.profileId });
        const row = marked[0];
        if (!row) return false;
        const profileRows = await tx.select().from(profiles).where(eq(profiles.id, row.profileId)).limit(1);
        const profile = profileRows[0];
        // El token llegó al correo registrado: eso ya acredita el buzón, con
        // la cuenta verificada o sin ella.
        if (!profile) return false;
        const passwordHash = await argon2.hash(newPassword);
        await tx.update(profiles).set({ passwordHash }).where(eq(profiles.id, profile.id));
        // Revocar todas las sesiones existentes
        await tx.delete(sessions).where(eq(sessions.profileId, profile.id));
        return true;
      });
      if (!done) return deny(reply, request, 400, 'INVALID_RECOVERY_TOKEN');
      return { message: 'Contraseña actualizada. Inicie sesión con la nueva contraseña.' };
    } catch {
      return deny(reply, request, 503, 'DEPENDENCY_UNAVAILABLE');
    }
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
      profile: { id: profile?.id ?? "", displayName: profile?.displayName ?? "", role: profile?.role ?? "player" },
      runs: userRuns.map(r => ({ id: r.id, definitionId: r.definitionId, createdAt: r.createdAt, updatedAt: r.updatedAt })),
      exportedAt: new Date().toISOString(),
    };

    reply.header('Content-Type', 'application/json');
    reply.header('Content-Disposition', `attachment; filename="meridiano-export-${profile?.id ?? ""}.json"`);
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

    const profileRows = await database.orm.select().from(profiles).where(eq(profiles.id, session.profile.id)).limit(1);
    const profile = profileRows[0];
    if (!profile || !profile.passwordHash) return deny(reply, request, 404, 'PROFILE_NOT_FOUND');
    const ok = await argon2.verify(profile.passwordHash, password).catch(() => false);
    if (!ok) return deny(reply, request, 403, 'INVALID_PASSWORD');

    // Borrado: se revocan las sesiones y se anonimiza el perfil (correo,
    // nombre y credencial desaparecen). La fila se conserva porque las
    // partidas referencian al perfil y la app nunca borra partidas
    // (migraciones 0003/0004: sin DELETE sobre runs); los tokens se borran.
    const deletedKey = `deleted:${randomUUID()}`;
    await database.orm.transaction(async tx => {
      await tx.delete(sessions).where(eq(sessions.profileId, session.profile.id));
      await tx.delete(emailVerifications).where(eq(emailVerifications.profileId, session.profile.id));
      await tx.delete(recoveryTokens).where(eq(recoveryTokens.profileId, session.profile.id));
      await tx.update(profiles).set({
        localKey: deletedKey,
        displayName: 'Cuenta eliminada',
        passwordHash: null,
        emailVerifiedAt: null,
      }).where(eq(profiles.id, session.profile.id));
    });

    reply.header('Set-Cookie', clearSessionCookie(config));
    return reply.code(204).send();
  });
}
