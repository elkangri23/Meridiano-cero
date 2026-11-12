import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AppConfig } from '../config.ts';
import type { Database } from '../database/connection.ts';
import { createAuthorizer } from '../ai/authorize.ts';
import { RunStoreError } from '../game/runs.ts';
import { and, eq, inArray } from 'drizzle-orm';
import { profiles } from '../database/schema.ts';

/**
 * Middleware de autorización para endpoints de administración.
 * Usa el mismo patrón createAuthorizer que las rutas de IA/juego,
 * pero verifica además que el perfil tenga rol 'admin' o 'superadmin'.
 */
export function createAdminAuthorizer(config: AppConfig, database: Database) {
  const baseAuthorizer = createAuthorizer(config, database);

  return async (request: FastifyRequest, reply: FastifyReply) => {
    // Ejecutar autorización base (sesión + origen + CSRF)
    let profileId: string;
    try {
      profileId = await baseAuthorizer(request);
    } catch (error) {
      // Re-lanzar errores de autorización base
      throw error;
    }

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
    const normalizedProfile = { ...profile, role: profile.role as 'admin' | 'superadmin' };
    (request as any).adminProfile = normalizedProfile;
    (request as any).isSuperadmin = profile.role === 'superadmin';
  };
}

/**
 * Helper para verificar superadmin en handlers que lo necesiten.
 * Lanza RunStoreError si no es superadmin.
 */
export function requireSuperadmin(_request: FastifyRequest): void {
  const isAdmin = (_request as any).isSuperadmin;
  if (!isAdmin) {
    throw new RunStoreError('FORBIDDEN');
  }
}

/**
 * Helper para obtener el perfil admin desde la request.
 */
export function getAdminProfile(request: FastifyRequest): { id: string; role: 'admin' | 'superadmin'; [key: string]: any } | null {
  return (request as any).adminProfile ?? null;
}
