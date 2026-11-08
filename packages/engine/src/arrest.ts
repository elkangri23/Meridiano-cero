// Detenciones automáticas (GDD §12): plan único de detención y hechos de
// reacción de los personajes. El motor tenía la regla repartida en tres
// espejos (`detentionAuthorized`, `detentionAvailable`,
// `generatedDetentionAvailable`); este módulo es la fuente única: la
// oferta, la confirmación y el lote usan el mismo plan, así que una
// detención no puede ofrecerse y luego rechazarse (ni al revés).
import { ARREST_COORDINATION_MINUTES, arrestTypeOf, resolveMessage, type Language } from '@meridiano/case-schema';
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

/** ¿Conoce el jugador al sospechoso (identidad y ubicación)? Es la
 * condición de la detención en persona (GDD §12: las interactivas son
 * «identificación, conversación y coordinación»): para detener a alguien
 * en persona hay que saber quién es y dónde está. */
export function suspectKnown(run: CaseRun, suspectId: string): boolean {
  return run.discoveries.includes('identity:' + suspectId) && run.discoveries.includes('location:' + suspectId);
}

/** ¿Se conoce la ubicación del sospechoso? Es la condición de la
 * detención automática (GDD §12): «una vez que existe orden válida y se
 * conoce la ubicación del sospechoso, este permanece allí hasta la
 * intervención». La orden es la que identifica al sospechoso: las
 * autoridades actúan con la orden y la ubicación, sin que el jugador
 * haya tenido que hablar con él en persona. */
export function suspectLocated(run: CaseRun, suspectId: string): boolean {
  return run.discoveries.includes('location:' + suspectId);
}

/** ¿Se cumple la condición de conocimiento de este modo? En persona
 * (interactivo), identidad y ubicación; coordinada (automática), solo la
 * ubicación, porque la orden identifica al sospechoso. */
function detentionIdentified(mode: unknown, run: CaseRun, suspectId: string): boolean {
  return mode === 'interactive' ? suspectKnown(run, suspectId) : suspectLocated(run, suspectId);
}

/** Los parámetros declarados, cuando los hay, deben nombrar a este
 * sospechoso con su orden y su lugar: una orden de otro o un lugar
 * distinto no detienen a nadie. Sin parámetros (ofertas), no hay nada
 * que comprobar. */
function detentionParamsMatch(suspect: DetentionSuspect, params?: Record<string, unknown>): boolean {
  if (params === undefined) return true;
  return params.warrantId === 'warrant:' + suspect.id && params.locationId === suspect.locationId;
}

/** Plan de detención para un sospechoso con un modo: si se puede detener,
 * con qué modo y cuánto cuesta; si no, `ok: false` sin decir por qué (el
 * llamador pone el motivo genérico). Reglas (GDD §12, SPEC-001): orden
 * válida en los dos modos; identidad y ubicación conocidas en el
 * interactivo (hay que saber a quién se detiene en persona), solo
 * ubicación conocida en el automático (la orden identifica al sospechoso
 * y las autoridades actúan con ella); presencia exacta solo en el
 * interactivo; el modo debe ser el del expediente; sin detenciones
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
  if (!detentionParamsMatch(suspect, params)) return { ok: false };
  const identified = detentionIdentified(mode, run, suspect.id);
  if (!identified) return { ok: false };
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
export function arrestFactsForNpc(def: CaseDefinition, run: CaseRun, npcId: string, language: Language = 'es'): Array<{ id: string; text: string }> {
  const facts: Array<{ id: string; text: string }> = [];
  for (const suspectId of run.detentions) {
    const suspect = def.npcs.find(npc => npc.id === suspectId);
    if (!suspect) continue;
    if (npcId === suspect.id) {
      facts.push({ id: `arrest:${suspect.id}`, text: resolveMessage(language, 'engine.arrest.self') });
    } else if (def.npcs.find(npc => npc.id === npcId)?.cityId === suspect.cityId) {
      facts.push({ id: `arrest:${suspect.id}`, text: resolveMessage(language, 'engine.arrest.other', { name: suspect.name }) });
    }
  }
  return facts;
}
