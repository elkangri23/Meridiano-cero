import { sql, type SQL } from 'drizzle-orm';
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
  id: string;
  adminId: string;
  action: string;
  targetType: string;
  targetId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  createdAt: Date;
}

// Consulta para métricas de IA (24h)
//
// Las columnas reales son snake_case (provider_id, prompt_tokens, ...);
// los alias entre comillas devuelven las claves camelCase que espera el
// contrato IAMetricsRow. Los agregados se castean a int/float porque el
// driver de Postgres devuelve COUNT/SUM como bigint (cadena) y AVG como
// numeric (cadena).
export async function getIAMetrics(database: Database): Promise<IAMetricsRow[]> {
  const result = await database.orm.execute(sql<IAMetricsRow>`
    SELECT
      provider_id as "providerId",
      model,
      SUM(prompt_tokens)::int as "totalPromptTokens",
      SUM(completion_tokens)::int as "totalCompletionTokens",
      SUM(total_tokens)::int as "totalTokens",
      AVG(latency_ms)::float as "avgLatencyMs",
      COUNT(*)::int as "requestCount",
      COUNT(CASE WHEN status != 'success' THEN 1 END)::int as "errorCount"
    FROM ai_usage
    WHERE created_at >= NOW() - INTERVAL '24 hours'
    GROUP BY provider_id, model
  `);
  return (result as unknown as { rows: IAMetricsRow[] }).rows ?? [];
}

// Consulta para métricas de partidas (24h)
//
// La tabla runs NO tiene columna status: el estado de la partida vive en
// engine_state.status ('active' | 'closed', lo mismo que usa el motor).
// Se deriva de ahí y se documenta, en vez de inventar la columna.
export async function getRunsMetrics(database: Database): Promise<RunsMetricsRow[]> {
  const result = await database.orm.execute(sql<RunsMetricsRow>`
    SELECT
      engine_state->>'status' as status,
      difficulty,
      COUNT(*)::int as count,
      AVG(deadline_minutes)::float as "avgDeadlineMinutes"
    FROM runs
    WHERE created_at >= NOW() - INTERVAL '24 hours'
    GROUP BY engine_state->>'status', difficulty
  `);
  return (result as unknown as { rows: RunsMetricsRow[] }).rows ?? [];
}

// Consulta para métricas de usuarios por rol
//
// sessions no tiene columna sessionId: la sesión se identifica por
// token_hash (su clave primaria). El COUNT de usuarios es DISTINCT sobre
// profiles.id, porque el LEFT JOIN multiplicaría filas por sesión.
export async function getUsersMetrics(database: Database): Promise<UsersMetricsRow[]> {
  const result = await database.orm.execute(sql<UsersMetricsRow>`
    SELECT
      role,
      COUNT(DISTINCT profiles.id)::int as "userCount",
      COUNT(DISTINCT sessions.token_hash)::int as "activeSessions"
    FROM profiles
    LEFT JOIN sessions ON profiles.id = sessions.profile_id
      AND sessions.revoked_at IS NULL
      AND sessions.expires_at > NOW()
    GROUP BY role
  `);
  return (result as unknown as { rows: UsersMetricsRow[] }).rows ?? [];
}

// Consulta para cuotas IA activas
export interface AIQuotaRow {
  scope: string;
  scopeValue: string | null;
  limitType: string;
  limitValue: number;
  isActive: number;
}

export async function getAIQuotas(database: Database): Promise<AIQuotaRow[]> {
  const result = await database.orm.execute(sql<AIQuotaRow>`
    SELECT
      scope,
      scope_value as "scopeValue",
      limit_type as "limitType",
      limit_value as "limitValue",
      is_active as "isActive"
    FROM ai_quotas
    WHERE is_active = 1
  `);
  return (result as unknown as { rows: AIQuotaRow[] }).rows ?? [];
}

// Consulta para auditoría con filtros opcionales
//
// Las condiciones se construyen como lista y se unen con AND: la versión
// anterior interpolaba un WHERE solo para startDate y un AND suelto para
// los demás filtros, lo que rompía la SQL cuando startDate no venía, y
// usaba createdAt (inexistente; la columna es created_at).
export async function getAdminAudit(database: Database, filters: { startDate?: string; endDate?: string; action?: string }): Promise<AuditLogRow[]> {
  const conditions: SQL[] = [];
  if (filters.startDate) conditions.push(sql`created_at >= ${filters.startDate}`);
  if (filters.endDate) conditions.push(sql`created_at <= ${filters.endDate}`);
  if (filters.action) conditions.push(sql`action = ${filters.action}`);
  const where = conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``;
  const result = await database.orm.execute(sql<AuditLogRow>`
    SELECT
      id,
      admin_id as "adminId",
      action,
      target_type as "targetType",
      target_id as "targetId",
      before,
      after,
      created_at as "createdAt"
    FROM admin_audit_log
    ${where}
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
