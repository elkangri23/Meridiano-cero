import { check, isRecord, type DataRecord } from './validation-fields.js';
import type { EntityGroups } from './validation-entities.js';

const rootFields = 'catalogVersion,cities,contentMode,contentVersion,deadlineMinutes,difficulty,engineCompatibility,evidence,explorationMode,facts,id,locations,npcs,objectives,rules,scheduledResults,schemaVersion,seed,solution,travelDurations,validationReport';
const entityFields: Readonly<Record<keyof EntityGroups, string>> = {
  cities: 'country,id,name',
  locations: 'accessible,cityId,description,id,name',
  npcs: 'cityId,cooperation,id,knowledge,name',
  evidence: 'admissible,id,minute,origin,relations,type',
  objectives: 'achieved,description,id',
  travelDurations: 'fromCityId,minutes,toCityId',
  scheduledResults: 'dueMinute,id,payload,type',
};
function exactFields(value: DataRecord, expected: string): boolean {
  const actual = Object.keys(value).sort();
  return actual.length === expected.split(',').length && actual.join(',') === expected;
}
/** No permite declarar políticas o efectos que el consumidor ignoraría. */
export function validateShape(def: DataRecord, groups: EntityGroups, errors: string[]): void {
  check(exactFields(def, rootFields), 'definition campos no soportados o ausentes', errors);
  for (const name of Object.keys(entityFields) as Array<keyof EntityGroups>) {
    for (const entry of groups[name]) {
      check(exactFields(entry, entityFields[name]), name + ' campos no soportados o ausentes', errors);
    }
  }
  if (isRecord(def.validationReport)) {
    check(exactFields(def.validationReport, 'errors,scenarios,status,validatorVersion'), 'validationReport campos no soportados o ausentes', errors);
  }
}
