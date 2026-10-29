import type { CaseDefinition, CaseRun } from '@meridiano/case-schema';
import type { Action, ActionResult } from './types.js';
import { isFixedCase } from './fixed-case.js';
import { inspectedEvidence, knowsEvidence } from './fixed-evidence.js';

export function materialMinutes(def: CaseDefinition, run: CaseRun, action: Action): number {
  if (!isFixedCase(def)) return 0;
  if (action.type === 'detain') return 15;
  if (action.type === 'recover') return 20;
  if (action.type !== 'inspect') return 0;
  const element = typeof action.params.elementId === 'string' ? action.params.elementId : undefined;
  const id = inspectedEvidence(String(action.params.targetId), element);
  if (!id || knowsEvidence(run, id)) return 0;
  return element === undefined ? 10 : 20;
}

export function confirmation(run: CaseRun, action: Action, minutes: number): ActionResult {
  return { status: 'confirmation_required', run, events: [], preview: {
    actionType: action.type, estimatedMinutes: minutes, estimatedEndTime: run.minute + minutes,
    description: `Confirmar acción: ${minutes} minutos estimados.`,
  } };
}
