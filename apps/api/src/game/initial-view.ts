import { hashDefinition } from '@meridiano/case-schema/server';
import { isDeepStrictEqual } from 'node:util';
import type { CaseDefinition, Language } from '@meridiano/case-schema';
import { caseText, localizedCountryName } from '@meridiano/case-schema';
import type { InitialPlayerViewDto } from '@meridiano/contracts';
import { createInitialRun, ENGINE_VERSION } from '@meridiano/engine';
import type { Database } from '../database/connection.ts';
import { findCase, metaForDefinition } from './catalog.ts';
import { atlasFor, localizedLocation } from './player-view.ts';
import { RunStoreError, type StoredRun } from './runs.ts';

/** Fallo cerrado hasta entregar proyección de transiciones, guardados y conversación. */
export async function initialPlayerView(db: Database['orm'], run: StoredRun, language: Language = 'es'): Promise<InitialPlayerViewDto> {
  const definition = await storedDefinition(db, run.definitionId);
  const definitionHash = hashDefinition(definition);
  const initial = createInitialRun(definition, run.ownerId, run.id, definitionHash);
  const expected = expectedInitial(initial, run.engineVersion);
  if (run.definitionHash !== definitionHash ||
      run.revision !== 1 || !isDeepStrictEqual(run.engineState, expected)) {
    throw new RunStoreError('DEPENDENCY_UNAVAILABLE');
  }
  const { city, location } = initialPosition(definition, initial);
  const publicLocation = localizedLocation(definition, location, language);
  // El modo de exploración es el de la fila, no el del expediente: las
  // partidas anteriores a la migración 0012 son guiadas por defecto.
  const effective = { ...definition, explorationMode: run.explorationMode ?? 'guided' };
  const cities = effective.explorationMode === 'guided' ? definition.cities : [city];
  return {
    schemaVersion: 1, runId: run.id, branchId: run.branchId, version: run.revision,
    status: 'active', difficulty: run.difficulty, explorationMode: effective.explorationMode, clock: { minute: 0, deadlineMinutes: run.deadlineMinutes },
    position: { city: { id: city.id, name: city.name, country: localizedCountryName(city.country, language) }, location: { ...publicLocation } },
    initialCityId: city.id,
    cities: cities.map(item => ({ id: item.id, name: item.name, country: localizedCountryName(item.country, language) })),
    atlas: atlasFor(effective, initial, language),
    locations: [publicLocation], objects: [], dossier: [], conversation: [], communications: [], pendingRequests: [],
    warrants: [], detentions: [], batch: null, finalReport: null, officialResult: null,
    // Objetivos en vivo (lote 2): al empezar, todos pendientes (la partida
    // inicial no tiene detenciones ni objetos recuperados).
    objectives: definition.objectives.map(objective => ({
      id: objective.id, description: caseText(definition.id, 'objective.' + objective.id, language) ?? objective.description, achieved: false,
    })),
    caseMeta: metaForDefinition(definition),
    saveCapabilities: { manualLimit: 10, manualCount: 0, canSave: false, canLoad: false },
    recovery: { retryCreationWithSameKey: true, creationLookup: true, operationLookup: false },
  };
}

async function storedDefinition(db: Database['orm'], id: string) {
  try { return await findCase(db, id); }
  catch { throw new RunStoreError('DEPENDENCY_UNAVAILABLE'); }
}

/** Ciudad y lugar iniciales de la partida: deben existir en la definición,
 * el lugar debe pertenecer a la ciudad y ser accesible. */
function initialPosition(definition: CaseDefinition, initial: ReturnType<typeof createInitialRun>) {
  const city = definition.cities.find(item => item.id === initial.position.cityId);
  const location = definition.locations.find(item => item.id === initial.position.locationId);
  if (!city || !location || location.cityId !== city.id || !location.accessible) {
    throw new RunStoreError('DEPENDENCY_UNAVAILABLE');
  }
  return { city, location };
}

function expectedInitial(initial: ReturnType<typeof createInitialRun>, engineVersion: number): unknown {
  if (engineVersion === ENGINE_VERSION) return initial;
  if ([7, 8, 9, 10, 11, 12, 13].includes(engineVersion)) return { ...initial, engineVersion };
  if (![1, 2, 3, 4, 5, 6].includes(engineVersion)) throw new RunStoreError('DEPENDENCY_UNAVAILABLE');
  // Solo igualdad completa con la forma virgen de cada versión, sin escribir.
  const legacy: Record<string, unknown> = { ...initial, engineVersion };
  delete legacy.tripCount;
  if (engineVersion === 1) delete legacy.eventOrdinal;
  return legacy;
}
