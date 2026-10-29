/** Compatibilidad explícita del expediente original; no es vocabulario del generador. */
export const LEGACY_ASTROLABIO_ID = 'astrolabio-tres-ciudades';
const ines = Object.freeze({ id: 'ines', identity: 'ines-valera', cityId: 'lisboa', locationId: 'LIS-ALM' });
const tomas = Object.freeze({ id: 'tomas', identity: 'tomas-rios', cityId: 'madrid', locationId: 'MAD-SALA' });

export function legacyAstrolabioSuspect(id: string) {
  if (id === 'ines' || id === 'ines-valera') return ines;
  if (id === 'tomas' || id === 'tomas-rios') return tomas;
  return undefined;
}

const knowledge: Readonly<Record<string, readonly string[]>> = {
  lucia: ['authorized-persons', 'tomas-moved-box'], emile: ['tool-registry'],
  marta: ['deposit-record', 'locker-l7'], tomas: ['his-task'], ines: ['truth'],
};
export function legacyAstrolabioKnowledge(npcId: unknown, token: string): boolean {
  if (typeof npcId !== 'string' || !Object.hasOwn(knowledge, npcId)) return false;
  return knowledge[npcId]?.includes(token) ?? false;
}

const ruleManifest = [
  'warrant-ines: EV-03 + EV-04 OR EV-06 + EV-07 + EV-08',
  'warrant-tomas: EV-09 + EV-10 (insufficient for theft)',
  'access-l7: warrant-ines + (EV-05 OR EV-08)',
];
export function hasLegacyAstrolabioRules(value: unknown): boolean {
  if (!Array.isArray(value) || value.length !== ruleManifest.length) return false;
  return new Set(value).size === ruleManifest.length && value.every(rule => typeof rule === 'string' && ruleManifest.includes(rule));
}
