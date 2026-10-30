import { describe, it, expect, vi } from 'vitest';

// Mock the ai-adapters module at the top level
vi.mock('@meridiano/ai-adapters', () => ({
  createOllamaProvider: () => ({
    execute: vi.fn().mockResolvedValue({
      payload: { text: 'hola' },
      usage: { promptTokens: 10, completionTokens: 5 },
      latencyMs: 100,
      finishReason: 'stop',
    }),
  }),
}));

import { createCompatibleOllamaProvider } from './ollama-adapter.js';

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