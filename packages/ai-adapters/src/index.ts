// AI Adapters - Contratos y tipos para integración de IA
// SPEC-005: Integración de IA y fidelidad narrativa
export * from './types.js';

// Re-export from providers
export { createProvider } from './providers/index.js';
export { OllamaProvider, createOllamaProvider, type OllamaConfig } from './providers/index.js';
export { DeterministicMockProvider, createDeterministicMockProvider } from './providers/index.js';
export { FreeLLMAPIProvider, createFreeLLMAPIProvider, type FreeLLMAPIConfig, parseFreeLLMAPIConfig } from './providers/index.js';
export { OpenAIProvider, createOpenAIProvider, type OpenAIConfig, parseOpenAIConfig } from './providers/index.js';
export { OpenAICompatibleProvider, createOpenAICompatibleProvider, type OpenAICompatibleConfig, parseOpenAICompatibleConfig } from './providers/index.js';
export { OpenAIChatProvider, parseOpenAIChatConfig, type OpenAIChatConfig } from './providers/index.js';
export { AnthropicProvider, createAnthropicProvider, type AnthropicConfig, parseAnthropicConfig } from './providers/index.js';
export { GoogleProvider, createGoogleProvider, type GoogleConfig, parseGoogleConfig } from './providers/index.js';