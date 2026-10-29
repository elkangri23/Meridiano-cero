import { check, type DataRecord } from './validation-fields.js';
import { LEGACY_ASTROLABIO_ID, hasLegacyAstrolabioRules } from './legacy-astrolabio.js';

/** No aprobar instrucciones que el runtime actual ignoraría o no sabe interpretar. */
export function validateExecutableContent(def: DataRecord, errors: string[]): void {
  if (def.id === LEGACY_ASTROLABIO_ID) {
    check(hasLegacyAstrolabioRules(def.rules), 'rules manifiesto legado incompatible', errors);
  } else {
    check(Array.isArray(def.rules) && def.rules.length === 0, 'rules declarativas no soportadas', errors);
  }
  check(Array.isArray(def.scheduledResults) && def.scheduledResults.length === 0, 'scheduledResults iniciales no soportados', errors);
}
