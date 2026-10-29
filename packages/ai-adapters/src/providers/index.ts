import { parseOllamaConfig } from './ollama-config.js';
export { OllamaProvider, createOllamaProvider, type OllamaConfig } from './ollama.js';
export { DeterministicMockProvider, createDeterministicMockProvider } from './mock.js';

import type { AIProvider, ProviderId } from '../index.js';
import { OllamaProvider } from './ollama.js';
import { DeterministicMockProvider } from './mock.js';

export interface ProviderRegistry {
  ollama: OllamaProvider;
  mock: DeterministicMockProvider;
}

export function createProvider(providerId: ProviderId, config?: Record<string, unknown>): AIProvider {
  switch (providerId) {
    case 'ollama':
      return new OllamaProvider(parseOllamaConfig(config));
    case 'mock':
    case 'mock-deterministic':
      return new DeterministicMockProvider();
    default:
      throw new Error('Proveedor no disponible.');
  }
}

export async function healthCheckAll(providers: Record<string, AIProvider>): Promise<Record<string, { available: boolean; latencyMs?: number; error?: string }>> {
  const results: Record<string, { available: boolean; latencyMs?: number; error?: string }> = {};

  await Promise.all(
    Object.entries(providers).map(async ([id, provider]) => {
      results[id] = await provider.healthCheck();
    })
  );

  return results;
}

export function createDefaultProviders(config?: { ollamaBaseUrl?: string; ollamaModel?: string }): Record<string, AIProvider> {
  return {
    ollama: new OllamaProvider({
      baseUrl: config?.ollamaBaseUrl ?? 'http://localhost:11434',
      defaultModel: config?.ollamaModel ?? 'llama3.1:8b',
      timeoutMs: 60000,
      maxRetries: 1,
      maxContextTokens: 8192,
    }),
    mock: new DeterministicMockProvider(),
  };
}
