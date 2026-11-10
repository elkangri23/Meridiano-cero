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
import { arrestTypeOf } from '@meridiano/case-schema';
import { canIssueWarrant, confirmAction, createInitialRun, knowsEvidence, knownSuspect, resolveAction } from '@meridiano/engine';
import type { ArrestType, CaseDefinition, CaseRun, MechanicsSuspect } from '@meridiano/case-schema';

export interface GoldenPathAction {
  type: string;
  params: Record<string, unknown>;
}

export interface SimulationCheck {
  name: string;
  passed: boolean;
  detail: string;
}

export interface AlternativeRouteOutcome {
  minute: number;
  result: SimulationResult['result'];
  objectivesAchieved: string[];
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
  /** Resultado de la ruta alternativa (GDD §4/§18): solo cuando se pasa
   * `alternativePath` a `simulateCase`. */
  alternative?: AlternativeRouteOutcome;
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

function checkPathOutcome(definition: CaseDefinition, run: CaseRun, label: 'dorada' | 'alternativa'): string | null {
  if (run.status !== 'closed' || !run.finalReport) return `La ruta ${label} no cierra el caso.`;
  if (run.finalReport.result !== 'complete') return `La ruta ${label} termina en ${run.finalReport.result}, no en completado.`;
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

// ── Evidencia pendiente ─────────────────────────────────────────────────────
// Una consulta o un análisis NO entrega su evidencia al instante: la pide y
// el resultado llega solo cuando pasa el tiempo (delayMinutes), al esperar,
// viajar o inspeccionar. Mientras tanto la evidencia está «en curso»: el
// motor la rechaza como requisito, pero no es desconocida ni está mal
// ordenada — lo que falta es una espera después del paso que la pidió.
// Sin distinguirla, el diagnóstico decía «mueve la consulta DESPUÉS del
// paso que la revela» aunque ya iba después, y el modelo no podía arreglarlo
// (dos jobs en Media cayeron así en la etapa 4).

function pendingEvidence(run: CaseRun): Map<string, { dueMinute: number; method: string }> {
  const pending = new Map<string, { dueMinute: number; method: string }>();
  for (const request of run.pendingRequests) {
    if (request.type !== 'fixed_evidence') continue;
    const payload = request.payload;
    if (!payload || typeof payload !== 'object') continue;
    const record = payload as Record<string, unknown>;
    const evidenceId = record.evidenceId;
    if (typeof evidenceId !== 'string' || pending.has(evidenceId)) continue;
    pending.set(evidenceId, {
      dueMinute: request.dueMinute,
      method: typeof record.method === 'string' ? record.method : 'query',
    });
  }
  return pending;
}

/** Lo que revela una acción concreta (consulta o análisis) para una evidencia. */
function requestingStepForAction(definition: CaseDefinition, action: GoldenPathAction, evidenceId: string): { label: string; delayMinutes: number } | null {
  if (action.type === 'query') {
    const rule = definition.mechanics?.queries.find(entry => entry.id === paramId(action, 'topicId'));
    if (rule?.evidenceId === evidenceId) return { label: `la consulta «${rule.id}»`, delayMinutes: rule.delayMinutes };
  }
  if (action.type === 'analyze') {
    const rule = definition.mechanics?.analyses.find(entry => entry.inputEvidenceId === paramId(action, 'evidenceId'));
    if (rule?.resultEvidenceId === evidenceId) return { label: `el análisis de ${rule.inputEvidenceId}`, delayMinutes: rule.delayMinutes };
  }
  return null;
}

/** Paso de la ruta que pidió una evidencia pendiente, con su retardo. */
function requestingStep(definition: CaseDefinition, path: GoldenPathAction[], index: number, evidenceId: string): { stepIndex: number; label: string; delayMinutes: number } | null {
  for (let stepIndex = 0; stepIndex < index; stepIndex++) {
    const action = path[stepIndex];
    if (!action) continue;
    const found = requestingStepForAction(definition, action, evidenceId);
    if (found) return { stepIndex, ...found };
  }
  return null;
}

function pendingDiagnosis(definition: CaseDefinition, run: CaseRun, path: GoldenPathAction[], index: number, evidenceId: string): string | null {
  const pending = pendingEvidence(run);
  if (!pending.has(evidenceId)) return null;
  const request = requestingStep(definition, path, index, evidenceId);
  const wait = request ? Math.max(1, request.delayMinutes) : 30;
  const where = request ? `${request.label} en el paso ${request.stepIndex + 1}` : 'un paso anterior';
  return `${evidenceId} ya está pedida (${where}) pero su resultado aún no ha llegado: una consulta o un análisis no entrega su evidencia al instante, solo cuando pasa el tiempo. Añade un wait de al menos ${wait} min —o un viaje— después de ese paso, antes de usar ${evidenceId}.`;
}

function diagnoseQueryRequires(definition: CaseDefinition, run: CaseRun, path: GoldenPathAction[], index: number, step: string, topicId: string, rule: NonNullable<CaseDefinition['mechanics']>['queries'][number]): string | null {
  if (rule.requires.length === 0 || rule.requires.some(id => knowsEvidence(run, id))) return null;
  const pending = rule.requires.find(id => pendingEvidence(run).has(id));
  if (pending) {
    const cause = pendingDiagnosis(definition, run, path, index, pending);
    if (cause) return `${step}: la consulta «${topicId}» exige haber obtenido antes ${pending}. ${cause}`;
  }
  return `${step}: la consulta «${topicId}» exige haber obtenido antes al menos una de estas evidencias: ${rule.requires.join(', ')}. En este punto conoces: ${knownEvidenceList(run)}. Mueve la consulta DESPUÉS del paso que revela una de ellas.`;
}

function diagnoseQuery(definition: CaseDefinition, run: CaseRun, action: GoldenPathAction, path: GoldenPathAction[], index: number, engineError: string): string {
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
  const requiresProblem = diagnoseQueryRequires(definition, run, path, index, step, topicId, rule);
  if (requiresProblem) return requiresProblem;
  if (knowsEvidence(run, rule.evidenceId)) {
    return `${step}: la consulta «${topicId}» ya dio su resultado (${rule.evidenceId} ya se conoce). Quítala de la ruta.`;
  }
  return stepFallback(action, index, engineError);
}

function diagnoseRecoverAccess(definition: CaseDefinition, run: CaseRun, path: GoldenPathAction[], index: number, step: string, recovery: NonNullable<CaseDefinition['mechanics']>['recovery']): string | null {
  if (!recovery.requiresAccessWarrant || run.warrants.includes('warrant:access') || run.discoveries.includes('forced-entry')) return null;
  const suspect = definition.mechanics?.suspects.find(entry => entry.id === definition.solution);
  const accessIds = suspect?.accessEvidenceIds ?? [];
  const requestIndex = path.slice(0, index).findIndex(entry => entry?.type === 'request_warrant');
  if (requestIndex === -1) {
    return `${step}: la recuperación exige la orden de acceso (warrant:access) y la ruta no pide ninguna orden antes de recuperar. Pide la orden con request_warrant (con una evidencia de acceso entre sus evidenceIds) y espera 30 min a que madure antes de recuperar.`;
  }
  const request = path[requestIndex];
  const evidenceIds = Array.isArray(request?.params.evidenceIds)
    ? request.params.evidenceIds.filter((id): id is string => typeof id === 'string')
    : [];
  const pending = run.pendingRequests.find(entry => entry.type === 'warrant');
  return diagnoseRecoverRequest(step, requestIndex, evidenceIds, pending, suspect, accessIds, run.minute);
}

function diagnoseRecoverRequest(step: string, requestIndex: number, evidenceIds: string[], pending: CaseRun['pendingRequests'][number] | undefined, suspect: MechanicsSuspect | undefined, accessIds: string[], minute: number): string {
  if (pending) {
    return `${step}: la orden se pidió en el paso ${requestIndex + 1} pero aún no ha madurado (vence en el minuto ${pending.dueMinute} y estás en el minuto ${minute}). Espera ${pending.dueMinute - minute} min más con wait antes de recuperar.`;
  }
  if (accessIds.length === 0) {
    return `${step}: el sospechoso no declara ninguna evidencia de acceso (accessEvidenceIds vacío en la mecánica): sin ella el motor nunca concede warrant:access y la recuperación es imposible. Declara al menos una evidencia de acceso en el sospechoso y úsala en la request_warrant.`;
  }
  if (!evidenceIds.some(id => accessIds.includes(id))) {
    return `${step}: la orden pedida en el paso ${requestIndex + 1} usa evidenceIds [${evidenceIds.join(', ')}] y ninguna es una evidencia de acceso (${accessIds.join(', ')}). Incluye una evidencia de acceso en la request_warrant para que al madurar se conceda warrant:access.`;
  }
  return `${step}: la orden pedida en el paso ${requestIndex + 1} se denegó al madurar o no cubre una combinación válida: revisa que use una combinación completa de warrantCombinations del sospechoso (${JSON.stringify(suspect?.warrantCombinations ?? [])}) con evidencias conocidas y admisibles.`;
}

function diagnoseRecover(definition: CaseDefinition, run: CaseRun, action: GoldenPathAction, path: GoldenPathAction[], index: number, engineError: string): string {
  const step = `Paso ${index + 1} (recover)`;
  const recovery = definition.mechanics?.recovery;
  if (!recovery) return `${step}: la mecánica no declara ninguna recuperación.`;
  const objectId = paramId(action, 'objectId');
  if (objectId !== recovery.objectId) return `${step}: el objeto de la recuperación es «${recovery.objectId}», no «${objectId}».`;
  if (run.position.cityId !== recovery.cityId || run.position.locationId !== recovery.locationId) {
    return `${step}: la recuperación exige estar en ${cityLabel(definition, recovery.cityId)} / ${locationLabel(definition, recovery.locationId)} y estás en ${positionLabel(definition, run)}. Viaja antes a esa ciudad y vuelve a intentarlo en ese lugar.`;
  }
  if (run.recoveredObjects.includes(recovery.objectId)) return `${step}: el objeto ya está recuperado. Quita este paso.`;
  const accessProblem = diagnoseRecoverAccess(definition, run, path, index, step, recovery);
  if (accessProblem) return accessProblem;
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
  // El modo de la ruta dorada es el del expediente (GDD §12): la
  // automática se coordina con las autoridades y la interactiva detiene en
  // persona. Con el modo equivocado el motor rechaza la detención.
  const arrestType = arrestTypeOf(definition);
  if (paramId(action, 'mode') !== arrestType) {
    return `${step}: el modo de la detención es «${paramId(action, 'mode') || '(sin modo)'}» pero el caso es «${arrestType}»: pon mode: '${arrestType}' en el detain.`;
  }
  const known = diagnoseDetainKnown(run, suspect, step, arrestType);
  if (known) return known;
  // La automática no exige presencia: se coordina desde cualquier ciudad.
  const presence = diagnoseDetainPresence(definition, run, suspect, step, arrestType);
  if (presence) return presence;
  const warrant = diagnoseDetainWarrant(run, suspect, step);
  if (warrant) return warrant;
  if (run.detentions.includes(suspectId)) return `${step}: el sospechoso ya está detenido. Quita este paso.`;
  return stepFallback(action, index, engineError);
}

// ¿Se conoce lo necesario para detener? En automático basta la ubicación
// (GDD §12: orden válida y ubicación conocida); en interactivo, además
// la identidad, porque se detiene en persona. En los casos generados el
// único tema que revela ambos marcadores es «identidad».
function diagnoseDetainKnown(run: CaseRun, suspect: MechanicsSuspect, step: string, arrestType: ArrestType): string | undefined {
  if (run.discoveries.includes(`location:${suspect.id}`)) {
    if (arrestType !== 'interactive' || run.discoveries.includes(`identity:${suspect.id}`)) return undefined;
    return `${step}: el sospechoso aún no es conocido: falta hablar con él con topicId «identidad» (es el único tema que revela identity:${suspect.id}) antes de detenerlo en persona.`;
  }
  return `${step}: aún no se conoce la ubicación del sospechoso: habla con él con topicId «identidad» (es el único tema que revela location:${suspect.id}) antes de detenerlo.`;
}

// ¿Está el jugador donde está el sospechoso? Solo la interactiva lo
// exige: la automática se coordina desde cualquier ciudad.
function diagnoseDetainPresence(definition: CaseDefinition, run: CaseRun, suspect: MechanicsSuspect, step: string, arrestType: ArrestType): string | undefined {
  if (arrestType !== 'interactive') return undefined;
  if (run.position.cityId === suspect.cityId && run.position.locationId === suspect.locationId) return undefined;
  return `${step}: el sospechoso está en ${cityLabel(definition, suspect.cityId)} / ${locationLabel(definition, suspect.locationId)} y estás en ${positionLabel(definition, run)}. Viaja antes a esa ciudad.`;
}

// ¿Por qué no se puede detener todavía, si falta la orden? Con una
// orden pedida y sin madurar dice cuánto falta; sin pedir, recuerda
// pedirla con una combinación completa y esperar 30 min.
function diagnoseDetainWarrant(run: CaseRun, suspect: MechanicsSuspect, step: string): string | undefined {
  if (run.warrants.includes(`warrant:${suspect.id}`)) return undefined;
  const pending = run.pendingRequests.find(entry => entry.type === 'warrant');
  if (pending) {
    return `${step}: la orden se pidió pero aún no ha madurado (vence en el minuto ${pending.dueMinute} y estás en el minuto ${run.minute}). Espera ${pending.dueMinute - run.minute} min más con wait antes de detener.`;
  }
  return `${step}: no tienes la orden contra ${suspect.id}. Pide la orden con request_warrant usando una combinación completa de sus warrantCombinations (${JSON.stringify(suspect.warrantCombinations)}) y espera 30 min a que madure antes de detener.`;
}

function diagnoseRequestWarrant(definition: CaseDefinition, run: CaseRun, action: GoldenPathAction, path: GoldenPathAction[], index: number, engineError: string): string {
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
    const pending = unknown.find(id => pendingEvidence(run).has(id));
    if (pending) {
      const cause = pendingDiagnosis(definition, run, path, index, pending);
      if (cause) return `${step}: ${pending} aún no se conoce. ${cause}`;
    }
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

function diagnoseAnalyze(definition: CaseDefinition, run: CaseRun, action: GoldenPathAction, path: GoldenPathAction[], index: number, engineError: string): string {
  const step = `Paso ${index + 1} (analyze)`;
  const evidenceId = paramId(action, 'evidenceId');
  const rule = definition.mechanics?.analyses.find(entry => entry.inputEvidenceId === evidenceId);
  if (!rule) return `${step}: no hay ningún análisis declarado para ${evidenceId}.`;
  if (!run.inventory.includes(evidenceId)) {
    const pending = pendingDiagnosis(definition, run, path, index, evidenceId);
    if (pending) return `${step}: ${evidenceId} aún no está en tu poder. ${pending}`;
    return `${step}: ${evidenceId} no está en tu poder: recógela antes de analizarla.`;
  }
  if (pendingEvidence(run).has(rule.resultEvidenceId)) {
    const cause = pendingDiagnosis(definition, run, path, index, rule.resultEvidenceId);
    if (cause) return `${step}: el análisis de ${evidenceId} ya está en curso. ${cause}`;
  }
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

function diagnoseStep(definition: CaseDefinition, run: CaseRun, action: GoldenPathAction, path: GoldenPathAction[], index: number, engineError: string): string {
  switch (action.type) {
    case 'query': return diagnoseQuery(definition, run, action, path, index, engineError);
    case 'recover': return diagnoseRecover(definition, run, action, path, index, engineError);
    case 'detain': return diagnoseDetain(definition, run, action, index, engineError);
    case 'request_warrant': return diagnoseRequestWarrant(definition, run, action, path, index, engineError);
    case 'collect': return diagnoseCollect(definition, run, action, index, engineError);
    case 'inspect': return diagnoseInspect(definition, run, action, index, engineError);
    case 'analyze': return diagnoseAnalyze(definition, run, action, path, index, engineError);
    case 'talk': return diagnoseTalk(definition, run, action, index, engineError);
    case 'travel': return diagnoseTravel(definition, run, action, index, engineError);
    default: return stepFallback(action, index, engineError);
  }
}

/**
 * Reproduce una ruta paso a paso y explica el primer paso que el
 * motor rechaza (o el resultado cuando todos los pasos se aplican).
 * Devuelve null cuando la ruta es jugable y cierra el caso completo
 * dentro del presupuesto. `label` es 'dorada' o 'alternativa' y sale
 * en los mensajes para que el modelo sepa qué ruta hay que arreglar.
 */
export function diagnosePathFailure(definition: CaseDefinition, path: GoldenPathAction[], budgetMinutes: number, label: 'dorada' | 'alternativa'): string | null {
  let run = freshRun(definition);
  for (let index = 0; index < path.length; index++) {
    const action = path[index];
    if (!action) continue;
    const step = applyGoldenStep(definition, run, action, index);
    if (step.error) return diagnoseStep(definition, run, action, path, index, step.error);
    run = step.run;
    if (run.status === 'closed') break;
  }
  if (run.status !== 'closed' || !run.finalReport) {
    return `La ruta ${label} no cierra el caso: falta la acción finish al final, después de detener al sospechoso y recuperar el objeto.`;
  }
  if (run.finalReport.result !== 'complete') {
    const missing = definition.objectives
      .map(objective => objective.id)
      .filter(id => !run.finalReport?.objectivesAchieved.includes(id));
    return `La ruta ${label} termina en ${run.finalReport.result}, no en completado. Objetivos sin lograr: ${missing.join(', ') || 'ninguno marcado'}. Revisa que la ruta detenga al sospechoso solución y recupere el objeto, con los dos objetivos del expediente.`;
  }
  if (run.minute > budgetMinutes) {
    return `La ruta ${label} tarda ${run.minute} min, por encima del presupuesto de ${budgetMinutes} min: acorta la ruta (menos esperas o viajes) o quita pasos que no revelan nada nuevo.`;
  }
  return null;
}

/** Atajo para la ruta dorada (la alternativa usa `diagnosePathFailure`). */
export function diagnoseGoldenPathFailure(definition: CaseDefinition, goldenPath: GoldenPathAction[], budgetMinutes: number): string | null {
  return diagnosePathFailure(definition, goldenPath, budgetMinutes, 'dorada');
}

function checkPath(definition: CaseDefinition, path: GoldenPathAction[], budgetMinutes: number, label: 'dorada' | 'alternativa'): GoldenPathOutcome {
  const checkName = label === 'dorada' ? 'golden-path' : 'alternative-path';
  const fail = (detail: string, minute = 0): GoldenPathOutcome => ({ check: { name: checkName, passed: false, detail }, minute, result: null, objectivesAchieved: [] });
  let run = freshRun(definition);
  for (let index = 0; index < path.length; index++) {
    const action = path[index];
    if (!action) continue;
    const step = applyGoldenStep(definition, run, action, index);
    if (step.error) return fail(step.error, run.minute);
    run = step.run;
    if (run.status === 'closed') break;
  }
  const outcomeError = checkPathOutcome(definition, run, label);
  if (outcomeError) return fail(outcomeError, run.minute);
  const report = run.finalReport;
  if (!report) return fail(`La ruta ${label} no cierra el caso.`, run.minute);
  if (run.minute > budgetMinutes) {
    return fail(`La ruta ${label} tarda ${run.minute} min, por encima del presupuesto de ${budgetMinutes} min.`, run.minute);
  }
  return {
    check: { name: checkName, passed: true, detail: `Ruta ${label} completa en ${run.minute} min (presupuesto ${budgetMinutes} min).` },
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
  const result = apply(definition, run, { type: 'detain', params: { suspectId: suspect.id, warrantId: 'warrant:' + suspect.id, locationId: suspect.locationId, mode: arrestTypeOf(definition) } });
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

// ── Varias rutas (GDD §4/§18) ───────────────────────────────────────────────
// Una «ruta alternativa» es una segunda vía de resolución distinta y
// completa: otra cadena de evidencias que llega a orden + detención +
// recuperación dentro del mismo presupuesto, sin usar ninguna evidencia
// de la ruta dorada. No es una variación cosmética (otros waits, otro
// orden de viajes): su combinación de orden es distinta y su cadena no
// depende de la dorada. El precedente es el caso fijo (SPEC-003): la ruta
// A técnica (EV-03/EV-04/EV-05) y la ruta B documental (EV-06/EV-07/EV-08)
// se comprueban eliminando las evidencias exclusivas de la otra ruta.
//
// La independencia NO se comprueba repitiendo la ruta con la definición
// mutilada: la ruta dorada de los generados hace consultas opcionales
// (p. ej. el registro de envíos, que revela la ubicación) cuyos
// resultados pertenecen a la otra cadena, y la repetición fallaría aunque
// la orden no los necesite. Se comprueba sobre el grafo de obtención: cada
// evidencia de la orden de una ruta debe poder obtenerse sin ninguna
// evidencia de la orden de la otra (los `requires` de una consulta son
// «cualquiera de»: basta una vía). La simulación completa demuestra que
// cada ruta cierra el caso en plazo; este análisis demuestra que sus
// cadenas decisivas son distintas.

/** Evidencias de la orden que pide una ruta (unión de sus request_warrant
 * para el sospechoso solución; incluye la evidencia de acceso cuando la
 * ruta la añade a la combinación). */
export function warrantEvidenceOfPath(path: GoldenPathAction[], suspectId?: string): string[] {
  const ids: string[] = [];
  for (const action of path) {
    if (action.type !== 'request_warrant') continue;
    if (suspectId !== undefined && paramId(action, 'suspectId') !== suspectId) continue;
    const evidenceIds = Array.isArray(action.params.evidenceIds)
      ? action.params.evidenceIds.filter((id): id is string => typeof id === 'string')
      : [];
    for (const id of evidenceIds) if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

/** ¿Se puede obtener una evidencia sin usar ninguna de `forbidden`? Sigue
 * el grafo de obtención de la mecánica: observación/objeto por
 * inspeccionar, registro por consulta (basta UNO de sus `requires`),
 * análisis por su entrada, testimonio por hablar. Los ciclos no sirven
 * como vía (esa rama falla). Sin mecánica declarada no hay grafo. */
export function obtainableWithout(definition: CaseDefinition, evidenceId: string, forbidden: ReadonlySet<string>): boolean {
  return obtainableWithoutVisited(definition, evidenceId, forbidden, new Set<string>());
}

function obtainableRecord(definition: CaseDefinition, evidenceId: string, forbidden: ReadonlySet<string>, visiting: Set<string>): boolean {
  const queries = definition.mechanics?.queries.filter(entry => entry.evidenceId === evidenceId) ?? [];
  return queries.some(query => query.requires.length === 0 || query.requires.some(id => obtainableWithoutVisited(definition, id, forbidden, visiting)));
}

function obtainableAnalysis(definition: CaseDefinition, evidenceId: string, forbidden: ReadonlySet<string>, visiting: Set<string>): boolean {
  const analysis = definition.mechanics?.analyses.find(entry => entry.resultEvidenceId === evidenceId);
  return analysis !== undefined && obtainableWithoutVisited(definition, analysis.inputEvidenceId, forbidden, visiting);
}

function obtainableWithoutVisited(definition: CaseDefinition, evidenceId: string, forbidden: ReadonlySet<string>, visiting: Set<string>): boolean {
  if (forbidden.has(evidenceId)) return false;
  if (visiting.has(evidenceId)) return false;
  const evidence = definition.evidence.find(entry => entry.id === evidenceId);
  const mechanics = definition.mechanics;
  if (!evidence || !mechanics) return false;
  visiting.add(evidenceId);
  try {
    switch (evidence.type) {
      case 'observation':
      case 'object':
        return mechanics.inspectables.some(entry => entry.evidenceId === evidenceId);
      case 'record':
        return obtainableRecord(definition, evidenceId, forbidden, visiting);
      case 'analysis':
        return obtainableAnalysis(definition, evidenceId, forbidden, visiting);
      case 'testimony':
        return mechanics.talkEvidence.some(entry => entry.evidenceId === evidenceId);
      default:
        return false;
    }
  } finally {
    visiting.delete(evidenceId);
  }
}

export interface WarrantRouteAnalysis {
  solutionId: string | null;
  combinations: string[][];
  /** Pares de combinaciones disjuntas e independientes entre sí (índices). */
  independentPairs: Array<{ first: number; second: number }>;
  /** Por qué no hay par válido (vacío cuando lo hay). */
  reasons: string[];
}

/** ¿Forman dos combinaciones un par de rutas válido? Disjuntas y cada una
 * obtenible sin las evidencias de la otra. Devuelve los motivos cuando no. */
function analyzeCombinationPair(definition: CaseDefinition, firstCombo: string[], secondCombo: string[], first: number, second: number): string[] {
  const shared = firstCombo.filter(id => secondCombo.includes(id));
  if (shared.length > 0) {
    return [`Las combinaciones ${first + 1} y ${second + 1} comparten ${shared.join(', ')}: cada ruta necesita su propia cadena de evidencias.`];
  }
  const reasons: string[] = [];
  const blockedFirst = firstCombo.filter(id => !obtainableWithout(definition, id, new Set(secondCombo)));
  const blockedSecond = secondCombo.filter(id => !obtainableWithout(definition, id, new Set(firstCombo)));
  if (blockedFirst.length > 0) reasons.push(`La combinación ${first + 1} necesita ${blockedFirst.join(', ')}, que solo se obtiene con evidencias de la combinación ${second + 1}.`);
  if (blockedSecond.length > 0) reasons.push(`La combinación ${second + 1} necesita ${blockedSecond.join(', ')}, que solo se obtiene con evidencias de la combinación ${first + 1}.`);
  return reasons;
}

/** ¿La mecánica del expediente admite dos rutas? El sospechoso solución
 * debe tener al menos dos combinaciones de orden disjuntas, cada una
 * obtenible sin las evidencias de la otra. Es la precondición estructural
 * de la puerta (etapa 6): sin ella, ninguna pareja de rutas declaradas
 * puede ser independiente. */
export function analyzeWarrantRoutes(definition: CaseDefinition): WarrantRouteAnalysis {
  const mechanics = definition.mechanics;
  const solution = mechanics?.suspects.find(entry => entry.id === definition.solution);
  if (!solution) {
    return { solutionId: null, combinations: [], independentPairs: [], reasons: ['La mecánica no declara al sospechoso solución.'] };
  }
  const combinations = solution.warrantCombinations.filter((combo): combo is string[] => Array.isArray(combo));
  const reasons: string[] = [];
  if (combinations.length < 2) {
    reasons.push(combinations.length === 0
      ? 'El sospechoso solución no tiene ninguna combinación de orden: hacen falta al menos dos combinaciones disjuntas para dos rutas.'
      : 'El sospechoso solución tiene una sola combinación de orden: hace falta una segunda combinación disjunta para la ruta alternativa.');
  }
  const independentPairs: Array<{ first: number; second: number }> = [];
  for (let first = 0; first < combinations.length; first++) {
    for (let second = first + 1; second < combinations.length; second++) {
      const pairReasons = analyzeCombinationPair(definition, combinations[first] ?? [], combinations[second] ?? [], first, second);
      if (pairReasons.length === 0) independentPairs.push({ first, second });
      else reasons.push(...pairReasons);
    }
  }
  return { solutionId: solution.id, combinations, independentPairs, reasons };
}

/** ¿Admite el expediente dos rutas de resolución? Proxy computable desde
 * la definición guardada (C2, lote pequeños del catálogo 2026-11-10): par
 * independiente de combinaciones de orden (precondición estructural de
 * la etapa 6) y, si la recuperación exige orden de acceso, una evidencia
 * de acceso obtenible sin la cadena de la otra ruta en cada lado. No es
 * la puerta completa: no simula las rutas ni comprueba el presupuesto,
 * así que un caso futuro podría marcarse como multi-ruta con la
 * alternativa fuera de presupuesto. Sin mecánica (caso fijo) no se puede
 * analizar: devuelve false y el catálogo decide el fijo aparte
 * (SPEC-003:86, dos rutas A/B). */
export function hasMultipleRoutes(definition: CaseDefinition): boolean {
  const analysis = analyzeWarrantRoutes(definition);
  if (analysis.independentPairs.length === 0) return false;
  if (definition.mechanics?.recovery.requiresAccessWarrant !== true) return true;
  const solution = definition.mechanics?.suspects.find(entry => entry.id === definition.solution);
  const accessIds = solution?.accessEvidenceIds ?? [];
  if (accessIds.length === 0) return false;
  return analysis.independentPairs.some(pair => {
    const first = analysis.combinations[pair.first] ?? [];
    const second = analysis.combinations[pair.second] ?? [];
    const firstAccess = accessIds.some(id => obtainableWithout(definition, id, new Set(second)));
    const secondAccess = accessIds.some(id => obtainableWithout(definition, id, new Set(first)));
    return firstAccess && secondAccess;
  });
}

/** Comprobación de independencia de una ruta: cada evidencia de su orden
 * debe poder obtenerse sin ninguna evidencia de la orden de la otra ruta.
 * Sin mecánica declarada (caso fijo) no se puede analizar: no se añade
 * la comprobación. */
function checkRouteIndependence(definition: CaseDefinition, ownLabel: 'dorada' | 'alternativa', ownEvidence: string[], otherLabel: 'dorada' | 'alternativa', otherEvidence: string[]): SimulationCheck | null {
  if (definition.mechanics === undefined) return null;
  const checkName = ownLabel === 'dorada' ? 'golden-independent' : 'alternative-independent';
  const blocked = ownEvidence.filter(id => !obtainableWithout(definition, id, new Set(otherEvidence)));
  if (blocked.length === 0) {
    return { name: checkName, passed: true, detail: `La ruta ${ownLabel} no depende de las evidencias de la ruta ${otherLabel}.` };
  }
  return { name: checkName, passed: false, detail: `La ruta ${ownLabel} necesita ${blocked.join(', ')}, que son evidencias de la ruta ${otherLabel}: cada ruta debe completarse solo con su propia cadena.` };
}

/** Evidencias que podrían formar la combinación de una ruta: obtenibles
 * sin la cadena de la otra ruta. EV-01 (la observación inicial, común a
 * todas las rutas) y EV-11 (el objeto de la recuperación) no cuentan. */
function obtainableCandidates(definition: CaseDefinition, otherEvidence: string[]): string[] {
  return definition.evidence
    .map(entry => entry.id)
    .filter(id => id !== 'EV-01' && id !== 'EV-11' && !otherEvidence.includes(id))
    .filter(id => obtainableWithout(definition, id, new Set(otherEvidence)));
}

/** Diagnóstico de la simulación con dos rutas: primero la dorada, luego
 * la alternativa y, si ambas se juegan, la independencia entre ellas. */
function diagnoseSimulation(definition: CaseDefinition, goldenPath: GoldenPathAction[], alternativePath: GoldenPathAction[] | undefined, budgetMinutes: number): string | null {
  const goldenDiagnosis = diagnosePathFailure(definition, goldenPath, budgetMinutes, 'dorada');
  if (goldenDiagnosis) return goldenDiagnosis;
  if (alternativePath === undefined) return null;
  const alternativeDiagnosis = diagnosePathFailure(definition, alternativePath, budgetMinutes, 'alternativa');
  if (alternativeDiagnosis) return alternativeDiagnosis;
  if (definition.mechanics !== undefined) {
    const goldenWarrant = warrantEvidenceOfPath(goldenPath, definition.solution);
    const alternativeWarrant = warrantEvidenceOfPath(alternativePath, definition.solution);
    const pairs: Array<[string[], string[], 'dorada' | 'alternativa', 'dorada' | 'alternativa']> = [
      [alternativeWarrant, goldenWarrant, 'alternativa', 'dorada'],
      [goldenWarrant, alternativeWarrant, 'dorada', 'alternativa'],
    ];
    for (const [own, other, ownLabel, otherLabel] of pairs) {
      const blocked = own.filter(id => !obtainableWithout(definition, id, new Set(other)));
      if (blocked.length > 0) {
        // La reparación de 4b no puede arreglar la red: decirle al modelo
        // qué evidencias SÍ valen para la otra combinación, o que no hay
        // ninguna y el problema está en la red de pistas (etapa 4a).
        const candidates = obtainableCandidates(definition, other);
        const candidatesText = candidates.length > 0
          ? `Evidencias que SÍ se pueden obtener sin la cadena ${otherLabel} (candidatas para la combinación de la ruta ${ownLabel}): ${candidates.join(', ')}.`
          : `Ninguna evidencia fuera de la cadena ${otherLabel} se puede obtener sin ella: la red de pistas no admite dos rutas; cambia la combinación o el requisito que ata las dos cadenas.`;
        return `La ruta ${ownLabel} no es independiente de la ${otherLabel}: ${blocked.join(', ')} solo se obtiene con evidencias de la ruta ${otherLabel} (${other.join(', ')}). Cada ruta debe completarse solo con su propia cadena de evidencias: cambia la combinación de la orden o el requisito de la consulta que ata las dos cadenas. ${candidatesText}`;
      }
    }
  }
  return null;
}

/** Ejecuta las comprobaciones de jugabilidad sobre un expediente
 * generado. `budgetMinutes` es el plazo de la partida más difícil (la mitad
 * del plazo base del expediente): cada ruta debe caber ahí. Con
 * `alternativePath`, la puerta exige además que la segunda ruta complete
 * el caso y que ambas sean independientes (GDD §4/§18); sin ella, solo se
 * comprueba la ruta dorada, como antes. */
export function simulateCase(definition: CaseDefinition, goldenPath: GoldenPathAction[], budgetMinutes: number, alternativePath?: GoldenPathAction[]): SimulationResult {
  const golden = checkPath(definition, goldenPath, budgetMinutes, 'dorada');
  const checks = [
    golden.check,
    checkEarlyFinish(definition),
    checkDetainWithoutWarrant(definition),
    checkRecoverWithoutAccess(definition),
  ];
  let alternative: AlternativeRouteOutcome | undefined;
  if (alternativePath !== undefined) {
    const alt = checkPath(definition, alternativePath, budgetMinutes, 'alternativa');
    checks.push(alt.check);
    if (alt.check.passed) alternative = { minute: alt.minute, result: alt.result, objectivesAchieved: alt.objectivesAchieved };
    if (definition.mechanics !== undefined) {
      const goldenWarrant = warrantEvidenceOfPath(goldenPath, definition.solution);
      const alternativeWarrant = warrantEvidenceOfPath(alternativePath, definition.solution);
      const alternativeIndependent = checkRouteIndependence(definition, 'alternativa', alternativeWarrant, 'dorada', goldenWarrant);
      const goldenIndependent = checkRouteIndependence(definition, 'dorada', goldenWarrant, 'alternativa', alternativeWarrant);
      if (alternativeIndependent) checks.push(alternativeIndependent);
      if (goldenIndependent) checks.push(goldenIndependent);
    }
  }
  const errors = checks.filter(check => !check.passed).map(check => check.detail);
  return {
    playable: errors.length === 0,
    minute: golden.minute,
    budgetMinutes,
    result: golden.result,
    objectivesAchieved: golden.objectivesAchieved,
    checks,
    errors,
    diagnosis: errors.length > 0 ? diagnoseSimulation(definition, goldenPath, alternativePath, budgetMinutes) : null,
    ...(alternative !== undefined ? { alternative } : {}),
  };
}
