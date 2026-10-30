// Cuotas, corte global, logs y alertas (T7-03)

import { and, eq, gte, lte, sql, sum } from 'drizzle-orm';
import type { Database } from '../database/connection.ts';
import { pgTable, uuid, text, timestamp, integer, jsonb, index, unique } from 'drizzle-orm/pg-core';

// Esquema para tracking de uso y cuotas
export const aiUsage = pgTable('ai_usage', {
  id: uuid('id').defaultRandom().primaryKey(),
  ownerId: uuid('owner_id').references(() => profiles.id), // null = system/admin
  connectionId: uuid('connection_id').references(() => aiConnections.id),
  function: text('function').notNull(), // 'interpretAction', 'narrateResult', 'converse', 'generateCase'
  providerId: text('provider_id').notNull(), // 'ollama', 'freellmapi', etc.
  model: text('model').notNull(),
  promptTokens: integer('prompt_tokens').notNull().default(0),
  completionTokens: integer('completion_tokens').notNull().default(0),
  totalTokens: integer('total_tokens').notNull().default(0),
  latencyMs: integer('latency_ms').notNull(),
  status: text('status').notNull(), // 'success', 'error', 'timeout', 'rate_limited', 'quota_exceeded'
  errorCode?: text('error_code'),
  requestId: text('request_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [
  index('ai_usage_owner_created_idx').on(table.ownerId, table.createdAt),
  index('ai_usage_connection_created_idx').on(table.connectionId, table.createdAt),
  index('ai_usage_provider_created_idx').on(table.providerId, table.createdAt),
]);

export const aiQuotas = pgTable('ai_quotas', {
  id: uuid('id').defaultRandom().primaryKey(),
  scope: text('scope').notNull(), // 'global', 'user', 'ip', 'function', 'model', 'provider'
  scopeValue: text('scope_value'), // userId, ip, function name, model name, provider id
  limitType: text('limit_type').notNull(), // 'requests', 'tokens', 'concurrency', 'daily_tokens'
  limitValue: integer('limit_value').notNull(),
  windowSeconds: integer('window_seconds').notNull(), // 0 = no window (absolute)
  action: text('action').notNull().default('deny'), // 'deny', 'warn', 'throttle'
  isActive: integer('is_active').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [
  unique('ai_quotas_unique').on(table.scope, table.scopeValue, table.limitType),
  index('ai_quotas_scope_idx').on(table.scope, table.scopeValue),
  check('ai_quotas_limit', sql`${table.limitValue} > 0`),
  check('ai_quotas_action', sql`${table.action} IN ('deny', 'warn', 'throttle')`),
]);

export const aiGlobalCutoff = pgTable('ai_global_cutoff', {
  id: integer('id').primaryKey().default(1),
  isEnabled: integer('is_enabled').notNull().default(0),
  reason: text('reason'),
  enabledAt: timestamp('enabled_at', { withTimezone: true }),
  enabledBy: uuid('enabled_by').references(() => profiles.id),
  disabledAt: timestamp('disabled_at', { withTimezone: true }),
  disabledBy: uuid('disabled_by').references(() => profiles.id),
}, table => [
  check('ai_global_cutoff_singleton', sql`${table.id} = 1`),
]);

import { profiles } from '../database/schema.ts';
import { aiConnections } from './ai-connections.ts';

export interface QuotaCheckResult {
  allowed: boolean;
  reason?: string;
  retryAfter?: number;
  currentUsage?: number;
  limit?: number;
}

export interface UsageStats {
  requests: number;
  totalTokens: number;
  avgLatencyMs: number;
  errors: number;
  byProvider: Record<string, { requests: number; tokens: number }>;
  byFunction: Record<string, { requests: number; tokens: number }>;
}

export async function checkQuota(
  database: Database,
  params: {
    ownerId?: string;
    ip?: string;
    function: string;
    providerId: string;
    model: string;
    estimatedTokens: number;
  }
): Promise<QuotaCheckResult> {
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Verificar corte global
  const [cutoff] = await database.orm.select().from(aiGlobalCutoff).where(eq(aiGlobalCutoff.id, 1)).limit(1);
  if (cutoff?.isEnabled) {
    return { allowed: false, reason: cutoff.reason ?? 'Servicio de IA no disponible temporalmente', retryAfter: 300 };
  }

  // Verificar cuotas activas
  const quotas = await database.orm.select().from(aiQuotas).where(eq(aiQuotas.isActive, 1));

  for (const quota of quotas) {
    let scopeMatch = false;
    let scopeVal = quota.scopeValue;

    switch (quota.scope) {
      case 'global':
        scopeMatch = true;
        break;
      case 'user':
        scopeMatch = !!params.ownerId && quota.scopeValue === params.ownerId;
        break;
      case 'ip':
        scopeMatch = !!params.ip && quota.scopeValue === params.ip;
        break;
      case 'function':
        scopeMatch = quota.scopeValue === params.function;
        break;
      case 'model':
        scopeMatch = quota.scopeValue === params.model;
        break;
      case 'provider':
        scopeMatch = quota.scopeValue === params.providerId;
        break;
    }

    if (!scopeMatch) continue;

    let currentUsage = 0;
    const windowStart = quota.windowSeconds > 0 ? new Date(now.getTime() - quota.windowSeconds * 1000) : dayStart;

    if (quota.limitType === 'requests') {
      const [count] = await database.orm.select({ count: sql`count(*)` }).from(aiUsage)
        .where(and(
          quota.scope === 'user' ? eq(aiUsage.ownerId, params.ownerId!) : sql`1=1`,
          quota.scope === 'ip' ? sql`${aiUsage.ownerId} IS NULL` : sql`1=1`, // simplify
          gte(aiUsage.createdAt, windowStart),
          quota.scope === 'function' ? eq(aiUsage.function, params.function) : sql`1=1`,
          quota.scope === 'model' ? eq(aiUsage.model, params.model) : sql`1=1`,
          quota.scope === 'provider' ? eq(aiUsage.providerId, params.providerId) : sql`1=1`,
        ));
      currentUsage = Number(count?.count ?? 0);
    } else if (quota.limitType === 'tokens') {
      const [sumResult] = await database.orm.select({ sum: sum(aiUsage.totalTokens) }).from(aiUsage)
        .where(and(
          quota.scope === 'user' ? eq(aiUsage.ownerId, params.ownerId!) : sql`1=1`,
          gte(aiUsage.createdAt, windowStart),
          quota.scope === 'function' ? eq(aiUsage.function, params.function) : sql`1=1`,
          quota.scope === 'model' ? eq(aiUsage.model, params.model) : sql`1=1`,
          quota.scope === 'provider' ? eq(aiUsage.providerId, params.providerId) : sql`1=1`,
        ));
      currentUsage = Number(sumResult?.sum ?? 0);
      // Añadir tokens estimados de la petición actual
      currentUsage += params.estimatedTokens;
    } else if (quota.limitType === 'daily_tokens') {
      const [sumResult] = await database.orm.select({ sum: sum(aiUsage.totalTokens) }).from(aiUsage)
        .where(and(
          quota.scope === 'user' ? eq(aiUsage.ownerId, params.ownerId!) : sql`1=1`,
          gte(aiUsage.createdAt, dayStart),
          quota.scope === 'function' ? eq(aiUsage.function, params.function) : sql`1=1`,
        ));
      currentUsage = Number(sumResult?.sum ?? 0) + params.estimatedTokens;
    }

    if (currentUsage > quota.limitValue) {
      if (quota.action === 'deny') {
        const retryAfter = quota.windowSeconds > 0 ? quota.windowSeconds : Math.ceil((dayStart.getTime() + 86400000 - now.getTime()) / 1000);
        return { allowed: false, reason: `Cuota ${quota.limitType} excedida (${currentUsage}/${quota.limitValue})`, retryAfter, currentUsage, limit: quota.limitValue };
      } else if (quota.action === 'throttle') {
        return { allowed: false, reason: `Rate limit: cuota ${quota.limitType} excedida`, retryAfter: 60, currentUsage, limit: quota.limitValue };
      }
      // 'warn' permite pero registra
    }
  }

  return { allowed: true };
}

export async function recordUsage(
  database: Database,
  params: {
    ownerId?: string;
    connectionId?: string;
    function: string;
    providerId: string;
    model: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    latencyMs: number;
    status: 'success' | 'error' | 'timeout' | 'rate_limited' | 'quota_exceeded';
    errorCode?: string;
    requestId: string;
  }
): Promise<void> {
  await database.orm.insert(aiUsage).values({
    ownerId: params.ownerId,
    connectionId: params.connectionId,
    function: params.function,
    providerId: params.providerId,
    model: params.model,
    promptTokens: params.promptTokens,
    completionTokens: params.completionTokens,
    totalTokens: params.totalTokens,
    latencyMs: params.latencyMs,
    status: params.status,
    errorCode: params.errorCode,
    requestId: params.requestId,
  });
}

export async function getUsageStats(
  database: Database,
  params: { ownerId?: string; since?: Date; until?: Date }
): Promise<UsageStats> {
  const where = [];
  if (params.ownerId) where.push(eq(aiUsage.ownerId, params.ownerId));
  if (params.since) where.push(gte(aiUsage.createdAt, params.since));
  if (params.until) where.push(lte(aiUsage.createdAt, params.until));

  const rows = await database.orm.select().from(aiUsage).where(and(...where));

  const stats: UsageStats = {
    requests: rows.length,
    totalTokens: rows.reduce((s, r) => s + r.totalTokens, 0),
    avgLatencyMs: rows.length > 0 ? rows.reduce((s, r) => s + r.latencyMs, 0) / rows.length : 0,
    errors: rows.filter(r => r.status !== 'success').length,
    byProvider: {},
    byFunction: {},
  };

  for (const r of rows) {
    const providerEntry = stats.byProvider[r.providerId] ?? { requests: 0, tokens: 0 };
    providerEntry.requests++;
    providerEntry.tokens += r.totalTokens;
    stats.byProvider[r.providerId] = providerEntry;

    const functionEntry = stats.byFunction[r.function] ?? { requests: 0, tokens: 0 };
    functionEntry.requests++;
    functionEntry.tokens += r.totalTokens;
    stats.byFunction[r.function] = functionEntry;
  }

  return stats;
}

// Corte global de emergencia
export async function enableGlobalCutoff(database: Database, adminId: string, reason: string): Promise<void> {
  await database.orm.insert(aiGlobalCutoff).values({
    id: 1,
    isEnabled: 1,
    reason,
    enabledAt: new Date(),
    enabledBy: adminId,
  }).onConflictDoUpdate({ target: aiGlobalCutoff.id, set: { isEnabled: 1, reason, enabledAt: new Date(), enabledBy: adminId } });
}

export async function disableGlobalCutoff(database: Database, adminId: string): Promise<void> {
  await database.orm.update(aiGlobalCutoff).set({ isEnabled: 0, disabledAt: new Date(), disabledBy: adminId }).where(eq(aiGlobalCutoff.id, 1));
}

export async function getGlobalCutoff(database: Database): Promise<{ enabled: boolean; reason?: string } | null> {
  const [cutoff] = await database.orm.select().from(aiGlobalCutoff).where(eq(aiGlobalCutoff.id, 1)).limit(1);
  if (!cutoff) return null;
  const result: { enabled: boolean; reason?: string } = { enabled: !!cutoff.isEnabled };
  if (cutoff.reason) result.reason = cutoff.reason;
  return result;
}

// Inicializar cuotas por defecto
export async function initializeDefaultQuotas(database: Database): Promise<void> {
  const defaults = [
    // Global: 10000 requests/hour
    { scope: 'global', scopeValue: null, limitType: 'requests', limitValue: 10000, windowSeconds: 3600, action: 'deny' },
    // Global: 1M tokens/day
    { scope: 'global', scopeValue: null, limitType: 'daily_tokens', limitValue: 1000000, windowSeconds: 86400, action: 'deny' },
    // Per user: 100 requests/minute
    { scope: 'user', scopeValue: '', limitType: 'requests', limitValue: 100, windowSeconds: 60, action: 'throttle' },
    // Per user: 50k tokens/day
    { scope: 'user', scopeValue: '', limitType: 'daily_tokens', limitValue: 50000, windowSeconds: 86400, action: 'deny' },
    // Per IP: 20 requests/minute
    { scope: 'ip', scopeValue: '', limitType: 'requests', limitValue: 20, windowSeconds: 60, action: 'throttle' },
    // Per function: generateCase 10/hour
    { scope: 'function', scopeValue: 'generateCase', limitType: 'requests', limitValue: 10, windowSeconds: 3600, action: 'deny' },
    // Per model: 1000 requests/hour
    { scope: 'model', scopeValue: '', limitType: 'requests', limitValue: 1000, windowSeconds: 3600, action: 'throttle' },
  ];

  for (const d of defaults) {
    try {
      await database.orm.insert(aiQuotas).values(d).onConflictDoNothing();
    } catch {
      // Ignorar conflictos
    }
  }
}