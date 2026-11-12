import { sql } from 'drizzle-orm';

// Consultas para métricas de IA
export function getIAMetricsQuery() {
  return sql`
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
  `;
}

// Consultas para métricas de partidas
export function getRunsMetricsQuery() {
  return sql`
    SELECT
      status,
      difficulty,
      COUNT(*) as count,
      AVG(deadlineMinutes) as avgDeadlineMinutes
    FROM runs
    WHERE createdAt >= NOW() - INTERVAL '24 hours'
    GROUP BY status, difficulty
  `;
}

// Consultas para métricas de usuarios
export function getUsersMetricsQuery() {
  return sql`
    SELECT
      role,
      COUNT(*) as userCount,
      COUNT(DISTINCT sessionId) as activeSessions
    FROM profiles
    LEFT JOIN sessions ON profiles.id = sessions.profileId AND sessions.revokedAt IS NULL AND sessions.expiresAt > NOW()
    GROUP BY role
  `;
}

// Consultas para cuotas IA
export function getAIQuotasQuery() {
  return sql`
    SELECT
      scope,
      scopeValue,
      limitType,
      limitValue,
      isActive
    FROM ai_quotas
    WHERE isActive = true
  `;
}

// Consultas para auditoría
export function getAdminAuditQuery(filters: { startDate?: string; endDate?: string; action?: string }) {
  const conditions: string[] = [];
  const params: any[] = [];

  if (filters.startDate) {
    conditions.push(`createdAt >= $${params.length + 1}`);
    params.push(filters.startDate);
  }
  if (filters.endDate) {
    conditions.push(`createdAt <= $${params.length + 1}`);
    params.push(filters.endDate);
  }
  if (filters.action) {
    conditions.push(`action = $${params.length + 1}`);
    params.push(filters.action);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  return sql`
    SELECT
      action,
      target_type,
      target_id,
      before,
      after,
      created_at
    FROM admin_audit_log
    ${sql.raw(whereClause)}
    ORDER BY created_at DESC
  `;
}

// Función para registrar acción administrativa
export async function logAdminAction(_database: any, data: {
  adminId: string;
  action: string;
  targetType: string;
  targetId: string;
  before?: any;
  after?: any;
}) {
  await sql`
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
  `;
}