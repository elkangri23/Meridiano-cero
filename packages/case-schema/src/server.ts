import { createHash } from 'node:crypto';
import type { CaseDefinition } from './types.js';

/** Integridad de servidor: esta entrada no forma parte de la raíz pura. */
function canonicalJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([key, item]) => [key, canonicalJson(item)]));
  }
  return value;
}

export function hashDefinition(def: CaseDefinition): string {
  const content = Object.fromEntries(Object.entries(def).filter(([key]) => key !== 'validationReport'));
  return createHash('sha256').update(JSON.stringify(canonicalJson(content))).digest('hex');
}
