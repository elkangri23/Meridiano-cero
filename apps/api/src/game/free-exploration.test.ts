// Vista de partida en modo libre y atlas mundial (GDD §5): ciudades
// ocultas hasta descubrirlas, atlas con destinos turísticos y posición en
// una ciudad fuera del expediente con su información turística.
import { describe, expect, it } from 'vitest';
import { hashDefinition } from '@meridiano/case-schema/server';
import { isPlayerViewDto } from '@meridiano/contracts';
import { astrolabioDefinition, confirmAction, createInitialRun, ENGINE_VERSION, resolveAction } from '@meridiano/engine';
import type { CaseDefinition, CaseRun } from '@meridiano/case-schema';
import type { StoredRun } from './runs.ts';
import { playerViewDto } from './player-view.ts';

function freeDefinition(): CaseDefinition {
  return { ...structuredClone(astrolabioDefinition), explorationMode: 'free' };
}

function fullRun(def: CaseDefinition, run: CaseRun): StoredRun & CaseRun {
  return {
    ...run,
    id: run.id, ownerId: 'owner-1', definitionId: def.id, definitionHash: hashDefinition(def),
    engineVersion: ENGINE_VERSION, revision: 1, branchId: '33333333-3333-4333-8333-333333333333',
    status: 'active', difficulty: 'normal', deadlineMinutes: def.deadlineMinutes, explorationMode: def.explorationMode,
    engineState: run,
  };
}

function fresh(def: CaseDefinition): StoredRun & CaseRun {
  const run = createInitialRun(def, 'owner-1', '22222222-2222-4222-8222-222222222222', hashDefinition(def));
  return fullRun(def, run);
}

function apply(def: CaseDefinition, run: StoredRun & CaseRun, action: Parameters<typeof resolveAction>[2]): StoredRun & CaseRun {
  const preview = resolveAction(def, run, action);
  const result = preview.status === 'confirmation_required' ? confirmAction(def, run, action) : preview;
  if (result.status !== 'applied') throw new Error('Acción no aplicada: ' + result.status);
  return fullRun(def, result.run);
}

describe('vista en modo libre y atlas (GDD §5)', () => {
  it('en libre solo se enseña Madrid; el atlas lista las 9 admitidas sin revelar París ni Lisboa', () => {
    const def = freeDefinition();
    const view = playerViewDto(def, fresh(def), 0);
    expect(view.explorationMode).toBe('free');
    expect(view.cities.map(city => city.id)).toEqual(['madrid']);
    expect(view.atlas).toHaveLength(9);
    const paris = view.atlas.find(city => city.id === 'paris');
    const lisboa = view.atlas.find(city => city.id === 'lisboa');
    const barcelona = view.atlas.find(city => city.id === 'barcelona');
    expect(paris).toMatchObject({ kind: 'case', discovered: false });
    expect(lisboa).toMatchObject({ kind: 'case', discovered: false });
    expect(barcelona).toMatchObject({ kind: 'tourist', discovered: true });
    expect(isPlayerViewDto(view)).toBe(true);
  });

  it('en guiado las tres ciudades del expediente están descubiertas en el atlas', () => {
    const view = playerViewDto(astrolabioDefinition, fresh(astrolabioDefinition), 0);
    expect(view.explorationMode).toBe('guided');
    expect(view.cities.map(city => city.id)).toEqual(['madrid', 'paris', 'lisboa']);
    for (const id of ['madrid', 'paris', 'lisboa']) {
      expect(view.atlas.find(city => city.id === id)).toMatchObject({ kind: 'case', discovered: true });
    }
    expect(isPlayerViewDto(view)).toBe(true);
  });

  it('investigar descubre París en las ciudades y en el atlas', () => {
    const def = freeDefinition();
    let run = fresh(def);
    run = apply(def, run, { type: 'inspect', params: { targetId: 'MAD-SALA' } });
    const view = playerViewDto(def, run, 0);
    expect(view.cities.map(city => city.id)).toEqual(['madrid', 'paris']);
    expect(view.atlas.find(city => city.id === 'paris')).toMatchObject({ discovered: true });
    expect(view.atlas.find(city => city.id === 'lisboa')).toMatchObject({ discovered: false });
    expect(isPlayerViewDto(view)).toBe(true);
  });

  it('en Barcelona la posición es el centro de la ciudad con su información turística', () => {
    const def = freeDefinition();
    let run = fresh(def);
    run = apply(def, run, { type: 'travel', params: { toCityId: 'barcelona' } });
    const view = playerViewDto(def, run, 0);
    expect(view.position.city).toMatchObject({ id: 'barcelona', name: 'Barcelona' });
    expect(view.position.location.id).toBe('visit:barcelona');
    expect(view.position.location.name).toBe('Centro de Barcelona');
    expect(view.position.location.description).toContain('Gaudí');
    expect(view.atlas.find(city => city.id === 'barcelona')).toMatchObject({ kind: 'tourist', discovered: true });
    expect(isPlayerViewDto(view)).toBe(true);
  });
});
