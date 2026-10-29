import { fixedSuspect, isFixedCase, ORIGINAL_OBJECT } from './fixed-case.js';
import type { CaseDefinition, CaseRun, FinalReport } from '@meridiano/case-schema';

// Alias históricos del caso fijo, no inferidos de nombres visibles o substrings.
function canonicalSuspect(def: CaseDefinition, id: string): string {
  return isFixedCase(def) ? fixedSuspect(id)?.identity ?? id : id;
}

function objectiveAchieved(def: CaseDefinition, run: CaseRun, id: string): boolean {
  if (id === 'obj-detener') return run.detentions.some(suspect => canonicalSuspect(def, suspect) === def.solution);
  if (id === 'obj-recuperar' && isFixedCase(def)) return run.recoveredObjects.includes(ORIGINAL_OBJECT);
  // El formato heredado no define condiciones para objetivos arbitrarios.
  return false;
}

function result(def: CaseDefinition, run: CaseRun, achieved: string[]): FinalReport['result'] {
  if (run.detentions.some(suspect => canonicalSuspect(def, suspect) !== def.solution)) return 'incorrect';
  if (def.objectives.length > 0 && achieved.length === def.objectives.length) return 'complete';
  return achieved.length > 0 ? 'partial' : 'unresolved';
}

export function buildFinalReport(def: CaseDefinition, run: CaseRun, reason: FinalReport['reason']): FinalReport {
  const achieved = def.objectives.filter(objective => objectiveAchieved(def, run, objective.id)).map(objective => objective.id);
  return { result: result(def, run, achieved), objectivesAchieved: achieved, reason, minute: run.minute };
}
