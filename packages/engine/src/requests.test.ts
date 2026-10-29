import { hashDefinition } from '@meridiano/case-schema/server';
import { acceptAction as resolveAction } from './test-actions.js';
import { describe, expect, it } from 'vitest';
import { astrolabioDefinition as def, createInitialRun,  EngineStateError } from './index.js';
import { MAX_PENDING_REQUESTS } from './requests.js';

describe('BOR-051: admisión de solicitudes de juego', () => {
  it('el cupo produce error operativo y conserva estado/ordinal', () => {
    const run = createInitialRun(def, 'synthetic', 'synthetic', hashDefinition(def));
    for (let index = 0; index < MAX_PENDING_REQUESTS; index++) {
      run.pendingRequests.push({ id: 'synthetic-' + index, type: 'communicate', dueMinute: 30, payload: {} });
    }
    // Estado controlado de unidad para saturar; no es una ruta de aceptación.
    const before = structuredClone(run);
    expect(() => resolveAction(def, run, { type: 'communicate', params: { channel: 'interno', recipient: 'equipo', content: 'sintético' } }))
      .toThrow(EngineStateError);
    expect(run).toEqual(before);
  });
  it('repetir un registro pendiente no reserva otro hueco ni cambia reloj', () => {
    const first = resolveAction(def, createInitialRun(def, 'synthetic', 'synthetic', hashDefinition(def)), { type: 'query', params: { topicId: 'accesos-tomas' } });
    const duplicate = resolveAction(def, first.run, { type: 'query', params: { topicId: 'accesos-tomas' } });
    expect(duplicate).toMatchObject({ status: 'impossible', run: first.run, events: [] });
    expect(duplicate.run.pendingRequests).toHaveLength(1);
  });
  it('payload de evidencia corrupto no se narra como resultado válido', () => {
    const run = createInitialRun(def, 'synthetic', 'synthetic', hashDefinition(def));
    run.pendingRequests.push({ id: 'synthetic', type: 'fixed_evidence', dueMinute: 1, payload: { evidenceId: 'EV-11', method: 'query' } });
    const before = structuredClone(run);
    expect(() => resolveAction(def, run, { type: 'wait', params: { minutes: 1 } })).toThrow(EngineStateError);
    expect(run).toEqual(before);
  });
  it('estar en la ciudad no sustituye presencia en el archivo autorizado', () => {
    const run = createInitialRun(def, 'synthetic', 'synthetic', hashDefinition(def));
    const absent = { ...run, position: { cityId: 'madrid', locationId: 'otra-ubicacion' } };
    const result = resolveAction(def, absent, { type: 'query', params: { topicId: 'accesos-tomas' } });
    expect(result).toMatchObject({ status: 'impossible', run: absent, events: [] });
  });

});
