import { validateCaseDefinition } from '@meridiano/case-schema';
import type { CaseSummary } from '@meridiano/contracts';
import { astrolabioDefinition } from '@meridiano/engine';
import { RunStoreError } from './runs.ts';

export function findCase(caseId: string) {
  if (caseId !== astrolabioDefinition.id) throw new RunStoreError('NOT_FOUND');
  // No entregar referencias mutables al fixture usado por otras peticiones.
  return structuredClone(astrolabioDefinition);
}

export function caseSummary(caseId: string): CaseSummary {
  const definition = findCase(caseId);
  return {
    caseId: definition.id,
    title: 'El astrolabio de las tres ciudades',
    contentMode: definition.contentMode,
    difficulty: definition.difficulty,
    explorationMode: definition.explorationMode,
    deadlineMinutes: definition.deadlineMinutes,
    contentVersion: definition.contentVersion,
    canStart: validateCaseDefinition(definition).valid,
  };
}

export function listCases() {
  return [caseSummary(astrolabioDefinition.id)];
}
