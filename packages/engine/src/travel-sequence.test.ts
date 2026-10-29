import { describe, expect, it } from 'vitest';
import { hashDefinition } from '@meridiano/case-schema/server';
import { astrolabioDefinition, createInitialRun, resolveAction, confirmAction, EngineStateError } from './index.js';
import type { CaseRun } from '@meridiano/case-schema';
const def = { ...astrolabioDefinition, seed: 1 };
const initial = () => createInitialRun(def, 'synthetic', 'synthetic', hashDefinition(def));
const travel = (toCityId: string) => ({ type: 'travel' as const, params: { toCityId } });

describe('T2-04: secuencia real de viajes', () => {
  it('repetir dos destinos no congela el índice y aplica el sorteo propio de cada salida', () => {
    let run = initial(); const delays: unknown[] = [];
    for (const city of ['paris', 'madrid', 'paris', 'madrid']) {
      const result = confirmAction(def, run, travel(city));
      expect(result.status).toBe('applied');
      delays.push(result.events.find(event => event.type === 'travel')?.payload.delay);
      run = result.run;
    }
    expect(delays).toEqual([0, 0, 0, 38]);
    expect(run.minute).toBe(758);
    expect(run.tripCount).toBe(4);
    expect(run.discoveries.filter(id => id.startsWith('travel:'))).toHaveLength(2);
  });
  it('serializar después de dos viajes conserva la misma continuación y ordinales', () => {
    const one = confirmAction(def, initial(), travel('paris'));
    const two = confirmAction(def, one.run, travel('madrid'));
    const restored: CaseRun = JSON.parse(JSON.stringify(two.run));
    const third = confirmAction(def, two.run, travel('paris'));
    expect(confirmAction(def, restored, travel('paris'))).toEqual(third);
    const fourth = confirmAction(def, third.run, travel('madrid'));
    expect(fourth.run.tripCount).toBe(4);
    expect(fourth.run.minute).toBe(758);
    expect(fourth.events.at(-1)?.ordinal).toBe(4);
  });
  it('preview repetido no reserva índice ni revela el sorteo; mismo input confirmado es reproducible', () => {
    const one = confirmAction(def, initial(), travel('paris'));
    const two = confirmAction(def, one.run, travel('madrid'));
    const before = structuredClone(two.run);
    const preview = resolveAction(def, two.run, travel('paris'));
    expect(preview).toMatchObject({ status: 'confirmation_required', run: before, events: [], preview: { estimatedMinutes: 180 } });
    expect(resolveAction(def, two.run, travel('paris'))).toEqual(preview);
    expect(two.run).toEqual(before);
    expect(confirmAction(def, two.run, travel('paris'))).toEqual(confirmAction(def, before, travel('paris')));
  });
  it('ruta imposible y acción sin viaje no consumen contador', () => {
    const run = initial();
    expect(confirmAction(def, run, travel('missing'))).toMatchObject({ status: 'impossible', run, events: [] });
    const talked = resolveAction(def, run, { type: 'talk', params: { npcId: 'lucia' } });
    expect(talked.run.tripCount).toBe(0);
  });
  it('un viaje interrumpido cuenta una salida confirmada, sin llegar ni permitir otro intento', () => {
    const short = { ...def, deadlineMinutes: 10 };
    const run = createInitialRun(short, 'synthetic', 'synthetic', hashDefinition(short));
    const result = confirmAction(short, run, travel('paris'));
    expect(result.status).toBe('case_closed');
    expect(result.run.tripCount).toBe(1);
    expect(result.run.position).toEqual(run.position);
    expect(result.run.discoveries).not.toContain('travel:paris');
    expect(confirmAction(short, result.run, travel('paris'))).toMatchObject({ status: 'impossible', run: result.run, events: [] });
  });
  it.each([undefined, -1, 0.5, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1])('contador inválido o agotado falla cerrado: %s', value => {
    const run = { ...initial(), tripCount: value as unknown as number }; const before = structuredClone(run);
    expect(() => resolveAction(def, run, travel('paris'))).toThrow(EngineStateError);
    expect(() => confirmAction(def, run, travel('paris'))).toThrow('TRAVEL_SEQUENCE_INVALID');
    expect(run).toEqual(before);
  });
  it('el límite del contador impide otro viaje pero conserva lectura y cierre del caso', () => {
    // Contador controlado de unidad, no una ruta de aceptación.
    const run = { ...initial(), tripCount: Number.MAX_SAFE_INTEGER - 1 };
    const result = confirmAction(def, run, travel('paris'));
    expect(result.status).toBe('applied');
    expect(result.run.tripCount).toBe(Number.MAX_SAFE_INTEGER);
    expect(() => resolveAction(def, result.run, travel('madrid'))).toThrow('TRAVEL_SEQUENCE_INVALID');
    const closed = confirmAction(def, result.run, { type: 'finish', params: { confirmed: true } });
    expect(closed.status).toBe('case_closed');
    expect(closed.run.tripCount).toBe(Number.MAX_SAFE_INTEGER);
  });

});
