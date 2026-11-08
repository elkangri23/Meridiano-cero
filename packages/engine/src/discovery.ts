import type { CaseDefinition, CaseRun } from '@meridiano/case-schema';

/** Ciudades del expediente que el jugador ya conoce por investigación:
 * descubrimientos que son el id de una ciudad (`paris` al inspeccionar la
 * caja del astrolabio) o un viaje a ella (`travel:paris`). El descubrimiento
 * `map` no es una ciudad: revela todas (ver `visibleCaseCityIds`). */
export function discoveredCityIds(def: CaseDefinition, run: CaseRun): Set<string> {
  const ids = new Set<string>();
  const caseIds = new Set(def.cities.map(city => city.id));
  for (const discovery of run.discoveries) {
    if (caseIds.has(discovery)) ids.add(discovery);
    if (discovery.startsWith('travel:')) {
      const cityId = discovery.slice('travel:'.length);
      if (caseIds.has(cityId)) ids.add(cityId);
    }
  }
  return ids;
}

/** Ciudades del expediente visibles según el modo de exploración (GDD §5,
 * REQ-G05-02): guiado las enseña todas desde el principio; libre solo la
 * actual y las descubiertas, salvo que se haya descubierto el mapa (`map`).
 * El buscador del atlas no se bloquea por esto: viajar a una ciudad
 * admitida no exige haberla descubierto (lo valida la ruta, no la vista). */
export function visibleCaseCityIds(def: CaseDefinition, run: CaseRun): string[] {
  if (def.explorationMode === 'guided' || run.discoveries.includes('map')) {
    return def.cities.map(city => city.id);
  }
  const discovered = discoveredCityIds(def, run);
  // La ciudad inicial siempre se conoce (se empieza en ella) y la actual
  // también; el resto, solo si se descubrió investigando o viajando.
  const start = def.cities[0]?.id;
  return def.cities
    .filter(city => city.id === start || city.id === run.position.cityId || discovered.has(city.id))
    .map(city => city.id);
}
