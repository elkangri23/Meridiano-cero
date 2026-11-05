import { createOllamaProvider } from '@meridiano/ai-adapters';
import { createCompatibleProvider } from './compat-adapter.ts';
import type { AiProvider } from './provider.ts';

/**
 * Adaptador de compatibilidad para el motor existente.
 * Envuelve el Provider unificado de 'ai-adapters' para satisfacer el contrato AiProvider de la API.
 */
export function createCompatibleOllamaProvider(options: {
  model: string;
  origin?: string;
  timeoutMs?: number;
}): AiProvider {
  const provider = createOllamaProvider({
    baseUrl: options.origin ?? 'http://127.0.0.1:11434',
    defaultModel: options.model,
    timeoutMs: options.timeoutMs ?? 60000,
    maxRetries: 1, // Coherente con el intento de reintento del motor original
  });

  return createCompatibleProvider(provider, {
    providerId: 'ollama',
    model: options.model,
    timeoutMs: options.timeoutMs ?? 60000,
  });
}
