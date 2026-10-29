import type { CaseRun } from '@meridiano/case-schema';
import type { Action, ActionResult, BatchStep, EngineEvent } from './types.js';
import { createBatchSteps, dependenciesApplied, parsePendingBatch } from './pending-batch.js';

type Execute = (run: CaseRun, action: Action) => ActionResult;
function event(run: CaseRun, type: string, payload: Record<string, unknown>): EngineEvent {
  return { ordinal: 0, minute: run.minute, type, payload };
}
function pause(run: CaseRun, steps: BatchStep[], step: BatchStep, events: EngineEvent[], reason: string): ActionResult {
  step.status = 'impossible'; step.reason = reason;
  return { status: 'batch_paused', pausedAt: step.ordinal, reason,
    run: { ...run, version: run.version + 1, pendingBatch: steps.map(value => JSON.stringify(value)) },
    events: [...events, event(run, 'batch_paused', { stepOrdinal: step.ordinal })] };
}
function executeSteps(run: CaseRun, steps: BatchStep[], execute: Execute): ActionResult {
  let current = run;
  const events: EngineEvent[] = [];
  for (const step of steps) {
    if (step.status !== 'pending') continue;
    if (!dependenciesApplied(steps, step)) {
      step.status = 'skipped';
      events.push(event(current, 'batch_step_skipped', { stepOrdinal: step.ordinal, reason: 'dependency_not_applied' }));
      continue;
    }
    const result = execute(current, step.action);
    if (result.status === 'case_closed') return { ...result, run: { ...result.run, pendingBatch: null }, events: [...events, ...result.events] };
    if (result.status !== 'applied') return pause(current, steps, step, events, 'reason' in result ? result.reason : 'Paso no disponible.');
    step.status = 'applied'; current = result.run; events.push(...result.events);
  }
  return { status: 'applied', run: { ...current, version: current.version + 1, pendingBatch: null },
    events: [...events, event(current, 'batch_completed', {})] };
}

export function startBatch(run: CaseRun, params: Record<string, unknown>, execute: Execute): ActionResult {
  const steps = createBatchSteps(params);
  if (!steps) return { status: 'impossible', run, events: [], reason: 'Lote inválido: de 1 a 8 pasos admitidos con dependencias previas.' };
  return executeSteps(run, steps, execute);
}

export function decideBatch(run: CaseRun, params: Record<string, unknown>, execute: Execute): ActionResult {
  const decision = params.decision;
  if (!Object.hasOwn(params, 'decision') || !Object.keys(params).every(key => key === 'decision') || typeof decision !== 'string' || !['cancel', 'continue_independent'].includes(decision)) {
    return { status: 'impossible', run, events: [], reason: 'Decisión inválida.' };
  }
  if (!run.pendingBatch) return { status: 'impossible', run, events: [], reason: 'No hay lote pendiente.' };
  const steps = parsePendingBatch(run.pendingBatch);
  if (decision === 'cancel') return { status: 'applied', run: { ...run, version: run.version + 1, pendingBatch: null },
    events: [event(run, 'batch_cancelled', { stepsCancelled: steps.filter(step => step.status === 'pending').length })] };
  return executeSteps(run, steps, execute);
}
