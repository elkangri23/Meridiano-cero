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

// Default mock provider for development/E2E tests - returns valid action interpretations
export function createDefaultMockProvider(): AiProvider {
  return createMockProvider((request) => {
    if (request.operation === 'interpretAction') {
      // Return the first offered action as the interpretation
      const offers = request.context.offers as Array<{ id: string; label: string }> | undefined;
      const firstOffer = offers && offers.length > 0 ? offers[0] : undefined;
      return { kind: 'actions', actionIds: firstOffer ? [firstOffer.id] : ['inspect-room'] };
    }
    if (request.operation === 'narrateResult') {
      return { act: 'state', factIds: [] };
    }
    if (request.operation === 'converse') {
      return { act: 'inform', factIds: [], text: 'Entendido.' };
    }
    throw new Error('Unknown operation: ' + request.operation);
  });
}
