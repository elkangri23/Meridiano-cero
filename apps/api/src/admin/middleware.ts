import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AppConfig } from '../config.ts';
import type { Database } from '../database/connection.ts';
import { createAuthorizer } from '../ai/authorize.ts';
import { RunStoreError } from '../game/runs.ts';
import { and, eq, inArray, type InferSelectModel } from 'drizzle-orm';
import { profiles } from '../database/schema.ts';

/** Perfil con rol de administración, tal como lo deja el autorizador. */
export type AdminProfile = Omit<InferSelectModel<typeof profiles>, 'role'> & { role: 'admin' | 'superadmin' };

declare module 'fastify' {
  interface FastifyRequest {
    adminProfile?: AdminProfile;
    isSuperadmin?: boolean;
  }
}

/**
 * Middleware de autorización para endpoints de administración.
 * Usa el mismo patrón createAuthorizer que las rutas de IA/juego,
 * pero verifica además que el perfil tenga rol 'admin' o 'superadmin'.
 */
export function createAdminAuthorizer(config: AppConfig, database: Database) {
  const baseAuthorizer = createAuthorizer(config, database);

  return async (request: FastifyRequest, reply: FastifyReply) => {
    // El hook se registra en la app raíz y Fastify lo ejecuta en TODAS las
    // peticiones, incluidas las públicas (/health, /ready, /auth/*, juego).
    // Solo actúa sobre las rutas de administración; el resto pasa sin tocarlo.
    if (!request.url.startsWith('/api/v1/admin/') && request.url !== '/api/v1/admin') return;

    // Ejecutar autorización base (sesión + origen + CSRF)
    const profileId = await baseAuthorizer(request);

    // Verificar rol admin/superadmin en profiles
    const rows = await database.orm.select()
      .from(profiles)
      .where(
        and(
          eq(profiles.id, profileId),
          inArray(profiles.role, ['admin' as const, 'superadmin' as const])
        )
      );

    const profile = rows[0];

    if (!profile) {
      return reply.code(403).send({
        error: {
          code: 'FORBIDDEN',
          message: 'Acceso denegado: se requiere rol admin o superadmin',
          requestId: request.id,
        },
      });
    }

    // Adjuntar perfil a request para uso en handlers
    const normalizedProfile: AdminProfile = { ...profile, role: profile.role as 'admin' | 'superadmin' };
    request.adminProfile = normalizedProfile;
    request.isSuperadmin = profile.role === 'superadmin';
  };
}

/**
 * Helper para verificar superadmin en handlers que lo necesiten.
 * Lanza RunStoreError si no es superadmin.
 */
export function requireSuperadmin(request: FastifyRequest): void {
  const isAdmin = request.isSuperadmin;
  if (!isAdmin) {
    throw new RunStoreError('FORBIDDEN');
  }
}

/**
 * Helper para obtener el perfil admin desde la request.
 */
export function getAdminProfile(request: FastifyRequest): AdminProfile | null {
  return request.adminProfile ?? null;
}
