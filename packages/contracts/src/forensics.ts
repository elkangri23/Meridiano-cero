// Tipos forenses del laboratorio (GDD §11): huellas, documentos,
// fotografías, audio, muestras y materiales. Solo el vocabulario (tipos y
// etiquetas): la derivación del tipo que corresponde a una evidencia o a
// una regla de análisis necesita la definición del expediente y vive en
// `@meridiano/case-schema` (`forensics.ts`), que re-exporta esto.

/** Tipos forenses canónicos (GDD §11, en ese orden). */
export const FORENSIC_TYPES = ['huellas', 'documentos', 'fotografias', 'audio', 'muestras', 'materiales'] as const;
export type ForensicType = (typeof FORENSIC_TYPES)[number];

export const FORENSIC_TYPE_LABELS: Record<ForensicType, string> = {
  huellas: 'Huellas y marcas',
  documentos: 'Documentos',
  fotografias: 'Fotografías',
  audio: 'Audio',
  muestras: 'Muestras',
  materiales: 'Materiales',
};

export function isForensicType(value: unknown): value is ForensicType {
  return typeof value === 'string' && (FORENSIC_TYPES as readonly string[]).includes(value);
}
