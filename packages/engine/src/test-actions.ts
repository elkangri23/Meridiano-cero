import { resolveAction, confirmAction } from './index.js';
import type { CaseDefinition, CaseRun } from '@meridiano/case-schema';
import type { Action } from './types.js';

/** Test driver: explicitly accepts new material/wait/batch previews; travel remains manual. */
export function acceptAction(def: CaseDefinition, run: CaseRun, action: Action) {
  const result = resolveAction(def, run, action);
  if (result.status === 'confirmation_required' && action.type !== 'travel' && action.type !== 'finish') {
    return confirmAction(def, run, action);
  }
  return result;
}
