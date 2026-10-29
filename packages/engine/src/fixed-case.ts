import { LEGACY_ASTROLABIO_ID } from '@meridiano/case-schema';
import type { CaseDefinition } from '@meridiano/case-schema';
export { legacyAstrolabioSuspect as fixedSuspect } from '@meridiano/case-schema';

export const ORIGINAL_OBJECT = 'astrolabio-original';
export function isFixedCase(def: CaseDefinition): boolean { return def.id === LEGACY_ASTROLABIO_ID; }
