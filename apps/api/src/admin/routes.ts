import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { AppConfig } from '../config.ts';
import type { Database } from '../database/connection.ts';
import { createAdminAuthorizer } from './middleware.ts';
import {
  getIAMetrics,
  getRunsMetrics,
  getUsersMetrics,
  getAdminAudit,
  logAdminAction,
} from './queries.ts';
import { requireSuperadmin } from './middleware.ts';
import { eq } from 'drizzle-orm';
import { profiles, runs, sessions } from '../database/schema.ts';

interface AdminRouteParams {
  id: string;
}

/**
 * Rutas de administración (Fase 2 - Métricas reales).
 *
 * Todas las rutas bajo /api/v1/admin/* están protegidas por
 * createAdminAuthorizer, que verifica sesión activa y rol admin/superadmin.
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

  // ---- Métricas del dashboard (Fase 2 - datos reales) ----
  app.get('/api/v1/admin/users', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const rows = await getUsersMetrics(database);
      return reply.code(200).send(rows);
    } catch (error) {
      return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'Error obteniendo métricas de usuarios' } });
    }
  });

  app.get('/api/v1/admin/runs', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const rows = await getRunsMetrics(database);
      return reply.code(200).send(rows);
    } catch (error) {
      return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'Error obteniendo métricas de partidas' } });
    }
  });

  app.get('/api/v1/admin/metrics', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Métricas agregadas para el dashboard
      const [usersMetrics, runsMetrics, aiMetrics] = await Promise.all([
        getUsersMetrics(database),
        getRunsMetrics(database),
        getIAMetrics(database),
      ]);

      // Calcular totales
      const usersTotal = usersMetrics.reduce((sum, r) => sum + (r.userCount || 0), 0);
      const usersActive24h = usersMetrics.reduce((sum, r) => sum + (r.activeSessions || 0), 0);
      const runsTotal = runsMetrics.reduce((sum, r) => sum + (r.count || 0), 0);
      const runsActive = runsMetrics.find(r => r.status === 'active')?.count ?? 0;

      // Métricas de IA
      let aiTokensTotal = 0;
      let aiErrors = 0;
      let aiRequests = 0;
      for (const row of aiMetrics) {
        aiTokensTotal += row.totalTokens || 0;
        aiErrors += row.errorCount || 0;
        aiRequests += row.requestCount || 0;
      }

      const dashboardMetrics = {
        usersTotal,
        usersActive24h,
        runsTotal,
        runsActive,
        aiTokensUsed24h: aiTokensTotal,
        aiErrorRate24h: aiRequests > 0 ? Math.round((aiErrors / aiRequests) * 1000) / 10 : 0,
        byProvider: aiMetrics,
      };

      return reply.code(200).send(dashboardMetrics);
    } catch (error) {
      return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'Error obteniendo métricas' } });
    }
  });

  app.get('/api/v1/admin/ai/metrics', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const rows = await getIAMetrics(database);
      return reply.code(200).send(rows);
    } catch (error) {
      return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'Error obteniendo métricas de IA' } });
    }
  });

  app.get('/api/v1/admin/audit', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as Record<string, string | number | undefined>;
      const { startDate, endDate, action, page = 1, limit = 50 } = query;

      // Construir filtros para getAdminAudit
      const auditFilters: { startDate?: string; endDate?: string; action?: string } = {};
      if (startDate) auditFilters.startDate = startDate;
      if (endDate) auditFilters.endDate = endDate;
      if (action) auditFilters.action = action;

      // Obtener entradas de auditoría con filtros
      const rows = await getAdminAudit(database, auditFilters);

      // Aplicar paginación en memoria (para producción usaría base de datos nativo)
      const itemsPerPage = Math.min(Number(limit) || 50, 100);
      const currentPage = Math.max(1, Number(page) || 1);
      const totalItems = rows.length;
      const totalPages = Math.ceil(totalItems / itemsPerPage);
      const startIndex = (currentPage - 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
      const paginatedRows = rows.slice(startIndex, endIndex);

      // Registrar acción de auditoría
      await logAdminAction(database, {
        adminId: (request as any).adminProfile.id,
        action: 'view_audit',
        targetType: 'audit_log',
        targetId: 'list',
      });

      return reply.code(200).send({
        data: paginatedRows,
        pagination: {
          totalItems,
          totalPages,
          currentPage,
          itemsPerPage,
          hasNextPage: currentPage < totalPages,
          hasPrevPage: currentPage > 1,
        },
      });
    } catch (error) {
      return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'Error obteniendo auditoría' } });
    }
  });

  // ---- Endpoints de gestión de usuarios (Fase 2) ----
  app.get('/api/v1/admin/users/:id', async (request: FastifyRequest<{ Params: AdminRouteParams }>, reply: FastifyReply) => {
    const { id } = request.params;

    // Obtener usuario específico usando query directo
    const [user] = await database.orm.select({
      id: profiles.id,
      displayName: profiles.displayName,
      role: profiles.role,
      emailVerifiedAt: profiles.emailVerifiedAt,
      createdAt: profiles.createdAt,
    }).from(profiles).where(eq(profiles.id, id)).limit(1);

    if (!user) {
      return reply.code(404).send({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'Usuario no encontrado',
        },
      });
    }

    if (!user) {
      return reply.code(404).send({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'Usuario no encontrado',
        },
      });
    }

    // Transformar para el frontend (runs se llenarían desde otra tabla)
    const transformedUser = {
      id: user.id,
      displayName: user.displayName,
      role: user.role,
      emailVerified: !!user.emailVerifiedAt,
      createdAt: user.createdAt.toISOString(),
      runsTotal: 0,
      runsActive: 0,
      lastActiveAt: null,
      sessionCount: 0,
      activeSessions: 0,
    };

    // Registrar acción de auditoría
    await logAdminAction(database, {
      adminId: (request as any).adminProfile.id,
      action: 'view_user',
      targetType: 'user',
      targetId: id,
    });

    return reply.code(200).send(transformedUser);
  });

  app.patch('/api/v1/admin/users/:id', async (request: FastifyRequest<{ Params: AdminRouteParams }>, reply: FastifyReply) => {
    requireSuperadmin(request);

    const { id } = request.params;
    const body = request.body as any;
    const adminProfile = (request as any).adminProfile;

    // Obtener usuario actual usando query directo
    const [user] = await database.orm.select({
      id: profiles.id,
      displayName: profiles.displayName,
      role: profiles.role,
      emailVerifiedAt: profiles.emailVerifiedAt,
      createdAt: profiles.createdAt,
    }).from(profiles).where(eq(profiles.id, id)).limit(1);

    if (!user) {
      return reply.code(404).send({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'Usuario no encontrado',
        },
      });
    }

    // Verificar si hay cambios
    const updates: any = {};
    if (body.displayName !== undefined && body.displayName !== user.displayName) {
      updates.displayName = body.displayName;
    }
    if (body.role !== undefined && body.role !== user.role) {
      // Validar roles permitidos
      if (!['player', 'admin', 'superadmin'].includes(body.role)) {
        return reply.code(400).send({
          error: {
            code: 'INVALID_ROLE',
            message: 'Rol inválido. Debe ser: player, admin o superadmin',
          },
        });
      }
      updates.role = body.role;
    }
    if (body.emailVerified !== undefined && body.emailVerified !== !!user.emailVerifiedAt) {
      updates.emailVerifiedAt = body.emailVerified ? new Date() : null;
    }

    if (Object.keys(updates).length === 0) {
      return reply.code(400).send({
        error: {
          code: 'NO_CHANGES',
          message: 'No hay cambios para actualizar',
        },
      });
    }

    // Guardar cambios originales para auditoría
    const beforeState = { ...user };

    // Aplicar actualizaciones
    await database.orm.update(profiles).set(updates).where(eq(profiles.id, id));

    // Obtener usuario actualizado usando query directo
    const [updatedUser] = await database.orm.select({
      id: profiles.id,
      displayName: profiles.displayName,
      role: profiles.role,
      emailVerifiedAt: profiles.emailVerifiedAt,
      createdAt: profiles.createdAt,
    }).from(profiles).where(eq(profiles.id, id)).limit(1);

    // Registrar acción de auditoría
    await logAdminAction(database, {
      adminId: adminProfile.id,
      action: 'update_user',
      targetType: 'user',
      targetId: id,
      before: JSON.stringify(beforeState),
      after: JSON.stringify(updatedUser),
    });

    return reply.code(200).send({
      id: updatedUser.id,
      displayName: updatedUser.displayName,
      role: updatedUser.role,
      emailVerified: !!updatedUser.emailVerifiedAt,
      createdAt: updatedUser.createdAt.toISOString(),
      message: 'Usuario actualizado exitosamente',
    });
  });

  app.delete('/api/v1/admin/users/:id/sessions', async (request: FastifyRequest<{ Params: AdminRouteParams }>, reply: FastifyReply) => {
    const userId = request.params.id;
    const adminProfile = (request as any).adminProfile;

    if (!adminProfile) {
      return reply.code(401).send({
        error: {
          code: 'SESSION_REQUIRED',
          message: 'Sesión requerida',
        },
      });
    }

    // Revocar todas las sesiones activas del usuario
    const revokedSessions = await database.orm
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(sessions.profileId, userId),
          eq(sessions.revokedAt, null),
        )
      )
      .returning();

    // Registrar acción de auditoría
    await logAdminAction(database, {
      adminId: adminProfile.id,
      action: 'revoke_all_sessions',
      targetType: 'user',
      targetId: userId,
      before: { activeSessions: 0, revokedCount: revokedSessions.length },
      after: { activeSessions: 0, revokedCount: revokedSessions.length },
    });

    return reply.code(200).send({
      message: 'Todas las sesiones revocadas exitosamente',
      userId: userId,
      revokedCount: revokedSessions.length,
      remainingSessions: 0,
    });
  });

  // ---- Endpoints de gestión de partidas (Fase 2) ----
  app.get('/api/v1/admin/runs/:id', async (request: FastifyRequest<{ Params: AdminRouteParams }>, reply: FastifyReply) => {
    const { id } = request.params;

    // Obtener partida específica usando query directo
    const [run] = await database.orm.select({
      id: runs.id,
      ownerId: runs.ownerId,
      definitionId: runs.definitionId,
      status: runs.status,
      difficulty: runs.difficulty,
      deadlineMinutes: runs.deadlineMinutes,
      revision: runs.revision,
      engineVersion: runs.engineVersion,
      createdAt: runs.createdAt,
      updatedAt: runs.updatedAt,
    }).from(runs).where(eq(runs.id, id)).limit(1);

    if (!run) {
      return reply.code(404).send({
        error: {
          code: 'RUN_NOT_FOUND',
          message: 'Partida no encontrada',
        },
      });
    }

    // Obtener datos del propietario
    const [owner] = await database.orm.select({
      id: profiles.id,
      displayName: profiles.displayName,
      role: profiles.role,
    }).from(profiles).where(eq(profiles.id, run.ownerId)).limit(1);

    // Registrar acción de auditoría
    await logAdminAction(database, {
      adminId: (request as any).adminProfile.id,
      action: 'view_run',
      targetType: 'run',
      targetId: id,
    });

    // Transformar para el frontend
    const transformedRun = {
      id: run.id,
      ownerId: run.ownerId,
      ownerDisplayName: owner?.displayName ?? 'Desconocido',
      definitionId: run.definitionId,
      status: run.status,
      difficulty: run.difficulty,
      deadlineMinutes: run.deadlineMinutes,
      revision: run.revision,
      engineVersion: run.engineVersion,
      createdAt: run.createdAt.toISOString(),
      updatedAt: run.updatedAt.toISOString(),
      ownerRole: owner?.role ?? 'player',
    };

    return reply.code(200).send(transformedRun);
  });

  app.patch('/api/v1/admin/runs/:id', async (request: FastifyRequest<{ Params: AdminRouteParams }>, reply: FastifyReply) => {
    requireSuperadmin(request);

    const { id } = request.params;
    const body = request.body as any;
    const adminProfile = (request as any).adminProfile;

    // Obtener partida actual usando query directo
    const [run] = await database.orm.select({
      id: runs.id,
      ownerId: runs.ownerId,
      definitionId: runs.definitionId,
      status: runs.status,
      difficulty: runs.difficulty,
      deadlineMinutes: runs.deadlineMinutes,
      revision: runs.revision,
      engineVersion: runs.engineVersion,
      createdAt: runs.createdAt,
      updatedAt: runs.updatedAt,
    }).from(runs).where(eq(runs.id, id)).limit(1);

    if (!run) {
      return reply.code(404).send({
        error: {
          code: 'RUN_NOT_FOUND',
          message: 'Partida no encontrada',
        },
      });
    }

    // Verificar si hay cambios válidos
    const updates: any = {};
    if (body.status !== undefined && body.status !== run.status) {
      // Validar estados permitidos
      if (!['active', 'closed'].includes(body.status)) {
        return reply.code(400).send({
          error: {
            code: 'INVALID_STATUS',
            message: 'Estado inválido. Debe ser: active o closed',
          },
        });
      }
      updates.status = body.status;
    }
    if (body.difficulty !== undefined && body.difficulty !== run.difficulty) {
      if (!['easy', 'normal', 'hard'].includes(body.difficulty)) {
        return reply.code(400).send({
          error: {
            code: 'INVALID_DIFFICULTY',
            message: 'Dificultad inválida. Debe ser: easy, normal o hard',
          },
        });
      }
      updates.difficulty = body.difficulty;
    }
    if (body.deadlineMinutes !== undefined && body.deadlineMinutes !== run.deadlineMinutes) {
      if (body.deadlineMinutes <= 0) {
        return reply.code(400).send({
          error: {
            code: 'INVALID_DEADLINE',
            message: 'La duración debe ser mayor que 0',
          },
        });
      }
      updates.deadlineMinutes = body.deadlineMinutes;
    }
    if (body.revision !== undefined && body.revision !== run.revision) {
      if (body.revision < 1) {
        return reply.code(400).send({
          error: {
            code: 'INVALID_REVISION',
            message: 'La revisión debe ser mayor que 0',
          },
        });
      }
      updates.revision = body.revision;
    }

    if (Object.keys(updates).length === 0) {
      return reply.code(400).send({
        error: {
          code: 'NO_CHANGES',
          message: 'No hay cambios para actualizar',
        },
      });
    }

    // Guardar cambios originales para auditoría
    const beforeState = { ...run };

    // Aplicar actualizaciones
    await database.orm.update(runs).set(updates).where(eq(runs.id, id));

    // Obtener partida actualizada usando query directo
    const [updatedRun] = await database.orm.select({
      id: runs.id,
      ownerId: runs.ownerId,
      definitionId: runs.definitionId,
      status: runs.status,
      difficulty: runs.difficulty,
      deadlineMinutes: runs.deadlineMinutes,
      revision: runs.revision,
      engineVersion: runs.engineVersion,
      createdAt: runs.createdAt,
      updatedAt: runs.updatedAt,
    }).from(runs).where(eq(runs.id, id)).limit(1);

    // Registrar acción de auditoría
    const beforeStateJson = JSON.stringify({
      id: beforeState.id,
      ownerId: beforeState.ownerId,
      definitionId: beforeState.definitionId,
      status: beforeState.status,
      difficulty: beforeState.difficulty,
      deadlineMinutes: beforeState.deadlineMinutes,
      revision: beforeState.revision,
      engineVersion: beforeState.engineVersion,
    });

    const afterStateJson = JSON.stringify({
      id: updatedRun!.id,
      ownerId: updatedRun!.ownerId,
      definitionId: updatedRun!.definitionId,
      status: updatedRun!.status,
      difficulty: updatedRun!.difficulty,
      deadlineMinutes: updatedRun!.deadlineMinutes,
      revision: updatedRun!.revision,
      engineVersion: updatedRun!.engineVersion,
    });

    await logAdminAction(database, {
      adminId: adminProfile.id,
      action: 'update_run',
      targetType: 'run',
      targetId: id,
      before: beforeStateJson,
      after: afterStateJson,
    });

    return reply.code(200).send({
      id: updatedRun!.id,
      message: 'Partida actualizada exitosamente',
      changes: { ...updates } as Record<string, unknown>,
    });
  });

  app.delete('/api/v1/admin/runs/:id/sessions', async (request: FastifyRequest<{ Params: AdminRouteParams }>, reply: FastifyReply) => {
    const runId = request.params.id;
    const adminProfile = (request as any).adminProfile;

    if (!adminProfile) {
      return reply.code(401).send({
        error: {
          code: 'SESSION_REQUIRED',
          message: 'Sesión requerida',
        },
      });
    }

    // Verificar partida existe usando query directo
    const [run] = await database.orm.select({
      id: runs.id,
      ownerId: runs.ownerId,
    }).from(runs).where(eq(runs.id, runId)).limit(1);

    if (!run) {
      return reply.code(404).send({
        error: {
          code: 'RUN_NOT_FOUND',
          message: 'Partida no encontrada',
        },
      });
    }

    // Revocar todas las sesiones de la partida (sessions del owner)
    const revokedSessions = await database.orm
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(eq(sessions.profileId, run.ownerId))
      .returning();

    // Registrar acción de auditoría
    await logAdminAction(database, {
      adminId: adminProfile.id,
      action: 'revoke_run_sessions',
      targetType: 'run',
      targetId: runId,
      before: { runStatus: run.status, ownerId: run.ownerId },
      after: { runStatus: 'closed', ownerId: run.ownerId },
    });

    return reply.code(200).send({
      message: 'Sesiones de la partida revocadas exitosamente',
      runId: runId,
      ownerId: run.ownerId,
      revokedCount: revokedSessions.length,
      runStatus: 'closed',
    });
  });

  // ---- Cuotas y Configuración IA (Fase 2) ----
  app.get('/api/v1/admin/ai/quotas', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const quotas = await getAIQuotas(database);
      return reply.code(200).send(quotas);
    } catch (error) {
      return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'Error obteniendo cuotas IA' } });
    }
  });

  app.patch('/api/v1/admin/ai/quotas', async (request: FastifyRequest, reply: FastifyReply) => {
    requireSuperadmin(request);

    const body = request.body as any;
    const adminProfile = (request as any).adminProfile;
    const { quotas } = body;

    if (!quotas || !Array.isArray(quotas)) {
      return reply.code(400).send({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Se requiere un array de cuotas',
        },
      });
    }

    // Validar y actualizar cada cuota
    const updatedQuotas = [];
    for (const quotaData of quotas) {
      // Buscar cuota existente
      const existing = quotas.find(q => q.scope === quotaData.scope && q.scopeValue === quotaData.scopeValue && q.limitType === quotaData.limitType);

      if (existing) {
        // Actualizar cuota existente
        await database.orm.update(aiQuotas)
          .set({
            limitValue: quotaData.limitValue,
            action: quotaData.action,
            isActive: quotaData.isActive,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(aiQuotas.scope, quotaData.scope),
              eq(aiQuotas.scopeValue, quotaData.scopeValue),
              eq(aiQuotas.limitType, quotaData.limitType)
            )
          );
        updatedQuotas.push({ ...existing, ...quotaData });
      } else {
        // Crear nueva cuota (solo scopes globales o user)
        if (!['user', 'global', 'ip', 'function', 'model', 'provider'].includes(quotaData.scope)) {
          return reply.code(400).send({
            error: {
              code: 'INVALID_SCOPE',
              message: `Scope inválido: ${quotaData.scope}`,
            },
          });
        }
        await database.orm.insert(aiQuotas).values({
          scope: quotaData.scope,
          scopeValue: quotaData.scopeValue,
          limitType: quotaData.limitType,
          limitValue: quotaData.limitValue,
          windowSeconds: quotaData.windowSeconds ?? 3600,
          action: quotaData.action,
          isActive: quotaData.isActive !== undefined ? quotaData.isActive : 1,
        });
        updatedQuotas.push(quotaData);
      }
    }

    // Registrar acción de auditoría
    await logAdminAction(database, {
      adminId: adminProfile.id,
      action: 'update_ai_quotas',
      targetType: 'ai_quotas',
      targetId: 'bulk',
    });

    return reply.code(200).send({
      message: 'Cuotas IA actualizadas exitosamente',
      quotas: updatedQuotas,
    });
  });
}