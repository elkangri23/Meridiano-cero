import { AiError } from './provider.ts';
import type { AiProvider, AiRequest, AiResponse } from './provider.ts';

// Explicit deterministic double for tests/evaluation; never selected automatically on transport failure.
export function createMockProvider(
  respond: (request: AiRequest) => unknown,
): AiProvider {
  return {
    providerId: 'mock', model: 'deterministic-ci',
    async request(request): Promise<AiResponse> {
      if (request.signal?.aborted) throw new AiError('cancelled');
      return { payload: respond(structuredClone({ operation: request.operation, requestId: request.requestId, schema: request.schema, context: request.context })),
        usage: null, latencyMs: 0, finishReason: 'stop' };
    },
  };
}
