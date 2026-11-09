// Cliente de conexiones IA personales (Fase C).
// Las credenciales nunca viajan de vuelta: las respuestas solo indican si
// existe credencial, nunca su valor.

import { createPreferenceStore } from '@meridiano/contracts';
import type { AiAuth } from './client';

export interface ProviderCatalogEntry {
  id: string;
  label: string;
  needsKey: boolean;
  needsBaseUrl: boolean;
  fixedBaseUrl: boolean;
  defaultBaseUrl: string;
  defaultModel: string;
  hint: string;
}

export interface AiConnection {
  id: string;
  name: string;
  adapterId: string;
  baseUrl: string;
  model: string;
  roles: string[];
  limits: { timeoutMs: number; maxContextTokens: number; maxTokens: number; maxConcurrency: number; dailyBudgetTokens?: number };
  capabilities: string[];
  isDefault: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
  lastError?: string | null;
  hasCredential: boolean;
}

export interface EffectiveProvider {
  source: 'personal' | 'admin' | 'mock';
  providerId: string;
  model: string;
  connectionId: string | null;
  connectionName: string | null;
}

export interface ConnectionsResponse {
  catalog: ProviderCatalogEntry[];
  connections: AiConnection[];
  effective: EffectiveProvider;
}

export interface ConnectionTestResult {
  available: boolean;
  latencyMs?: number;
  error?: string;
}

export class ConnectionsError extends Error {
  /** Motivo real del servidor, solo para errores de destino (INVALID_DESTINATION). */
  constructor(readonly kind: 'unavailable' | 'invalid' | 'not_found' | 'session', readonly detail?: string) { super(kind); }
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  if (!text) return {} as Record<string, unknown>;
  try {
    const body = JSON.parse(text) as unknown;
    if (typeof body !== 'object' || body === null || Array.isArray(body)) throw new Error('invalid');
    return body as Record<string, unknown>;
  } catch {
    throw new ConnectionsError('invalid');
  }
}

async function readErrorDetail(response: Response): Promise<string | undefined> {
  const body = await readJson(response).catch(() => ({} as Record<string, unknown>));
  const errorBody = body.error;
  if (typeof errorBody !== 'object' || errorBody === null) return undefined;
  const record = errorBody as Record<string, unknown>;
  if (record.code !== 'INVALID_DESTINATION' || typeof record.message !== 'string') return undefined;
  return record.message;
}

async function request(
  path: string,
  signal: AbortSignal,
  init: RequestInit,
  auth?: AiAuth,
): Promise<Record<string, unknown>> {
  const headers: Record<string, string> = {};
  // Sin cuerpo no se declara JSON: Fastify rechaza un DELETE con
  // content-type application/json y cuerpo vacío (400).
  if (init.body !== undefined) headers['content-type'] = 'application/json';
  if (auth) headers['x-csrf-token'] = auth.csrfToken;
  // El idioma viaja en cada llamada: el catálogo de proveedores se sirve
  // localizado y el cambio en Ajustes debe reflejarse sin recargar (antes
  // no se mandaba y el catálogo quedaba siempre en español).
  headers['x-meridiano-language'] = createPreferenceStore().load().language;
  let response: Response;
  try {
    response = await fetch(path, { ...init, headers, credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]) });
  } catch {
    if (signal.aborted) throw new ConnectionsError('unavailable');
    throw new ConnectionsError('unavailable');
  }
  if (response.status === 401) throw new ConnectionsError('session');
  if (response.status === 404) throw new ConnectionsError('not_found');
  if (!response.ok) {
    // El servidor solo adjunta mensaje propio a INVALID_DESTINATION; ese
    // motivo real se muestra en el formulario en vez del mensaje genérico.
    throw new ConnectionsError('invalid', await readErrorDetail(response));
  }
  return readJson(response);
}

export const aiConnectionsApi = {
  async list(signal: AbortSignal, auth?: AiAuth): Promise<ConnectionsResponse> {
    const body = await request('/api/v1/ai/connections', signal, { method: 'GET' }, auth);
    if (!Array.isArray(body.catalog) || !Array.isArray(body.connections) || typeof body.effective !== 'object' || body.effective === null) {
      throw new ConnectionsError('invalid');
    }
    return body as unknown as ConnectionsResponse;
  },

  async create(
    input: { name: string; adapterId: string; baseUrl?: string; model: string; credential?: string; isDefault?: boolean },
    signal: AbortSignal,
    auth?: AiAuth,
  ): Promise<AiConnection> {
    const body = await request('/api/v1/ai/connections', signal, { method: 'POST', body: JSON.stringify(input) }, auth);
    if (typeof body.connection !== 'object' || body.connection === null) throw new ConnectionsError('invalid');
    return body.connection as AiConnection;
  },

  async update(
    id: string,
    updates: { name?: string; model?: string; baseUrl?: string; credential?: string; isDefault?: boolean; status?: 'active' | 'disabled' },
    signal: AbortSignal,
    auth?: AiAuth,
  ): Promise<AiConnection> {
    const body = await request(`/api/v1/ai/connections/${id}`, signal, { method: 'PATCH', body: JSON.stringify(updates) }, auth);
    if (typeof body.connection !== 'object' || body.connection === null) throw new ConnectionsError('invalid');
    return body.connection as AiConnection;
  },

  async remove(id: string, signal: AbortSignal, auth?: AiAuth): Promise<void> {
    await request(`/api/v1/ai/connections/${id}`, signal, { method: 'DELETE' }, auth);
  },

  async test(id: string, signal: AbortSignal, auth?: AiAuth): Promise<ConnectionTestResult> {
    const body = await request(`/api/v1/ai/connections/${id}/test`, signal, { method: 'POST', body: JSON.stringify({}) }, auth);
    const result: ConnectionTestResult = { available: body.available === true };
    if (typeof body.latencyMs === 'number') result.latencyMs = body.latencyMs;
    if (typeof body.error === 'string') result.error = body.error;
    return result;
  },

  async useDefault(signal: AbortSignal, auth?: AiAuth): Promise<EffectiveProvider> {
    const body = await request('/api/v1/ai/connections/use-default', signal, { method: 'POST', body: JSON.stringify({}) }, auth);
    if (typeof body.effective !== 'object' || body.effective === null) throw new ConnectionsError('invalid');
    return body.effective as EffectiveProvider;
  },
};
