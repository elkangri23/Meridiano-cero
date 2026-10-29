import { describe, expect, it } from 'vitest';
import { hashDefinition } from '@meridiano/case-schema/server';
import { astrolabioDefinition as def, createInitialRun, resolveAction, confirmAction, EngineStateError } from './index.js';
import { MAX_PENDING_REQUESTS } from './requests.js';
import type { Action } from './types.js';

const initial = () => createInitialRun(def, 'synthetic', 'synthetic', hashDefinition(def));
const inspect: Action = { type: 'inspect', params: { targetId: 'MAD-SALA', elementId: 'cerradura' } };
const collect: Action = { type: 'collect', params: { evidenceId: 'EV-02' } };
const analyze: Action = { type: 'analyze', params: { evidenceId: 'EV-02' } };
const query: Action = { type: 'query', params: { topicId: 'accesos-tomas' } };
const wait = (minutes: number): Action => ({ type: 'wait', params: { minutes } });
const proceed: Action = { type: 'batch_decision', params: { decision: 'continue_independent' } };
function batch(steps: unknown[], dependencies?: number[][]): Action {
  return { type: 'batch', params: { steps, ...(dependencies ? { dependencies } : {}) } };
}

describe('T2: solicitudes y esperas en lotes v6', () => {
  it('envía laboratorio/registro en paralelo y madura al minuto de juego correcto', () => {
    const run = initial();
    const action = batch([inspect, collect, analyze, query]);
    const before = structuredClone(run);
    expect(resolveAction(def, run, action)).toMatchObject({ status: 'confirmation_required', run: before, events: [], preview: { estimatedMinutes: 20 } });
    expect(run).toEqual(before);
    const submitted = confirmAction(def, run, action);
    expect(submitted.status).toBe('applied');
    expect(submitted.run.minute).toBe(20);
    expect(submitted.run.pendingRequests.map(request => request.dueMinute)).toEqual([110, 50]);
    const result = confirmAction(def, submitted.run, batch([wait(30), wait(60)]));
    expect(result.status).toBe('applied');
    expect(result.run.minute).toBe(110);
    expect(result.run.evidenceRecords?.['EV-10']?.revealedMinute).toBe(50);
    expect(result.run.evidenceRecords?.['EV-03']?.revealedMinute).toBe(110);
    expect(result.run.pendingRequests).toEqual([]);
  });
  it('no espera implícitamente un resultado ni repite solicitudes al continuar', () => {
    const action = batch([inspect, collect, analyze,
      { type: 'request_warrant', params: { suspectId: 'ines', evidenceIds: ['EV-03', 'EV-04'] } }, wait(90)],
    [[], [0], [1], [2], []]);
    const paused = confirmAction(def, initial(), action);
    expect(paused.status).toBe('batch_paused');
    expect(paused.run.minute).toBe(20);
    expect(paused.run.pendingRequests).toHaveLength(1);
    const before = structuredClone(paused.run);
    expect(resolveAction(def, paused.run, proceed)).toMatchObject({ status: 'confirmation_required', run: before, events: [], preview: { estimatedMinutes: 90 } });
    const result = confirmAction(def, paused.run, proceed);
    expect(result.run.minute).toBe(110);
    expect(result.run.discoveries).toContain('EV-03');
    expect(result.run.warrants).toEqual([]);
    expect(result.events.some(event => event.type === 'request_submitted')).toBe(false);
    expect(paused.run).toEqual(before);
  });
  it('una solicitud duplicada pausa sin reservar otro hueco y una espera independiente puede continuar', () => {
    const paused = resolveAction(def, initial(), batch([query, query, wait(30)], [[], [], []]));
    expect(paused.status).toBe('batch_paused');
    expect(paused.run.minute).toBe(0);
    expect(paused.run.pendingRequests).toHaveLength(1);
    const result = confirmAction(def, paused.run, proceed);
    expect(result.run.discoveries).toContain('EV-10');
    expect(result.run.pendingRequests).toEqual([]);
    expect(result.events.filter(event => event.type === 'request_matured')).toHaveLength(1);
  });
  it('el juzgado solo concede la selección admisible después de esperas explícitas', () => {
    const action = batch([{ type: 'talk', params: { npcId: 'lucia', topicId: 'caja' } }, query, wait(30),
      { type: 'request_warrant', params: { suspectId: 'tomas', evidenceIds: ['EV-09', 'EV-10'] } }, wait(30)]);
    const run = initial();
    expect(resolveAction(def, run, action)).toMatchObject({ status: 'confirmation_required', run, events: [], preview: { estimatedMinutes: 60 } });
    const result = confirmAction(def, run, action);
    expect(result.status).toBe('applied');
    expect(result.run.minute).toBe(60);
    expect(result.run.warrants).toEqual(['warrant:tomas']);
    expect(result.run.status).toBe('active');
  });
  it('el empate del plazo suprime el resultado y el resto del lote', () => {
    const short = { ...def, deadlineMinutes: 30 };
    const run = createInitialRun(short, 'synthetic', 'synthetic', hashDefinition(short));
    const result = confirmAction(short, run, batch([query, wait(30), { type: 'talk', params: { npcId: 'lucia' } }]));
    expect(result.status).toBe('case_closed');
    expect(result.run.minute).toBe(30);
    expect(result.run.discoveries).not.toContain('EV-10');
    expect(result.run.conversationRecords).toEqual([]);
    expect(result.run.pendingBatch).toBeNull();
  });
  it('cupo agotado es fallo operativo: no conserva el prefijo prospectivo como castigo', () => {
    // Estado controlado de saturación, no ruta de aceptación del caso.
    const run = initial();
    run.pendingRequests = Array.from({ length: MAX_PENDING_REQUESTS }, (_, index) => ({ id: 'synthetic-' + index, type: 'communicate', dueMinute: 100, payload: {} }));
    const before = structuredClone(run);
    const action = batch([{ type: 'inspect', params: { targetId: 'MAD-SALA' } }, query]);
    expect(() => resolveAction(def, run, action)).toThrow(EngineStateError);
    expect(() => confirmAction(def, run, action)).toThrow(EngineStateError);
    expect(run).toEqual(before);
  });
  it.each([
    { type: 'wait', params: { minutes: '30' } }, { type: 'wait', params: { minutes: 0 } },
    { type: 'wait', params: { minutes: -1 } }, { type: 'wait', params: { minutes: 0.5 } },
    { type: 'wait', params: { minutes: Number.MAX_SAFE_INTEGER + 1 } },
    { type: 'analyze', params: { evidenceId: 'EV-02', dueMinute: 1 } },
    { type: 'query', params: { topicId: 'accesos-tomas', revealedFacts: ['EV-10'] } },
    { type: 'request_warrant', params: { suspectId: 'tomas', evidenceIds: ['EV-09'], approved: true } },
    { type: 'request_warrant', params: { suspectId: 'tomas', evidenceIds: ['EV-09', 'EV-09'] } },
    { type: 'request_warrant', params: { suspectId: 'tomas', evidenceIds: Array(1) } },
  ])('forma inválida rechaza el lote entero, sin prefijo: %j', value => {
    const run = initial(); const action = batch([query, value]);
    expect(resolveAction(def, run, action)).toMatchObject({ status: 'impossible', run, events: [] });
    expect(confirmAction(def, run, action)).toMatchObject({ status: 'impossible', run, events: [] });
  });
  it.each([0, -1, 0.5, Number.MAX_SAFE_INTEGER + 1])('contador de versión inválido %s falla antes de encolar', version => {
    const run = { ...initial(), version }; const before = structuredClone(run);
    expect(() => resolveAction(def, run, batch([query]))).toThrow('RUN_VERSION_INVALID');
    expect(() => confirmAction(def, run, batch([query]))).toThrow('RUN_VERSION_INVALID');
    expect(run).toEqual(before);
  });
  it('el control de lote no desborda versión tras una solicitud válida en el límite', () => {
    const run = { ...initial(), version: Number.MAX_SAFE_INTEGER - 1 }; const before = structuredClone(run);
    expect(() => resolveAction(def, run, batch([query]))).toThrow('RUN_VERSION_INVALID');
    expect(() => confirmAction(def, run, batch([query]))).toThrow('RUN_VERSION_INVALID');
    expect(run).toEqual(before);
  });
  it('un preview costoso tampoco oculta una transición cuyo contador desbordaría', () => {
    const run = { ...initial(), version: Number.MAX_SAFE_INTEGER }; const before = structuredClone(run);
    expect(() => resolveAction(def, run, batch([inspect]))).toThrow('RUN_VERSION_INVALID');
    expect(() => confirmAction(def, run, batch([inspect]))).toThrow('RUN_VERSION_INVALID');
    expect(run).toEqual(before);
  });

});
