import { describe, expect, it } from 'vitest';
import { hashDefinition } from '@meridiano/case-schema/server';
import { createInitialRun, resolveAction, confirmAction, EngineStateError } from './index.js';
import { astrolabioDefinition as source } from './fixtures/case-astrolabio.js';
import type { Action } from './types.js';

const travel = (toCityId: string): Action => ({ type: 'travel', params: { toCityId } });
const proceed: Action = { type: 'batch_decision', params: { decision: 'continue_independent' } };
function batch(steps: Action[], dependencies?: number[][]): Action {
  return { type: 'batch', params: { steps, ...(dependencies ? { dependencies } : {}) } };
}
function initial(def = source) { return createInitialRun(def, 'synthetic', 'synthetic', hashDefinition(def)); }

describe('T2: viajes en lotes v10', () => {
  it('preview usa duración base sin leer seed ni aplicar estado prospectivo', () => {
    const def = { ...source, seed: 14194 }; const run = initial(def); const before = structuredClone(run);
    let reads = 0;
    Object.defineProperty(def, 'seed', { get() { reads++; return 14194; } });
    const action = batch([travel('paris'), travel('lisboa')]);
    const preview = resolveAction(def, run, action);
    expect(preview).toMatchObject({ status: 'confirmation_required', run: before, events: [], preview: { estimatedMinutes: 330, estimatedEndTime: 330 } });
    expect(reads).toBe(0); expect(run).toEqual(before);
    const result = confirmAction(def, run, action);
    expect(result.status).toBe('applied'); expect(result.run.minute).toBe(420);
    expect(result.run.tripCount).toBe(2); expect(reads).toBe(2);
    expect(result.run.position.cityId).toBe('lisboa');
    expect(result.events.filter(event => event.type === 'travel').map(event => event.payload.delay)).toEqual([45, 45]);
  });
  it('misma estimación con retrasos cero o máximos incluso cerca del plazo', () => {
    const action = batch([travel('paris'), travel('lisboa')]);
    const quiet = { ...source, seed: 1, deadlineMinutes: 350 };
    const delayed = { ...quiet, seed: 14194 };
    const a = resolveAction(quiet, initial(quiet), action);
    const b = resolveAction(delayed, initial(delayed), action);
    expect(a.status).toBe('confirmation_required'); expect(b.status).toBe('confirmation_required');
    if (a.status !== 'confirmation_required' || b.status !== 'confirmation_required') throw new Error('Missing preview');
    expect(a.preview).toEqual(b.preview); expect(a.preview.description).toContain('retrasarse');
    expect(confirmAction(quiet, initial(quiet), action).status).toBe('applied');
    const result = confirmAction(delayed, initial(delayed), action);
    expect(result.status).toBe('case_closed'); expect(result.run.minute).toBe(350);
    expect(result.run.position.cityId).toBe('paris'); expect(result.run.tripCount).toBe(2);
    expect(result.run.discoveries).not.toContain('travel:lisboa');
  });
  it('madura solicitudes durante el viaje y valida pasos en el destino real', () => {
    const def = { ...source, seed: 1 }; const run = initial(def);
    const action = batch([{ type: 'query', params: { topicId: 'accesos-tomas' } }, travel('paris'),
      { type: 'inspect', params: { targetId: 'PAR-ARCH' } }]);
    const result = confirmAction(def, run, action);
    expect(result.status).toBe('applied'); expect(result.run.discoveries).toContain('EV-10');
    expect(result.run.evidenceRecords?.['EV-10']?.revealedMinute).toBe(30);
    expect(result.run.position.cityId).toBe('paris'); expect(result.run.pendingRequests).toEqual([]);
    expect(result.events.map(event => event.minute)).toEqual([...result.events.map(event => event.minute)].sort((a, b) => a - b));
  });
  it('serialización y continuación independiente no repiten viaje aplicado ni sorteo', () => {
    const def = { ...source, seed: 14194 }; const run = initial(def);
    const action = batch([travel('paris'), travel('unknown'), travel('lisboa')], [[], [], []]);
    const paused = confirmAction(def, run, action);
    expect(paused.status).toBe('batch_paused'); expect(paused.run.tripCount).toBe(1);
    expect(paused.run.minute).toBe(225);
    const saved = JSON.parse(JSON.stringify(paused.run)) as typeof run;
    const preview = resolveAction(def, saved, proceed);
    expect(preview).toMatchObject({ status: 'confirmation_required', run: saved, events: [], preview: { estimatedMinutes: 150 } });
    const result = confirmAction(def, saved, proceed);
    expect(result.run.minute).toBe(420); expect(result.run.tripCount).toBe(2);
    expect(result.events.filter(event => event.type === 'travel')).toHaveLength(1);
    expect(result.run.pendingBatch).toBeNull(); expect(result.run.position.cityId).toBe('lisboa');
  });
  it('fallo de ruta omite dependientes sin consumir viaje; cancelar conserva prefijo', () => {
    const def = { ...source, seed: 1 }; const run = initial(def);
    const paused = confirmAction(def, run, batch([travel('paris'), travel('unknown'), travel('lisboa')]));
    const continued = confirmAction(def, paused.run, proceed);
    expect(continued.run.tripCount).toBe(1); expect(continued.run.minute).toBe(180);
    expect(continued.run.position.cityId).toBe('paris');
    const cancelled = resolveAction(def, paused.run, { type: 'batch_decision', params: { decision: 'cancel' } });
    expect(cancelled.run.tripCount).toBe(1); expect(cancelled.run.minute).toBe(180);
    expect(cancelled.run.pendingBatch).toBeNull();
  });
  it('plazo exacto interrumpe el primer viaje sin llegada ni pasos posteriores', () => {
    const def = { ...source, seed: 14194, deadlineMinutes: 225 }; const run = initial(def);
    const result = confirmAction(def, run, batch([travel('paris'), { type: 'talk', params: { npcId: 'emile' } }]));
    expect(result.status).toBe('case_closed'); expect(result.run.minute).toBe(225);
    expect(result.run.position).toEqual(run.position); expect(result.run.tripCount).toBe(1);
    expect(result.run.conversationRecords).toEqual([]); expect(result.run.pendingBatch).toBeNull();
  });
  it.each([{ toCityId: '' }, { toCityId: 1 }, { toCityId: 'paris', delay: 0 }, { toCityId: 'p'.repeat(129) }])('parámetros cerrados: %j', params => {
    const run = initial();
    expect(confirmAction(source, run, batch([travel('paris'), { type: 'travel', params }]))).toMatchObject({ status: 'impossible', run, events: [] });
  });
  it('repetir destinos conserva secuencia y equivalencia con viajes individuales', () => {
    const def = { ...source, seed: 14194 }; const run = initial(def);
    const steps = [travel('paris'), travel('lisboa'), travel('madrid'), travel('paris')];
    let individual = run;
    for (const action of steps) individual = confirmAction(def, individual, action).run;
    const result = confirmAction(def, run, batch(steps));
    expect(result.run).toEqual({ ...individual, version: individual.version + 1, eventOrdinal: individual.eventOrdinal + 1 });
    expect(result.run.tripCount).toBe(4);
  });
  it('contador agotado y versión anterior fallan operativamente sin mutación', () => {
    const run = initial(); const full = { ...run, tripCount: Number.MAX_SAFE_INTEGER };
    expect(() => resolveAction(source, full, batch([travel('paris')]))).toThrow(EngineStateError);
    expect(full.tripCount).toBe(Number.MAX_SAFE_INTEGER);
    expect(() => confirmAction(source, { ...run, engineVersion: 9 }, batch([travel('paris')]))).toThrow(EngineStateError);
  });
});
