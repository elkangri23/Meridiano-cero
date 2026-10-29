import { describe, expect, it } from 'vitest';
import { hashDefinition } from '@meridiano/case-schema/server';
import { astrolabioDefinition as def, createInitialRun, resolveAction, confirmAction, EngineStateError } from './index.js';
import type { Action, BatchStep } from './types.js';

const initial = () => createInitialRun(def, 'synthetic', 'synthetic', hashDefinition(def));
const talk: Action = { type: 'talk', params: { npcId: 'lucia' } };
const missing: Action = { type: 'collect', params: { evidenceId: 'synthetic-missing' } };
const inspect: Action = { type: 'inspect', params: { targetId: 'MAD-SALA', elementId: 'cerradura' } };
const proceed: Action = { type: 'batch_decision', params: { decision: 'continue_independent' } };
function batch(steps: unknown[], dependencies?: unknown): Action {
  return { type: 'batch', params: { steps, ...(dependencies !== undefined ? { dependencies } : {}) } };
}

describe('T2-03: dependencias conservadoras de lotes', () => {
  it('sin grafo el resto depende del fallo y continuar necesita aprobación aunque cueste cero', () => {
    const paused = resolveAction(def, initial(), batch([missing, talk]));
    expect(paused.status).toBe('batch_paused');
    const before = structuredClone(paused.run);
    expect(resolveAction(def, paused.run, proceed)).toMatchObject({ status: 'confirmation_required', run: before, events: [], preview: { estimatedMinutes: 0 } });
    const result = confirmAction(def, paused.run, proceed);
    expect(result.status).toBe('applied');
    expect(result.run.conversationRecords).toEqual([]);
    expect(result.run.minute).toBe(0);
    expect(result.run.pendingBatch).toBeNull();
    expect(result.events).toMatchObject([{ type: 'batch_step_skipped', payload: { stepOrdinal: 1 } }, { type: 'batch_completed' }]);
    expect(paused.run).toEqual(before);
  });
  it('omite dependencias transitivas sin coste y permite una acción independiente', () => {
    const paused = resolveAction(def, initial(), batch([missing, inspect, inspect, talk], [[], [0], [1], []]));
    const result = confirmAction(def, paused.run, proceed);
    expect(result.run.minute).toBe(0);
    expect(result.run.discoveries).not.toContain('EV-02');
    expect(result.run.conversationRecords).toEqual(['talk:lucia@0']);
    expect(result.events.filter(event => event.type === 'batch_step_skipped').map(event => event.payload.stepOrdinal)).toEqual([1, 2]);
  });
  it('conserva el prefijo y ejecuta un paso dependiente de un requisito que sí se completó', () => {
    const action = batch([{ type: 'inspect', params: { targetId: 'MAD-SALA' } }, missing, talk], [[], [], [0]]);
    const run = initial();
    expect(resolveAction(def, run, action)).toMatchObject({ status: 'confirmation_required', run, events: [] });
    const paused = confirmAction(def, run, action);
    expect(paused.status).toBe('batch_paused');
    expect(paused.run.minute).toBe(10);
    const result = confirmAction(def, paused.run, proceed);
    expect(result.run.minute).toBe(10);
    expect(result.run.conversationRecords).toEqual(['talk:lucia@10']);
    expect(result.events.map(event => event.type)).toEqual(['talk', 'batch_completed']);
  });
  it('una segunda pausa persiste omisiones y reanuda tras serialización sin repetirlas', () => {
    const first = resolveAction(def, initial(), batch([missing, inspect, missing, talk], [[], [0], [], []]));
    const second = confirmAction(def, first.run, proceed);
    expect(second.status).toBe('batch_paused');
    const records = second.run.pendingBatch?.map(value => JSON.parse(value) as BatchStep);
    expect(records?.map(step => step.status)).toEqual(['impossible', 'skipped', 'impossible', 'pending']);
    const restored: typeof second.run = JSON.parse(JSON.stringify(second.run));
    const result = confirmAction(def, restored, proceed);
    expect(result.run.conversationRecords).toEqual(['talk:lucia@0']);
    expect(result.events.map(event => event.type)).toEqual(['talk', 'batch_completed']);
    expect(result.events.map(event => event.ordinal)).toEqual([4, 5]);
    expect(result.run.pendingBatch).toBeNull();
  });
  it('cancelar no ejecuta el resto ni consume minutos', () => {
    const paused = resolveAction(def, initial(), batch([missing, inspect], [[], []]));
    const result = resolveAction(def, paused.run, { type: 'batch_decision', params: { decision: 'cancel' } });
    expect(result.status).toBe('applied');
    expect(result.run.minute).toBe(0);
    expect(result.run.discoveries).not.toContain('EV-02');
    expect(result.run.pendingBatch).toBeNull();
  });
  it.each([
    { label: 'null', graph: null }, { label: 'longitud', graph: [] }, { label: 'referencia propia', graph: [[], [1]] },
    { label: 'referencia futura', graph: [[1], []] }, { label: 'negativo', graph: [[], [-1]] },
    { label: 'duplicado', graph: [[], [0, 0]] }, { label: 'fuera de rango', graph: [[], [8]] },
    { label: 'string', graph: [[], ['0']] }, { label: 'fracción', graph: [[], [0.5]] },
    { label: 'infinito', graph: [[], [Infinity]] }, { label: 'lista dispersa', graph: [[], Array(1)] },
  ])('rechaza grafo $label sin ejecutar prefijo', ({ graph }) => {
    const run = initial(); const action = batch([talk, talk], graph);
    expect(resolveAction(def, run, action)).toMatchObject({ status: 'impossible', run, events: [] });
    expect(confirmAction(def, run, action)).toMatchObject({ status: 'impossible', run, events: [] });
  });
  it.each([
    { type: 'talk', params: { npcId: 0 } },
    { type: 'talk', params: { npcId: 'lucia', approved: true } },
    { type: 'inspect', params: { targetId: 'MAD-SALA', elementId: [] } },
    { type: 'batch', params: { steps: [] } },
    { type: 'travel', params: { toCityId: 'paris', delay: 0 } },
    { type: 'talk', params: { npcId: 'lucia' }, dependsOn: [] },
  ])('valida params y tipos de todo el lote antes del prefijo: %j', value => {
    const run = initial();
    expect(confirmAction(def, run, batch([talk, value]))).toMatchObject({ status: 'impossible', run, events: [] });
  });
  it('una lista de acciones dispersa no elude la validación', () => {
    const steps = Array(2); steps[0] = talk;
    const run = initial();
    expect(resolveAction(def, run, batch(steps))).toMatchObject({ status: 'impossible', run, events: [] });
  });
  it('no comparte arrays de dependencias ni acciones con la entrada tras pausar', () => {
    const graph = [[], [0]];
    const pendingTalk: Action = { type: 'talk', params: { npcId: 'lucia' } };
    const paused = resolveAction(def, initial(), batch([missing, pendingTalk], graph));
    graph[1]?.splice(0); pendingTalk.params.npcId = 'tomas';
    const result = confirmAction(def, paused.run, proceed);
    expect(result.run.conversationRecords).toEqual([]);
    expect(result.events.some(event => event.type === 'batch_step_skipped')).toBe(true);
  });
  it('corrupción de dependencias o estados persistidos falla cerrado incluso al cancelar', () => {
    const paused = resolveAction(def, initial(), batch([missing, talk]));
    const records = paused.run.pendingBatch;
    if (!records) throw new Error('Missing synthetic batch');
    const corruptions = [
      (steps: BatchStep[]) => { const step = steps[1]; if (step) step.dependsOn = [1]; },
      (steps: BatchStep[]) => { const step = steps[1]; if (step) step.status = 'applied'; },
      (steps: BatchStep[]) => { const step = steps[0]; if (step) step.status = 'pending'; },
      (steps: BatchStep[]) => { const step = steps[1]; if (step) delete (step as Partial<BatchStep>).dependsOn; },
    ];
    for (const corrupt of corruptions) {
      const steps = records.map(value => JSON.parse(value) as BatchStep); corrupt(steps);
      const run = { ...paused.run, pendingBatch: steps.map(value => JSON.stringify(value)) };
      const before = structuredClone(run);
      for (const decision of ['cancel', 'continue_independent']) {
        expect(() => confirmAction(def, run, { type: 'batch_decision', params: { decision } })).toThrow(EngineStateError);
        expect(run).toEqual(before);
      }
    }
  });
  it('no coacciona una decisión objeto a continuación ejecutable', () => {
    const paused = resolveAction(def, initial(), batch([missing, talk], [[], []]));
    const action: Action = { type: 'batch_decision', params: { decision: { toString: () => 'continue_independent' } } };
    expect(resolveAction(def, paused.run, action)).toMatchObject({ status: 'impossible', run: paused.run, events: [] });
  });
  it.each([4, 5, 6, 7])('rechaza ejecución v%s sin reinterpretar progreso antiguo', engineVersion => {
    const run = { ...initial(), engineVersion };
    expect(() => confirmAction(def, run, batch([talk]))).toThrow(EngineStateError);
  });
  it('vencimiento durante una continuación descarta resto y no materializa el hallazgo', () => {
    const later = confirmAction(def, initial(), { type: 'wait', params: { minutes: def.deadlineMinutes - 10 } });
    const paused = resolveAction(def, later.run, batch([missing, inspect, talk], [[], [], []]));
    expect(resolveAction(def, paused.run, proceed)).toMatchObject({ status: 'confirmation_required', run: paused.run, events: [] });
    const result = confirmAction(def, paused.run, proceed);
    expect(result.status).toBe('case_closed');
    expect(result.run.pendingBatch).toBeNull();
    expect(result.run.discoveries).not.toContain('EV-02');
    expect(result.run.conversationRecords).toEqual([]);
  });
  it('acota lectura de metadata persistida antes de parsear y motivos de pausa', () => {
    const paused = resolveAction(def, initial(), batch([missing, talk]));
    const oversized = { ...paused.run, pendingBatch: ['x'.repeat(4097)] };
    expect(() => confirmAction(def, oversized, proceed)).toThrow(EngineStateError);
    const records = paused.run.pendingBatch?.map(value => JSON.parse(value) as BatchStep);
    if (!records?.[0]) throw new Error('Missing synthetic metadata');
    records[0].reason = 'x'.repeat(513);
    const run = { ...paused.run, pendingBatch: records.map(value => JSON.stringify(value)) };
    expect(() => confirmAction(def, run, proceed)).toThrow(EngineStateError);
  });

});
