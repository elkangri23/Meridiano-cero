import { sql } from 'drizzle-orm';
import { pgTable, uuid, text, timestamp, integer, jsonb, primaryKey, index, unique, foreignKey, check } from 'drizzle-orm/pg-core';

export const profiles = pgTable('profiles', {
  id: uuid('id').defaultRandom().primaryKey(),
  localKey: text('local_key').notNull().unique(),
  displayName: text('display_name').notNull(),
  role: text('role').notNull().default('player'),
});
export const sessions = pgTable('sessions', {
  tokenHash: text('token_hash').primaryKey(),
  profileId: uuid('profile_id').notNull().references(() => profiles.id),
  csrfToken: text('csrf_token').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
});

// La revisión HTTP y rama no se restauran desde engineState.
export const runs = pgTable('runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  ownerId: uuid('owner_id').notNull().references(() => profiles.id),
  definitionId: text('definition_id').notNull(),
  definitionHash: text('definition_hash').notNull(),
  engineVersion: integer('engine_version').notNull(),
  revision: integer('revision').notNull().default(1),
  branchId: uuid('branch_id').notNull().defaultRandom(),
  engineState: jsonb('engine_state').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [
  unique('runs_owner_id_id_unique').on(table.ownerId, table.id),
  index('runs_owner_created_idx').on(table.ownerId, table.createdAt, table.id),
  check('runs_revision_positive', sql`${table.revision} > 0`),
  check('runs_engine_positive', sql`${table.engineVersion} > 0`),
  check('runs_definition_digest', sql`${table.definitionHash} ~ '^[a-f0-9]{64}$'`),
  check('runs_state_object', sql`jsonb_typeof(${table.engineState}) = 'object'`),
]);

// Ámbito de creación: usuario + clave; aún no existe runId al recibir la intención.
export const runCreations = pgTable('run_creations', {
  ownerId: uuid('owner_id').notNull(),
  idempotencyKey: text('idempotency_key').notNull(),
  requestDigest: text('request_digest').notNull(),
  runId: uuid('run_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [
  primaryKey({ columns: [table.ownerId, table.idempotencyKey] }),
  foreignKey({ columns: [table.ownerId, table.runId], foreignColumns: [runs.ownerId, runs.id] }),
  check('run_creations_key', sql`${table.idempotencyKey} ~ '^[A-Za-z0-9._:-]{16,128}$'`),
  check('run_creations_digest', sql`${table.requestDigest} ~ '^[a-f0-9]{64}$'`),
]);

// Guardados manuales (T3-06)
export const manualSaves = pgTable('manual_saves', {
  id: uuid('id').defaultRandom().primaryKey(),
  runId: uuid('run_id').notNull().references(() => runs.id),
  ownerId: uuid('owner_id').notNull().references(() => profiles.id),
  schemaVersion: integer('schema_version').notNull().default(1),
  name: text('name').notNull(),
  sourceRevision: integer('source_revision').notNull(),
  sourceBranchId: uuid('source_branch_id').notNull(),
  minute: integer('minute').notNull(),
  status: text('status').notNull().default('active'), // active, replaced, deleted
  snapshot: jsonb('snapshot').notNull(),
  snapshotHash: text('snapshot_hash').notNull(),
  engineVersion: integer('engine_version').notNull(),
  metadataVersion: integer('metadata_version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [
  unique('manual_saves_run_name_unique').on(table.runId, table.name),
  index('manual_saves_run_created_idx').on(table.runId, table.createdAt),
  check('manual_saves_status', sql`${table.status} IN ('active', 'replaced', 'deleted')`),
  check('manual_saves_hash', sql`${table.snapshotHash} ~ '^[a-f0-9]{64}$'`),
  check('manual_saves_snapshot_object', sql`jsonb_typeof(${table.snapshot}) = 'object'`),
]);

// Registro de operaciones (T3-06/T3-08)
export const operationRecords = pgTable('operation_records', {
  id: uuid('id').defaultRandom().primaryKey(),
  runId: uuid('run_id').notNull().references(() => runs.id),
  ownerId: uuid('owner_id').notNull().references(() => profiles.id),
  idempotencyKey: text('idempotency_key').notNull(),
  kind: text('kind').notNull(), // 'create_run', 'save', 'load', 'action', 'ai_request'
  requestDigest: text('request_digest').notNull(),
  resultPublic: jsonb('result_public'),
  branchId: uuid('branch_id').notNull(),
  revision: integer('revision').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [
  unique('operation_records_run_key_unique').on(table.runId, table.idempotencyKey),
  index('operation_records_run_created_idx').on(table.runId, table.createdAt),
  check('operation_records_key', sql`${table.idempotencyKey} ~ '^[A-Za-z0-9._:-]{16,128}$'`),
  check('operation_records_digest', sql`${table.requestDigest} ~ '^[a-f0-9]{64}$'`),
]);

// Registro de resultados oficiales (T3-06 carrera)
export const officialResults = pgTable('official_results', {
  id: uuid('id').defaultRandom().primaryKey(),
  ownerId: uuid('owner_id').notNull().references(() => profiles.id),
  definitionHash: text('definition_hash').notNull(),
  contentHash: text('content_hash').notNull(), // huella del contenido inmutable
  variantOrigin: text('variant_origin'), // procedencia de variante
  firstResult: jsonb('first_result').notNull(), // result, objectives, reason, minute, rewards
  ruleVersion: integer('rule_version').notNull().default(1),
  operationId: uuid('operation_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [
  unique('official_results_owner_content_unique').on(table.ownerId, table.contentHash),
  index('official_results_owner_created_idx').on(table.ownerId, table.createdAt),
  check('official_results_hash', sql`${table.definitionHash} ~ '^[a-f0-9]{64}$'`),
  check('official_results_content', sql`${table.contentHash} ~ '^[a-f0-9]{64}$'`),
]);

// Cuotas y seguimiento IA (T3-08/T7-03)
export const aiUsage = pgTable('ai_usage', {
  id: uuid('id').defaultRandom().primaryKey(),
  ownerId: uuid('owner_id').references(() => profiles.id),
  connectionId: uuid('connection_id').references(() => aiConnections.id),
  function: text('function').notNull(),
  providerId: text('provider_id').notNull(),
  model: text('model').notNull(),
  promptTokens: integer('prompt_tokens').notNull().default(0),
  completionTokens: integer('completion_tokens').notNull().default(0),
  totalTokens: integer('total_tokens').notNull().default(0),
  latencyMs: integer('latency_ms').notNull(),
  status: text('status').notNull(),
  errorCode: text('error_code'),
  requestId: text('request_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [
  index('ai_usage_owner_created_idx').on(table.ownerId, table.createdAt),
  index('ai_usage_connection_created_idx').on(table.connectionId, table.createdAt),
  index('ai_usage_provider_created_idx').on(table.providerId, table.createdAt),
]);

// Cuotas (T7-03)
export const aiQuotas = pgTable('ai_quotas', {
  id: uuid('id').defaultRandom().primaryKey(),
  scope: text('scope').notNull(),
  scopeValue: text('scope_value'),
  limitType: text('limit_type').notNull(),
  limitValue: integer('limit_value').notNull(),
  windowSeconds: integer('window_seconds').notNull(),
  action: text('action').notNull().default('deny'),
  isActive: integer('is_active').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [
  unique('ai_quotas_unique').on(table.scope, table.scopeValue, table.limitType),
  index('ai_quotas_scope_idx').on(table.scope, table.scopeValue),
  check('ai_quotas_limit', sql`${table.limitValue} > 0`),
  check('ai_quotas_action', sql`${table.action} IN ('deny', 'warn', 'throttle')`),
]);

// Corte global (T7-03)
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

// Conexiones IA personales (T7-02)
export const aiConnections = pgTable('ai_connections', {
  id: uuid('id').defaultRandom().primaryKey(),
  ownerId: uuid('owner_id').notNull().references(() => profiles.id),
  name: text('name').notNull(),
  adapterId: text('adapter_id').notNull(),
  baseUrl: text('base_url').notNull(),
  model: text('model').notNull(),
  credentialRef: text('credential_ref').notNull(),
  encryptedCredential: text('encrypted_credential').notNull(),
  roles: text('roles').array().notNull().default([]),
  limits: jsonb('limits').$type<{
    timeoutMs: number;
    maxContextTokens: number;
    maxTokens: number;
    maxConcurrency: number;
    dailyBudgetTokens?: number;
  }>().notNull(),
  capabilities: text('capabilities').array().notNull().default([]),
  isDefault: integer('is_default').notNull().default(0),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  lastError: text('last_error'),
  errorCount: integer('error_count').notNull().default(0),
}, table => [
  unique('ai_connections_owner_name_unique').on(table.ownerId, table.name),
  index('ai_connections_owner_idx').on(table.ownerId),
  check('ai_connections_status', sql`${table.status} IN ('active', 'disabled', 'error')`),
]);

export const detectiveProfiles = pgTable('detective_profiles', {
  userId: uuid('user_id').primaryKey().references(() => profiles.id),
  alias: text('alias').notNull(),
  avatar: text('avatar').notNull().default('detective'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const instances = pgTable('instances', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  allowRegistration: integer('allow_registration').notNull().default(0),
  defaultAiProvider: text('default_ai_provider').notNull().default('disabled'),
  aiConfig: jsonb('ai_config').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const caseRuns = pgTable('case_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  ownerId: uuid('owner_id').notNull().references(() => profiles.id),
  definitionId: text('definition_id').notNull(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [
  index('case_runs_owner_idx').on(table.ownerId),
  index('case_runs_definition_idx').on(table.definitionId),
]);

export const baseMigrations = pgTable('base_migrations', {
  name: text('name').primaryKey(),
  hash: text('hash').notNull(),
  appliedAt: timestamp('applied_at', { withTimezone: true }).notNull().defaultNow(),
});
