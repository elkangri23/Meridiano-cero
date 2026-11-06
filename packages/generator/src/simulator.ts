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
import { canIssueWarrant, confirmAction, createInitialRun, knowsEvidence, knownSuspect, resolveAction } from '@meridiano/engine';
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
  /** Causa exacta del primer paso que el motor rechaza (o del resultado),
   * con los ids y el arreglo: es el feedback que recibe la reparación de
   * la etapa 4. Null cuando la ruta es jugable. */
  diagnosis: string | null;
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
    // Los parámetros en el mensaje: sin ellos el modelo no sabe QUÉ
    // evidencia o consulta falló («Evidencia no disponible» a secas no
    // dice cuál ni por qué).
    const params = action.params && Object.keys(action.params).length > 0 ? ` ${JSON.stringify(action.params)}` : '';
    return { run, error: `Paso ${index + 1} (${action.type}${params}) no se pudo aplicar: ${result.reason ?? result.status}.` };
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

// ── Diagnóstico de la ruta dorada ──────────────────────────────────────────
// Cuando la simulación falla, el error del motor («Consulta no disponible»)
// no dice POR QUÉ: el modelo reintentaba a ciegas y repetía el mismo fallo
// estructural. En Media, dos jobs seguidos cayeron en la etapa 4 por una
// consulta antes de su requisito y una recuperación sin orden de acceso.
// El diagnóstico reproduce la ruta paso a paso y, en el primer paso que el
// motor rechaza, dice la causa exacta con los ids y el arreglo.

function knownEvidenceList(run: CaseRun): string {
  const known = [...new Set([...run.discoveries, ...run.inventory].filter(id => id.startsWith('EV-')))].sort();
  return known.length > 0 ? known.join(', ') : 'ninguna evidencia todavía';
}

function cityLabel(definition: CaseDefinition, cityId: string): string {
  const city = definition.cities.find(entry => entry.id === cityId);
  return city ? `${city.name} (${city.id})` : cityId;
}

function locationLabel(definition: CaseDefinition, locationId: string): string {
  const location = definition.locations.find(entry => entry.id === locationId);
  return location ? `${location.name} (${location.id})` : locationId;
}

function positionLabel(definition: CaseDefinition, run: CaseRun): string {
  return `${cityLabel(definition, run.position.cityId)} / ${locationLabel(definition, run.position.locationId)}`;
}

function paramId(action: GoldenPathAction, key: string): string {
  const value = action.params[key];
  return typeof value === 'string' ? value : '';
}

function stepFallback(action: GoldenPathAction, index: number, engineError: string): string {
  return `Paso ${index + 1} (${action.type} ${JSON.stringify(action.params)}): ${engineError} Revisa los requisitos de esta acción en la mecánica y en qué punto de la ruta ocurre.`;
}

function diagnoseQuery(definition: CaseDefinition, run: CaseRun, action: GoldenPathAction, index: number, engineError: string): string {
  const step = `Paso ${index + 1} (query)`;
  const topicId = paramId(action, 'topicId');
  const rule = definition.mechanics?.queries.find(entry => entry.id === topicId);
  if (!rule) {
    const ids = definition.mechanics?.queries.map(entry => entry.id).join(', ') ?? '';
    return `${step}: no existe ninguna consulta con id «${topicId}» en la mecánica. Usa uno de: ${ids}.`;
  }
  if (run.position.cityId !== rule.cityId || run.position.locationId !== rule.locationId) {
    return `${step}: la consulta «${topicId}» exige estar en ${cityLabel(definition, rule.cityId)} / ${locationLabel(definition, rule.locationId)} y estás en ${positionLabel(definition, run)}. Viaja antes a esa ciudad y vuelve a intentarlo en ese lugar.`;
  }
  if (rule.requires.length > 0 && !rule.requires.some(id => knowsEvidence(run, id))) {
    return `${step}: la consulta «${topicId}» exige haber obtenido antes al menos una de estas evidencias: ${rule.requires.join(', ')}. En este punto conoces: ${knownEvidenceList(run)}. Mueve la consulta DESPUÉS del paso que revela una de ellas.`;
  }
  if (knowsEvidence(run, rule.evidenceId)) {
    return `${step}: la consulta «${topicId}» ya dio su resultado (${rule.evidenceId} ya se conoce). Quítala de la ruta.`;
  }
  return stepFallback(action, index, engineError);
}

function diagnoseRecover(definition: CaseDefinition, run: CaseRun, action: GoldenPathAction, goldenPath: GoldenPathAction[], index: number, engineError: string): string {
  const step = `Paso ${index + 1} (recover)`;
  const recovery = definition.mechanics?.recovery;
  if (!recovery) return `${step}: la mecánica no declara ninguna recuperación.`;
  const objectId = paramId(action, 'objectId');
  if (objectId !== recovery.objectId) return `${step}: el objeto de la recuperación es «${recovery.objectId}», no «${objectId}».`;
  if (run.position.cityId !== recovery.cityId || run.position.locationId !== recovery.locationId) {
    return `${step}: la recuperación exige estar en ${cityLabel(definition, recovery.cityId)} / ${locationLabel(definition, recovery.locationId)} y estás en ${positionLabel(definition, run)}. Viaja antes a esa ciudad y vuelve a intentarlo en ese lugar.`;
  }
  if (run.recoveredObjects.includes(recovery.objectId)) return `${step}: el objeto ya está recuperado. Quita este paso.`;
  if (recovery.requiresAccessWarrant && !run.warrants.includes('warrant:access') && !run.discoveries.includes('forced-entry')) {
    const suspect = definition.mechanics?.suspects.find(entry => entry.id === definition.solution);
    const accessIds = suspect?.accessEvidenceIds ?? [];
    const requestIndex = goldenPath.slice(0, index).findIndex(entry => entry?.type === 'request_warrant');
    if (requestIndex === -1) {
      return `${step}: la recuperación exige la orden de acceso (warrant:access) y la ruta no pide ninguna orden antes de recuperar. Pide la orden con request_warrant (con una evidencia de acceso entre sus evidenceIds) y espera 30 min a que madure antes de recuperar.`;
    }
    const request = goldenPath[requestIndex];
    const evidenceIds = Array.isArray(request?.params.evidenceIds)
      ? request.params.evidenceIds.filter((id): id is string => typeof id === 'string')
      : [];
    const pending = run.pendingRequests.find(entry => entry.type === 'warrant');
    if (pending) {
      return `${step}: la orden se pidió en el paso ${requestIndex + 1} pero aún no ha madurado (vence en el minuto ${pending.dueMinute} y estás en el minuto ${run.minute}). Espera ${pending.dueMinute - run.minute} min más con wait antes de recuperar.`;
    }
    if (!evidenceIds.some(id => accessIds.includes(id))) {
      return `${step}: la orden pedida en el paso ${requestIndex + 1} usa evidenceIds [${evidenceIds.join(', ')}] y ninguna es una evidencia de acceso (${accessIds.join(', ') || 'sin declarar'}). Incluye una evidencia de acceso en la request_warrant para que al madurar se conceda warrant:access.`;
    }
    return `${step}: la orden pedida en el paso ${requestIndex + 1} se denegó al madurar o no cubre una combinación válida: revisa que use una combinación completa de warrantCombinations del sospechoso (${JSON.stringify(suspect?.warrantCombinations ?? [])}) con evidencias conocidas y admisibles.`;
  }
  return stepFallback(action, index, engineError);
}

function diagnoseDetain(definition: CaseDefinition, run: CaseRun, action: GoldenPathAction, index: number, engineError: string): string {
  const step = `Paso ${index + 1} (detain)`;
  const suspectId = paramId(action, 'suspectId');
  const suspect = definition.mechanics?.suspects.find(entry => entry.id === suspectId);
  if (!suspect) return `${step}: no hay ningún sospechoso con id «${suspectId}» en la mecánica.`;
  if (paramId(action, 'locationId') !== suspect.locationId) {
    return `${step}: la detención debe hacerse en ${locationLabel(definition, suspect.locationId)}, no en «${paramId(action, 'locationId')}».`;
  }
  if (!run.discoveries.includes(`identity:${suspectId}`) || !run.discoveries.includes(`location:${suspectId}`)) {
    return `${step}: el sospechoso aún no es conocido: falta hablar con él con topicId «identidad» (es el único tema que revela identity:${suspectId} y location:${suspectId}) antes de detenerlo.`;
  }
  if (run.position.cityId !== suspect.cityId || run.position.locationId !== suspect.locationId) {
    return `${step}: el sospechoso está en ${cityLabel(definition, suspect.cityId)} / ${locationLabel(definition, suspect.locationId)} y estás en ${positionLabel(definition, run)}. Viaja antes a esa ciudad.`;
  }
  if (!run.warrants.includes(`warrant:${suspectId}`)) {
    const pending = run.pendingRequests.find(entry => entry.type === 'warrant');
    if (pending) {
      return `${step}: la orden se pidió pero aún no ha madurado (vence en el minuto ${pending.dueMinute} y estás en el minuto ${run.minute}). Espera ${pending.dueMinute - run.minute} min más con wait antes de detener.`;
    }
    return `${step}: no tienes la orden contra ${suspectId}. Pide la orden con request_warrant usando una combinación completa de sus warrantCombinations (${JSON.stringify(suspect.warrantCombinations)}) y espera 30 min a que madure antes de detener.`;
  }
  if (run.detentions.includes(suspectId)) return `${step}: el sospechoso ya está detenido. Quita este paso.`;
  return stepFallback(action, index, engineError);
}

function diagnoseRequestWarrant(definition: CaseDefinition, run: CaseRun, action: GoldenPathAction, index: number, engineError: string): string {
  const step = `Paso ${index + 1} (request_warrant)`;
  const suspectId = paramId(action, 'suspectId');
  const suspect = definition.mechanics?.suspects.find(entry => entry.id === suspectId);
  if (!suspect) return `${step}: no hay ningún sospechoso con id «${suspectId}» en la mecánica.`;
  if (!knownSuspect(definition, run, suspectId)) {
    return `${step}: el sospechoso aún no es conocido. Reúne antes una evidencia de knownFromEvidence (${suspect.knownFromEvidence.join(', ')}) o habla con él con topicId «identidad».`;
  }
  const evidenceIds = Array.isArray(action.params.evidenceIds)
    ? action.params.evidenceIds.filter((id): id is string => typeof id === 'string')
    : [];
  const unknown = evidenceIds.filter(id => !knowsEvidence(run, id));
  if (unknown.length > 0) {
    return `${step}: estas evidencias aún no se conocen: ${unknown.join(', ')}. Pide la orden solo con evidencias ya obtenidas.`;
  }
  if (!canIssueWarrant(definition, run, suspectId, evidenceIds)) {
    return `${step}: la selección [${evidenceIds.join(', ')}] no cubre ninguna combinación de warrantCombinations (${JSON.stringify(suspect.warrantCombinations)}). Usa una combinación completa con evidencias conocidas y admisibles.`;
  }
  return stepFallback(action, index, engineError);
}

function diagnoseCollect(definition: CaseDefinition, run: CaseRun, action: GoldenPathAction, index: number, engineError: string): string {
  const step = `Paso ${index + 1} (collect)`;
  const evidenceId = paramId(action, 'evidenceId');
  const evidence = definition.evidence.find(entry => entry.id === evidenceId);
  if (!evidence) return `${step}: no existe la evidencia «${evidenceId}».`;
  if (evidence.type !== 'object') {
    return `${step}: ${evidenceId} es de tipo ${evidence.type}: solo se recogen evidencias de tipo object (una observación se revela al inspeccionar, un registro por consulta, un análisis por analyze y un testimonio por hablar).`;
  }
  if (run.inventory.includes(evidenceId)) return `${step}: ${evidenceId} ya está recogida. Quita este paso.`;
  if (!run.discoveries.includes(evidenceId)) {
    const inspectable = definition.mechanics?.inspectables.find(entry => entry.evidenceId === evidenceId);
    const where = inspectable
      ? `Inspecciona ${locationLabel(definition, inspectable.locationId)}${inspectable.elementId ? ` (elemento ${inspectable.elementId})` : ''} antes de recogerla.`
      : 'Inspecciona el lugar que la revela antes de recogerla.';
    return `${step}: ${evidenceId} aún no se conoce. ${where}`;
  }
  if (evidence.origin !== run.position.locationId) {
    return `${step}: ${evidenceId} está en ${locationLabel(definition, evidence.origin)} y estás en ${locationLabel(definition, run.position.locationId)}. Viaja antes a esa ciudad.`;
  }
  return stepFallback(action, index, engineError);
}

function diagnoseInspect(definition: CaseDefinition, run: CaseRun, action: GoldenPathAction, index: number, engineError: string): string {
  const step = `Paso ${index + 1} (inspect)`;
  const targetId = paramId(action, 'targetId');
  const location = definition.locations.find(entry => entry.id === targetId);
  if (!location) return `${step}: no existe el lugar «${targetId}».`;
  if (location.cityId !== run.position.cityId) {
    return `${step}: ${locationLabel(definition, targetId)} está en ${cityLabel(definition, location.cityId)} y estás en ${cityLabel(definition, run.position.cityId)}. Viaja antes a esa ciudad.`;
  }
  const elementId = paramId(action, 'elementId');
  const inspectable = definition.mechanics?.inspectables.find(entry => entry.locationId === targetId && entry.elementId === elementId);
  if (!inspectable) {
    return `${step}: ningún inspeccionable declara ${elementId ? `el elemento «${elementId}» de ` : ''}${locationLabel(definition, targetId)}. Revisa los inspectables de la mecánica.`;
  }
  return stepFallback(action, index, engineError);
}

function diagnoseAnalyze(definition: CaseDefinition, run: CaseRun, action: GoldenPathAction, index: number, engineError: string): string {
  const step = `Paso ${index + 1} (analyze)`;
  const evidenceId = paramId(action, 'evidenceId');
  const rule = definition.mechanics?.analyses.find(entry => entry.inputEvidenceId === evidenceId);
  if (!rule) return `${step}: no hay ningún análisis declarado para ${evidenceId}.`;
  if (!run.inventory.includes(evidenceId)) return `${step}: ${evidenceId} no está en tu poder: recógela antes de analizarla.`;
  if (knowsEvidence(run, rule.resultEvidenceId)) return `${step}: el análisis ya dio su resultado (${rule.resultEvidenceId} ya se conoce). Quita este paso.`;
  return stepFallback(action, index, engineError);
}

function diagnoseTalk(definition: CaseDefinition, run: CaseRun, action: GoldenPathAction, index: number, engineError: string): string {
  const step = `Paso ${index + 1} (talk)`;
  const npcId = paramId(action, 'npcId');
  const npc = definition.npcs.find(entry => entry.id === npcId);
  if (!npc) return `${step}: no existe el personaje «${npcId}».`;
  if (npc.cityId !== run.position.cityId) {
    return `${step}: ${npc.name} está en ${cityLabel(definition, npc.cityId)} y estás en ${cityLabel(definition, run.position.cityId)}. Viaja antes a esa ciudad.`;
  }
  return stepFallback(action, index, engineError);
}

function diagnoseTravel(definition: CaseDefinition, run: CaseRun, action: GoldenPathAction, index: number, engineError: string): string {
  const step = `Paso ${index + 1} (travel)`;
  const toCityId = paramId(action, 'toCityId');
  if (!definition.cities.some(entry => entry.id === toCityId)) return `${step}: no existe la ciudad «${toCityId}».`;
  if (toCityId === run.position.cityId) return `${step}: ya estás en ${cityLabel(definition, toCityId)}: un viaje va siempre a una ciudad distinta de la actual.`;
  return stepFallback(action, index, engineError);
}

function diagnoseStep(definition: CaseDefinition, run: CaseRun, action: GoldenPathAction, goldenPath: GoldenPathAction[], index: number, engineError: string): string {
  switch (action.type) {
    case 'query': return diagnoseQuery(definition, run, action, index, engineError);
    case 'recover': return diagnoseRecover(definition, run, action, goldenPath, index, engineError);
    case 'detain': return diagnoseDetain(definition, run, action, index, engineError);
    case 'request_warrant': return diagnoseRequestWarrant(definition, run, action, index, engineError);
    case 'collect': return diagnoseCollect(definition, run, action, index, engineError);
    case 'inspect': return diagnoseInspect(definition, run, action, index, engineError);
    case 'analyze': return diagnoseAnalyze(definition, run, action, index, engineError);
    case 'talk': return diagnoseTalk(definition, run, action, index, engineError);
    case 'travel': return diagnoseTravel(definition, run, action, index, engineError);
    default: return stepFallback(action, index, engineError);
  }
}

/**
 * Reproduce la ruta dorada paso a paso y explica el primer paso que el
 * motor rechaza (o el resultado cuando todos los pasos se aplican).
 * Devuelve null cuando la ruta es jugable y cierra el caso completo
 * dentro del presupuesto.
 */
export function diagnoseGoldenPathFailure(definition: CaseDefinition, goldenPath: GoldenPathAction[], budgetMinutes: number): string | null {
  let run = freshRun(definition);
  for (let index = 0; index < goldenPath.length; index++) {
    const action = goldenPath[index];
    if (!action) continue;
    const step = applyGoldenStep(definition, run, action, index);
    if (step.error) return diagnoseStep(definition, run, action, goldenPath, index, step.error);
    run = step.run;
    if (run.status === 'closed') break;
  }
  if (run.status !== 'closed' || !run.finalReport) {
    return 'La ruta dorada no cierra el caso: falta la acción finish al final, después de detener al sospechoso y recuperar el objeto.';
  }
  if (run.finalReport.result !== 'complete') {
    const missing = definition.objectives
      .map(objective => objective.id)
      .filter(id => !run.finalReport?.objectivesAchieved.includes(id));
    return `La ruta dorada termina en ${run.finalReport.result}, no en completado. Objetivos sin lograr: ${missing.join(', ') || 'ninguno marcado'}. Revisa que la ruta detenga al sospechoso solución y recupere el objeto, con los dos objetivos del expediente.`;
  }
  if (run.minute > budgetMinutes) {
    return `La ruta dorada tarda ${run.minute} min, por encima del presupuesto de ${budgetMinutes} min: acorta la ruta (menos esperas o viajes) o quita pasos que no revelan nada nuevo.`;
  }
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
    diagnosis: errors.length > 0 ? diagnoseGoldenPathFailure(definition, goldenPath, budgetMinutes) : null,
  };
}
