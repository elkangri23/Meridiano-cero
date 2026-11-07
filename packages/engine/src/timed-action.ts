import type { CaseDefinition, CaseRun } from '@meridiano/case-schema';
import { DOCUMENT_SEND_MINUTES } from '@meridiano/case-schema';
import type { Action, ActionResult } from './types.js';
import { isFixedCase } from './fixed-case.js';
import { inspectedEvidence, knowsEvidence } from './fixed-evidence.js';
import { generatedInspectEvidence } from './generated-mechanics.js';

function inspectMinutes(run: CaseRun, action: Action, resolve: (targetId: string, element: string | undefined) => string | undefined): number {
  if (action.type === 'detain') return 15;
  if (action.type === 'recover') return 20;
  if (action.type !== 'inspect') return 0;
  const element = typeof action.params.elementId === 'string' ? action.params.elementId : undefined;
  const id = resolve(String(action.params.targetId), element);
  if (!id || knowsEvidence(run, id)) return 0;
  return element === undefined ? 10 : 20;
}

export function materialMinutes(def: CaseDefinition, run: CaseRun, action: Action): number {
  if (action.type === 'communicate') {
    // Enviar un documento es un trámite (GDD §9/§10); escribir un mensaje
    // sin documento no cuesta tiempo (conversar o leer no cuesta tiempo).
    return typeof action.params.documentId === 'string' ? DOCUMENT_SEND_MINUTES : 0;
  }
  if (!isFixedCase(def)) {
    // Expediente generado (T4-08): los mismos costes que el caso fijo.
    return inspectMinutes(run, action, (targetId, element) => generatedInspectEvidence(def, targetId, element)?.evidenceId);
  }
  return inspectMinutes(run, action, (targetId, element) => inspectedEvidence(targetId, element));
}

export function confirmation(run: CaseRun, action: Action, minutes: number): ActionResult {
  return { status: 'confirmation_required', run, events: [], preview: {
    actionType: action.type, estimatedMinutes: minutes, estimatedEndTime: run.minute + minutes,
    description: `Confirmar acción: ${minutes} minutos estimados.`,
  } };
}
