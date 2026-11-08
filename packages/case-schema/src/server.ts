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

/** Huella de contenido para la identidad de un expediente (DEC-020):
 * como hashDefinition pero sin el `id` de transporte: dos copias del
 * mismo contenido con distinto id son el mismo expediente a efectos del
 * primer resultado oficial, así que cambiar solo el id no elude la regla
 * de unicidad (SPEC-008). */
export function contentHashForDefinition(def: CaseDefinition): string {
  const content = Object.fromEntries(Object.entries(def)
    .filter(([key]) => key !== 'validationReport' && key !== 'id'));
  return createHash('sha256').update(JSON.stringify(canonicalJson(content))).digest('hex');
}
