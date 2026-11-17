import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { AppConfig } from '../config.ts';
import type { Database } from '../database/connection.ts';
import { createAdminAuthorizer, getAdminProfile, requireSuperadmin } from './middleware.ts';
import {
  getIAMetrics,
  getRunsMetrics,
  getUsersMetrics,
  getAIQuotas,
  getAdminAudit,
  logAdminAction,
  type IAMetricsRow,
  type RunsMetricsRow,
  type UsersMetricsRow,
} from './queries.ts';
import { eq, isNull, and } from 'drizzle-orm';
import { profiles, runs, sessions, aiQuotas } from '../database/schema.ts';

interface AdminRouteParams {
  id: string;
}

interface AuditQuery {
  startDate?: string;
  endDate?: string;
  action?: string;
  page?: string | number;
  limit?: string | number;
}

interface UserUpdateBody {
  displayName?: string;
  role?: string;
  emailVerified?: boolean;
}

type UserRole = 'player' | 'admin' | 'superadmin';

interface UserUpdates {
  displayName?: string;
  role?: UserRole;
  emailVerifiedAt?: Date | null;
}

interface RunUpdateBody {
  status?: string;
  difficulty?: string;
  deadlineMinutes?: number;
  revision?: number;
}

interface RunUpdates {
  status?: 'active' | 'closed';
  difficulty?: 'easy' | 'normal' | 'hard';
  deadlineMinutes?: number;
  revision?: number;
}

interface QuotaInput {
  scope: string;
  scopeValue?: string | null;
  limitType: string;
  limitValue: number;
  windowSeconds?: number;
  action?: string;
  isActive?: boolean;
}

interface QuotasUpdateBody {
  quotas?: QuotaInput[];
}

/** Error de validación de un campo en una actualización admin (400 con código propio). */
class AdminValidationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

function isUserRole(value: string): value is UserRole {
  return value === 'player' || value === 'admin' || value === 'superadmin';
}

function isRunStatus(value: string): value is 'active' | 'closed' {
  return value === 'active' || value === 'closed';
}

function isRunDifficulty(value: string): value is 'easy' | 'normal' | 'hard' {
  return value === 'easy' || value === 'normal' || value === 'hard';
}

type QuotaScope = 'user' | 'global' | 'ip' | 'function' | 'model' | 'provider';

const QUOTA_SCOPES: readonly QuotaScope[] = ['user', 'global', 'ip', 'function', 'model', 'provider'];

function isQuotaScope(value: string): value is QuotaScope {
  return (QUOTA_SCOPES as readonly string[]).includes(value);
}

async function findUserById(database: Database, id: string) {
  const [user] = await database.orm.select({
    id: profiles.id,
    displayName: profiles.displayName,
    role: profiles.role,
    emailVerifiedAt: profiles.emailVerifiedAt,
  }).from(profiles).where(eq(profiles.id, id)).limit(1);
  return user ?? null;
}

async function findRunById(database: Database, id: string) {
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
  return run ?? null;
}

async function findProfileNameById(database: Database, id: string) {
  const [owner] = await database.orm.select({
    id: profiles.id,
    displayName: profiles.displayName,
    role: profiles.role,
  }).from(profiles).where(eq(profiles.id, id)).limit(1);
  return owner ?? null;
}

function computeUserUpdates(body: UserUpdateBody, user: { displayName: string; role: UserRole; emailVerifiedAt: Date | null }): UserUpdates {
  const updates: UserUpdates = {};
  if (body.displayName !== undefined && body.displayName !== user.displayName) {
    updates.displayName = body.displayName;
  }
  if (body.role !== undefined && body.role !== user.role) {
    if (!isUserRole(body.role)) {
      throw new AdminValidationError('INVALID_ROLE', 'Rol inválido. Debe ser: player, admin o superadmin');
    }
    updates.role = body.role;
  }
  if (body.emailVerified !== undefined && body.emailVerified !== !!user.emailVerifiedAt) {
    updates.emailVerifiedAt = body.emailVerified ? new Date() : null;
  }
  if (Object.keys(updates).length === 0) {
    throw new AdminValidationError('NO_CHANGES', 'No hay cambios para actualizar');
  }
  return updates;
}

type RunCurrent = { status: string; difficulty: string; deadlineMinutes: number; revision: number };

function applyRunStatus(body: RunUpdateBody, run: RunCurrent, updates: RunUpdates): void {
  if (body.status === undefined || body.status === run.status) return;
  if (!isRunStatus(body.status)) {
    throw new AdminValidationError('INVALID_STATUS', 'Estado inválido. Debe ser: active o closed');
  }
  updates.status = body.status;
}

function applyRunDifficulty(body: RunUpdateBody, run: RunCurrent, updates: RunUpdates): void {
  if (body.difficulty === undefined || body.difficulty === run.difficulty) return;
  if (!isRunDifficulty(body.difficulty)) {
    throw new AdminValidationError('INVALID_DIFFICULTY', 'Dificultad inválida. Debe ser: easy, normal o hard');
  }
  updates.difficulty = body.difficulty;
}

function applyRunDeadline(body: RunUpdateBody, run: RunCurrent, updates: RunUpdates): void {
  if (body.deadlineMinutes === undefined || body.deadlineMinutes === run.deadlineMinutes) return;
  if (body.deadlineMinutes <= 0) {
    throw new AdminValidationError('INVALID_DEADLINE', 'La duración debe ser mayor que 0');
  }
  updates.deadlineMinutes = body.deadlineMinutes;
}

function applyRunRevision(body: RunUpdateBody, run: RunCurrent, updates: RunUpdates): void {
  if (body.revision === undefined || body.revision === run.revision) return;
  if (body.revision < 1) {
    throw new AdminValidationError('INVALID_REVISION', 'La revisión debe ser mayor que 0');
  }
  updates.revision = body.revision;
}

function computeRunUpdates(body: RunUpdateBody, run: RunCurrent): RunUpdates {
  const updates: RunUpdates = {};
  applyRunStatus(body, run, updates);
  applyRunDifficulty(body, run, updates);
  applyRunDeadline(body, run, updates);
  applyRunRevision(body, run, updates);
  if (Object.keys(updates).length === 0) {
    throw new AdminValidationError('NO_CHANGES', 'No hay cambios para actualizar');
  }
  return updates;
}

function aggregateDashboardMetrics(usersMetrics: UsersMetricsRow[], runsMetrics: RunsMetricsRow[], aiMetrics: IAMetricsRow[]) {
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

  return {
    usersTotal,
    usersActive24h,
    runsTotal,
    runsActive,
    aiTokensUsed24h: aiTokensTotal,
    aiErrorRate24h: aiRequests > 0 ? Math.round((aiErrors / aiRequests) * 1000) / 10 : 0,
    byProvider: aiMetrics,
  };
}

async function updateQuotaRow(database: Database, quotaData: QuotaInput): Promise<void> {
  await database.orm.update(aiQuotas)
    .set({
      limitValue: quotaData.limitValue,
      action: quotaData.action ?? 'deny',
      isActive: quotaData.isActive ? 1 : 0,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(aiQuotas.scope, quotaData.scope),
        quotaData.scopeValue == null
          ? isNull(aiQuotas.scopeValue)
          : eq(aiQuotas.scopeValue, quotaData.scopeValue),
        eq(aiQuotas.limitType, quotaData.limitType),
      ),
    );
}

async function insertQuotaRow(database: Database, quotaData: QuotaInput): Promise<void> {
  await database.orm.insert(aiQuotas).values({
    scope: quotaData.scope,
    scopeValue: quotaData.scopeValue ?? null,
    limitType: quotaData.limitType,
    limitValue: quotaData.limitValue,
    windowSeconds: quotaData.windowSeconds ?? 3600,
    action: quotaData.action ?? 'deny',
    isActive: quotaData.isActive ? 1 : 0,
  });
}

/** Responde 401 cuando el autorizador no dejó perfil admin en la request. */
function unauthorized(reply: FastifyReply) {
  return reply.code(401).send({
    error: {
      code: 'SESSION_REQUIRED',
      message: 'Sesión requerida',
    },
  });
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
    } catch {
      return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'Error obteniendo métricas de usuarios' } });
    }
  });

  app.get('/api/v1/admin/runs', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const rows = await getRunsMetrics(database);
      return reply.code(200).send(rows);
    } catch {
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
      return reply.code(200).send(aggregateDashboardMetrics(usersMetrics, runsMetrics, aiMetrics));
    } catch {
      return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'Error obteniendo métricas' } });
    }
  });

  app.get('/api/v1/admin/ai/metrics', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const rows = await getIAMetrics(database);
      return reply.code(200).send(rows);
    } catch {
      return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'Error obteniendo métricas de IA' } });
    }
  });

  app.get('/api/v1/admin/audit', async (request: FastifyRequest<{ Querystring: AuditQuery }>, reply: FastifyReply) => {
    try {
      const { startDate, endDate, action, page = 1, limit = 50 } = request.query;

      const adminProfile = getAdminProfile(request);
      if (!adminProfile) {
        return unauthorized(reply);
      }

      // Construir filtros para getAdminAudit
      const auditFilters: { startDate?: string; endDate?: string; action?: string } = {};
      if (startDate) auditFilters.startDate = String(startDate);
      if (endDate) auditFilters.endDate = String(endDate);
      if (action) auditFilters.action = String(action);

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
        adminId: adminProfile.id,
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
    } catch {
      return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'Error obteniendo auditoría' } });
    }
  });

  // ---- Endpoints de gestión de usuarios (Fase 2) ----
  app.get('/api/v1/admin/users/:id', async (request: FastifyRequest<{ Params: AdminRouteParams }>, reply: FastifyReply) => {
    const { id } = request.params;

    const adminProfile = getAdminProfile(request);
    if (!adminProfile) {
      return unauthorized(reply);
    }

    // Obtener usuario específico usando query directo
    const user = await findUserById(database, id);

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
      createdAt: new Date().toISOString(),
      runsTotal: 0,
      runsActive: 0,
      lastActiveAt: null,
      sessionCount: 0,
      activeSessions: 0,
    };

    // Registrar acción de auditoría
    await logAdminAction(database, {
      adminId: adminProfile.id,
      action: 'view_user',
      targetType: 'user',
      targetId: id,
    });

    return reply.code(200).send(transformedUser);
  });

  app.patch('/api/v1/admin/users/:id', async (request: FastifyRequest<{ Params: AdminRouteParams; Body: UserUpdateBody }>, reply: FastifyReply) => {
    requireSuperadmin(request);

    const { id } = request.params;
    const body = request.body;

    const adminProfile = getAdminProfile(request);
    if (!adminProfile) {
      return unauthorized(reply);
    }

    // Obtener usuario actual usando query directo
    const user = await findUserById(database, id);

    if (!user) {
      return reply.code(404).send({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'Usuario no encontrado',
        },
      });
    }

    // Verificar si hay cambios válidos
    let updates: UserUpdates;
    try {
      updates = computeUserUpdates(body, user);
    } catch (error) {
      if (error instanceof AdminValidationError) {
        return reply.code(400).send({ error: { code: error.code, message: error.message } });
      }
      throw error;
    }

    // Guardar cambios originales para auditoría
    const beforeState = { ...user };

    // Aplicar actualizaciones
    await database.orm.update(profiles).set(updates).where(eq(profiles.id, id));

    // Obtener usuario actualizado usando query directo
    const updatedUser = await findUserById(database, id);
    if (!updatedUser) {
      return reply.code(404).send({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'Usuario no encontrado',
        },
      });
    }

    // Registrar acción de auditoría
    await logAdminAction(database, {
      adminId: adminProfile.id,
      action: 'update_user',
      targetType: 'user',
      targetId: id,
      before: { ...beforeState },
      after: { ...updatedUser },
    });

    return reply.code(200).send({
      id: updatedUser.id,
      displayName: updatedUser.displayName,
      role: updatedUser.role,
      emailVerified: !!updatedUser.emailVerifiedAt,
      createdAt: new Date().toISOString(),
      message: 'Usuario actualizado exitosamente',
    });
  });

  app.delete('/api/v1/admin/users/:id/sessions', async (request: FastifyRequest<{ Params: AdminRouteParams }>, reply: FastifyReply) => {
    const userId = request.params.id;
    const adminProfile = getAdminProfile(request);

    if (!adminProfile) {
      return unauthorized(reply);
    }

    // Revocar todas las sesiones activas del usuario
    const revokedSessions = await database.orm
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(sessions.profileId, userId),
          isNull(sessions.revokedAt),
        ),
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

    const adminProfile = getAdminProfile(request);
    if (!adminProfile) {
      return unauthorized(reply);
    }

    // Obtener partida específica usando query directo
    const run = await findRunById(database, id);

    if (!run) {
      return reply.code(404).send({
        error: {
          code: 'RUN_NOT_FOUND',
          message: 'Partida no encontrada',
        },
      });
    }

    // Obtener datos del propietario
    const owner = await findProfileNameById(database, run.ownerId);

    // Registrar acción de auditoría
    await logAdminAction(database, {
      adminId: adminProfile.id,
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

  app.patch('/api/v1/admin/runs/:id', async (request: FastifyRequest<{ Params: AdminRouteParams; Body: RunUpdateBody }>, reply: FastifyReply) => {
    requireSuperadmin(request);

    const { id } = request.params;
    const body = request.body;

    const adminProfile = getAdminProfile(request);
    if (!adminProfile) {
      return unauthorized(reply);
    }

    // Obtener partida actual usando query directo
    const run = await findRunById(database, id);

    if (!run) {
      return reply.code(404).send({
        error: {
          code: 'RUN_NOT_FOUND',
          message: 'Partida no encontrada',
        },
      });
    }

    // Verificar si hay cambios válidos
    let updates: RunUpdates;
    try {
      updates = computeRunUpdates(body, run);
    } catch (error) {
      if (error instanceof AdminValidationError) {
        return reply.code(400).send({ error: { code: error.code, message: error.message } });
      }
      throw error;
    }

    // Guardar cambios originales para auditoría
    const beforeState = { ...run };

    // Aplicar actualizaciones
    await database.orm.update(runs).set(updates).where(eq(runs.id, id));

    // Obtener partida actualizada usando query directo
    const updatedRun = await findRunById(database, id);
    if (!updatedRun) {
      return reply.code(404).send({
        error: {
          code: 'RUN_NOT_FOUND',
          message: 'Partida no encontrada',
        },
      });
    }

    // Registrar acción de auditoría
    await logAdminAction(database, {
      adminId: adminProfile.id,
      action: 'update_run',
      targetType: 'run',
      targetId: id,
      before: { id: beforeState.id, ownerId: beforeState.ownerId, definitionId: beforeState.definitionId, status: beforeState.status, difficulty: beforeState.difficulty, deadlineMinutes: beforeState.deadlineMinutes, revision: beforeState.revision, engineVersion: beforeState.engineVersion },
      after: { id: updatedRun.id, ownerId: updatedRun.ownerId, definitionId: updatedRun.definitionId, status: updatedRun.status, difficulty: updatedRun.difficulty, deadlineMinutes: updatedRun.deadlineMinutes, revision: updatedRun.revision, engineVersion: updatedRun.engineVersion },
    });

    return reply.code(200).send({
      id: updatedRun.id,
      message: 'Partida actualizada exitosamente',
      changes: { ...updates } as Record<string, unknown>,
    });
  });

  app.delete('/api/v1/admin/runs/:id/sessions', async (request: FastifyRequest<{ Params: AdminRouteParams }>, reply: FastifyReply) => {
    const runId = request.params.id;
    const adminProfile = getAdminProfile(request);

    if (!adminProfile) {
      return unauthorized(reply);
    }

    // Verificar partida existe usando query directo
    const run = await findRunById(database, runId);

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
  app.get('/api/v1/admin/ai/quotas', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const quotas = await getAIQuotas(database);
      return reply.code(200).send(quotas);
    } catch {
      return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'Error obteniendo cuotas IA' } });
    }
  });

  app.patch('/api/v1/admin/ai/quotas', async (request: FastifyRequest<{ Body: QuotasUpdateBody }>, reply: FastifyReply) => {
    requireSuperadmin(request);

    const body = request.body;

    const adminProfile = getAdminProfile(request);
    if (!adminProfile) {
      return unauthorized(reply);
    }

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
    const updatedQuotas: QuotaInput[] = [];
    for (const quotaData of quotas) {
      // Buscar cuota existente
      const existing = quotas.find(q => q.scope === quotaData.scope && q.scopeValue === quotaData.scopeValue && q.limitType === quotaData.limitType);

      if (existing) {
        // Actualizar cuota existente
        await updateQuotaRow(database, quotaData);
        updatedQuotas.push({ ...existing, ...quotaData });
      } else {
        // Crear nueva cuota (solo scopes globales o user)
        if (!isQuotaScope(quotaData.scope)) {
          return reply.code(400).send({
            error: {
              code: 'INVALID_SCOPE',
              message: `Scope inválido: ${quotaData.scope}`,
            },
          });
        }
        await insertQuotaRow(database, quotaData);
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
