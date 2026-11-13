import { sql } from 'drizzle-orm';
import type { Database } from '../database/connection.ts';

// Tipos para los resultados de las consultas
export interface IAMetricsRow {
  providerId: string;
  model: string;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  avgLatencyMs: number;
  requestCount: number;
  errorCount: number;
}

export interface RunsMetricsRow {
  status: string;
  difficulty: string;
  count: number;
  avgDeadlineMinutes: number;
}

export interface UsersMetricsRow {
  role: string;
  userCount: number;
  activeSessions: number;
}

export interface AuditLogRow {
  action: string;
  targetType: string;
  targetId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  createdAt: Date;
}

// Consulta para métricas de IA (24h)
export async function getIAMetrics(database: Database): Promise<IAMetricsRow[]> {
  const result = await database.orm.execute(sql<IAMetricsRow>`
    SELECT
      providerId,
      model,
      SUM(promptTokens) as totalPromptTokens,
      SUM(completionTokens) as totalCompletionTokens,
      SUM(totalTokens) as totalTokens,
      AVG(latencyMs) as avgLatencyMs,
      COUNT(*) as requestCount,
      COUNT(CASE WHEN status != 'success' THEN 1 END) as errorCount
    FROM ai_usage
    WHERE createdAt >= NOW() - INTERVAL '24 hours'
    GROUP BY providerId, model
  `);
  return (result as unknown as { rows: IAMetricsRow[] }).rows ?? [];
}

// Consulta para métricas de partidas (24h)
export async function getRunsMetrics(database: Database): Promise<RunsMetricsRow[]> {
  const result = await database.orm.execute(sql<RunsMetricsRow>`
    SELECT
      status,
      difficulty,
      COUNT(*) as count,
      AVG(deadlineMinutes) as avgDeadlineMinutes
    FROM runs
    WHERE createdAt >= NOW() - INTERVAL '24 hours'
    GROUP BY status, difficulty
  `);
  return (result as unknown as { rows: RunsMetricsRow[] }).rows ?? [];
}

// Consulta para métricas de usuarios por rol
export async function getUsersMetrics(database: Database): Promise<UsersMetricsRow[]> {
  const result = await database.orm.execute(sql<UsersMetricsRow>`
    SELECT
      role,
      COUNT(*) as userCount,
      COUNT(DISTINCT sessionId) as activeSessions
    FROM profiles
    LEFT JOIN sessions ON profiles.id = sessions.profileId
      AND sessions.revokedAt IS NULL
      AND sessions.expiresAt > NOW()
    GROUP BY role
  `);
  return (result as unknown as { rows: UsersMetricsRow[] }).rows ?? [];
}

// Consulta para cuotas IA activas
export async function getAIQuotas(database: Database) {
  const result = await database.orm.execute(sql`
    SELECT
      scope,
      scopeValue,
      limitType,
      limitValue,
      isActive
    FROM ai_quotas
    WHERE isActive = true
  `);
  return (result as unknown as { rows: any[] }).rows ?? [];
}

// Consulta para auditoría con filtros opcionales
export async function getAdminAudit(database: Database, filters: { startDate?: string; endDate?: string; action?: string }): Promise<AuditLogRow[]> {
  const result = await database.orm.execute(sql<AuditLogRow>`
    SELECT
      action,
      target_type as "targetType",
      target_id as "targetId",
      before,
      after,
      created_at as "createdAt"
    FROM admin_audit_log
    ${filters.startDate ? sql`WHERE createdAt >= ${filters.startDate}` : sql``}
    ${filters.endDate ? sql`AND createdAt <= ${filters.endDate}` : sql``}
    ${filters.action ? sql`AND action = ${filters.action}` : sql``}
    ORDER BY created_at DESC
  `);
  return (result as unknown as { rows: AuditLogRow[] }).rows ?? [];
}

// Función para registrar acción administrativa
export async function logAdminAction(database: Database, data: {
  adminId: string;
  action: string;
  targetType: string;
  targetId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}) {
  await database.orm.execute(sql`
    INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, before, after, created_at)
    VALUES (
      ${data.adminId},
      ${data.action},
      ${data.targetType},
      ${data.targetId},
      ${JSON.stringify(data.before ?? null)},
      ${JSON.stringify(data.after ?? null)},
      NOW()
    )
  `);
}