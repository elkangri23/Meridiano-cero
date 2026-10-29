import { hashDefinition } from '@meridiano/case-schema/server';
import { acceptAction as resolveAction } from './test-actions.js';
import { describe, expect, it } from 'vitest';
import { astrolabioDefinition as definition, createInitialRun,  confirmAction, ENGINE_VERSION, EngineStateError } from './index.js';
import type { Action } from './index.js';
import type { CaseRun } from '@meridiano/case-schema';

const inspect: Action = { type: 'inspect', params: { targetId: 'MAD-SALA' } };
const query: Action = { type: 'query', params: { topicId: 'accesos-tomas' } };
function initial() { return createInitialRun(definition, 'synthetic-owner', 'synthetic-run', hashDefinition(definition)); }

describe('BOR-032/042: secuencia persistida por partida', () => {
  it('el mismo estado produce lo mismo aunque otra partida ejecute acciones', () => {
    const run = initial();
    const before = structuredClone(run);
    const first = resolveAction(definition, run, query);
    resolveAction(definition, createInitialRun(definition, 'other-owner', 'other-run', hashDefinition(definition)), query);
    resolveAction(definition, createInitialRun(definition, 'other-owner', 'other-run', hashDefinition(definition)), inspect);
    expect(resolveAction(definition, run, query)).toEqual(first);
    expect(run).toEqual(before);
    expect(first.events.map(event => event.ordinal)).toEqual([1]);
    expect(first.run.eventOrdinal).toBe(1);
  });
  it('serializar/reanudar conserva secuencia e IDs sin depender del proceso', () => {
    const first = resolveAction(definition, initial(), query);
    const restored = JSON.parse(JSON.stringify(first.run)) as CaseRun;
    const result = resolveAction(definition, restored, { type: 'wait', params: { minutes: 30 } });
    expect(result.events.map(event => event.ordinal)).toEqual([2, 3]);
    expect(result.run.eventOrdinal).toBe(3);
    expect(result.events.map(event => event.type)).toEqual(['request_matured', 'wait']);
    expect(restored.eventOrdinal).toBe(1);
  });
  it('un preview no reserva ordinal ni altera la identidad de la siguiente solicitud', () => {
    const run = initial();
    const preview = resolveAction(definition, run, { type: 'travel', params: { toCityId: 'paris' } });
    expect(preview.status).toBe('confirmation_required');
    expect(preview.run.eventOrdinal).toBe(0);
    expect(resolveAction(definition, preview.run, query)).toEqual(resolveAction(definition, run, query));
  });
  it.each([-1, NaN, Number.MAX_SAFE_INTEGER])('contador inválido o agotado falla sin efectos: %s', eventOrdinal => {
    const run = { ...initial(), eventOrdinal };
    const before = structuredClone(run);
    expect(() => resolveAction(definition, run, inspect)).toThrow(EngineStateError);
    expect(run).toEqual(before);
  });
  it('no interpreta estados de ejecución v1 con las reglas v3', () => {
    const run = { ...initial(), engineVersion: 1 };
    expect(ENGINE_VERSION).toBe(14);
    expect(() => confirmAction(definition, run, { type: 'travel', params: { toCityId: 'paris' } })).toThrow(EngineStateError);
  });
});

describe('BOR-031/032: vencimiento y objetivos materializados', () => {
  it.each([
    { detained: [], recovered: [], expected: 'unresolved' },
    { detained: ['ines'], recovered: [], expected: 'partial' },
    { detained: [], recovered: ['astrolabio-original'], expected: 'partial' },
    { detained: ['ines-valera'], recovered: ['astrolabio-original'], expected: 'complete' },
    { detained: ['ines', 'tomas'], recovered: ['astrolabio-original'], expected: 'incorrect' },
    { detained: ['ines-v'], recovered: [], expected: 'incorrect' },
    { detained: [], recovered: ['not-the-original'], expected: 'unresolved' },
  ])('finish y deadline usan los mismos hechos: $expected / $detained', sample => {
    // Estado controlado de unidad; no es una demostración de ruta legal completa.
    const run = { ...initial(), detentions: sample.detained, recoveredObjects: sample.recovered, minute: definition.deadlineMinutes - 1 };
    const before = structuredClone(run);
    const finished = confirmAction(definition, run, { type: 'finish', params: {} });
    const expired = resolveAction(definition, run, { type: 'wait', params: { minutes: 1 } });
    if (finished.status !== 'case_closed' || expired.status !== 'case_closed') throw new Error('Expected closed case');
    expect(finished.report.result).toBe(sample.expected);
    expect(expired.report.result).toBe(sample.expected);
    expect(expired.report.objectivesAchieved).toEqual(finished.report.objectivesAchieved);
    expect(expired.report.reason).toBe('deadline');
    expect(finished.report.reason).toBe('finished');
    expect(run).toEqual(before);
  });
  it('no acepta objetivos precompletados de la definición como efectos del jugador', () => {
    const forged = { ...definition, objectives: definition.objectives.map(objective => ({ ...objective, achieved: true })) };
    const result = confirmAction(forged, createInitialRun(forged, 'synthetic', 'synthetic', hashDefinition(forged)), { type: 'finish', params: {} });
    expect(result).toMatchObject({ status: 'case_closed', report: { result: 'unresolved', objectivesAchieved: [] } });
    expect(forged.objectives.every(objective => objective.achieved)).toBe(true);
  });
  it.each([179, 180, 181])('viaje de 180 minutos con plazo %s respeta el empate', deadlineMinutes => {
    const def = { ...definition, deadlineMinutes, seed: 1 };
    const run = createInitialRun(def, 'synthetic', 'synthetic', hashDefinition(def));
    const result = confirmAction(def, run, { type: 'travel', params: { toCityId: 'paris' } });
    expect(result.run.minute).toBe(Math.min(180, deadlineMinutes));
    if (deadlineMinutes <= 180) {
      expect(result.status).toBe('case_closed');
      expect(result.run.position).toEqual(run.position);
      expect(result.run.discoveries).not.toContain('travel:paris');
      expect(result.events.some(event => event.type === 'travel')).toBe(false);
    } else {
      expect(result.status).toBe('applied');
      expect(result.run.position.cityId).toBe('paris');
    }
  });
  it('solo maduran eventos anteriores al plazo, ordenados por minuto y ordinal', () => {
    const def = { ...definition, deadlineMinutes: 10 };
    const run = { ...createInitialRun(def, 'synthetic', 'synthetic', hashDefinition(def)), minute: 8,
      pendingRequests: [
        { id: 'later', dueMinute: 11, type: 'query', payload: {} },
        { id: 'exact', dueMinute: 10, type: 'query', payload: {} },
        { id: 'before', dueMinute: 9, type: 'query', payload: {} },
      ] };
    const before = structuredClone(run);
    const result = resolveAction(def, run, { type: 'wait', params: { minutes: 2 } });
    expect(result.events.map(event => [event.minute, event.ordinal, event.type])).toEqual([[9, 1, 'request_matured'], [10, 2, 'wait']]);
    expect(result.events[0]?.payload.requestId).toBe('before');
    expect(result.run.pendingRequests.map(request => request.id)).toEqual(['exact', 'later']);
    expect(run).toEqual(before);
  });
  it('confirmar después del cierre no mueve estado ni genera eventos', () => {
    const closed = confirmAction(definition, initial(), { type: 'finish', params: {} });
    expect(confirmAction(definition, closed.run, { type: 'travel', params: { toCityId: 'paris' } }))
      .toMatchObject({ status: 'impossible', run: closed.run, events: [] });
  });
  it('análisis se envía sin coste y no madura si su resultado queda después del plazo', () => {
    const run = { ...initial(), minute: definition.deadlineMinutes - 10, inventory: ['EV-02'] };
    const submitted = confirmAction(definition, run, { type: 'analyze', params: { evidenceId: 'EV-02' } });
    expect(submitted.status).toBe('applied');
    expect(submitted.run.minute).toBe(run.minute);
    const result = resolveAction(definition, submitted.run, { type: 'wait', params: { minutes: 10 } });
    expect(result.status).toBe('case_closed');
    expect(result.run.minute).toBe(definition.deadlineMinutes);
    expect(result.run.discoveries).not.toContain('EV-03');
  });
});
