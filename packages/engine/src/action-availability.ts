// Motivos por los que pedir una orden o detener a un sospechoso no está
// disponible todavía: el intérprete de texto libre los usa para explicar
// QUÉ FALTA en vez de inventar otra acción (lote intérprete de texto
// libre, 2026-11-09). Las reglas son las mismas del motor (offers.ts y
// arrest.ts): este módulo solo las describe, nunca las salta.
import { arrestTypeOf } from '@meridiano/case-schema';
import type { CaseDefinition, CaseRun } from '@meridiano/case-schema';
import { suspectLocated } from './arrest.js';
import { fixedSuspect, isFixedCase } from './fixed-case.js';
import { isGeneratedCase } from './generated-mechanics.js';
import { canIssueWarrant, knownSuspect } from './warrants.js';

/** Lo que falta para poder pedir una orden o detener a un sospechoso. */
export type LockedMissing =
  | 'suspect_unknown'
  | 'no_authorizing_evidence'
  | 'warrant_pending'
  | 'warrant_granted'
  | 'no_warrant'
  | 'location_unknown'
  | 'identity_unknown'
  | 'not_at_location'
  | 'already_detained';

export interface LockedAction {
  type: 'warrant' | 'detain';
  suspectId: string;
  suspectName: string;
  missing: LockedMissing[];
}

/** Sospechosos con oferta de orden/detención: los mismos de offers.ts. */
function suspectIds(def: CaseDefinition): string[] {
  return isGeneratedCase(def)
    ? (def.mechanics?.suspects.map(suspect => suspect.id) ?? [])
    : ['ines', 'tomas'];
}

function npcName(def: CaseDefinition, npcId: string): string {
  return def.npcs.find(npc => npc.id === npcId)?.name ?? npcId;
}

/** ¿Hay una solicitud de orden en curso para este sospechoso? Espejo de
 * `warrantPending` en offers.ts: la petición vive en `pendingRequests`
 * con tipo 'warrant' y el sospechoso en el payload. */
function warrantPending(run: CaseRun, suspectId: string): boolean {
  return run.pendingRequests.some(request => {
    if (request.type !== 'warrant' || typeof request.payload !== 'object' || request.payload === null) return false;
    return (request.payload as Record<string, unknown>).suspectId === suspectId;
  });
}

function warrantMissing(def: CaseDefinition, run: CaseRun, suspectId: string): LockedMissing[] | null {
  if (run.warrants.includes('warrant:' + suspectId)) return ['warrant_granted'];
  if (warrantPending(run, suspectId)) return ['warrant_pending'];
  const missing: LockedMissing[] = [];
  if (!knownSuspect(def, run, suspectId)) missing.push('suspect_unknown');
  if (!canIssueWarrant(def, run, suspectId)) missing.push('no_authorizing_evidence');
  return missing.length > 0 ? missing : null;
}

function detainMissing(def: CaseDefinition, run: CaseRun, suspectId: string): LockedMissing[] | null {
  if (run.detentions.includes(suspectId)) return ['already_detained'];
  if (!run.warrants.includes('warrant:' + suspectId)) {
    // Sin orden válida: una solicitud en curso es lo que falta (tiempo),
    // no la orden en sí; sin solicitud, falta la orden.
    return warrantPending(run, suspectId) ? ['warrant_pending'] : ['no_warrant'];
  }
  return detainReadinessMissing(def, run, suspectId);
}

/** ¿Está el jugador en la ciudad y el lugar del sospechoso? Solo
 * importa en la detención en persona (modo interactivo). */
function suspectPresent(def: CaseDefinition, run: CaseRun, suspectId: string): boolean {
  const suspect = isFixedCase(def)
    ? fixedSuspect(suspectId)
    : def.mechanics?.suspects.find(entry => entry.id === suspectId);
  return !suspect || (run.position.cityId === suspect.cityId && run.position.locationId === suspect.locationId);
}

/** Con la orden válida, lo que falta para detener: identidad y ubicación
 * en la interactiva (hay que saber a quién se detiene en persona y estar
 * en su lugar), solo la ubicación en la automática. */
function detainReadinessMissing(def: CaseDefinition, run: CaseRun, suspectId: string): LockedMissing[] | null {
  const missing: LockedMissing[] = [];
  const interactive = arrestTypeOf(def) === 'interactive';
  if (interactive && !run.discoveries.includes('identity:' + suspectId)) missing.push('identity_unknown');
  if (!suspectLocated(run, suspectId)) missing.push('location_unknown');
  if (interactive && !suspectPresent(def, run, suspectId)) missing.push('not_at_location');
  return missing.length > 0 ? missing : null;
}

/** Acciones de orden y detención que hoy NO se pueden hacer, con el
 * motivo: una entrada por sospechoso y tipo cuando la oferta no existe.
 * Solo se describe lo que falta; el motor sigue validando cada acción al
 * confirmarla. */
export function describeLockedActions(def: CaseDefinition, run: CaseRun): LockedAction[] {
  const locked: LockedAction[] = [];
  for (const suspectId of suspectIds(def)) {
    const name = npcName(def, suspectId);
    const warrant = warrantMissing(def, run, suspectId);
    if (warrant) locked.push({ type: 'warrant', suspectId, suspectName: name, missing: warrant });
    const detain = detainMissing(def, run, suspectId);
    if (detain) locked.push({ type: 'detain', suspectId, suspectName: name, missing: detain });
  }
  return locked;
}
