import { describe, it, expect, vi } from 'vitest';
import { createCompatibleOllamaProvider } from './ollama-adapter.js';
import type { AiRequest } from './provider.js';

vi.mock('@meridiano/ai-adapters', () => {
  return {
    createOllamaProvider: () => ({
      execute: vi.fn().mockResolvedValue({
        payload: { text: 'hola' },
        usage: { promptTokens: 10, completionTokens: 5 },
        latencyMs: 100,
        finishReason: 'stop'
      })
    })
  };
});

describe('ollama-adapter', () => {
  it('mapea correctamente una respuesta exitosa', async () => {
    const adapter = createCompatibleOllamaProvider({ model: 'test-model' });
    const req = {
      operation: 'converse',
      requestId: 'req-1',
      schema: {},
      context: {}
    };

    const res = await adapter.request(req);
    expect(res.payload).toEqual({ text: 'hola' });
    expect(res.usage).toEqual({ inputTokens: 10, outputTokens: 5 });
  });
});