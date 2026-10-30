import { createOllamaProvider } from '@meridiano/ai-adapters';
import { AiError, type AiProvider, type AiRequest, type AiResponse } from './provider.js';

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

  return {
    providerId: 'ollama',
    model: options.model,
    async request(input: AiRequest): Promise<AiResponse> {
      try {
        const response = await provider.execute({
          providerId: 'ollama',
          model: options.model,
          function: input.operation as any,
          schemaVersion: 1,
          authorizedContext: input.context,
          limits: {
            timeoutMs: options.timeoutMs ?? 60000,
            maxRetries: 1,
          },
          cancellationSignal: input.signal ?? new AbortController().signal,
          requestId: input.requestId,
        });

        if (!response.payload) {
          throw new AiError(response.error?.code === 'MODEL_UNAVAILABLE' ? 'unavailable' : 'invalid_response');
        }

        return {
          payload: response.payload,
          usage: response.usage ? {
            inputTokens: response.usage.promptTokens ?? 0,
            outputTokens: response.usage.completionTokens ?? 0
          } : null,
          latencyMs: response.latencyMs,
          finishReason: 'stop',
        };
      } catch (error: any) {
        if (error.message === 'CANCELLED') throw new AiError('cancelled');
        if (error.message === 'INVALID_OUTPUT') throw new AiError('invalid_response');
        if (error.message === 'MODEL_UNAVAILABLE') throw new AiError('unavailable');
        throw new AiError('unavailable');
      }
    },
  };
}
