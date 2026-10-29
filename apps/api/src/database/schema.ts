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
