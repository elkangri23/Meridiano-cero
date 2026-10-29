import { check, identifier, integer, strings, text, type DataRecord } from './validation-fields.js';

export interface EntityGroups {
  cities: DataRecord[];
  locations: DataRecord[];
  npcs: DataRecord[];
  evidence: DataRecord[];
  objectives: DataRecord[];
  travelDurations: DataRecord[];
  scheduledResults: DataRecord[];
}

function city(value: DataRecord, errors: string[]) {
  check(text(value.name), 'cities.name', errors);
  check(typeof value.country === 'string' && /^[A-Z]{2}$/.test(value.country), 'cities.country', errors);
}

function location(value: DataRecord, errors: string[]) {
  check(identifier(value.cityId), 'locations.cityId', errors);
  check(text(value.name), 'locations.name', errors);
  check(text(value.description), 'locations.description', errors);
  check(typeof value.accessible === 'boolean', 'locations.accessible', errors);
}

function npc(value: DataRecord, errors: string[]) {
  check(identifier(value.cityId), 'npcs.cityId', errors);
  check(text(value.name), 'npcs.name', errors);
  check(integer(value.cooperation, 0) && Number(value.cooperation) <= 10, 'npcs.cooperation', errors);
  strings(value.knowledge, 'npcs.knowledge', errors);
}

function evidence(value: DataRecord, errors: string[]) {
  check(typeof value.type === 'string' && ['object', 'observation', 'testimony', 'analysis', 'record'].includes(value.type), 'evidence.type', errors);
  check(identifier(value.origin), 'evidence.origin', errors);
  check(integer(value.minute, 0), 'evidence.minute', errors);
  check(typeof value.admissible === 'boolean', 'evidence.admissible', errors);
  const relations = strings(value.relations, 'evidence.relations', errors);
  check(new Set(relations).size === relations.length, 'evidence.relations duplicadas', errors);
}

function objective(value: DataRecord, errors: string[]) {
  check(text(value.description), 'objectives.description', errors);
  check(typeof value.achieved === 'boolean', 'objectives.achieved', errors);
}

function travel(value: DataRecord, errors: string[]) {
  check(identifier(value.fromCityId), 'travelDurations.fromCityId', errors);
  check(identifier(value.toCityId), 'travelDurations.toCityId', errors);
  check(integer(value.minutes, 1), 'travelDurations.minutes', errors);
  check(value.fromCityId !== value.toCityId, 'travelDurations sin desplazamiento', errors);
}

function scheduled(value: DataRecord, errors: string[]) {
  check(integer(value.dueMinute, 0), 'scheduledResults.dueMinute', errors);
  check(identifier(value.type), 'scheduledResults.type', errors);
  check(Object.hasOwn(value, 'payload'), 'scheduledResults.payload', errors);
}

function uniqueIds(groups: EntityGroups, errors: string[]) {
  const ids = new Set<string>();
  const named = [groups.cities, groups.locations, groups.npcs, groups.evidence, groups.objectives, groups.scheduledResults];
  for (const group of named) {
    for (const entry of group) {
      if (!identifier(entry.id)) { errors.push('Entidades: id inválido.'); continue; }
      if (ids.has(entry.id)) errors.push('Entidades: id duplicado.');
      ids.add(entry.id);
    }
  }
}

export function validateEntities(groups: EntityGroups, errors: string[]) {
  uniqueIds(groups, errors);
  for (const value of groups.cities) city(value, errors);
  for (const value of groups.locations) location(value, errors);
  for (const value of groups.npcs) npc(value, errors);
  for (const value of groups.evidence) evidence(value, errors);
  for (const value of groups.objectives) objective(value, errors);
  for (const value of groups.travelDurations) travel(value, errors);
  for (const value of groups.scheduledResults) scheduled(value, errors);
}
