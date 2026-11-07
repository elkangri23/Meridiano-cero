// Tipos forenses del laboratorio (GDD §11): huellas, documentos,
// fotografías, audio, muestras y materiales. Un análisis de laboratorio ya
// no es genérico: cada regla de análisis del expediente declara su tipo y
// el laboratorio solo ofrece el tipo que tiene sentido para esa prueba.
// El tipo es una categoría del método, no una conclusión: el resultado
// sigue siendo la evidencia que declara la mecánica, con su propio coste
// (delayMinutes) y sin interpretar culpabilidad.
import type { CaseDefinition, Evidence, MechanicsAnalysis } from './types.js';

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

/** Tipo forense que corresponde al tipo de evidencia que se examina.
// Es la derivación para expedientes antiguos, cuya mecánica no declara el
// tipo: un registro se examina como documento, un objeto como material,
// una observación como fotografía, un testimonio como audio y un resultado
// de análisis como muestra. Nunca inventa un método que el expediente no
// respalde: es la categoría del examen, no su conclusión. */
export function forensicTypeForEvidenceType(type: Evidence['type']): ForensicType {
  switch (type) {
    case 'record': return 'documentos';
    case 'object': return 'materiales';
    case 'observation': return 'fotografias';
    case 'testimony': return 'audio';
    case 'analysis': return 'muestras';
  }
}

/** Tipo forense de una regla de análisis: el declarado en la mecánica si
 * es canónico; si el expediente no lo declara (casos generados antes de
 * esta entrega), el derivado del tipo de la evidencia de entrada. */
export function forensicTypeForAnalysis(def: CaseDefinition, rule: MechanicsAnalysis): ForensicType {
  if (isForensicType(rule.forensicType)) return rule.forensicType;
  const input = def.evidence.find(item => item.id === rule.inputEvidenceId);
  return input ? forensicTypeForEvidenceType(input.type) : 'materiales';
}
