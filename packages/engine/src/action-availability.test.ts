// Regresión del lote intérprete de texto libre (2026-11-09): lo que
// falta para pedir una orden o detener, según el estado de la partida.
// Las reglas son las del motor (offers.ts, arrest.ts): este módulo solo
// las describe para que el intérprete explique el bloqueo en vez de
// inventar otra acción.
import { hashDefinition } from '@meridiano/case-schema/server';
import { describe, expect, it } from 'vitest';
import { astrolabioDefinition, createInitialRun, generadoFraudeDefinition } from './index.js';
import { describeLockedActions } from './action-availability.js';
import type { CaseDefinition, CaseRun } from '@meridiano/case-schema';

function runFor(def: CaseDefinition, patch: Partial<CaseRun>): CaseRun {
  return { ...createInitialRun(def, 'synthetic', 'synthetic', hashDefinition(def)), ...patch };
}

function locked(def: CaseDefinition, run: CaseRun, type: 'warrant' | 'detain', suspectId: string) {
  return describeLockedActions(def, run).find(entry => entry.type === type && entry.suspectId === suspectId);
}

describe('describeLockedActions (caso fijo)', () => {
  it('al principio faltan sospechoso y pruebas para la orden, y la orden para detener', () => {
    const run = runFor(astrolabioDefinition, {});
    expect(describeLockedActions(astrolabioDefinition, run)).toEqual([
      { type: 'warrant', suspectId: 'ines', suspectName: 'Inés Valera', missing: ['suspect_unknown', 'no_authorizing_evidence'] },
      { type: 'detain', suspectId: 'ines', suspectName: 'Inés Valera', missing: ['no_warrant'] },
      { type: 'warrant', suspectId: 'tomas', suspectName: 'Tomás Ríos', missing: ['suspect_unknown', 'no_authorizing_evidence'] },
      { type: 'detain', suspectId: 'tomas', suspectName: 'Tomás Ríos', missing: ['no_warrant'] },
    ]);
  });

  it('con EV-03+EV-04 la orden de Inés deja de estar bloqueada (existe la oferta)', () => {
    const run = runFor(astrolabioDefinition, { discoveries: ['EV-03', 'EV-04'] });
    expect(locked(astrolabioDefinition, run, 'warrant', 'ines')).toBeUndefined();
    expect(locked(astrolabioDefinition, run, 'detain', 'ines')).toEqual(
      { type: 'detain', suspectId: 'ines', suspectName: 'Inés Valera', missing: ['no_warrant'] });
    expect(locked(astrolabioDefinition, run, 'warrant', 'tomas')?.missing)
      .toEqual(['suspect_unknown', 'no_authorizing_evidence']);
  });

  it('con la orden concedida y la ubicación conocida, la detención automática deja de estar bloqueada', () => {
    const run = runFor(astrolabioDefinition, {
      discoveries: ['EV-03', 'EV-04', 'location:ines'],
      warrants: ['warrant:ines'],
    });
    expect(locked(astrolabioDefinition, run, 'warrant', 'ines')).toEqual(
      { type: 'warrant', suspectId: 'ines', suspectName: 'Inés Valera', missing: ['warrant_granted'] });
    expect(locked(astrolabioDefinition, run, 'detain', 'ines')).toBeUndefined();
  });

  it('con la solicitud en curso, la orden está pendiente y detener espera a que madure', () => {
    const run = runFor(astrolabioDefinition, {
      discoveries: ['EV-03', 'EV-04'],
      pendingRequests: [{ id: 'req-1', dueMinute: 30, type: 'warrant', payload: { suspectId: 'ines', evidenceIds: ['EV-03', 'EV-04'] } }],
    });
    expect(locked(astrolabioDefinition, run, 'warrant', 'ines')?.missing).toEqual(['warrant_pending']);
    expect(locked(astrolabioDefinition, run, 'detain', 'ines')?.missing).toEqual(['warrant_pending']);
  });

  it('tras detener, la detención está hecha y la orden ya concedida', () => {
    const run = runFor(astrolabioDefinition, {
      discoveries: ['EV-03', 'EV-04', 'location:ines'],
      warrants: ['warrant:ines'],
      detentions: ['ines'],
    });
    expect(locked(astrolabioDefinition, run, 'detain', 'ines')?.missing).toEqual(['already_detained']);
    expect(locked(astrolabioDefinition, run, 'warrant', 'ines')?.missing).toEqual(['warrant_granted']);
  });
});

describe('describeLockedActions (caso generado interactivo)', () => {
  it('al principio faltan sospechoso y pruebas para la orden, y la orden para detener', () => {
    const run = runFor(generadoFraudeDefinition, {});
    expect(locked(generadoFraudeDefinition, run, 'warrant', 'carmen')?.missing)
      .toEqual(['suspect_unknown', 'no_authorizing_evidence']);
    expect(locked(generadoFraudeDefinition, run, 'detain', 'carmen')?.missing).toEqual(['no_warrant']);
  });

  it('con orden válida e identidad y ubicación conocidas, detener en persona exige estar en su lugar', () => {
    const run = runFor(generadoFraudeDefinition, {
      position: { cityId: 'madrid', locationId: 'MAD-SALA' },
      discoveries: ['identity:carmen', 'location:carmen'],
      warrants: ['warrant:carmen'],
    });
    expect(locked(generadoFraudeDefinition, run, 'detain', 'carmen')?.missing).toEqual(['not_at_location']);
    const there = runFor(generadoFraudeDefinition, {
      position: { cityId: 'valencia', locationId: 'VLC-ALM' },
      discoveries: ['identity:carmen', 'location:carmen'],
      warrants: ['warrant:carmen'],
    });
    expect(locked(generadoFraudeDefinition, there, 'detain', 'carmen')).toBeUndefined();
  });

  it('sin identidad, la interactiva lo dice aunque la ubicación se conozca', () => {
    const run = runFor(generadoFraudeDefinition, {
      position: { cityId: 'valencia', locationId: 'VLC-ALM' },
      discoveries: ['location:carmen'],
      warrants: ['warrant:carmen'],
    });
    expect(locked(generadoFraudeDefinition, run, 'detain', 'carmen')?.missing).toEqual(['identity_unknown']);
  });
});
