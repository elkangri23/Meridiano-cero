// Plazos del cliente de IA: conversar con un personaje tarda lo que tarda
// el modelo (hasta ~35 s medidos en el servidor). El plazo único de 8 s
// abortaba cada intento antes de que el servidor contestara, así que
// preguntar a Inés fallaba con «La IA no responde» siempre que el modelo
// tardaba más de 8 s, aunque el servidor acababa respondiendo (200 en 24,8 s
// medidos en producción). Cada operación tiene su plazo: interpretar es
// rápido, conversar y narrar son lentos.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { aiApi } from './client';

const signal = () => new AbortController().signal;
const auth = { csrfToken: 't'.repeat(43) };
const runId = '11111111-1111-4111-8111-111111111111';

const inesInput = {
  runId,
  text: 'hola, no quieres decir nada?',
  npc: { id: 'ines', name: 'Inés Valera', persona: 'Sospechosa', knownFactIds: ['truth'], revealableFactIds: ['truth'] },
  facts: [{ id: 'truth', text: 'Soy Inés Valera, restauradora contratada para el traslado del astrolabio.' }],
  memory: { schemaVersion: 1, runId, npcId: 'ines', treatment: 'neutral', turns: [] },
  allowedActs: ['state', 'acknowledge', 'decline', 'silence'],
};

const narrativeBody = {
  narrative: { text: 'Soy Inés Valera, restauradora contratada para el traslado del astrolabio.', factIds: ['truth'], act: 'state', source: 'model' },
  memory: { ...inesInput.memory, turns: [{ factIds: ['truth'], act: 'state' }] },
};

function respond(body: unknown, delayMs = 0, status = 200) {
  const fetcher = vi.fn<typeof fetch>().mockImplementation(() => new Promise(resolve => {
    setTimeout(() => resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })), delayMs);
  }));
  vi.stubGlobal('fetch', fetcher);
  return fetcher;
}

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('plazos del cliente de IA', () => {
  it('cada operación usa su plazo: interpretar 15 s, narrar 45 s, conversar 55 s', async () => {
    const originalTimeout = AbortSignal.timeout.bind(AbortSignal);
    const spy = vi.spyOn(AbortSignal, 'timeout').mockImplementation((ms: number) => originalTimeout(ms));
    respond({ interpretation: { kind: 'actions', actionIds: [] } });
    await aiApi.interpret('inspeccionar la sala',
      { location: 'MAD-SALA', description: 'Sala de embalaje' },
      [{ id: 'inspect:MAD-SALA', label: 'Inspeccionar Sala de embalaje' }], signal(), auth);
    respond({ narrative: { text: 'La caja está a la vista.', factIds: [], act: 'state', source: 'model' } });
    await aiApi.narrate([{ id: 'EV-01', text: 'La caja está a la vista.' }], signal(), auth);
    respond(narrativeBody);
    await aiApi.converse(inesInput, signal(), auth);
    expect(spy.mock.calls.map(call => call[0])).toEqual([15000, 45000, 55000]);
  });

  it('conversar con Inés sobrevive a una respuesta lenta del modelo (9 s reales)', async () => {
    respond(narrativeBody, 9_000);
    await expect(aiApi.converse(inesInput, signal(), auth)).resolves
      .toMatchObject({ narrative: { text: expect.stringContaining('restauradora') } });
  }, 20_000);
});
