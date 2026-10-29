import { check, identifier, type DataRecord } from './validation-fields.js';
import type { EntityGroups } from './validation-entities.js';

function ids(entries: DataRecord[]): Set<unknown> {
  return new Set(entries.map(entry => entry.id));
}

function evidenceLinks(groups: EntityGroups, errors: string[]) {
  const origins = new Set([...ids(groups.cities), ...ids(groups.locations)]);
  const evidenceIds = ids(groups.evidence);
  for (const evidence of groups.evidence) {
    check(origins.has(evidence.origin), 'evidence.origin inexistente', errors);
    if (!Array.isArray(evidence.relations)) continue;
    for (const parent of evidence.relations) {
      check(evidenceIds.has(parent) && parent !== evidence.id, 'evidence.relations inexistente o autorreferencia', errors);
    }
  }
}

function travelLinks(groups: EntityGroups, errors: string[]) {
  const cityIds = ids(groups.cities);
  const routes = new Set<string>();
  for (const route of groups.travelDurations) {
    check(cityIds.has(route.fromCityId) && cityIds.has(route.toCityId), 'travelDurations ciudad inexistente', errors);
    if (typeof route.fromCityId !== 'string' || typeof route.toCityId !== 'string') continue;
    const key = JSON.stringify([route.fromCityId, route.toCityId]);
    check(!routes.has(key), 'travelDurations ruta duplicada', errors);
    routes.add(key);
  }
}

export function validateReferences(groups: EntityGroups, errors: string[]) {
  const cityIds = ids(groups.cities);
  for (const value of [...groups.locations, ...groups.npcs]) {
    check(cityIds.has(value.cityId), 'cityId inexistente', errors);
  }
  evidenceLinks(groups, errors);
  travelLinks(groups, errors);
}

function evidenceGraph(entries: DataRecord[]) {
  const parents = new Map<string, Set<string>>();
  const children = new Map<string, Set<string>>();
  for (const entry of entries) {
    if (!identifier(entry.id) || !Array.isArray(entry.relations)) continue;
    const links = entry.relations.filter((id): id is string => typeof id === 'string');
    parents.set(entry.id, new Set(links));
    for (const parent of links) {
      const descendants = children.get(parent) ?? new Set<string>();
      descendants.add(entry.id);
      children.set(parent, descendants);
    }
  }
  return { parents, children };
}

export function validateEvidenceGraph(entries: DataRecord[], errors: string[]) {
  const { parents, children } = evidenceGraph(entries);
  const ready = [...parents].filter(([, links]) => links.size === 0).map(([id]) => id);
  for (let index = 0; index < ready.length; index++) {
    const id = ready[index];
    if (id === undefined) continue;
    for (const child of children.get(id) ?? []) {
      const remaining = parents.get(child);
      if (!remaining) continue;
      remaining.delete(id);
      if (remaining.size === 0) ready.push(child);
    }
  }
  check(ready.length === parents.size, 'evidence.relations grafo no resoluble', errors);
}

export function validateStart(groups: EntityGroups, errors: string[]) {
  check(groups.cities.length > 0, 'cities vacío', errors);
  check(groups.locations.length > 0, 'locations vacío', errors);
  check(groups.objectives.length > 0, 'objectives vacío', errors);
  const start = groups.locations[0];
  const city = groups.cities[0];
  if (!start || !city) return;
  check(start.accessible === true && start.cityId === city.id, 'posición inicial incompatible', errors);
}
