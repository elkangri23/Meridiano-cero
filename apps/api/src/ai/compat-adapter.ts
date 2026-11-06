// Adaptador de compatibilidad entre la frontera de `packages/ai-adapters`
// (AIProvider) y el contrato AiProvider de la API. Cualquier proveedor del
// catálogo (Ollama, FreeLLMAPI, OpenAI, Anthropic, Google, OpenAI-compatible)
// se conecta a través de aquí; los errores del transporte se normalizan a
// AiError sin filtrar cuerpos del proveedor.

import { AiError, type AiProvider, type AiRequest, type AiResponse } from './provider.ts';
import type { AIProvider } from '@meridiano/ai-adapters';

function mapAdapterError(error: unknown): AiError {
  if (error instanceof AiError) return error;
  if (error instanceof Error && error.message === 'CANCELLED') return new AiError('cancelled');
  if (error instanceof Error && error.message === 'INVALID_OUTPUT') return new AiError('invalid_response');
  if (error instanceof Error && error.message === 'MODEL_UNAVAILABLE') return new AiError('unavailable');
  return new AiError('unavailable');
}

export function createCompatibleProvider(
  provider: AIProvider,
  options: { providerId: string; model: string; timeoutMs?: number },
): AiProvider {
  const timeoutMs = options.timeoutMs ?? 60000;
  return {
    providerId: options.providerId,
    model: options.model,
    async healthCheck() {
      return provider.healthCheck();
    },
    async request(input: AiRequest): Promise<AiResponse> {
      try {
        const response = await provider.execute({
          providerId: provider.id,
          model: options.model,
          function: input.operation as never,
          schemaVersion: 1,
          authorizedContext: input.context,
          limits: { timeoutMs: input.timeoutMs ?? timeoutMs, maxRetries: 1 },
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
            outputTokens: response.usage.completionTokens ?? 0,
          } : null,
          latencyMs: response.latencyMs,
          finishReason: 'stop',
        };
      } catch (error: unknown) {
        throw mapAdapterError(error);
      }
    },
  };
}
