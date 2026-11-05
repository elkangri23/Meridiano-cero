// Tests para los adaptadores OpenAI-compatibles (FreeLLMAPI, OpenAI directo y
// genérico openai-compatible) con transporte simulado.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { createFreeLLMAPIProvider, type FreeLLMAPIConfig } from './freellmapi.js';
import { createOpenAIProvider } from './openai.js';
import { createOpenAICompatibleProvider } from './openai-compatible.js';
import type { AIContext } from '../types.js';

afterEach(() => vi.restoreAllMocks());

function context(model = 'auto'): AIContext {
  return {
    providerId: 'freellmapi',
    model,
    function: 'interpretAction',
    schemaVersion: 1,
    authorizedContext: { text: 'inspecciona la sala', offers: [{ id: 'inspect-room', label: 'Inspeccionar la sala' }] },
    limits: { timeoutMs: 5000, maxRetries: 0 },
    requestId: 'test-1',
  };
}

function chatResponse(content: string): Response {
  return new Response(JSON.stringify({
    choices: [{ message: { content }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

describe('adaptadores OpenAI-compatibles', () => {
  it('FreeLLMAPI interpreta con modelo auto y registra uso', async () => {
    const send = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      chatResponse('{"kind":"actions","actionIds":["inspect:MAD-SALA"]}'),
    );
    const provider = createFreeLLMAPIProvider({ apiKey: 'test-key', baseUrl: 'http://freellmapi:3001/v1', defaultModel: 'auto', maxRetries: 0 });
    const result = await provider.execute(context('auto'));
    expect(result.payload).toEqual({ kind: 'actions', actionIds: ['inspect:MAD-SALA'] });
    expect(result.usage).toEqual({ promptTokens: 10, completionTokens: 5, totalTokens: 15 });
    expect(result.finishReason).toBe('stop');
    expect(send).toHaveBeenCalledWith('http://freellmapi:3001/v1/chat/completions', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('"model":"auto"'),
    }));
  });

  it('OpenAI directo usa api.openai.com por defecto', async () => {
    const send = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      chatResponse('{"kind":"actions","actionIds":["inspect:MAD-SALA"]}'),
    );
    const provider = createOpenAIProvider({ apiKey: 'sk-test', maxRetries: 0 });
    expect(provider.id).toBe('openai');
    expect(provider.defaultModel).toBe('gpt-4o-mini');
    await provider.execute(context('gpt-4o-mini'));
    expect(send).toHaveBeenCalledWith('https://api.openai.com/v1/chat/completions', expect.anything());
  });

  it('openai-compatible apunta a LM Studio y exige baseUrl y modelo', async () => {
    const send = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      chatResponse('{"kind":"actions","actionIds":["inspect:MAD-SALA"]}'),
    );
    const provider = createOpenAICompatibleProvider({
      apiKey: '',
      baseUrl: 'http://localhost:1234/v1',
      defaultModel: 'local-model',
      maxRetries: 0,
    });
    expect(provider.id).toBe('openai-compatible');
    await provider.execute(context('local-model'));
    expect(send).toHaveBeenCalledWith('http://localhost:1234/v1/chat/completions', expect.anything());
    expect(() => createOpenAICompatibleProvider({ baseUrl: 'http://localhost:1234/v1' })).toThrow('Configuración openai-compatible inválida.');
    expect(() => createOpenAICompatibleProvider({ defaultModel: 'local-model' })).toThrow('Configuración openai-compatible inválida.');
  });

  it('401 se traduce a UNAUTHORIZED sin reintentar', async () => {
    const send = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"error":"bad key"}', { status: 401 }));
    const provider = createFreeLLMAPIProvider({ apiKey: 'bad', maxRetries: 0 });
    await expect(provider.execute(context())).rejects.toThrow('UNAUTHORIZED');
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('429 se traduce a RATE_LIMITED', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 429 }));
    const provider = createFreeLLMAPIProvider({ apiKey: 'test-key', maxRetries: 0 });
    await expect(provider.execute(context())).rejects.toThrow('RATE_LIMITED');
  });

  it('salida no JSON se traduce a MODEL_UNAVAILABLE', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(chatResponse('esto no es JSON ni objeto'));
    const provider = createFreeLLMAPIProvider({ apiKey: 'test-key', maxRetries: 0 });
    await expect(provider.execute(context())).rejects.toThrow('MODEL_UNAVAILABLE');
  });

  it('rechaza configuración con claves desconocidas o baseUrl con credenciales', () => {
    expect(() => createFreeLLMAPIProvider({ apiKey: 'x', unexpected: true } as unknown as Partial<FreeLLMAPIConfig>)).toThrow('Configuración freellmapi inválida.');
    expect(() => createFreeLLMAPIProvider({ apiKey: 'x', baseUrl: 'http://user:pass@example.com/v1' })).toThrow('Configuración freellmapi inválida.');
  });

  it('healthCheck sin clave devuelve no disponible sin hacer red', async () => {
    const send = vi.spyOn(globalThis, 'fetch');
    const provider = createFreeLLMAPIProvider({ apiKey: '' });
    await expect(provider.healthCheck()).resolves.toEqual({ available: false, error: 'API key no configurada' });
    expect(send).not.toHaveBeenCalled();
  });
});
