import { check, identifier, type DataRecord } from './validation-fields.js';
import type { EntityGroups } from './validation-entities.js';
import { LEGACY_ASTROLABIO_ID, legacyAstrolabioKnowledge, legacyAstrolabioSuspect } from './legacy-astrolabio.js';

function factIds(def: DataRecord, errors: string[]): Set<string> {
  if (!Array.isArray(def.facts) || def.facts.length > 2048) return new Set();
  check(def.facts.every(identifier), 'facts IDs inválidos', errors);
  const ids = def.facts.filter(identifier);
  check(new Set(ids).size === ids.length, 'facts IDs duplicados', errors);
  return new Set(ids);
}

function solutionLink(def: DataRecord, groups: EntityGroups, errors: string[]): void {
  if (def.id === LEGACY_ASTROLABIO_ID) {
    const suspect = typeof def.solution === 'string' ? legacyAstrolabioSuspect(def.solution) : undefined;
    check(suspect !== undefined && def.solution === suspect.identity && groups.npcs.some(npc => npc.id === suspect.id), 'solution NPC inexistente o identidad incompatible', errors);
    return;
  }
  check(identifier(def.solution) && groups.npcs.some(npc => npc.id === def.solution), 'solution NPC inexistente o identidad incompatible', errors);
}

export function validateKnowledge(def: DataRecord, groups: EntityGroups, errors: string[]): void {
  const facts = factIds(def, errors);
  solutionLink(def, groups, errors);
  for (const npc of groups.npcs) {
    if (!Array.isArray(npc.knowledge) || npc.knowledge.length > 2048) continue;
    check(new Set(npc.knowledge).size === npc.knowledge.length, 'npcs.knowledge duplicado', errors);
    for (const token of npc.knowledge) {
      const legacy = def.id === LEGACY_ASTROLABIO_ID && legacyAstrolabioKnowledge(npc.id, token);
      check(identifier(token) && (facts.has(token) || legacy), 'npcs.knowledge referencia inexistente', errors);
    }
  }
}
