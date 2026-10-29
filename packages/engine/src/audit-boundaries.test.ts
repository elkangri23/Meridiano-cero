import { hashDefinition } from '@meridiano/case-schema/server';
import { describe, expect, it } from 'vitest';
import { astrolabioDefinition, createInitialRun, resolveAction } from './index.js';
import { seededDelay } from './clock.js';
import { validateCaseDefinition, createValidationReport } from '@meridiano/case-schema';

describe('regresiones del contraste con 7962014', () => {
  it('preview de viaje no revela el retraso sorteado ni modifica estado', () => {
    const delayed = { ...astrolabioDefinition, seed: 0 };
    const normal = { ...astrolabioDefinition, seed: 42 };
    const action = { type: 'travel', params: { toCityId: 'paris' } } as const;
    const firstRun = createInitialRun(delayed, 'synthetic', 'synthetic-run', hashDefinition(delayed));
    const before = structuredClone(firstRun);
    const first = resolveAction(delayed, firstRun, action);
    const second = resolveAction(normal, createInitialRun(normal, 'synthetic', 'synthetic-run', hashDefinition(normal)), action);
    expect(seededDelay(0, 0)).not.toBe(seededDelay(42, 0));
    expect(first.status).toBe('confirmation_required');
    if (first.status !== 'confirmation_required' || second.status !== 'confirmation_required') throw new Error('Missing preview');
    expect(first.preview).toEqual(second.preview);
    expect(firstRun).toEqual(before);
    expect(first.events).toEqual([]);
  });
  it('semillas negativas y enteros grandes no producen retrasos negativos o fuera de rango', () => {
    for (const seed of [-1, -100, -10001, Number.MAX_SAFE_INTEGER]) {
      for (const trip of [0, 3, 99, Number.MAX_SAFE_INTEGER]) {
        const delay = seededDelay(seed, trip);
        expect(delay === 0 || (delay >= 15 && delay <= 45)).toBe(true);
      }
    }
  });
  it.each([
    { schemaVersion: 2 }, { engineCompatibility: 2 },
    { seed: Number.MAX_SAFE_INTEGER + 1 }, { deadlineMinutes: Number.MAX_SAFE_INTEGER + 1 },
  ])('rechaza versión no soportada o número inseguro: %j', change => {
    expect(validateCaseDefinition({ ...astrolabioDefinition, ...change }).valid).toBe(false);
  });
  it.each(['cities', 'locations', 'npcs', 'evidence', 'objectives', 'travelDurations', 'scheduledResults'])(
    'rechaza entradas null en %s', field => {
      expect(validateCaseDefinition({ ...astrolabioDefinition, [field]: [null] }).valid).toBe(false);
    });
  it('no inspecciona ni conversa desde otra ciudad, sin efectos ni conocimiento secreto', () => {
    const run = createInitialRun(astrolabioDefinition, 'synthetic', 'synthetic-run', hashDefinition(astrolabioDefinition));
    const before = structuredClone(run);
    for (const action of [
      { type: 'inspect', params: { targetId: 'PAR-ARCH' } },
      { type: 'talk', params: { npcId: 'emile' } },
    ] as const) {
      const result = resolveAction(astrolabioDefinition, run, action);
      expect(result.status).toBe('impossible');
      expect(result.run).toEqual(before);
      expect(result.events).toEqual([]);
    }
  });
  it('un reporte estructural no afirma rutas/referencias/simulaciones no ejecutadas', () => {
    expect(createValidationReport([]).scenarios).toEqual(['structural']);
  });
});
