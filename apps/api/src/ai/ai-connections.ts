// Gestión de conexiones IA personales por usuario (T7-02)
// Almacenamiento cifrado de credenciales, selección de proveedor, límites

import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { Database } from '../database/connection.ts';
import { pgTable, uuid, text, timestamp, integer, jsonb, primaryKey, unique } from 'drizzle-orm/pg-core';

// Esquema para conexiones IA personales
export const aiConnections = pgTable('ai_connections', {
  id: uuid('id').defaultRandom().primaryKey(),
  ownerId: uuid('owner_id').notNull().references(() => profiles.id),
  name: text('name').notNull(), // Nombre amigable: "Mi Ollama", "FreeLLMAPI personal"
  adapterId: text('adapter_id').notNull(), // 'ollama', 'freellmapi', 'openai-compatible'
  baseUrl: text('base_url').notNull(),
  model: text('model').notNull(),
  credentialRef: text('credential_ref').notNull(), // Hash de la credencial para deduplicación
  encryptedCredential: text('encrypted_credential').notNull(), // Credencial cifrada
  roles: text('roles').array().notNull().default([]), // Funciones permitidas
  limits: jsonb('limits').$type<{
    timeoutMs: number;
    maxContextTokens: number;
    maxTokens: number;
    maxConcurrency: number;
    dailyBudgetTokens?: number;
  }>().notNull(),
  capabilities: text('capabilities').array().notNull().default([]),
  isDefault: integer('is_default').notNull().default(0),
  status: text('status').notNull().default('active'), // active, disabled, error
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

import { profiles } from '../database/schema.ts';

const MASTER_KEY = process.env.AI_CREDENTIAL_MASTER_KEY || 'dev-master-key-change-in-production-32b!';
const MASTER_KEY_BUFFER = createHash('sha256').update(MASTER_KEY).digest();

function encryptCredential(credential: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', MASTER_KEY_BUFFER, iv);
  const encrypted = Buffer.concat([cipher.update(credential, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return iv.toString('base64') + ':' + encrypted.toString('base64') + ':' + authTag.toString('base64');
}

function decryptCredential(encrypted: string): string {
  const [ivB64, encryptedB64, authTagB64] = encrypted.split(':');
  const iv = Buffer.from(ivB64, 'base64');
  const encryptedBuf = Buffer.from(encryptedB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', MASTER_KEY_BUFFER, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encryptedBuf), decipher.final()]);
  return decrypted.toString('utf8');
}

function hashCredential(credential: string): string {
  return createHash('sha256').update(credential).digest('hex').slice(0, 32);
}

export interface AIConnectionInput {
  name: string;
  adapterId: string;
  baseUrl: string;
  model: string;
  credential: string; // API key u otro secreto
  roles: string[];
  limits: {
    timeoutMs: number;
    maxContextTokens: number;
    maxTokens: number;
    maxConcurrency: number;
    dailyBudgetTokens?: number;
  };
  capabilities: string[];
  isDefault: boolean;
}

export interface AIConnectionOutput {
  id: string;
  name: string;
  adapterId: string;
  baseUrl: string;
  model: string;
  roles: string[];
  limits: {
    timeoutMs: number;
    maxContextTokens: number;
    maxTokens: number;
    maxConcurrency: number;
    dailyBudgetTokens?: number;
  };
  capabilities: string[];
  isDefault: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;
  lastError?: string;
  hasCredential: boolean;
}

export async function createAIConnection(database: Database, ownerId: string, input: AIConnectionInput): Promise<AIConnectionOutput> {
  const credentialRef = hashCredential(input.credential);
  const encryptedCredential = encryptCredential(input.credential);

  // Si es default, desactivar otros defaults del usuario
  if (input.isDefault) {
    await database.orm.update(aiConnections)
      .set({ isDefault: 0, updatedAt: new Date() })
      .where(and(eq(aiConnections.ownerId, ownerId), eq(aiConnections.isDefault, 1)));
  }

  const [connection] = await database.orm.insert(aiConnections).values({
    ownerId,
    name: input.name,
    adapterId: input.adapterId,
    baseUrl: input.baseUrl,
    model: input.model,
    credentialRef,
    encryptedCredential,
    roles: input.roles,
    limits: input.limits,
    capabilities: input.capabilities,
    isDefault: input.isDefault ? 1 : 0,
    status: 'active',
  }).returning({
    id: aiConnections.id,
    name: aiConnections.name,
    adapterId: aiConnections.adapterId,
    baseUrl: aiConnections.baseUrl,
    model: aiConnections.model,
    roles: aiConnections.roles,
    limits: aiConnections.limits,
    capabilities: aiConnections.capabilities,
    isDefault: aiConnections.isDefault,
    status: aiConnections.status,
    createdAt: aiConnections.createdAt,
    updatedAt: aiConnections.updatedAt,
    lastUsedAt: aiConnections.lastUsedAt,
    lastError: aiConnections.lastError,
  });

  return { ...connection, hasCredential: true };
}

export async function listAIConnections(database: Database, ownerId: string): Promise<AIConnectionOutput[]> {
  const connections = await database.orm.select({
    id: aiConnections.id,
    name: aiConnections.name,
    adapterId: aiConnections.adapterId,
    baseUrl: aiConnections.baseUrl,
    model: aiConnections.model,
    roles: aiConnections.roles,
    limits: aiConnections.limits,
    capabilities: aiConnections.capabilities,
    isDefault: aiConnections.isDefault,
    status: aiConnections.status,
    createdAt: aiConnections.createdAt,
    updatedAt: aiConnections.updatedAt,
    lastUsedAt: aiConnections.lastUsedAt,
    lastError: aiConnections.lastError,
  }).from(aiConnections).where(eq(aiConnections.ownerId, ownerId));

  return connections.map(c => ({ ...c, hasCredential: true }));
}

export async function getAIConnection(database: Database, ownerId: string, connectionId: string): Promise<AIConnectionOutput | null> {
  const [connection] = await database.orm.select({
    id: aiConnections.id,
    name: aiConnections.name,
    adapterId: aiConnections.adapterId,
    baseUrl: aiConnections.baseUrl,
    model: aiConnections.model,
    roles: aiConnections.roles,
    limits: aiConnections.limits,
    capabilities: aiConnections.capabilities,
    isDefault: aiConnections.isDefault,
    status: aiConnections.status,
    createdAt: aiConnections.createdAt,
    updatedAt: aiConnections.updatedAt,
    lastUsedAt: aiConnections.lastUsedAt,
    lastError: aiConnections.lastError,
  }).from(aiConnections).where(and(eq(aiConnections.ownerId, ownerId), eq(aiConnections.id, connectionId))).limit(1);

  return connection ? { ...connection, hasCredential: true } : null;
}

export async function getAIConnectionWithCredential(database: Database, ownerId: string, connectionId: string): Promise<{ connection: AIConnectionOutput; credential: string } | null> {
  const [connection] = await database.orm.select().from(aiConnections).where(and(eq(aiConnections.ownerId, ownerId), eq(aiConnections.id, connectionId))).limit(1);
  if (!connection) return null;
  return { connection: { ...connection, hasCredential: true }, credential: decryptCredential(connection.encryptedCredential) };
}

export async function updateAIConnection(database: Database, ownerId: string, connectionId: string, updates: Partial<AIConnectionInput>): Promise<AIConnectionOutput | null> {
  const data: any = { updatedAt: new Date() };

  if (updates.name) data.name = updates.name;
  if (updates.adapterId) data.adapterId = updates.adapterId;
  if (updates.baseUrl) data.baseUrl = updates.baseUrl;
  if (updates.model) data.model = updates.model;
  if (updates.roles) data.roles = updates.roles;
  if (updates.limits) data.limits = updates.limits;
  if (updates.capabilities) data.capabilities = updates.capabilities;
  if (updates.isDefault !== undefined) {
    data.isDefault = updates.isDefault ? 1 : 0;
    if (updates.isDefault) {
      await database.orm.update(aiConnections)
        .set({ isDefault: 0, updatedAt: new Date() })
        .where(and(eq(aiConnections.ownerId, ownerId), eq(aiConnections.isDefault, 1)));
    }
  }

  if (updates.credential) {
    data.credentialRef = hashCredential(updates.credential);
    data.encryptedCredential = encryptCredential(updates.credential);
  }

  const [connection] = await database.orm.update(aiConnections)
    .set(data)
    .where(and(eq(aiConnections.ownerId, ownerId), eq(aiConnections.id, connectionId)))
    .returning({
      id: aiConnections.id,
      name: aiConnections.name,
      adapterId: aiConnections.adapterId,
      baseUrl: aiConnections.baseUrl,
      model: aiConnections.model,
      roles: aiConnections.roles,
      limits: aiConnections.limits,
      capabilities: aiConnections.capabilities,
      isDefault: aiConnections.isDefault,
      status: aiConnections.status,
      createdAt: aiConnections.createdAt,
      updatedAt: aiConnections.updatedAt,
      lastUsedAt: aiConnections.lastUsedAt,
      lastError: aiConnections.lastError,
    });

  return connection ? { ...connection, hasCredential: true } : null;
}

export async function deleteAIConnection(database: Database, ownerId: string, connectionId: string): Promise<boolean> {
  const result = await database.orm.delete(aiConnections).where(and(eq(aiConnections.ownerId, ownerId), eq(aiConnections.id, connectionId)));
  return (result.rowCount ?? 0) > 0;
}

export async function recordAIConnectionUsage(database: Database, ownerId: string, connectionId: string, error?: string): Promise<void> {
  const updates: any = { lastUsedAt: new Date() };
  if (error) {
    updates.lastError = error;
    updates.errorCount = sql`${aiConnections.errorCount} + 1`;
    if (error.includes('UNAUTHORIZED') || error.includes('QUOTA_EXCEEDED')) {
      updates.status = 'error';
    }
  }
  await database.orm.update(aiConnections).set(updates).where(and(eq(aiConnections.ownerId, ownerId), eq(aiConnections.id, connectionId)));
}

// Resolver conexión para una petición: personal > default admin
export async function resolveAIConnection(database: Database, ownerId: string, adminDefaultConnectionId?: string): Promise<{ connection: any; credential: string } | null> {
  // 1. Buscar conexión personal activa
  const personal = await database.orm.select().from(aiConnections)
    .where(and(eq(aiConnections.ownerId, ownerId), eq(aiConnections.status, 'active')))
    .orderBy(sql`CASE WHEN ${aiConnections.isDefault} = 1 THEN 0 ELSE 1 END, ${aiConnections.createdAt}`)
    .limit(1);

  if (personal.length > 0) {
    return { connection: personal[0], credential: decryptCredential(personal[0].encryptedCredential) };
  }

  // 2. Fallback a configuración default del admin
  if (adminDefaultConnectionId) {
    const admin = await database.orm.select().from(aiConnections)
      .where(and(eq(aiConnections.id, adminDefaultConnectionId), eq(aiConnections.status, 'active')))
      .limit(1);
    if (admin.length > 0) {
      return { connection: admin[0], credential: decryptCredential(admin[0].encryptedCredential) };
    }
  }

  return null;
}