import { describe, expect, it } from 'vitest';
import { hashDefinition } from '@meridiano/case-schema/server';
import { astrolabioDefinition as def, createInitialRun, resolveAction, confirmAction, EngineStateError } from './index.js';
import type { Action } from './types.js';
const initial = () => createInitialRun(def, 'synthetic', 'synthetic', hashDefinition(def));
const finish: Action = { type: 'finish', params: {} };

describe('T2: cierre individual por confirmación separada v14', () => {
  it('preview de cierre gratuito no produce informe, eventos ni cambio de estado', () => {
    const run = initial(); const before = structuredClone(run);
    expect(resolveAction(def, run, finish)).toMatchObject({ status: 'confirmation_required', run: before, events: [], preview: { estimatedMinutes: 0 } });
    expect(run).toEqual(before); expect(run.finalReport).toBeNull();
  });
  it('confirmación cierra una sola vez y no cobra minutos', () => {
    const run = initial(); const result = confirmAction(def, run, finish);
    expect(result).toMatchObject({ status: 'case_closed', report: { reason: 'finished', result: 'unresolved' } });
    expect(result.run.minute).toBe(0); expect(result.run.version).toBe(run.version + 1);
    expect(result.events.map(event => event.type)).toEqual(['finish']);
    expect(confirmAction(def, result.run, finish)).toMatchObject({ status: 'impossible', run: result.run, events: [] });
  });
  it.each([{ confirmed: true }, { confirmed: false }, { result: 'complete' }, { ownerId: 'SYNTHETIC_PRIVATE' }])('campos de control no cierran ni en resolve ni en confirm: %j', params => {
    const run = initial(); const before = structuredClone(run); const action: Action = { type: 'finish', params };
    for (const execute of [resolveAction, confirmAction]) {
      const result = execute(def, run, action);
      expect(result).toMatchObject({ status: 'impossible', run: before, events: [] });
      expect(JSON.stringify(result)).not.toContain('SYNTHETIC_PRIVATE');
    }
    expect(run).toEqual(before);
  });
  it('inicio anterior conservado no se reinterpreta como versión nueva', () => {
    const legacy = { ...initial(), engineVersion: 13 }; const before = structuredClone(legacy);
    expect(() => confirmAction(def, legacy, finish)).toThrow(EngineStateError);
    expect(legacy).toEqual(before);
  });
});
