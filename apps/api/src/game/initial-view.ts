import { hashDefinition } from '@meridiano/case-schema/server';
import { isDeepStrictEqual } from 'node:util';
import type { InitialPlayerViewDto } from '@meridiano/contracts';
import { createInitialRun, ENGINE_VERSION } from '@meridiano/engine';
import { findCase } from './catalog.ts';
import { RunStoreError, type StoredRun } from './runs.ts';

/** Fallo cerrado hasta entregar proyección de transiciones, guardados y conversación. */
export function initialPlayerView(run: StoredRun): InitialPlayerViewDto {
  const definition = storedDefinition(run.definitionId);
  const definitionHash = hashDefinition(definition);
  const initial = createInitialRun(definition, run.ownerId, run.id, definitionHash);
  const expected = expectedInitial(initial, run.engineVersion);
  if (run.definitionHash !== definitionHash ||
      run.revision !== 1 || !isDeepStrictEqual(run.engineState, expected)) {
    throw new RunStoreError('DEPENDENCY_UNAVAILABLE');
  }
  const city = definition.cities.find(item => item.id === initial.position.cityId);
  const location = definition.locations.find(item => item.id === initial.position.locationId);
  if (!city || !location || location.cityId !== city.id || !location.accessible) {
    throw new RunStoreError('DEPENDENCY_UNAVAILABLE');
  }
  const publicLocation = { id: location.id, name: location.name, description: location.description };
  const cities = definition.explorationMode === 'guided' ? definition.cities : [city];
  return {
    schemaVersion: 1, runId: run.id, branchId: run.branchId, version: run.revision,
    status: 'active', clock: { minute: 0, deadlineMinutes: definition.deadlineMinutes },
    position: { city: { id: city.id, name: city.name, country: city.country }, location: { ...publicLocation } },
    cities: cities.map(item => ({ id: item.id, name: item.name, country: item.country })),
    locations: [publicLocation], objects: [], dossier: [], conversation: [], pendingRequests: [],
    warrants: [], detentions: [], batch: null, finalReport: null, officialResult: null,
    saveCapabilities: { manualLimit: 10, manualCount: 0, canSave: false, canLoad: false },
    recovery: { retryCreationWithSameKey: true, creationLookup: true, operationLookup: false },
  };
}

function storedDefinition(id: string) {
  try { return findCase(id); }
  catch { throw new RunStoreError('DEPENDENCY_UNAVAILABLE'); }
}

function expectedInitial(initial: ReturnType<typeof createInitialRun>, engineVersion: number): unknown {
  if (engineVersion === ENGINE_VERSION) return initial;
  if (engineVersion === 7) return { ...initial, engineVersion };
  if (![1, 2, 3, 4, 5, 6].includes(engineVersion)) throw new RunStoreError('DEPENDENCY_UNAVAILABLE');
  // Solo igualdad completa con la forma virgen de cada versión, sin escribir.
  const legacy: Record<string, unknown> = { ...initial, engineVersion };
  delete legacy.tripCount;
  if (engineVersion === 1) delete legacy.eventOrdinal;
  return legacy;
}
