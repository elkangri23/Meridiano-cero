import { check, isRecord, type DataRecord } from './validation-fields.js';
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

/** Términos que el contenido Familiar no admite (GDD §14): asesinatos ni
 * temas perturbadores. Se comprueba en los textos del expediente, no solo en
 * el prompt: el modelo puede colar un término aunque se le pida que no. */
export const FAMILY_FORBIDDEN_TERMS = [
  'asesinato', 'asesinar', 'asesino', 'asesina', 'cadáver', 'cadaver', 'sangre',
  'tortura', 'torturar', 'violación', 'violacion', 'secuestro', 'secuestrar',
  'mutila', 'descuartiza', 'ahorca', 'estrangula', 'apuñala', 'dispara',
  'ejecuta', 'suicidio', 'gore', 'pornograf',
] as const;

function collectTexts(value: unknown, out: string[]): void {
  if (typeof value === 'string') { out.push(value); return; }
  if (Array.isArray(value)) { for (const item of value) collectTexts(item, out); return; }
  if (isRecord(value)) { for (const item of Object.values(value)) collectTexts(item, out); }
}

/** Contenido Familiar/General de un expediente generado (T4-08). El validador
 * estructural (`validateCaseDefinition`) no conoce el nivel de contenido: lo
 * conoce el job de generación, que llama aquí como puerta. En Familiar se
 * rechaza cualquier término prohibido en los textos; en General se permiten
 * temas serios, sin detalle explícito ni gore (eso último lo vigila la
 * revisión semántica del pipeline, no esta lista). */
export function validateGeneratedContent(def: DataRecord, contentRating: 'familiar' | 'general', errors: string[]): void {
  if (contentRating !== 'familiar') return;
  const found = new Set<string>();
  const texts: string[] = [];
  collectTexts(def.texts, texts);
  for (const value of texts) {
    const lower = value.toLowerCase();
    for (const term of FAMILY_FORBIDDEN_TERMS) if (lower.includes(term)) found.add(term);
  }
  check(found.size === 0, `contenido Familiar: términos no admitidos (${[...found].join(', ')})`, errors);
}
