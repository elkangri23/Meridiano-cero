import { check, isRecord, type DataRecord } from './validation-fields.js';
import type { EntityGroups } from './validation-entities.js';

const rootFields = 'catalogVersion,cities,contentMode,contentVersion,deadlineMinutes,difficulty,engineCompatibility,evidence,explorationMode,facts,id,locations,npcs,objectives,rules,scheduledResults,schemaVersion,seed,solution,travelDurations,validationReport';
/** Campos opcionales de la raíz (T4-08): solo los traen los expedientes
 * generados; el caso fijo no los tiene y su hash no cambia. */
const rootOptionalFields = 'briefing,catalogMeta,mechanics,texts';
const entityFields: Readonly<Record<keyof EntityGroups, string>> = {
  cities: 'country,id,name',
  locations: 'accessible,cityId,description,id,name',
  npcs: 'cityId,cooperation,id,knowledge,name',
  evidence: 'admissible,id,minute,origin,relations,type',
  objectives: 'achieved,description,id',
  travelDurations: 'fromCityId,minutes,toCityId',
  scheduledResults: 'dueMinute,id,payload,type',
};
/** Campos opcionales por entidad (T4-08): `role` y `persona` solo los traen
 * los NPC de los expedientes generados. */
const entityOptionalFields: Partial<Readonly<Record<keyof EntityGroups, string>>> = {
  npcs: 'persona,role',
};
function exactFields(value: DataRecord, expected: string): boolean {
  const actual = Object.keys(value).sort();
  return actual.length === expected.split(',').length && actual.join(',') === expected;
}
/** Como exactFields pero admite un conjunto de campos opcionales: todas las
 * claves reales deben estar entre las requeridas y las opcionales, y todas
 * las requeridas deben estar presentes. */
function fieldsWithOptional(value: DataRecord, required: string, optional: string): boolean {
  const actual = Object.keys(value).sort();
  const allowed = new Set([...required.split(','), ...optional.split(',')]);
  const requiredSet = new Set(required.split(','));
  if (!actual.every(key => allowed.has(key))) return false;
  return [...requiredSet].every(key => actual.includes(key));
}
/** No permite declarar políticas o efectos que el consumidor ignoraría. */
export function validateShape(def: DataRecord, groups: EntityGroups, errors: string[]): void {
  check(fieldsWithOptional(def, rootFields, rootOptionalFields), 'definition campos no soportados o ausentes', errors);
  for (const name of Object.keys(entityFields) as Array<keyof EntityGroups>) {
    for (const entry of groups[name]) {
      check(fieldsWithOptional(entry, entityFields[name], entityOptionalFields[name] ?? ''), name + ' campos no soportados o ausentes', errors);
    }
  }
  if (isRecord(def.validationReport)) {
    check(exactFields(def.validationReport, 'errors,scenarios,status,validatorVersion'), 'validationReport campos no soportados o ausentes', errors);
  }
}
