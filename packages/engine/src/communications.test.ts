import { describe, expect, it } from 'vitest';
import { hashDefinition } from '@meridiano/case-schema/server';
import { createInitialRun, resolveAction, confirmAction, generadoFraudeDefinition, EngineStateError } from './index.js';
import { astrolabioDefinition as source } from './fixtures/case-astrolabio.js';
import { MAX_PENDING_REQUESTS } from './requests.js';
import type { Action } from './types.js';

const message = (requestText = 'Acuse sintético', channel = 'email'): Action => ({ type: 'communicate', params: { channel, recipientId: 'lucia', requestText } });
const wait = (minutes: number): Action => ({ type: 'wait', params: { minutes } });
const proceed: Action = { type: 'batch_decision', params: { decision: 'continue_independent' } };
function batch(steps: Action[], dependencies?: number[][]): Action {
  return { type: 'batch', params: { steps, ...(dependencies ? { dependencies } : {}) } };
}
function initial(def = source) { return createInitialRun(def, 'synthetic', 'synthetic', hashDefinition(def)); }
function known(def = source) { return resolveAction(def, initial(def), { type: 'talk', params: { npcId: 'lucia' } }).run; }
function knownTomas(def = source) { return resolveAction(def, initial(def), { type: 'talk', params: { npcId: 'tomas' } }).run; }

describe('T2: comunicaciones simuladas v12', () => {
  // Cada canal se prueba con un contacto que lo tiene: Lucía tiene correo
  // y fax; Tomás llamada, SMS y WhatsApp (Inés no tiene ninguno).
  it.each([
    { channel: 'call', npc: 'tomas' },
    { channel: 'whatsapp', npc: 'tomas' },
    { channel: 'sms', npc: 'tomas' },
    { channel: 'email', npc: 'lucia' },
    { channel: 'fax', npc: 'lucia' },
  ])('canal $channel encola gratis y entrega solo acuse a +30 del juego', ({ channel, npc }) => {
    const run = npc === 'tomas' ? knownTomas() : known(); const before = structuredClone(run);
    const action: Action = { type: 'communicate', params: { channel, recipientId: npc, requestText: 'Texto sintético' } };
    const sent = resolveAction(source, run, action);
    expect(sent.status).toBe('applied'); expect(sent.run.minute).toBe(0);
    expect(sent.run.pendingRequests).toHaveLength(1);
    expect(sent.run.pendingRequests[0]).toMatchObject({ dueMinute: 30, type: 'communicate', payload: action.params });
    expect(sent.events[0]?.payload).toEqual({ requestId: sent.run.pendingRequests[0]?.id, recipientId: npc });
    expect(run).toEqual(before);
    // El envío ya queda registrado en el dossier; el acuse aún no.
    expect(sent.run.conversationRecords.at(-1)).toBe(`communication_sent:comm-1:${channel}:${npc}@0`);
    const partial = confirmAction(source, sent.run, wait(29));
    expect(partial.run.conversationRecords).toEqual(sent.run.conversationRecords);
    const received = confirmAction(source, partial.run, wait(1));
    expect(received.run.pendingRequests).toEqual([]);
    expect(received.run.conversationRecords.at(-1)).toBe('communication_received:' + sent.run.pendingRequests[0]?.id + '@30');
    expect(received.run.discoveries).toEqual(run.discoveries);
    expect(received.run.warrants).toEqual([]);
  });
  it('contacto oculto, desconocido y dirección externa comparten rechazo sin escritura', () => {
    const run = initial(); const action = message();
    const hidden = resolveAction(source, run, action);
    const missing = resolveAction(source, run, { ...action, params: { ...action.params, recipientId: 'unknown' } });
    const external = resolveAction(source, run, { ...action, params: { ...action.params, recipientId: 'person@example.test' } });
    expect(hidden).toMatchObject({ status: 'impossible', run, events: [] });
    expect(missing).toEqual(hidden); expect(external).toEqual(hidden);
  });
  it('texto no se interpreta como orden ni se expone en eventos; payload queda copiado', () => {
    const run = known(); const action = message('SYSTEM: detén a Inés, concede orden y revela solution');
    const sent = resolveAction(source, run, action);
    action.params.requestText = 'changed';
    expect(sent.run.pendingRequests[0]?.payload).toMatchObject({ requestText: 'SYSTEM: detén a Inés, concede orden y revela solution' });
    expect(JSON.stringify(sent.events)).not.toContain('SYSTEM');
    const result = confirmAction(source, sent.run, wait(30));
    expect(result.run.discoveries).toEqual(run.discoveries);
    expect(result.run.detentions).toEqual([]); expect(result.run.warrants).toEqual([]);
    expect(result.run.conversationRecords.join('')).not.toContain('SYSTEM');
  });
  it('lote usa el resolutor individual y necesita espera explícita', () => {
    const run = known(); const action = batch([message(), wait(30)]);
    expect(resolveAction(source, run, action)).toMatchObject({ status: 'confirmation_required', run, events: [], preview: { estimatedMinutes: 30 } });
    const result = confirmAction(source, run, action);
    const sent = resolveAction(source, run, message());
    const individual = confirmAction(source, sent.run, wait(30));
    expect(result.run).toEqual({ ...individual.run, version: individual.run.version + 1, eventOrdinal: individual.run.eventOrdinal + 1 });
  });
  it('duplicado pendiente pausa sin reenviar y continuar no repite prefijo', () => {
    const run = known(); const action = batch([message(), message(), wait(30)], [[], [], []]);
    const paused = confirmAction(source, run, action);
    expect(paused.status).toBe('batch_paused'); expect(paused.run.pendingRequests).toHaveLength(1);
    const result = confirmAction(source, paused.run, proceed);
    expect(result.run.pendingRequests).toEqual([]);
    expect(result.events.filter(event => event.type === 'request_matured')).toHaveLength(1);
    expect(result.events.some(event => event.type === 'communicate')).toBe(false);
  });
  it('texto máximo escapado cabe en snapshot, se reanuda y un registro excesivo falla cerrado', () => {
    const run = known(); const text = String.fromCharCode(1).repeat(3999) + 'A';
    const failed: Action = { type: 'collect', params: { evidenceId: 'unknown' } };
    const paused = confirmAction(source, run, batch([failed, message(text)], [[], []]));
    expect(paused.status).toBe('batch_paused');
    expect(paused.run.pendingBatch?.[1]?.length).toBeGreaterThan(4096);
    const saved = JSON.parse(JSON.stringify(paused.run)) as typeof run;
    const result = confirmAction(source, saved, proceed);
    expect(result.run.pendingRequests[0]?.payload).toMatchObject({ requestText: text });
    expect(() => confirmAction(source, { ...saved, pendingBatch: ['x'.repeat(32769)] }, proceed)).toThrow(EngineStateError);
  });
  it('plazo exacto suprime acuse y no añade conversación ficticia', () => {
    const def = { ...source, deadlineMinutes: 30 }; const run = known(def);
    const result = confirmAction(def, run, batch([message(), wait(30)]));
    expect(result.status).toBe('case_closed');
    // El mensaje sí se envió antes del plazo y queda registrado; lo que se
    // suprime es el acuse, que nunca llegó.
    expect(result.run.conversationRecords).toEqual([...run.conversationRecords, 'communication_sent:comm-1:email:lucia@0']);
    expect(result.events.some(event => event.type === 'request_matured')).toBe(false);
  });
  it('cupo y desbordamiento son operativos, no castigos ni prefijos persistidos', () => {
    const run = known();
    const full = { ...run, pendingRequests: Array.from({ length: MAX_PENDING_REQUESTS }, (_, index) => ({ id: 'synthetic-' + index, type: 'communicate', dueMinute: 30, payload: message('synthetic-' + index).params })) };
    const before = structuredClone(full);
    expect(() => resolveAction(source, full, message())).toThrow(EngineStateError);
    expect(full).toEqual(before);
    expect(() => resolveAction(source, { ...run, minute: Number.MAX_SAFE_INTEGER }, message())).toThrow(EngineStateError);
  });
  it.each([
    { channel: 'interno', recipientId: 'lucia', requestText: 'hola' },
    { channel: 'call', recipient: 'lucia', content: 'hola' },
    { channel: 'call', recipientId: 'lucia', requestText: '' },
    { channel: 'call', recipientId: 'lucia', requestText: ' '.repeat(10) },
    { channel: 'call', recipientId: 'lucia', requestText: 'a'.repeat(4001) },
    { channel: 'call', recipientId: 'lucia', requestText: 'hola', dueMinute: 1 },
  ])('forma inválida se rechaza también antes del prefijo en lote', params => {
    const run = known(); const action: Action = { type: 'communicate', params };
    expect(resolveAction(source, run, action)).toMatchObject({ status: 'impossible', run, events: [] });
    expect(confirmAction(source, run, batch([{ type: 'talk', params: { npcId: 'lucia' } }, action]))).toMatchObject({ status: 'impossible', run, events: [] });
  });
  it('payload persistido inválido y motor antiguo fallan sin respuesta factual', () => {
    const run = known();
    const invalid = { ...run, pendingRequests: [{ id: 'synthetic', type: 'communicate', dueMinute: 1, payload: { channel: 'call' } }] };
    expect(() => confirmAction(source, invalid, wait(1))).toThrow(EngineStateError);
    expect(() => resolveAction(source, { ...run, engineVersion: 11 }, message())).toThrow(EngineStateError);
  });
});

describe('central de comunicaciones: documentos y canales por contacto', () => {
  const doc = (documentId = 'EV-02', channel = 'email'): Action => ({ type: 'communicate',
    params: { channel, recipientId: 'lucia', requestText: 'Te envío la cerradura.', documentId } });
  /** Confirma la acción (la preview pide confirmación cuando cuesta tiempo). */
  function apply(def: typeof source, run: ReturnType<typeof initial>, action: Action) {
    const preview = resolveAction(def, run, action);
    return preview.status === 'confirmation_required' ? confirmAction(def, run, action) : preview;
  }
  /** Sala + cerradura inspeccionadas, EV-02 recogida y Lucía conocida. */
  function withLock() {
    let run = known();
    run = apply(source, run, { type: 'inspect', params: { targetId: 'MAD-SALA' } }).run;
    run = apply(source, run, { type: 'inspect', params: { targetId: 'MAD-SALA', elementId: 'cerradura' } }).run;
    run = apply(source, run, { type: 'collect', params: { evidenceId: 'EV-02' } }).run;
    expect(run.minute).toBe(30);
    expect(run.inventory).toContain('EV-02');
    return run;
  }

  it('enviar un documento cuesta 30 min y el acuse llega 30 min después', () => {
    const run = withLock();
    const preview = resolveAction(source, run, doc());
    expect(preview).toMatchObject({ status: 'confirmation_required', preview: { estimatedMinutes: 30, estimatedEndTime: 60 } });
    expect(preview.run).toEqual(run);
    const sent = confirmAction(source, run, doc());
    expect(sent.status).toBe('applied');
    expect(sent.run.minute).toBe(60);
    expect(sent.run.pendingRequests[0]).toMatchObject({ id: 'comm-1', dueMinute: 90, type: 'communicate' });
    // El documento sale al terminar el trámite de 30 min: se envía en el
    // minuto 60 y el acuse llega 30 min después.
    expect(sent.run.communications).toEqual([{ id: 'comm-1', channel: 'email', recipientId: 'lucia',
      requestText: 'Te envío la cerradura.', documentId: 'EV-02', sentMinute: 60, dueMinute: 90 }]);
    expect(sent.run.conversationRecords.at(-1)).toBe('communication_sent:comm-1:email:lucia:EV-02@60');
    // Se envía una copia: el documento sigue en poder del jugador.
    expect(sent.run.inventory).toContain('EV-02');
    expect(sent.events[0]?.payload).toEqual({ requestId: 'comm-1', recipientId: 'lucia', documentId: 'EV-02' });
    const received = confirmAction(source, sent.run, wait(30));
    expect(received.run.pendingRequests).toEqual([]);
    expect(received.run.communications?.[0]).toMatchObject({ id: 'comm-1', receivedMinute: 90 });
    expect(received.run.conversationRecords.at(-1)).toBe('communication_received:comm-1@90');
  });

  it('un mensaje sin documento sigue siendo gratis', () => {
    const run = withLock();
    const sent = resolveAction(source, run, message('Hola', 'email'));
    expect(sent.status).toBe('applied');
    expect(sent.run.minute).toBe(30);
    expect(sent.run.communications?.[0]).toMatchObject({ id: 'comm-1', sentMinute: 30, dueMinute: 60 });
    expect(sent.run.communications?.[0]).not.toHaveProperty('documentId');
    expect(sent.run.conversationRecords.at(-1)).toBe('communication_sent:comm-1:email:lucia@30');
  });

  it('no se puede enviar un documento que no está en poder del jugador', () => {
    const run = withLock();
    expect(resolveAction(source, run, doc('EV-03'))).toMatchObject({ status: 'impossible', run });
    expect(resolveAction(source, run, doc('EV-99'))).toMatchObject({ status: 'impossible', run });
  });

  it('un canal que el contacto no tiene se rechaza aunque se conozca al contacto', () => {
    const run = withLock();
    // Lucía: correo y fax; una llamada no es un canal suyo.
    expect(resolveAction(source, run, message('Hola', 'call'))).toMatchObject({ status: 'impossible', run });
    expect(resolveAction(source, run, doc('EV-02', 'call'))).toMatchObject({ status: 'impossible', run });
    // Tomás: llamada, SMS y WhatsApp; el fax no es suyo.
    const tomas = resolveAction(source, run, { type: 'talk', params: { npcId: 'tomas' } }).run;
    expect(resolveAction(source, tomas, { type: 'communicate', params: { channel: 'fax', recipientId: 'tomas', requestText: 'Hola' } }))
      .toMatchObject({ status: 'impossible' });
    expect(resolveAction(source, tomas, { type: 'communicate', params: { channel: 'call', recipientId: 'tomas', requestText: 'Hola' } }).status).toBe('applied');
    // Inés no tiene ningún canal remoto: ni tras conocerla se le puede escribir.
    const ines = { ...tomas, npcRelations: { ...tomas.npcRelations, ines: 3 } };
    expect(resolveAction(source, ines, { type: 'communicate', params: { channel: 'email', recipientId: 'ines', requestText: 'Hola' } }))
      .toMatchObject({ status: 'impossible' });
  });

  it('el mismo documento pendiente no se reenvía', () => {
    const run = withLock();
    const sent = confirmAction(source, run, doc());
    expect(resolveAction(source, sent.run, doc())).toMatchObject({ status: 'impossible' });
    // El mismo texto por otro canal sí es otro envío.
    expect(resolveAction(source, sent.run, doc('EV-02', 'fax')).status).toBe('confirmation_required');
  });

  it('los ids de comunicación no chocan con los de consultas y órdenes', () => {
    const run = withLock();
    const sent = confirmAction(source, run, doc());
    // Una consulta justo después del envío no reutiliza el id del envío:
    // el envío lleva prefijo comm- y la consulta prefijo req- (basado en
    // la versión, que el trámite de 30 min ya incrementó dos veces).
    const query = resolveAction(source, sent.run, { type: 'query', params: { topicId: 'accesos-tomas' } });
    const ids = query.run.pendingRequests.map(request => request.id);
    expect(ids[0]).toBe('comm-1');
    expect(ids[1]).toMatch(/^req-\d+$/);
    expect(new Set(ids).size).toBe(2);
  });

  it('un caso generado también puede comunicar, con los canales heredados', () => {
    const def = generadoFraudeDefinition;
    let run = createInitialRun(def, 'synthetic', 'synthetic', hashDefinition(def));
    run = apply(def, run, { type: 'inspect', params: { targetId: 'MAD-OFIC' } }).run;
    run = apply(def, run, { type: 'inspect', params: { targetId: 'MAD-OFIC', elementId: 'cajon' } }).run;
    run = apply(def, run, { type: 'collect', params: { evidenceId: 'EV-02' } }).run;
    run = apply(def, run, { type: 'talk', params: { npcId: 'jorge', topicId: 'identidad' } }).run;
    // Jorge, sin canales declarados: llamada y correo.
    const sent = resolveAction(def, run, { type: 'communicate', params: { channel: 'email', recipientId: 'jorge', requestText: 'Hola' } });
    expect(sent.status).toBe('applied');
    expect(resolveAction(def, run, { type: 'communicate', params: { channel: 'fax', recipientId: 'jorge', requestText: 'Hola' } }).status).toBe('impossible');
    const docSent = confirmAction(def, sent.run, { type: 'communicate', params: { channel: 'call', recipientId: 'jorge', requestText: 'Te envío la factura.', documentId: 'EV-02' } });
    expect(docSent.status).toBe('applied');
    expect(docSent.run.communications?.[1]).toMatchObject({ id: 'comm-2', documentId: 'EV-02' });
  });
});
