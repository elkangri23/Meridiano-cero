// Tipos forenses del laboratorio (GDD §11): derivación del tipo que
// corresponde a una evidencia o a una regla de análisis. El vocabulario
// (tipos canónicos, etiquetas y `isForensicType`) vive en
// `@meridiano/contracts` (`forensics.ts`) porque la web lo necesita para
// las etiquetas; este módulo lo re-exporta para el resto del paquete.
import type { CaseDefinition, Evidence, MechanicsAnalysis } from './types.js';
import { isForensicType, type ForensicType } from '@meridiano/contracts';

export { FORENSIC_TYPES, FORENSIC_TYPE_LABELS, isForensicType, type ForensicType } from '@meridiano/contracts';

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
