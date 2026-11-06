// Simulador de jugabilidad para el pipeline de generación (T4-08).
//
// La versión anterior (T4-03) solo contaba escenarios: generaba combinaciones
// de cooperación/retrasos sin jugar el motor. Esta ejecuta la ruta dorada
// declarada por el generador a través del motor real, con la misma semilla
// del expediente, y comprueba cuatro cosas: (a) la ruta dorada completa el
// caso con los dos objetivos dentro del presupuesto; (b) cerrar en el
// minuto 0 no resuelve nada (el caso no se resuelve solo); (c) detener sin
// orden es imposible (la puerta de la orden funciona); (d) recuperar sin
// acceso es imposible (la puerta de acceso funciona). Si alguna falla, el
// borrador se rechaza o se repara, nunca se publica.

import { hashDefinition } from '@meridiano/case-schema/server';
import { confirmAction, createInitialRun, resolveAction } from '@meridiano/engine';
import type { CaseDefinition, CaseRun } from '@meridiano/case-schema';

export interface GoldenPathAction {
  type: string;
  params: Record<string, unknown>;
}

export interface SimulationCheck {
  name: string;
  passed: boolean;
  detail: string;
}

export interface SimulationResult {
  playable: boolean;
  minute: number;
  budgetMinutes: number;
  result: 'complete' | 'partial' | 'incorrect' | 'unresolved' | null;
  objectivesAchieved: string[];
  checks: SimulationCheck[];
  errors: string[];
}

function freshRun(definition: CaseDefinition): CaseRun {
  return createInitialRun(definition, 'simulator', 'simulation-run', hashDefinition(definition));
}

function apply(definition: CaseDefinition, run: CaseRun, action: GoldenPathAction): { run: CaseRun; status: string; reason: string | undefined } {
  const preview = resolveAction(definition, run, { type: action.type, params: action.params } as never);
  if (preview.status === 'confirmation_required') {
    const confirmed = confirmAction(definition, run, { type: action.type, params: action.params } as never);
    return { run: confirmed.run, status: confirmed.status, reason: 'reason' in confirmed ? String(confirmed.reason) : undefined };
  }
  return { run: preview.run, status: preview.status, reason: 'reason' in preview ? String(preview.reason) : undefined };
}

interface GoldenPathOutcome {
  check: SimulationCheck;
  minute: number;
  result: SimulationResult['result'];
  objectivesAchieved: string[];
}

function applyGoldenStep(definition: CaseDefinition, run: CaseRun, action: GoldenPathAction, index: number): { run: CaseRun; error: string | null } {
  const result = apply(definition, run, action);
  if (result.status !== 'applied' && result.status !== 'case_closed') {
    return { run, error: `Paso ${index + 1} (${action.type}) no se pudo aplicar: ${result.reason ?? result.status}.` };
  }
  return { run: result.run, error: null };
}

function checkGoldenOutcome(definition: CaseDefinition, run: CaseRun): string | null {
  if (run.status !== 'closed' || !run.finalReport) return 'La ruta dorada no cierra el caso.';
  if (run.finalReport.result !== 'complete') return `La ruta dorada termina en ${run.finalReport.result}, no en completado.`;
  const missing = definition.objectives.map(objective => objective.id).filter(id => !run.finalReport?.objectivesAchieved.includes(id));
  if (missing.length > 0) return `Objetivos sin lograr: ${missing.join(', ')}.`;
  return null;
}

function checkGoldenPath(definition: CaseDefinition, goldenPath: GoldenPathAction[], budgetMinutes: number): GoldenPathOutcome {
  const fail = (detail: string, minute = 0): GoldenPathOutcome => ({ check: { name: 'golden-path', passed: false, detail }, minute, result: null, objectivesAchieved: [] });
  let run = freshRun(definition);
  for (let index = 0; index < goldenPath.length; index++) {
    const action = goldenPath[index];
    if (!action) continue;
    const step = applyGoldenStep(definition, run, action, index);
    if (step.error) return fail(step.error, run.minute);
    run = step.run;
    if (run.status === 'closed') break;
  }
  const outcomeError = checkGoldenOutcome(definition, run);
  if (outcomeError) return fail(outcomeError, run.minute);
  const report = run.finalReport;
  if (!report) return fail('La ruta dorada no cierra el caso.', run.minute);
  if (run.minute > budgetMinutes) {
    return fail(`La ruta dorada tarda ${run.minute} min, por encima del presupuesto de ${budgetMinutes} min.`, run.minute);
  }
  return {
    check: { name: 'golden-path', passed: true, detail: `Ruta dorada completa en ${run.minute} min (presupuesto ${budgetMinutes} min).` },
    minute: run.minute,
    result: report.result,
    objectivesAchieved: [...report.objectivesAchieved],
  };
}

function checkEarlyFinish(definition: CaseDefinition): SimulationCheck {
  const run = freshRun(definition);
  const result = apply(definition, run, { type: 'finish', params: {} });
  if (result.status !== 'case_closed' || !result.run.finalReport) {
    return { name: 'early-finish', passed: false, detail: 'Cerrar en el minuto 0 no cierra el caso.' };
  }
  if (result.run.finalReport.result !== 'unresolved') {
    return { name: 'early-finish', passed: false, detail: `Cerrar en el minuto 0 da ${result.run.finalReport.result}, no sin resolver.` };
  }
  return { name: 'early-finish', passed: true, detail: 'Cerrar en el minuto 0 queda sin resolver.' };
}

function checkDetainWithoutWarrant(definition: CaseDefinition): SimulationCheck {
  const suspect = definition.mechanics?.suspects.find(entry => entry.id === definition.solution);
  if (!suspect) return { name: 'detain-without-warrant', passed: false, detail: 'La mecánica no declara al sospechoso solución.' };
  const run = freshRun(definition);
  const result = apply(definition, run, { type: 'detain', params: { suspectId: suspect.id, warrantId: 'warrant:' + suspect.id, locationId: suspect.locationId, mode: 'interactive' } });
  if (result.status !== 'impossible') {
    return { name: 'detain-without-warrant', passed: false, detail: `Detener sin orden devolvió ${result.status}.` };
  }
  return { name: 'detain-without-warrant', passed: true, detail: 'Detener sin orden es imposible.' };
}

function checkRecoverWithoutAccess(definition: CaseDefinition): SimulationCheck {
  const recovery = definition.mechanics?.recovery;
  if (!recovery) return { name: 'recover-without-access', passed: false, detail: 'La mecánica no declara la recuperación.' };
  const run = freshRun(definition);
  const result = apply(definition, run, { type: 'recover', params: { objectId: recovery.objectId } });
  if (result.status !== 'impossible') {
    return { name: 'recover-without-access', passed: false, detail: `Recuperar sin acceso devolvió ${result.status}.` };
  }
  return { name: 'recover-without-access', passed: true, detail: 'Recuperar sin acceso es imposible.' };
}

/** Ejecuta las cuatro comprobaciones de jugabilidad sobre un expediente
 * generado. `budgetMinutes` es el plazo de la partida más difícil (la mitad
 * del plazo base del expediente): la ruta dorada debe caber ahí. */
export function simulateCase(definition: CaseDefinition, goldenPath: GoldenPathAction[], budgetMinutes: number): SimulationResult {
  const golden = checkGoldenPath(definition, goldenPath, budgetMinutes);
  const checks = [
    golden.check,
    checkEarlyFinish(definition),
    checkDetainWithoutWarrant(definition),
    checkRecoverWithoutAccess(definition),
  ];
  const errors = checks.filter(check => !check.passed).map(check => check.detail);
  return {
    playable: errors.length === 0,
    minute: golden.minute,
    budgetMinutes,
    result: golden.result,
    objectivesAchieved: golden.objectivesAchieved,
    checks,
    errors,
  };
}
