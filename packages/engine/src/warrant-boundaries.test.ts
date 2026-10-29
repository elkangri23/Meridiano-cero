import { hashDefinition } from '@meridiano/case-schema/server';
import { acceptAction as resolveAction } from './test-actions.js';
import { describe, expect, it } from 'vitest';
import { astrolabioDefinition as def, createInitialRun,  EngineStateError } from './index.js';

// Estados controlados de unidad: no sustituyen las rutas por acciones.
function known() {
  return { ...createInitialRun(def, 'synthetic', 'synthetic', hashDefinition(def)), discoveries: ['EV-03', 'EV-04', 'EV-05'],
    admissibility: { 'EV-03': true, 'EV-04': true, 'EV-05': true } };
}

describe('BOR-004/039: órdenes y recuperación fallan cerradas', () => {
  it.each([
    [], ['EV-03', 'EV-03'], ['UNKNOWN'], ['EV-03', 123],
    Array.from({ length: 17 }, () => 'EV-03'), Array(1),
  ].map(evidenceIds => ({ evidenceIds })))('selección inválida no encola ni altera estado: %j', ({ evidenceIds }) => {
    const run = known(); const before = structuredClone(run);
    const result = resolveAction(def, run, { type: 'request_warrant', params: { suspectId: 'ines', evidenceIds } });
    expect(result).toMatchObject({ status: 'impossible', run: before, events: [] });
    expect(run).toEqual(before);
  });
  it('ignora autoridad inventada: campos extra impiden ejecutar la intención', () => {
    const run = known();
    expect(resolveAction(def, run, { type: 'request_warrant', params: { suspectId: 'ines', evidenceIds: ['EV-03'], approved: true } }))
      .toMatchObject({ status: 'impossible', run, events: [] });
  });
  it('request y maduración no leen la propiedad solution', () => {
    const guarded = new Proxy(def, { get(target, property, receiver) {
      if (property === 'solution') throw new Error('Forbidden truth access');
      return Reflect.get(target, property, receiver);
    } });
    const request = resolveAction(guarded, known(), { type: 'request_warrant', params: { suspectId: 'ines', evidenceIds: ['EV-03', 'EV-04'] } });
    expect(request.status).toBe('applied');
    const result = resolveAction(guarded, request.run, { type: 'wait', params: { minutes: 30 } });
    expect(result.run.warrants).toContain('warrant:ines');
  });
  it('prueba inadmisible al madurar no concede una orden previamente solicitada', () => {
    const request = resolveAction(def, known(), { type: 'request_warrant', params: { suspectId: 'ines', evidenceIds: ['EV-03', 'EV-04'] } });
    const withdrawn = { ...request.run, admissibility: { ...request.run.admissibility, 'EV-03': false } };
    const result = resolveAction(def, withdrawn, { type: 'wait', params: { minutes: 30 } });
    expect(result.run.warrants).not.toContain('warrant:ines');
    expect(result.events.some(event => event.type === 'warrant_denied')).toBe(true);
  });
  it('no coacciona strings de admisibilidad a permisos booleanos', () => {
    const request = resolveAction(def, known(), { type: 'request_warrant', params: { suspectId: 'ines', evidenceIds: ['EV-03', 'EV-04'] } });
    const corrupt = { ...request.run, admissibility: { ...request.run.admissibility, 'EV-03': 'true' as unknown as boolean } };
    const before = structuredClone(corrupt);
    expect(() => resolveAction(def, corrupt, { type: 'wait', params: { minutes: 30 } })).toThrow(EngineStateError);
    expect(corrupt).toEqual(before);
  });
  it('solicitud persistida corrupta es un fallo operativo, sin efectos', () => {
    const run = known();
    run.pendingRequests = [{ id: 'synthetic', type: 'warrant', dueMinute: 1, payload: { suspectId: 'ines', approved: true } }];
    const before = structuredClone(run);
    expect(() => resolveAction(def, run, { type: 'wait', params: { minutes: 1 } })).toThrow(EngineStateError);
    expect(run).toEqual(before);
  });
  it('una selección pendiente equivalente no crea otra solicitud aunque cambie su orden', () => {
    const first = resolveAction(def, known(), { type: 'request_warrant', params: { suspectId: 'ines', evidenceIds: ['EV-03', 'EV-04'] } });
    const result = resolveAction(def, first.run, { type: 'request_warrant', params: { suspectId: 'ines', evidenceIds: ['EV-04', 'EV-03'] } });
    expect(result).toMatchObject({ status: 'impossible', run: first.run, events: [] });
  });
  it('la recuperación irregular exige presencia y conserva prueba inadmisible', () => {
    const run = { ...createInitialRun(def, 'synthetic', 'synthetic', hashDefinition(def)), position: { cityId: 'lisboa', locationId: 'LIS-ALM' }, discoveries: ['forced-entry'] };
    const result = resolveAction(def, run, { type: 'recover', params: { objectId: 'astrolabio-original' } });
    expect(result.status).toBe('applied');
    expect(result.run.admissibility['EV-11']).toBe(false);
    expect(result.events[0]?.payload.irregular).toBe(true);
  });
});
