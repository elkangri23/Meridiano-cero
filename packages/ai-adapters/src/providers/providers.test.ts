import { afterEach, describe, expect, it, vi } from 'vitest';
import { createProvider } from './index.js';
import { DeterministicMockProvider } from './mock.js';
import { createOllamaProvider } from './ollama.js';
import { parseOllamaConfig } from './ollama-config.js';
import type { AIContext, AIFunction, InterpretActionOutput } from '../index.js';

function context(functionName: AIFunction, input: unknown): AIContext {
  return { providerId: 'synthetic', model: 'synthetic:local', function: functionName, schemaVersion: 1,
    authorizedContext: input, limits: { timeoutMs: 1000, maxRetries: 0 }, requestId: 'synthetic' };
}
const actions = [{ type: 'inspect', params: { targetId: 'MAD-SALA' }, description: 'sintético' }];
afterEach(() => vi.restoreAllMocks());

describe('configuración del adaptador alternativo', () => {
  it('aplica defaults comprobados sin hacer red y normaliza el origen', () => {
    const send = vi.spyOn(globalThis, 'fetch');
    expect(createProvider('ollama').defaultModel).toBe('llama3.1:8b');
    expect(parseOllamaConfig({ baseUrl: 'http://localhost:11434/' }).baseUrl).toBe('http://localhost:11434');
    expect(send).not.toHaveBeenCalled();
  });
  it.each([{ timeoutMs: '1' }, { timeoutMs: 0 }, { timeoutMs: 60001 }, { maxRetries: 3 }, { maxRetries: 0.5 },
    { maxContextTokens: NaN }, { defaultModel: '' }, { unexpected: true }, { baseUrl: 'file:///synthetic' },
    { baseUrl: 'http://localhost:11434/private' }, { baseUrl: 'http://localhost:11434/?x=synthetic' },
    { baseUrl: 'http://synthetic:private@localhost:11434' }])('rechaza configuración inválida sin coerción: %j', config => {
    expect(() => createProvider('ollama', config)).toThrow('Configuración Ollama inválida.');
  });
  it('el error no reproduce identificadores libres del proveedor', () => {
    expect(() => createProvider('SYNTHETIC_PRIVATE_SENTINEL')).toThrow('Proveedor no disponible.');
  });
});

describe('doble determinista y limitado a propuestas autorizadas', () => {
  it('no utiliza azar, reloj o red para producir respuestas repetibles', async () => {
    vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('Unexpected random'); });
    vi.spyOn(Date, 'now').mockImplementation(() => { throw new Error('Unexpected clock'); });
    const send = vi.spyOn(globalThis, 'fetch');
    const provider = new DeterministicMockProvider();
    const input = context('interpretAction', { text: 'inspecciona MAD-SALA', availableActions: actions });
    const first = await provider.execute(input);
    expect(await provider.execute(input)).toEqual(first);
    expect(first).toMatchObject({ finishReason: 'stop', latencyMs: 0, payload: { actionType: 'inspect', params: { targetId: 'MAD-SALA' } } });
    expect(first.usage).toBeUndefined();
    expect(send).not.toHaveBeenCalled();
  });
  it.each(['inspecciona', 'inspecciona otro', 'inspecciona MAD-SALA y viaja a paris', 'espera', 'mensaje desconocido'])('pide aclaración sin inventar acción/objetivo: %s', text => {
    const provider = new DeterministicMockProvider();
    return expect(provider.execute<InterpretActionOutput>(context('interpretAction', { text, availableActions: actions })))
      .resolves.toMatchObject({ payload: { actionType: '', params: {}, confidence: 0, clarificationQuestion: expect.any(String) } });
  });
  it('no elige entre dos acciones coincidentes y no comparte referencias de params', async () => {
    const provider = new DeterministicMockProvider();
    const duplicate = { text: 'inspecciona MAD-SALA', availableActions: [actions[0], actions[0]] };
    expect(await provider.execute(context('interpretAction', duplicate))).toMatchObject({ payload: { confidence: 0 } });
    const result = await provider.execute<InterpretActionOutput>(context('interpretAction', { text: 'inspecciona MAD-SALA', availableActions: actions }));
    if (!result.payload) throw new Error('Missing synthetic payload');
    result.payload.params.targetId = 'changed';
    expect(actions[0]?.params.targetId).toBe('MAD-SALA');
  });
  it('no concede aprobaciones de casos inválidos ni inventa expedientes jugables', async () => {
    const provider = new DeterministicMockProvider();
    expect(await provider.execute(context('validateCase', { definition: {} }))).toMatchObject({ payload: { valid: false } });
    expect(provider.capabilities).not.toContain('generateCase');
    const first = await provider.execute(context('generateCase', {}));
    expect(await provider.execute(context('generateCase', {}))).toEqual(first);
    expect(first).toMatchObject({ payload: { definition: null, validationReport: { status: 'rejected', scenarios: [] } } });
  });
  it('no inventa IDs de hechos, conocimiento o cambios de cooperación', async () => {
    const provider = new DeterministicMockProvider();
    expect(await provider.execute(context('narrateResult', { publicEvents: [{ type: 'synthetic' }] })))
      .toMatchObject({ payload: { factReferences: [] } });
    expect(await provider.execute(context('converse', {}))).toMatchObject({ payload: { factIds: [], cooperationChange: 0 } });
  });
  it('cancelación previa no produce respuesta sintética', async () => {
    const controller = new AbortController(); controller.abort();
    await expect(new DeterministicMockProvider().execute({ ...context('converse', {}), cancellationSignal: controller.signal })).rejects.toThrow('CANCELLED');
  });
});

function envelope(content: unknown, usage: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({ done: true, message: { content: typeof content === 'string' ? content : JSON.stringify(content) }, ...usage }),
    { headers: { 'content-type': 'application/json' } });
}

describe('salida del transporte alternativo con fetch sintético', () => {
  it('entrega payload interpretado en vez del sobre del fabricante; uso ausente permanece desconocido', async () => {
    const output = { actionType: 'inspect', params: { targetId: 'MAD-SALA' }, confidence: 1 };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(envelope(output));
    const result = await createOllamaProvider({ maxRetries: 0 }).execute(context('interpretAction', {}));
    expect(result.payload).toEqual(output);
    expect(result.usage).toBeUndefined();
  });
  it('preserva únicamente conteos observados válidos', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(envelope({ valid: false, errors: [] }, { prompt_eval_count: 12, eval_count: 3 }));
    expect(await createOllamaProvider({ maxRetries: 0 }).execute(context('validateCase', {})))
      .toMatchObject({ usage: { promptTokens: 12, completionTokens: 3, totalTokens: 15 } });
  });
  it.each([
    { actionType: 'inspect', params: { targetId: 'MAD' }, confidence: 1, thought: 'Creo que es aquí' },
    { actionType: 'inspect', params: { targetId: 'MAD' }, confidence: 1, extra: 123 },
    { text: 'Hola', actOfSpeech: 'inform', extra: 'meta' }
  ])('rechaza salida con campos adicionales: %j', async output => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(envelope(output));
    const fn = output.actionType ? 'interpretAction' : 'converse';
    await expect(createOllamaProvider({ maxRetries: 0 }).execute(context(fn, {})))
      .rejects.toThrow('INVALID_OUTPUT');
  });
  it('un error HTTP no reproduce cuerpo privado y no se presenta como payload exitoso', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('SYNTHETIC_PRIVATE_SENTINEL', { status: 500 }));
    const result = await createOllamaProvider({ maxRetries: 0 }).execute(context('converse', {}));
    expect(result).toMatchObject({ payload: null, finishReason: 'error' });
    expect(JSON.stringify(result)).not.toContain('SYNTHETIC_PRIVATE_SENTINEL');
  });
  it('cancelación previa de Ollama no hace red y se distingue de JSON inválido', async () => {
    const send = vi.spyOn(globalThis, 'fetch');
    const controller = new AbortController(); controller.abort();
    await expect(createOllamaProvider({ maxRetries: 0 }).execute({ ...context('converse', {}), cancellationSignal: controller.signal })).rejects.toThrow('CANCELLED');
    expect(send).not.toHaveBeenCalled();
  });
  it('conteos inválidos o parciales no se convierten en cero ni en un total inventado', async () => {
    const send = vi.spyOn(globalThis, 'fetch');
    send.mockResolvedValueOnce(envelope({ valid: false, errors: [] }, { prompt_eval_count: '12', eval_count: -1 }));
    const provider = createOllamaProvider({ maxRetries: 0 });
    expect((await provider.execute(context('validateCase', {}))).usage).toBeUndefined();
    send.mockResolvedValueOnce(envelope({ valid: false, errors: [] }, { prompt_eval_count: 12 }));
    expect((await provider.execute(context('validateCase', {}))).usage).toEqual({ promptTokens: 12 });
  });
  it.each([null, { done: 'true', message: { content: '{}' } }, { done: true, message: null }])('sobre malformado no se interpreta como éxito: %j', async value => {
    const send = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(value)));
    await expect(createOllamaProvider({ maxRetries: 2 }).execute(context('converse', {}))).rejects.toThrow('INVALID_OUTPUT');
    expect(send).toHaveBeenCalledTimes(1);
  });

});
