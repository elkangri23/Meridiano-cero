import type { CaseDefinition, CaseRun } from '@meridiano/case-schema';
import { ARREST_COORDINATION_MINUTES, DOCUMENT_SEND_MINUTES, IRREGULAR_MINUTES, resolveMessage } from '@meridiano/case-schema';
import type { Language } from '@meridiano/case-schema';
import type { Action, ActionResult } from './types.js';
import { isFixedCase } from './fixed-case.js';
import { DETENTION_INTERACTIVE_MINUTES } from './arrest.js';
import { inspectedEvidence, knowsEvidence } from './fixed-evidence.js';
import { generatedInspectEvidence } from './generated-mechanics.js';

function inspectMinutes(run: CaseRun, action: Action, resolve: (targetId: string, element: string | undefined) => string | undefined): number {
  // Detener en persona cuesta 15 min (SPEC-003); coordinar la detención
  // con las autoridades, 30 min como un trámite (GDD §12).
  if (action.type === 'detain') return action.params.mode === 'automatic' ? ARREST_COORDINATION_MINUTES : DETENTION_INTERACTIVE_MINUTES;
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
  // Una acción irregular es un trámite con riesgo (GDD §14): 30 min, como
  // enviar un documento o una consulta. El castigo no es el tiempo, son
  // sus consecuencias (advertencia, cooperación, admisibilidad, retirada).
  if (action.type === 'irregular') return IRREGULAR_MINUTES;
  if (!isFixedCase(def)) {
    // Expediente generado (T4-08): los mismos costes que el caso fijo.
    return inspectMinutes(run, action, (targetId, element) => generatedInspectEvidence(def, targetId, element)?.evidenceId);
  }
  return inspectMinutes(run, action, (targetId, element) => inspectedEvidence(targetId, element));
}

export function confirmation(run: CaseRun, action: Action, minutes: number, language: Language = 'es'): ActionResult {
  return { status: 'confirmation_required', run, events: [], preview: {
    actionType: action.type, estimatedMinutes: minutes, estimatedEndTime: run.minute + minutes,
    description: resolveMessage(language, 'engine.preview.action', { minutes }),
  } };
}
