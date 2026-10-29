import type { CaseDefinition } from '@meridiano/case-schema';

export const ORIGINAL_OBJECT = 'astrolabio-original';
export function isFixedCase(def: CaseDefinition): boolean { return def.id === 'astrolabio-tres-ciudades'; }
const ines = Object.freeze({ id: 'ines', identity: 'ines-valera', cityId: 'lisboa', locationId: 'LIS-ALM' });
const tomas = Object.freeze({ id: 'tomas', identity: 'tomas-rios', cityId: 'madrid', locationId: 'MAD-SALA' });
export function fixedSuspect(id: string) {
  if (id === 'ines' || id === 'ines-valera') return ines;
  if (id === 'tomas' || id === 'tomas-rios') return tomas;
  return undefined;
}
