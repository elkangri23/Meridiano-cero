// Tipos forenses del laboratorio (GDD §11): huellas, documentos,
// fotografías, audio, muestras y materiales. Solo el vocabulario (tipos y
// etiquetas): la derivación del tipo que corresponde a una evidencia o a
// una regla de análisis necesita la definición del expediente y vive en
// `@meridiano/case-schema` (`forensics.ts`), que re-exporta esto.
import type { LocaleKey } from './locales/es.js';

/** Tipos forenses canónicos (GDD §11, en ese orden). */
export const FORENSIC_TYPES = ['huellas', 'documentos', 'fotografias', 'audio', 'muestras', 'materiales'] as const;
export type ForensicType = (typeof FORENSIC_TYPES)[number];

/** Claves de las etiquetas de tipo forense (i18n): el texto vive en
 * `locales/es.ts` y la web lo resuelve con `t()`. */
export const FORENSIC_TYPE_KEYS: Record<ForensicType, LocaleKey> = {
  huellas: 'labels.forensic.huellas',
  documentos: 'labels.forensic.documentos',
  fotografias: 'labels.forensic.fotografias',
  audio: 'labels.forensic.audio',
  muestras: 'labels.forensic.muestras',
  materiales: 'labels.forensic.materiales',
};

export function isForensicType(value: unknown): value is ForensicType {
  return typeof value === 'string' && (FORENSIC_TYPES as readonly string[]).includes(value);
}
