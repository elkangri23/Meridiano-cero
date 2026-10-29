import { check, identifier, integer } from './validation-fields.js';
import type { EntityGroups } from './validation-entities.js';

function routes(groups: EntityGroups, cityIds: Set<string>): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>();
  for (const route of groups.travelDurations) {
    if (!identifier(route.fromCityId) || !identifier(route.toCityId) || !integer(route.minutes, 1)) continue;
    if (!cityIds.has(route.fromCityId) || !cityIds.has(route.toCityId)) continue;
    const next = graph.get(route.fromCityId) ?? new Set<string>();
    next.add(route.toCityId);
    graph.set(route.fromCityId, next);
  }
  return graph;
}

function reachable(graph: Map<string, Set<string>>, start: string): Set<string> {
  const seen = new Set([start]);
  const pending = [start];
  for (let index = 0; index < pending.length; index++) {
    const city = pending[index];
    if (city === undefined) continue;
    for (const next of graph.get(city) ?? []) {
      if (seen.has(next)) continue;
      seen.add(next);
      pending.push(next);
    }
  }
  return seen;
}

export function validateMap(groups: EntityGroups, errors: string[]): void {
  const cityIds = new Set(groups.cities.map(city => city.id).filter(identifier));
  const landings = new Set(groups.locations.filter(location => location.accessible === true).map(location => location.cityId));
  check([...cityIds].every(city => landings.has(city)), 'cities sin lugar accesible', errors);
  const start = groups.cities[0]?.id;
  if (!identifier(start)) return;
  const seen = reachable(routes(groups, cityIds), start);
  check([...cityIds].every(city => seen.has(city)), 'travelDurations ciudades inalcanzables desde inicio', errors);
}
