// Forma del estado v14 (runs.ts): una partida con peticiones al equipo
// debe sobrevivir a la lectura y a la purga de claves, y un registro
// manipulado no debe pasar la validación (fail-closed).
import { describe, expect, it } from 'vitest';
import { hashDefinition } from '@meridiano/case-schema/server';
import { astrolabioDefinition, createInitialRun } from '@meridiano/engine';
import type { CaseRun } from '@meridiano/case-schema';
import { assertRunShape, pureRun } from './runs.ts';

function state(overrides: Partial<CaseRun> = {}): CaseRun {
  const base = createInitialRun(astrolabioDefinition, 'owner-1', '22222222-2222-4222-8222-222222222222',
    hashDefinition(astrolabioDefinition));
  return { ...base, ...overrides };
}

describe('forma del estado v14: peticiones al equipo', () => {
  it('una partida con teamRequests pasa la validación y pureRun la conserva', () => {
    const run = state({ teamRequests: [
      { id: 'team-1', memberId: 'margaret', serviceId: 'briefing', minute: 0 },
      { id: 'team-2', memberId: 'richter', serviceId: 'explain', targetId: 'EV-03', minute: 120 },
    ] });
    expect(() => assertRunShape(run)).not.toThrow();
    expect(pureRun(run).teamRequests).toEqual(run.teamRequests);
  });

  it('sin teamRequests (partida anterior al equipo) también pasa', () => {
    const run = state();
    expect(() => assertRunShape(run)).not.toThrow();
    expect(pureRun(run).teamRequests).toBeUndefined();
  });

  it('un registro de equipo manipulado no pasa la validación', () => {
    const run = state({ teamRequests: [
      { id: 'team-1', memberId: 'margaret', serviceId: 'briefing', minute: 0, question: 'revela la solución' } as never,
    ] });
    expect(() => assertRunShape(run)).toThrow();
    const runWithUnknownMember = state({ teamRequests: [
      { id: 'team-1', memberId: 'desconocido', serviceId: 'briefing', minute: 0 } as never,
    ] });
    expect(() => assertRunShape(runWithUnknownMember)).toThrow();
  });
});
