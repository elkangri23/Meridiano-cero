import { parseOllamaConfig } from './ollama-config.js';
export { OllamaProvider, createOllamaProvider, type OllamaConfig } from './ollama.js';
export { DeterministicMockProvider, createDeterministicMockProvider } from './mock.js';
export { FreeLLMAPIProvider, createFreeLLMAPIProvider, type FreeLLMAPIConfig, parseFreeLLMAPIConfig } from './freellmapi.js';
export { OpenAIProvider, createOpenAIProvider, type OpenAIConfig, parseOpenAIConfig } from './openai.js';
export { OpenAICompatibleProvider, createOpenAICompatibleProvider, type OpenAICompatibleConfig, parseOpenAICompatibleConfig } from './openai-compatible.js';
export { OpenAIChatProvider, parseOpenAIChatConfig, type OpenAIChatConfig } from './openai-chat.js';
export { AnthropicProvider, createAnthropicProvider, type AnthropicConfig, parseAnthropicConfig } from './anthropic.js';
export { GoogleProvider, createGoogleProvider, type GoogleConfig, parseGoogleConfig } from './google.js';

import type { AIProvider, ProviderId } from '../types.js';
import { OllamaProvider } from './ollama.js';
import { DeterministicMockProvider } from './mock.js';
import { FreeLLMAPIProvider, type FreeLLMAPIConfig } from './freellmapi.js';
import { OpenAIProvider, type OpenAIConfig } from './openai.js';
import { OpenAICompatibleProvider, type OpenAICompatibleConfig } from './openai-compatible.js';
import { AnthropicProvider, type AnthropicConfig } from './anthropic.js';
import { GoogleProvider, type GoogleConfig } from './google.js';

export interface ProviderRegistry {
  ollama: OllamaProvider;
  mock: DeterministicMockProvider;
  freellmapi: FreeLLMAPIProvider;
  openai: OpenAIProvider;
  'openai-compatible': OpenAICompatibleProvider;
  anthropic: AnthropicProvider;
  google: GoogleProvider;
}

export function createProvider(providerId: ProviderId, config?: Record<string, unknown>): AIProvider {
  switch (providerId) {
    case 'ollama':
      return new OllamaProvider(parseOllamaConfig(config));
    case 'mock':
    case 'mock-deterministic':
      return new DeterministicMockProvider();
    case 'freellmapi':
      return new FreeLLMAPIProvider(config as unknown as Partial<FreeLLMAPIConfig>);
    case 'openai':
      return new OpenAIProvider(config as unknown as Partial<OpenAIConfig>);
    case 'openai-compatible':
      return new OpenAICompatibleProvider(config as unknown as Partial<OpenAICompatibleConfig>);
    case 'anthropic':
      return new AnthropicProvider(config as unknown as Partial<AnthropicConfig>);
    case 'google':
      return new GoogleProvider(config as unknown as Partial<GoogleConfig>);
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

export function createDefaultProviders(config: {
  ollamaBaseUrl?: string;
  ollamaModel?: string;
  freellmapiApiKey?: string;
  freellmapiBaseUrl?: string;
  freellmapiModel?: string;
} = {}): Record<string, AIProvider> {
  const {
    ollamaBaseUrl = 'http://localhost:11434',
    ollamaModel = 'llama3.1:8b',
    freellmapiApiKey = '',
    freellmapiBaseUrl = 'https://api.freellmapi.com/v1',
    freellmapiModel = 'gpt-4o-mini',
  } = config;
  return {
    ollama: new OllamaProvider({
      baseUrl: ollamaBaseUrl,
      defaultModel: ollamaModel,
      timeoutMs: 60000,
      maxRetries: 1,
      maxContextTokens: 8192,
    }),
    mock: new DeterministicMockProvider(),
    freellmapi: new FreeLLMAPIProvider({
      apiKey: freellmapiApiKey,
      baseUrl: freellmapiBaseUrl,
      defaultModel: freellmapiModel,
      timeoutMs: 60000,
      maxRetries: 2,
    }),
    openai: new OpenAIProvider({ apiKey: '', timeoutMs: 60000, maxRetries: 2 }),
    'openai-compatible': new OpenAICompatibleProvider({ baseUrl: 'http://localhost:1234/v1', defaultModel: 'local-model', timeoutMs: 60000, maxRetries: 2 }),
    anthropic: new AnthropicProvider({ apiKey: '', timeoutMs: 60000, maxRetries: 2 }),
    google: new GoogleProvider({ apiKey: '', timeoutMs: 60000, maxRetries: 2 }),
  };
}
