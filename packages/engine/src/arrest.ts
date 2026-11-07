// Detenciones automáticas (GDD §12): plan único de detención y hechos de
// reacción de los personajes. El motor tenía la regla repartida en tres
// espejos (`detentionAuthorized`, `detentionAvailable`,
// `generatedDetentionAvailable`); este módulo es la fuente única: la
// oferta, la confirmación y el lote usan el mismo plan, así que una
// detención no puede ofrecerse y luego rechazarse (ni al revés).
import { ARREST_COORDINATION_MINUTES, arrestTypeOf } from '@meridiano/case-schema';
import type { CaseDefinition, CaseRun } from '@meridiano/case-schema';
import { fixedSuspect, isFixedCase } from './fixed-case.js';
import type { MechanicsSuspect } from '@meridiano/case-schema';

/** Coste en minutos de detener en persona (SPEC-003). */
export const DETENTION_INTERACTIVE_MINUTES = 15;

export interface DetentionSuspect {
  id: string;
  cityId: string;
  locationId: string;
}

export type DetentionPlan =
  | { ok: true; minutes: number; suspect: DetentionSuspect }
  | { ok: false };

function suspectOf(def: CaseDefinition, suspectId: string): DetentionSuspect | undefined {
  if (isFixedCase(def)) {
    const suspect = fixedSuspect(suspectId);
    return suspect ? { id: suspect.id, cityId: suspect.cityId, locationId: suspect.locationId } : undefined;
  }
  const suspect: MechanicsSuspect | undefined = def.mechanics?.suspects.find(entry => entry.id === suspectId);
  return suspect ? { id: suspect.id, cityId: suspect.cityId, locationId: suspect.locationId } : undefined;
}

/** ¿Conoce el jugador al sospechoso (identidad y ubicación)? Es la misma
 * condición en los dos modos: la automática no es un atajo, solo cambia
 * quién interviene. */
export function suspectKnown(run: CaseRun, suspectId: string): boolean {
  return run.discoveries.includes('identity:' + suspectId) && run.discoveries.includes('location:' + suspectId);
}

/** Plan de detención para un sospechoso con un modo: si se puede detener,
 * con qué modo y cuánto cuesta; si no, `ok: false` sin decir por qué (el
 * llamador pone el motivo genérico). Reglas (GDD §12, SPEC-001): orden
 * válida y ubicación conocida en los dos modos; presencia exacta solo en
 * el interactivo; el modo debe ser el del expediente; sin detenciones
 * repetidas. Los parámetros, cuando se pasan, se comprueban estrictos
 * (orden y lugar exactos): un `detain` con parámetros ajenos no se aplica. */
export function detentionPlan(
  def: CaseDefinition,
  run: CaseRun,
  suspectId: string,
  mode: unknown,
  params?: Record<string, unknown>,
): DetentionPlan {
  const suspect = suspectOf(def, suspectId);
  if (!suspect) return { ok: false };
  if (mode !== arrestTypeOf(def)) return { ok: false };
  if (params !== undefined) {
    if (params.warrantId !== 'warrant:' + suspect.id) return { ok: false };
    if (params.locationId !== suspect.locationId) return { ok: false };
  }
  if (!suspectKnown(run, suspect.id)) return { ok: false };
  if (!run.warrants.includes('warrant:' + suspect.id)) return { ok: false };
  if (run.detentions.includes(suspect.id)) return { ok: false };
  if (mode === 'interactive') {
    const present = run.position.cityId === suspect.cityId && run.position.locationId === suspect.locationId;
    if (!present) return { ok: false };
    return { ok: true, minutes: DETENTION_INTERACTIVE_MINUTES, suspect };
  }
  return { ok: true, minutes: ARREST_COORDINATION_MINUTES, suspect };
}

/** Hechos de reacción a una detención, para la conversación con los
 * personajes (mismo patrón que `misconductFactsForNpc`, GDD §14): los
 * personajes de la ciudad del detenido saben que las autoridades lo
 * detuvieron por orden de A.C.M.E., y el propio detenido lo sabe en
 * primera persona. Sin inventar nada: solo lo que ocurrió de verdad. */
export function arrestFactsForNpc(def: CaseDefinition, run: CaseRun, npcId: string): Array<{ id: string; text: string }> {
  const facts: Array<{ id: string; text: string }> = [];
  for (const suspectId of run.detentions) {
    const suspect = def.npcs.find(npc => npc.id === suspectId);
    if (!suspect) continue;
    if (npcId === suspect.id) {
      facts.push({ id: `arrest:${suspect.id}`, text: 'Las autoridades me detuvieron por orden de A.C.M.E.' });
    } else if (def.npcs.find(npc => npc.id === npcId)?.cityId === suspect.cityId) {
      facts.push({ id: `arrest:${suspect.id}`, text: `Las autoridades detuvieron a ${suspect.name} por orden de A.C.M.E.` });
    }
  }
  return facts;
}
