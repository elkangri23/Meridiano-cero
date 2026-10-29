import { describe, expect, it, vi } from 'vitest';
import { createOllamaProvider } from './ollama.ts';
import type { AiRequest } from './provider.ts';

const request: AiRequest = { operation: 'interpretAction', requestId: 'synthetic', schema: { type: 'object' }, context: { text: 'Examinar' } };
const envelope = { model: 'test:local', done: true, done_reason: 'stop', message: { role: 'assistant', content: '{"kind":"clarification","actionIds":[]}' }, prompt_eval_count: 15, eval_count: 8 };
const reply = () => Response.json(envelope);
function provider(send: typeof fetch, timeoutMs = 1000) {
  return createOllamaProvider({ model: 'test:local', fetch: send, timeoutMs });
}
describe('Transporte Ollama limitado', () => {
  it.each(['http://localhost:11434', 'https://example.org', 'http://169.254.169.254', 'http://127.0.0.1:11434/path', 'http://x:y@127.0.0.1:11434'])('rechaza un origen no permitido: %s', origin => {
    expect(() => createOllamaProvider({ model: 'test', origin })).toThrow();
  });
  it('usa JSON estructurado, sin streaming, ni herramientas, ni redirecciones', async () => {
    const send = vi.fn<typeof fetch>().mockResolvedValue(reply());
    const response = await provider(send).request(request);
    expect(send.mock.calls[0]?.[0]).toBe('http://127.0.0.1:11434/api/chat');
    const init = send.mock.calls[0]?.[1];
    expect(init?.redirect).toBe('error');
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(body).toMatchObject({ stream: false, format: { type: 'object' }, options: { temperature: 0, num_predict: 512 } });
    expect(body).not.toHaveProperty('tools');
    expect(response).toMatchObject({ usage: { inputTokens: 15, outputTokens: 8 }, finishReason: 'stop' });
  });
  it('reintenta una sola vez ante fallo transitorio', async () => {
    const send = vi.fn<typeof fetch>().mockRejectedValueOnce(new Error('private address')).mockResolvedValueOnce(reply());
    await provider(send).request(request);
    expect(send).toHaveBeenCalledTimes(2);
  });
  it('reintenta 503 pero no 400', async () => {
    const transient = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response('', { status: 503 })).mockResolvedValueOnce(reply());
    await provider(transient).request(request);
    expect(transient).toHaveBeenCalledTimes(2);
    const permanent = vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 400 }));
    await expect(provider(permanent).request(request)).rejects.toMatchObject({ code: 'unavailable' });
    expect(permanent).toHaveBeenCalledTimes(1);
  });
  it('no filtra errores del proveedor al llamador', async () => {
    const send = vi.fn<typeof fetch>().mockRejectedValue(new Error('PRIVATE_TRANSPORT_DETAIL'));
    await expect(provider(send).request(request)).rejects.toMatchObject({ message: 'unavailable' });
    expect(send).toHaveBeenCalledTimes(2);
  });
  it('aplica el timeout y aborta el transporte', async () => {
    const send: typeof fetch = async (_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('abort')), { once: true });
    });
    await expect(provider(send, 10).request(request)).rejects.toMatchObject({ code: 'timeout' });
  });
  it('no envía una petición cancelada', async () => {
    const send = vi.fn<typeof fetch>();
    await expect(provider(send).request({ ...request, signal: AbortSignal.abort() })).rejects.toMatchObject({ code: 'cancelled' });
    expect(send).not.toHaveBeenCalled();
  });
  it('rechaza contexto excesivo antes de contactar', async () => {
    const send = vi.fn<typeof fetch>();
    await expect(provider(send).request({ ...request, context: { text: 'x'.repeat(25_000) } })).rejects.toMatchObject({ code: 'budget_exceeded' });
    expect(send).not.toHaveBeenCalled();
  });
  it.each([
    { ...envelope, done: false },
    { ...envelope, done_reason: 'length' },
    { ...envelope, model: 'other' },
    { ...envelope, message: { role: 'assistant', content: 'invalid JSON' } },
    { ...envelope, message: { ...envelope.message, tool_calls: [] } },
  ])('rechaza envoltura truncada, ajena o inválida', async value => {
    await expect(provider(vi.fn<typeof fetch>().mockResolvedValue(Response.json(value))).request(request))
      .rejects.toMatchObject({ code: 'invalid_response' });
  });
  it('limita cuerpos aun cuando no existe Content-Length', async () => {
    const send = vi.fn<typeof fetch>().mockResolvedValue(new Response('x'.repeat(65_537)));
    await expect(provider(send).request(request)).rejects.toMatchObject({ code: 'budget_exceeded' });
  });
});

describe('Cancelación al completar el transporte', () => {
  it('rechaza una respuesta tardía aunque el transporte inyectado no respete el aborto', async () => {
    const controller = new AbortController();
    const send = vi.fn<typeof fetch>().mockImplementation(async () => {
      controller.abort(); return reply();
    });
    await expect(provider(send).request({ ...request, signal: controller.signal })).rejects.toMatchObject({ code: 'cancelled' });
    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe('transporte que ignora abort', () => {
  it('responde timeout y conserva el cupo sin acumular llamadas colgadas', async () => {
    const send = vi.fn<typeof fetch>(() => new Promise<Response>(() => {}));
    const instance = provider(send, 10);
    await expect(instance.request(request)).rejects.toMatchObject({ code: 'timeout' });
    for (let index = 0; index < 20; index++) {
      await expect(instance.request(request)).rejects.toMatchObject({ code: 'unavailable' });
    }
    expect(send).toHaveBeenCalledTimes(1);
  });
});
