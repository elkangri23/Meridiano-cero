// Tests para los adaptadores Anthropic y Google (Gemini) con transporte simulado.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { createAnthropicProvider, type AnthropicConfig } from './anthropic.js';
import { createGoogleProvider, type GoogleConfig } from './google.js';
import type { AIContext } from '../types.js';

afterEach(() => vi.restoreAllMocks());

function context(model: string): AIContext {
  return {
    providerId: 'anthropic',
    model,
    function: 'interpretAction',
    schemaVersion: 1,
    authorizedContext: { text: 'inspecciona la sala', offers: [{ id: 'inspect-room', label: 'Inspeccionar la sala' }] },
    limits: { timeoutMs: 5000, maxRetries: 0 },
    requestId: 'test-1',
  };
}

describe('AnthropicProvider', () => {
  it('interpreta desde el bloque de texto de Messages', async () => {
    const send = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      content: [{ type: 'text', text: '{"kind":"actions","actionIds":["inspect-room"]}' }],
      usage: { input_tokens: 12, output_tokens: 6 },
      stop_reason: 'end_turn',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const provider = createAnthropicProvider({ apiKey: 'sk-ant-test', maxRetries: 0 });
    expect(provider.id).toBe('anthropic');
    expect(provider.defaultModel).toBe('claude-sonnet-4-5');
    const result = await provider.execute(context('claude-sonnet-4-5'));
    expect(result.payload).toEqual({ kind: 'actions', actionIds: ['inspect-room'] });
    expect(result.usage).toEqual({ promptTokens: 12, completionTokens: 6, totalTokens: 18 });
    expect(send).toHaveBeenCalledWith('https://api.anthropic.com/v1/messages', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ 'anthropic-version': '2023-06-01' }),
    }));
  });

  it('401 se traduce a UNAUTHORIZED', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 401 }));
    const provider = createAnthropicProvider({ apiKey: 'bad', maxRetries: 0 });
    await expect(provider.execute(context('claude-sonnet-4-5'))).rejects.toThrow('UNAUTHORIZED');
  });

  it('respuesta sin texto se traduce a MODEL_UNAVAILABLE', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ content: [] }), { status: 200 }));
    const provider = createAnthropicProvider({ apiKey: 'sk-ant-test', maxRetries: 0 });
    await expect(provider.execute(context('claude-sonnet-4-5'))).rejects.toThrow('MODEL_UNAVAILABLE');
  });

  it('rechaza configuración inválida', () => {
    expect(() => createAnthropicProvider({ baseUrl: 'https://api.anthropic.com/v1' } as unknown as Partial<AnthropicConfig>)).toThrow('Configuración anthropic inválida.');
    expect(() => createAnthropicProvider({ apiKey: 'x', unexpected: true } as unknown as Partial<AnthropicConfig>)).toThrow('Configuración anthropic inválida.');
  });

  it('healthCheck sin clave devuelve no disponible sin hacer red', async () => {
    const send = vi.spyOn(globalThis, 'fetch');
    const provider = createAnthropicProvider({ apiKey: '' });
    await expect(provider.healthCheck()).resolves.toEqual({ available: false, error: 'API key no configurada' });
    expect(send).not.toHaveBeenCalled();
  });
});

describe('GoogleProvider', () => {
  it('interpreta desde el candidato de generateContent', async () => {
    const send = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: '{"kind":"actions","actionIds":["inspect-room"]}' }] } }],
      usageMetadata: { promptTokenCount: 11, candidatesTokenCount: 4, totalTokenCount: 15 },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const provider = createGoogleProvider({ apiKey: 'AIza-test', maxRetries: 0 });
    expect(provider.id).toBe('google');
    expect(provider.defaultModel).toBe('gemini-2.5-flash');
    const result = await provider.execute(context('gemini-2.5-flash'));
    expect(result.payload).toEqual({ kind: 'actions', actionIds: ['inspect-room'] });
    expect(result.usage).toEqual({ promptTokens: 11, completionTokens: 4, totalTokens: 15 });
    expect(send).toHaveBeenCalledWith(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ 'x-goog-api-key': 'AIza-test' }) }),
    );
  });

  it('401 se traduce a UNAUTHORIZED', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 401 }));
    const provider = createGoogleProvider({ apiKey: 'bad', maxRetries: 0 });
    await expect(provider.execute(context('gemini-2.5-flash'))).rejects.toThrow('UNAUTHORIZED');
  });

  it('sin candidatos se traduce a MODEL_UNAVAILABLE', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ candidates: [] }), { status: 200 }));
    const provider = createGoogleProvider({ apiKey: 'AIza-test', maxRetries: 0 });
    await expect(provider.execute(context('gemini-2.5-flash'))).rejects.toThrow('MODEL_UNAVAILABLE');
  });

  it('rechaza configuración inválida', () => {
    expect(() => createGoogleProvider({ apiKey: 'x', unexpected: true } as unknown as Partial<AnthropicConfig>)).toThrow('Configuración google inválida.');
    expect(() => createGoogleProvider({ baseUrl: 'notaurl' } as unknown as Partial<GoogleConfig>)).toThrow('Configuración google inválida.');
  });

  it('healthCheck sin clave devuelve no disponible sin hacer red', async () => {
    const send = vi.spyOn(globalThis, 'fetch');
    const provider = createGoogleProvider({ apiKey: '' });
    await expect(provider.healthCheck()).resolves.toEqual({ available: false, error: 'API key no configurada' });
    expect(send).not.toHaveBeenCalled();
  });
});
