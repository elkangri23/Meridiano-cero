import { hashDefinition } from '@meridiano/case-schema/server';
import { describe, expect, it } from 'vitest';
import { astrolabioDefinition as def, createInitialRun, resolveAction, confirmAction, EngineStateError } from './index.js';
import type { Action } from './types.js';

const initial = () => createInitialRun(def, 'synthetic', 'synthetic', hashDefinition(def));
const inspect: Action = { type: 'inspect', params: { targetId: 'MAD-SALA', elementId: 'cerradura' } };

describe('T2: confirmación, coste material y plazo', () => {
  it.each([{ elementId: undefined, minutes: 10, id: 'EV-01' }, { elementId: 'cerradura', minutes: 20, id: 'EV-02' }, { elementId: 'caja', minutes: 20, id: 'EV-06' }])('inspección $id cuesta $minutes solo tras confirmar', ({ elementId, minutes, id }) => {
    const run = initial(); const before = structuredClone(run);
    const action: Action = { type: 'inspect', params: { targetId: 'MAD-SALA', ...(elementId ? { elementId } : {}), confirmed: true } };
    const preview = resolveAction(def, run, action);
    expect(preview).toMatchObject({ status: 'confirmation_required', run: before, events: [], preview: { estimatedMinutes: minutes } });
    expect(run).toEqual(before);
    const result = confirmAction(def, run, action);
    expect(result.status).toBe('applied');
    expect(result.run.minute).toBe(minutes);
    expect(result.run.evidenceRecords?.[id]?.revealedMinute).toBe(minutes);
    const repeated = resolveAction(def, result.run, action);
    expect(repeated.status).toBe('applied');
    expect(repeated.run.minute).toBe(minutes);
  });
  it('esperar pide confirmación y no madura resultados en el preview', () => {
    const run = initial();
    const request = resolveAction(def, run, { type: 'query', params: { topicId: 'accesos-tomas' } });
    const action: Action = { type: 'wait', params: { minutes: 30 } };
    const before = structuredClone(request.run);
    expect(resolveAction(def, request.run, action)).toMatchObject({ status: 'confirmation_required', run: before, events: [] });
    expect(request.run).toEqual(before);
    const result = confirmAction(def, request.run, action);
    expect(result.run.discoveries).toContain('EV-10');
    expect(result.run.minute).toBe(30);
  });
  it.each([10, 20])('el plazo interrumpe inspección con %s minutos restantes, sin hallazgo terminal', remaining => {
    const run = { ...initial(), minute: def.deadlineMinutes - remaining };
    const result = confirmAction(def, run, inspect);
    expect(result.status).toBe('case_closed');
    expect(result.run.minute).toBe(def.deadlineMinutes);
    expect(result.run.discoveries).not.toContain('EV-02');
    expect(result.events.at(-1)?.type).toBe('action_interrupted');
    expect(result.run.pendingBatch).toBeNull();
  });
  it('no concede un hallazgo caro desde un lote sin aprobación', () => {
    const run = initial();
    const action: Action = { type: 'batch', params: { steps: [inspect, { type: 'collect', params: { evidenceId: 'EV-02' } }] } };
    expect(resolveAction(def, run, action)).toMatchObject({ status: 'confirmation_required', run, events: [], preview: { estimatedMinutes: 20 } });
    const result = confirmAction(def, run, action);
    expect(result.run.minute).toBe(20);
    expect(result.run.inventory).toContain('EV-02');
    expect(result.run.evidenceRecords?.['EV-02']?.collectedMinute).toBe(20);
  });
  it('vencimiento descarta el resto del lote sin recoger ni conversar', () => {
    const run = { ...initial(), minute: def.deadlineMinutes - 10 };
    const action: Action = { type: 'batch', params: { steps: [inspect, { type: 'talk', params: { npcId: 'lucia' } }] } };
    const result = confirmAction(def, run, action);
    expect(result.status).toBe('case_closed');
    expect(result.run.inventory).toEqual([]);
    expect(result.run.conversationRecords).toEqual([]);
    expect(result.run.pendingBatch).toBeNull();
  });
  it('lote mal formado se rechaza completo antes de ejecutar el prefijo', () => {
    const run = initial();
    const result = confirmAction(def, run, { type: 'batch', params: { steps: [inspect, null] } });
    expect(result).toMatchObject({ status: 'impossible', run, events: [] });
  });
  it.each(['detain', 'recover'] as const)('%s cobra tiempo y requiere aprobación', type => {
    // Estado controlado de unidad: las rutas naturales están en simulation.test.
    const run = { ...initial(), position: { cityId: 'lisboa', locationId: 'LIS-ALM' },
      discoveries: ['identity:ines', 'location:ines'], warrants: ['warrant:ines', 'warrant:access'] };
    const action: Action = type === 'detain'
      ? { type, params: { suspectId: 'ines', locationId: 'LIS-ALM', warrantId: 'warrant:ines', mode: 'interactive' } }
      : { type, params: { objectId: 'astrolabio-original' } };
    expect(resolveAction(def, run, action)).toMatchObject({ status: 'confirmation_required', run, events: [] });
    const result = confirmAction(def, run, action);
    expect(result.status).toBe('applied');
    expect(result.run.minute).toBe(type === 'detain' ? 15 : 20);
    const expired = confirmAction(def, { ...run, minute: def.deadlineMinutes - 1 }, action);
    expect(expired.status).toBe('case_closed');
    expect(expired.run.detentions).toEqual([]);
    expect(expired.run.recoveredObjects).toEqual([]);
  });
  it('continuar el resto costoso exige nuevo preview y no repite pasos aplicados', () => {
    const action: Action = { type: 'batch', params: { steps: [
      { type: 'talk', params: { npcId: 'lucia' } },
      { type: 'collect', params: { evidenceId: 'unknown' } }, inspect,
    ], dependencies: [[], [], []] } };
    const paused = resolveAction(def, initial(), action);
    expect(paused.status).toBe('batch_paused');
    const before = structuredClone(paused.run);
    const decision: Action = { type: 'batch_decision', params: { decision: 'continue_independent' } };
    expect(resolveAction(def, paused.run, decision)).toMatchObject({ status: 'confirmation_required', run: before, events: [], preview: { estimatedMinutes: 20 } });
    const resumed = confirmAction(def, paused.run, decision);
    expect(resumed.run.minute).toBe(20);
    expect(resumed.run.conversationRecords).toHaveLength(1);
    expect(resumed.run.pendingBatch).toBeNull();
    expect(paused.run).toEqual(before);
  });
  it('vencimiento conserva el prefijo completado del lote, sin aplicar el paso interrumpido', () => {
    const run = { ...initial(), minute: def.deadlineMinutes - 15 };
    const result = confirmAction(def, run, { type: 'batch', params: { steps: [
      { type: 'inspect', params: { targetId: 'MAD-SALA' } }, inspect,
    ] } });
    expect(result.status).toBe('case_closed');
    expect(result.run.discoveries).toContain('EV-01');
    expect(result.run.discoveries).not.toContain('EV-02');
    expect(result.run.pendingBatch).toBeNull();
    expect(result.events.map(event => event.type)).toEqual(['inspect', 'action_interrupted']);
    expect(result.events.map(event => event.ordinal)).toEqual([1, 2]);
  });
  it.each(['{', 'null', '[]', '{"ordinal":0,"status":"impossible","action":null}'])('lote persistido corrupto falla operativamente sin tocar el estado: %s', record => {
    const run = { ...initial(), pendingBatch: [record] };
    const before = structuredClone(run);
    expect(() => confirmAction(def, run, { type: 'batch_decision', params: { decision: 'continue_independent' } })).toThrow(EngineStateError);
    expect(run).toEqual(before);
  });

  it('rechaza espera cuya suma desborda el entero seguro, sin transición', () => {
    const run = { ...initial(), minute: 1 };
    const action: Action = { type: 'wait', params: { minutes: Number.MAX_SAFE_INTEGER } };
    expect(resolveAction(def, run, action)).toMatchObject({ status: 'impossible', run, events: [] });
    expect(confirmAction(def, run, action)).toMatchObject({ status: 'impossible', run, events: [] });
  });

});
