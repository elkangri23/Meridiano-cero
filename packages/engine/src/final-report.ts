import { fixedSuspect, isFixedCase, ORIGINAL_OBJECT } from './fixed-case.js';
import type { CaseDefinition, CaseRun, FinalReport } from '@meridiano/case-schema';

// Alias históricos del caso fijo, no inferidos de nombres visibles o substrings.
function canonicalSuspect(def: CaseDefinition, id: string): string {
  return isFixedCase(def) ? fixedSuspect(id)?.identity ?? id : id;
}

function objectiveAchieved(def: CaseDefinition, run: CaseRun, id: string): boolean {
  if (id === 'obj-detener') return run.detentions.some(suspect => canonicalSuspect(def, suspect) === def.solution);
  if (id === 'obj-recuperar') {
    // Expediente generado (T4-08): el objeto a recuperar lo declara la mecánica.
    const objectId = isFixedCase(def) ? ORIGINAL_OBJECT : def.mechanics?.recovery.objectId;
    return objectId !== undefined && run.recoveredObjects.includes(objectId);
  }
  // El formato heredado no define condiciones para objetivos arbitrarios.
  return false;
}

/** Objetivos logrados en este momento de la partida, según el estado del
 * motor (detenciones y objetos recuperados). Es la misma evaluación que
 * usa el informe final, pero en vivo: el panel de objetivos de la pantalla
 * de juego la enseña sin esperar al cierre. Los objetivos sin condición
 * conocida quedan siempre pendientes (no se inventa su logro). */
export function liveObjectives(def: CaseDefinition, run: CaseRun): string[] {
  return def.objectives.filter(objective => objectiveAchieved(def, run, objective.id)).map(objective => objective.id);
}

function result(def: CaseDefinition, run: CaseRun, achieved: string[]): FinalReport['result'] {
  if (run.detentions.some(suspect => canonicalSuspect(def, suspect) !== def.solution)) return 'incorrect';
  if (def.objectives.length > 0 && achieved.length === def.objectives.length) return 'complete';
  return achieved.length > 0 ? 'partial' : 'unresolved';
}

export function buildFinalReport(def: CaseDefinition, run: CaseRun, reason: FinalReport['reason']): FinalReport {
  const achieved = liveObjectives(def, run);
  return { result: result(def, run, achieved), objectivesAchieved: achieved, reason, minute: run.minute };
}
