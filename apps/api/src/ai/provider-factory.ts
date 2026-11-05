// Catálogo de proveedores y resolución personal > defecto del administrador.
// La conexión personal del usuario (ai_connections) manda sobre el defecto
// configurado por entorno; sin conexión personal válida se usa el defecto;
// sin defecto, el mock determinista. Nunca se cambia silenciosamente de una
// conexión personal al proveedor común: una configuración personal rota se
// resuelve a un proveedor que siempre responde «no disponible» y el director
// aplica la aclaración/respaldo factual.

import { createProvider } from '@meridiano/ai-adapters';
import { AiError, type AiProvider } from './provider.ts';
import { createCompatibleProvider } from './compat-adapter.ts';
import { createCompatibleOllamaProvider } from './ollama-adapter.ts';
import { createDefaultMockProvider } from './mock.ts';
import { resolveAIConnection } from './ai-connections.ts';
import type { AppConfig } from '../config.ts';
import type { Database } from '../database/connection.ts';

export interface ProviderCatalogEntry {
  id: string;
  label: string;
  needsKey: boolean;
  needsBaseUrl: boolean;
  /** La baseUrl es fija del catálogo y el usuario no la cambia. */
  fixedBaseUrl: boolean;
  defaultBaseUrl: string;
  defaultModel: string;
  hint: string;
}

export const PROVIDER_CATALOG: ProviderCatalogEntry[] = [
  { id: 'freellmapi', label: 'FreeLLMAPI', needsKey: true, needsBaseUrl: false, fixedBaseUrl: true,
    defaultBaseUrl: 'https://api.freellmapi.com/v1', defaultModel: 'gpt-4o-mini',
    hint: 'Servicio compatible con OpenAI. En este servidor es el proveedor predeterminado.' },
  { id: 'openai', label: 'OpenAI', needsKey: true, needsBaseUrl: false, fixedBaseUrl: true,
    defaultBaseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o-mini',
    hint: 'Tu clave de OpenAI; los tokens los pagas tú.' },
  { id: 'anthropic', label: 'Anthropic (Claude)', needsKey: true, needsBaseUrl: false, fixedBaseUrl: true,
    defaultBaseUrl: 'https://api.anthropic.com', defaultModel: 'claude-sonnet-4-5',
    hint: 'Tu clave de Anthropic; los tokens los pagas tú.' },
  { id: 'google', label: 'Google (Gemini)', needsKey: true, needsBaseUrl: false, fixedBaseUrl: true,
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta', defaultModel: 'gemini-2.5-flash',
    hint: 'Tu clave de Google AI Studio; los tokens los pagas tú.' },
  { id: 'ollama', label: 'Ollama local', needsKey: false, needsBaseUrl: true, fixedBaseUrl: false,
    defaultBaseUrl: 'http://127.0.0.1:11434', defaultModel: 'llama3.1:8b',
    hint: 'Solo funciona en una instalación en casa con Ollama en este equipo.' },
  { id: 'openai-compatible', label: 'OpenAI-compatible (LM Studio u otro)', needsKey: false, needsBaseUrl: true, fixedBaseUrl: false,
    defaultBaseUrl: 'http://localhost:1234/v1', defaultModel: 'local-model',
    hint: 'LM Studio en http://localhost:1234/v1 u otro endpoint compatible. En el servidor solo se admiten destinos HTTPS públicos.' },
];

export function catalogEntry(adapterId: string): ProviderCatalogEntry | undefined {
  return PROVIDER_CATALOG.find(entry => entry.id === adapterId);
}

export function defaultModelFor(adapterId: string): string {
  return catalogEntry(adapterId)?.defaultModel ?? '';
}

export function defaultBaseUrlFor(adapterId: string): string {
  return catalogEntry(adapterId)?.defaultBaseUrl ?? '';
}

/** Proveedor que siempre falla como no disponible (configuración personal rota). */
export function createUnavailableProvider(providerId: string, model: string): AiProvider {
  return {
    providerId,
    model,
    async request(): Promise<never> { throw new AiError('unavailable'); },
  };
}

export function buildProviderFromAdapter(
  adapterId: string,
  options: { baseUrl: string; model: string; apiKey: string; timeoutMs?: number },
): AiProvider {
  const timeoutMs = options.timeoutMs ?? 60000;
  if (adapterId === 'ollama') {
    return createCompatibleOllamaProvider({ model: options.model, origin: options.baseUrl, timeoutMs });
  }
  const provider = createProvider(adapterId as never, {
    apiKey: options.apiKey,
    baseUrl: options.baseUrl,
    defaultModel: options.model,
    timeoutMs,
    maxRetries: 2,
  } as Record<string, unknown>);
  return createCompatibleProvider(provider, { providerId: adapterId, model: options.model, timeoutMs });
}

type KeyedProviderId = 'freellmapi' | 'openai' | 'anthropic' | 'google' | 'openai-compatible';

function buildKeyedAdminProvider(providerId: KeyedProviderId, config: AppConfig): AiProvider {
  return buildProviderFromAdapter(providerId, {
    baseUrl: config.aiBaseUrl ?? defaultBaseUrlFor(providerId),
    model: config.aiModel ?? defaultModelFor(providerId),
    apiKey: config.aiApiKey ?? '',
    timeoutMs: config.aiTimeoutMs ?? 60000,
  });
}

/** Proveedor predeterminado del administrador, desde la configuración de entorno. */
export function buildAdminProvider(config: AppConfig): AiProvider {
  if (config.aiProvider === 'ollama') {
    return createCompatibleOllamaProvider({
      model: config.aiModel ?? 'llama3.1:8b',
      origin: config.aiBaseUrl ?? 'http://127.0.0.1:11434',
      timeoutMs: config.aiTimeoutMs ?? 60000,
    });
  }
  if (config.aiProvider === 'mock' || config.aiProvider === 'none') return createDefaultMockProvider();
  return buildKeyedAdminProvider(config.aiProvider, config);
}

export interface ResolvedProvider {
  provider: AiProvider;
  providerId: string;
  model: string;
  source: 'personal' | 'admin' | 'mock';
  connectionId?: string;
  connectionName?: string;
}

/** Resolución por petición: conexión personal activa > defecto del administrador > mock. */
export async function resolveRequestProvider(
  database: Database,
  ownerId: string,
  config: AppConfig,
): Promise<ResolvedProvider> {
  const resolved = await resolveAIConnection(database, ownerId);
  if (resolved) {
    const conn = resolved.connection as { id: string; name: string; adapterId: string; baseUrl: string; model: string; limits?: { timeoutMs?: number } };
    try {
      const provider = buildProviderFromAdapter(conn.adapterId, {
        baseUrl: conn.baseUrl,
        model: conn.model,
        apiKey: resolved.credential,
        timeoutMs: conn.limits?.timeoutMs ?? 60000,
      });
      return { provider, providerId: conn.adapterId, model: conn.model, source: 'personal', connectionId: conn.id, connectionName: conn.name };
    } catch {
      return { provider: createUnavailableProvider(conn.adapterId, conn.model), providerId: conn.adapterId,
        model: conn.model, source: 'personal', connectionId: conn.id, connectionName: conn.name };
    }
  }
  if (config.aiProvider === 'mock' || config.aiProvider === 'none') {
    return { provider: createDefaultMockProvider(), providerId: 'mock', model: 'deterministic-ci', source: 'mock' };
  }
  return {
    provider: buildAdminProvider(config),
    providerId: config.aiProvider,
    model: config.aiModel ?? defaultModelFor(config.aiProvider),
    source: 'admin',
  };
}
