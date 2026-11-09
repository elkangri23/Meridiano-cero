// Rutas de conexiones IA personales (Fase C, T7-02).
// El usuario gestiona sus propias conexiones (proveedor, modelo, clave,
// endpoint) y el servidor resuelve personal > defecto del administrador.
// Las credenciales nunca salen del servidor: las respuestas solo indican si
// existe credencial, nunca su valor.

import type { FastifyInstance } from 'fastify';
import type { AppConfig } from '../config.ts';
import type { Database } from '../database/connection.ts';
import { RunStoreError } from '../game/runs.ts';
import { createAuthorizer } from './authorize.ts';
import {
  createAIConnection, listAIConnections, getAIConnection, getAIConnectionWithCredential,
  updateAIConnection, deleteAIConnection, disableAllAIConnections, recordAIConnectionUsage,
  setAIConnectionStatus,
  type AIConnectionInput,
} from './ai-connections.ts';
import { localizedCatalog, catalogEntry, buildProviderFromAdapter, resolveRequestProvider, type ProviderCatalogEntry } from './provider-factory.ts';
import { parseLanguage } from '@meridiano/case-schema';
import { validateConnectionBaseUrl } from './destination-policy.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function textField(value: unknown, min: number, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) return null;
  return trimmed;
}

const DEFAULT_LIMITS = { timeoutMs: 60000, maxContextTokens: 8192, maxTokens: 1024, maxConcurrency: 2 };
const DEFAULT_ROLES = ['interpretAction', 'narrateResult', 'converse'];

async function resolveCreateBaseUrl(entry: ProviderCatalogEntry, raw: unknown, mode: 'development' | 'production'): Promise<string> {
  if (entry.fixedBaseUrl) {
    if (typeof raw === 'string' && raw.trim() !== '' && raw.trim() !== entry.defaultBaseUrl) {
      throw new RunStoreError('INVALID_REQUEST');
    }
    return entry.defaultBaseUrl;
  }
  const rawBaseUrl = textField(raw, 1, 512);
  if (!rawBaseUrl) throw new RunStoreError('INVALID_REQUEST');
  try {
    return await validateConnectionBaseUrl(entry.id, rawBaseUrl, mode);
  } catch (error) {
    // El motivo real del rechazo (p. ej. destino no permitido) llega a la
    // UI; el resto de validaciones sigue siendo INVALID_REQUEST genérico.
    if (error instanceof Error) throw new RunStoreError('INVALID_DESTINATION', error.message);
    throw new RunStoreError('INVALID_REQUEST');
  }
}

async function buildCreateInput(body: Record<string, unknown>, mode: 'development' | 'production'): Promise<AIConnectionInput> {
  const name = textField(body.name, 1, 100);
  const adapterId = typeof body.adapterId === 'string' ? body.adapterId : '';
  const entry = catalogEntry(adapterId);
  if (!name || !entry) throw new RunStoreError('INVALID_REQUEST');
  const model = textField(body.model, 1, 128) ?? entry.defaultModel;
  const credential = typeof body.credential === 'string' ? body.credential : '';
  if (entry.needsKey && !credential) throw new RunStoreError('INVALID_REQUEST');
  return {
    name,
    adapterId: entry.id,
    baseUrl: await resolveCreateBaseUrl(entry, body.baseUrl, mode),
    model,
    credential,
    roles: DEFAULT_ROLES,
    limits: DEFAULT_LIMITS,
    capabilities: [],
    isDefault: body.isDefault === true,
  };
}

async function parseNameUpdate(body: Record<string, unknown>, database: Database, ownerId: string, currentId: string): Promise<string | undefined> {
  if (body.name === undefined) return undefined;
  const name = textField(body.name, 1, 100);
  if (!name) throw new RunStoreError('INVALID_REQUEST');
  const existing = await listAIConnections(database, ownerId);
  if (existing.some(item => item.name === name && item.id !== currentId)) throw new RunStoreError('INVALID_REQUEST');
  return name;
}

function parseModelUpdate(body: Record<string, unknown>): string | undefined {
  if (body.model === undefined) return undefined;
  const model = textField(body.model, 1, 128);
  if (!model) throw new RunStoreError('INVALID_REQUEST');
  return model;
}

async function parseBaseUrlUpdate(body: Record<string, unknown>, entry: ProviderCatalogEntry, adapterId: string, mode: 'development' | 'production'): Promise<string | undefined> {
  if (body.baseUrl === undefined) return undefined;
  if (entry.fixedBaseUrl) throw new RunStoreError('INVALID_REQUEST');
  const rawBaseUrl = textField(body.baseUrl, 1, 512);
  if (!rawBaseUrl) throw new RunStoreError('INVALID_REQUEST');
  try {
    return await validateConnectionBaseUrl(adapterId, rawBaseUrl, mode);
  } catch (error) {
    if (error instanceof Error) throw new RunStoreError('INVALID_DESTINATION', error.message);
    throw new RunStoreError('INVALID_REQUEST');
  }
}

function parseCredentialUpdate(body: Record<string, unknown>, entry: ProviderCatalogEntry): string | undefined {
  if (body.credential === undefined) return undefined;
  if (typeof body.credential !== 'string' || body.credential.length > 512) throw new RunStoreError('INVALID_REQUEST');
  if (entry.needsKey && !body.credential) throw new RunStoreError('INVALID_REQUEST');
  return body.credential;
}

function parseBooleanUpdate(body: Record<string, unknown>, key: string): boolean | undefined {
  if (body[key] === undefined) return undefined;
  if (typeof body[key] !== 'boolean') throw new RunStoreError('INVALID_REQUEST');
  return body[key] as boolean;
}

function parseStatusUpdate(body: Record<string, unknown>): 'active' | 'disabled' | undefined {
  if (body.status === undefined) return undefined;
  if (body.status !== 'active' && body.status !== 'disabled') throw new RunStoreError('INVALID_REQUEST');
  return body.status;
}

type ConnectionUpdates = Partial<AIConnectionInput> & { status?: 'active' | 'disabled' };

async function parseConnectionUpdates(
  body: Record<string, unknown>,
  entry: ProviderCatalogEntry,
  current: { id: string; adapterId: string },
  database: Database,
  ownerId: string,
  mode: 'development' | 'production',
): Promise<ConnectionUpdates> {
  const updates: ConnectionUpdates = {};
  const name = await parseNameUpdate(body, database, ownerId, current.id);
  if (name !== undefined) updates.name = name;
  const model = parseModelUpdate(body);
  if (model !== undefined) updates.model = model;
  const baseUrl = await parseBaseUrlUpdate(body, entry, current.adapterId, mode);
  if (baseUrl !== undefined) updates.baseUrl = baseUrl;
  const credential = parseCredentialUpdate(body, entry);
  if (credential !== undefined) updates.credential = credential;
  const isDefault = parseBooleanUpdate(body, 'isDefault');
  if (isDefault !== undefined) updates.isDefault = isDefault;
  const status = parseStatusUpdate(body);
  if (status !== undefined) updates.status = status;
  return updates;
}

export function registerAiConnectionRoutes(app: FastifyInstance, config: AppConfig, database: Database): void {
  const authorize = createAuthorizer(config, database);

  // GET /api/v1/ai/connections — catálogo, conexiones propias y proveedor efectivo.
  app.get('/api/v1/ai/connections', { onRequest: async (request) => { await authorize(request); } }, async (request, reply) => {
    const ownerId = await authorize(request);
    const connections = await listAIConnections(database, ownerId);
    const resolved = await resolveRequestProvider(database, ownerId, config);
    return reply.send({
      // El catálogo se localiza con la cabecera `x-meridiano-language`:
      // antes se servían las etiquetas y ayudas en español tal cual.
      catalog: localizedCatalog(parseLanguage(request.headers['x-meridiano-language'])),
      connections,
      effective: {
        source: resolved.source,
        providerId: resolved.providerId,
        model: resolved.model,
        connectionId: resolved.connectionId ?? null,
        connectionName: resolved.connectionName ?? null,
      },
    });
  });

  // POST /api/v1/ai/connections — crear conexión personal.
  app.post('/api/v1/ai/connections', { onRequest: async (request) => { await authorize(request); } }, async (request, reply) => {
    const ownerId = await authorize(request);
    if (!isRecord(request.body)) throw new RunStoreError('INVALID_REQUEST');
    const input = await buildCreateInput(request.body, config.mode);
    const existing = await listAIConnections(database, ownerId);
    if (existing.some(item => item.name === input.name)) throw new RunStoreError('INVALID_REQUEST');
    const connection = await createAIConnection(database, ownerId, input);
    return reply.code(201).send({ connection });
  });

  // PATCH /api/v1/ai/connections/:id — actualizar conexión propia.
  app.patch<{ Params: { id: string } }>('/api/v1/ai/connections/:id', { onRequest: async (request) => { await authorize(request); } }, async (request, reply) => {
    const ownerId = await authorize(request);
    const current = await getAIConnection(database, ownerId, request.params.id);
    if (!current) throw new RunStoreError('NOT_FOUND');
    if (!isRecord(request.body)) throw new RunStoreError('INVALID_REQUEST');
    const entry = catalogEntry(current.adapterId);
    if (!entry) throw new RunStoreError('INVALID_REQUEST');
    const updates = await parseConnectionUpdates(request.body, entry, current, database, ownerId, config.mode);
    const updated = await updateAIConnection(database, ownerId, current.id, updates);
    if (!updated) throw new RunStoreError('NOT_FOUND');
    // updateAIConnection no persiste `status` (no está en AIConnectionInput).
    if (updates.status) {
      const refreshed = await setAIConnectionStatus(database, ownerId, current.id, updates.status);
      if (!refreshed) throw new RunStoreError('NOT_FOUND');
      return reply.send({ connection: refreshed });
    }
    return reply.send({ connection: updated });
  });

  // DELETE /api/v1/ai/connections/:id — borrar conexión propia.
  app.delete<{ Params: { id: string } }>('/api/v1/ai/connections/:id', { onRequest: async (request) => { await authorize(request); } }, async (request, reply) => {
    const ownerId = await authorize(request);
    const deleted = await deleteAIConnection(database, ownerId, request.params.id);
    if (!deleted) throw new RunStoreError('NOT_FOUND');
    return reply.code(204).send();
  });

  // POST /api/v1/ai/connections/:id/test — probar la conexión con su credencial guardada.
  app.post<{ Params: { id: string } }>('/api/v1/ai/connections/:id/test', { onRequest: async (request) => { await authorize(request); } }, async (request, reply) => {
    const ownerId = await authorize(request);
    const stored = await getAIConnectionWithCredential(database, ownerId, request.params.id);
    if (!stored) throw new RunStoreError('NOT_FOUND');
    const { connection, credential } = stored;
    try {
      const provider = buildProviderFromAdapter(connection.adapterId, {
        baseUrl: connection.baseUrl,
        model: connection.model,
        apiKey: credential,
        timeoutMs: connection.limits?.timeoutMs ?? 60000,
      });
      const health = await provider.healthCheck?.() ?? { available: false, error: 'healthCheck no implementado' };
      await recordAIConnectionUsage(database, ownerId, connection.id, health.available ? undefined : (health.error ?? 'unavailable'));
      return reply.send({ available: health.available, latencyMs: health.latencyMs, error: health.error });
    } catch {
      await recordAIConnectionUsage(database, ownerId, connection.id, 'unavailable');
      return reply.send({ available: false, error: 'La conexión no es válida.' });
    }
  });

  // POST /api/v1/ai/connections/use-default — volver al proveedor del servidor.
  app.post('/api/v1/ai/connections/use-default', { onRequest: async (request) => { await authorize(request); } }, async (request, reply) => {
    const ownerId = await authorize(request);
    await disableAllAIConnections(database, ownerId);
    const resolved = await resolveRequestProvider(database, ownerId, config);
    return reply.send({
      effective: {
        source: resolved.source,
        providerId: resolved.providerId,
        model: resolved.model,
        connectionId: resolved.connectionId ?? null,
        connectionName: resolved.connectionName ?? null,
      },
    });
  });
}
