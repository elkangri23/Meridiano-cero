// Detenciones automáticas (GDD §12): tipo de detención de un expediente.
// En casos con arresto, aproximadamente 30 % son detenciones automáticas
// coordinadas con las autoridades y 70 % intervenciones interactivas; el
// tipo se fija al generar el caso y no cambia durante la partida. La
// detención automática no es un atajo: exige lo mismo que la interactiva
// (orden válida y ubicación conocida) y solo cambia quién interviene —
// las autoridades en vez del detective en persona —, así que ni revela la
// solución ni evita el trabajo de acreditar al sospechoso.
import type { ArrestType, CaseDefinition } from './types.js';

export type { ArrestType } from './types.js';

export const ARREST_TYPES: readonly ArrestType[] = ['automatic', 'interactive'];

export function isArrestType(value: unknown): value is ArrestType {
  return value === 'automatic' || value === 'interactive';
}

/** Coste en minutos de coordinar una detención con las autoridades: un
 * trámite (GDD §9/§12), el mismo que enviar un documento, una consulta o
 * una acción irregular (30 min). La detención en persona cuesta 15 min
 * (SPEC-003). El coste no es la ventaja: la automática ahorra el viaje
 * hasta el sospechoso, no el trabajo de obtener la orden. */
export const ARREST_COORDINATION_MINUTES = 30;

/** Tipo de detención de un expediente: el declarado, o `interactive`
 * cuando no lo trae (expedientes generados antes de esta entrega y
 * cualquier definición sin el campo). */
export function arrestTypeOf(def: CaseDefinition): ArrestType {
  return def.arrestType ?? 'interactive';
}

/** Tipo de detención fijado al generar un caso, determinista a partir de
 * su id (GDD §12). Un hash estable del id reparte los casos sin depender
 * del modelo: el mismo id siempre da el mismo tipo y la proporción se
 * mantiene en el catálogo (~30 % automáticas). */
export function arrestTypeForCaseId(caseId: string): ArrestType {
  let hash = 5381;
  for (let i = 0; i < caseId.length; i++) hash = ((hash << 5) + hash + caseId.charCodeAt(i)) >>> 0;
  return hash % 10 < 3 ? 'automatic' : 'interactive';
}
