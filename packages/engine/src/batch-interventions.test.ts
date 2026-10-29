import { describe, expect, it } from 'vitest';
import { hashDefinition } from '@meridiano/case-schema/server';
import { createInitialRun, resolveAction, confirmAction, EngineStateError } from './index.js';
import { astrolabioDefinition as def } from './fixtures/case-astrolabio.js';
import type { Action } from './types.js';

const detain: Action = { type: 'detain', params: { suspectId: 'ines', warrantId: 'warrant:ines', locationId: 'LIS-ALM', mode: 'interactive' } };
const recover: Action = { type: 'recover', params: { objectId: 'astrolabio-original' } };
const proceed: Action = { type: 'batch_decision', params: { decision: 'continue_independent' } };
function batch(steps: Action[], dependencies?: number[][]): Action {
  return { type: 'batch', params: { steps, ...(dependencies ? { dependencies } : {}) } };
}
function ready() {
  // Estado sintético controlado para bordes; las rutas de aceptación no usan este helper.
  return { ...createInitialRun(def, 'synthetic', 'synthetic', hashDefinition(def)),
    position: { cityId: 'lisboa', locationId: 'LIS-ALM' },
    discoveries: ['identity:ines', 'location:ines'], warrants: ['warrant:ines', 'warrant:access'] };
}

describe('T2: intervenciones en secuencias v9', () => {
  it('preview no altera estado ni desvela resultados y confirma costes individuales', () => {
    const run = ready(); const before = structuredClone(run); const action = batch([detain, recover]);
    expect(resolveAction(def, run, action)).toMatchObject({ status: 'confirmation_required', run: before, events: [], preview: { estimatedMinutes: 35 } });
    expect(run).toEqual(before);
    const result = confirmAction(def, run, action);
    expect(result.status).toBe('applied');
    expect(result.run.minute).toBe(35);
    expect(result.run.detentions).toEqual(['ines']);
    expect(result.run.recoveredObjects).toEqual(['astrolabio-original']);
    expect(result.run.evidenceRecords?.['EV-11']?.revealedMinute).toBe(35);
    expect(result.run.status).toBe('active');
    expect(result.events.map(event => event.type)).toEqual(['detain', 'recover', 'batch_completed']);
    const first = confirmAction(def, before, detain);
    const second = confirmAction(def, first.run, recover);
    expect(result.run).toEqual({ ...second.run, version: second.run.version + 1, eventOrdinal: second.run.eventOrdinal + 1 });
  });
  it('detención sin orden pausa sin coste; omite recuperación dependiente', () => {
    const run = { ...ready(), warrants: [] };
    const paused = confirmAction(def, run, batch([detain, recover]));
    expect(paused.status).toBe('batch_paused');
    expect(paused.run.minute).toBe(0);
    expect(paused.run.detentions).toEqual([]);
    const result = confirmAction(def, paused.run, proceed);
    expect(result.run.recoveredObjects).toEqual([]);
    expect(result.run.minute).toBe(0);
    expect(result.events.some(event => event.type === 'batch_step_skipped')).toBe(true);
  });
  it('continuación independiente tras serialización no repite detención aplicada', () => {
    const run = ready();
    const paused = confirmAction(def, run, batch([detain, detain, recover], [[], [], []]));
    expect(paused.status).toBe('batch_paused');
    expect(paused.run.minute).toBe(15);
    const saved = JSON.parse(JSON.stringify(paused.run)) as typeof run;
    expect(resolveAction(def, saved, proceed)).toMatchObject({ status: 'confirmation_required', run: saved, events: [], preview: { estimatedMinutes: 20 } });
    const result = confirmAction(def, saved, proceed);
    expect(result.run.minute).toBe(35);
    expect(result.run.detentions).toEqual(['ines']);
    expect(result.events.some(event => event.type === 'detain')).toBe(false);
    expect(result.events.filter(event => event.type === 'recover')).toHaveLength(1);
    expect(result.run.pendingBatch).toBeNull();
  });
  it.each([15, 35])('plazo exacto %s no aplica efecto terminal ni resto del lote', deadlineMinutes => {
    const short = { ...def, deadlineMinutes }; const run = ready();
    const result = confirmAction(short, run, batch([detain, recover, { type: 'talk', params: { npcId: 'ines' } }]));
    expect(result.status).toBe('case_closed');
    expect(result.run.minute).toBe(deadlineMinutes);
    expect(result.run.detentions).toEqual(deadlineMinutes === 15 ? [] : ['ines']);
    expect(result.run.recoveredObjects).toEqual([]);
    expect(result.run.inventory).not.toContain('EV-11');
    expect(result.run.conversationRecords).toEqual([]);
    expect(result.run.pendingBatch).toBeNull();
  });
  it.each([
    { ...detain, params: { ...detain.params, mode: 'remote' } },
    { ...detain, params: { ...detain.params, warrantId: undefined } },
    { ...detain, params: { ...detain.params, authorized: true } },
    { ...recover, params: { ...recover.params, admissible: true } },
    { ...recover, params: { objectId: '' } },
  ])('rechaza parámetros no admitidos sin efectos', action => {
    const run = ready();
    expect(confirmAction(def, run, batch([action]))).toMatchObject({ status: 'impossible', run, events: [] });
  });
  it('recuperación exige acceso propio y presencia; no hereda permiso de detener', () => {
    const run = { ...ready(), warrants: ['warrant:ines'] };
    const result = confirmAction(def, run, batch([detain, recover]));
    expect(result.status).toBe('batch_paused');
    expect(result.run.minute).toBe(15);
    expect(result.run.recoveredObjects).toEqual([]);
    const elsewhere = { ...ready(), position: { cityId: 'madrid', locationId: 'MAD-SALA' } };
    expect(confirmAction(def, elsewhere, batch([detain])).run.detentions).toEqual([]);
  });
  it('no ejecuta snapshots v8 con semántica v9', () => {
    const run = { ...ready(), engineVersion: 8 };
    expect(() => confirmAction(def, run, batch([detain, recover]))).toThrow(EngineStateError);
  });
});
