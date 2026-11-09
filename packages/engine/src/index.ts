import { submitCommunication, matureCommunication } from './communications.js';
import { submitIrregular, irregularPreview } from './irregular.js';
import { submitTeam } from './team.js';
import { detentionPlan } from './arrest.js';
import { startBatch, decideBatch } from './batch.js';
import { materialMinutes, confirmation } from './timed-action.js';
import { appendRequest, pendingEvidence } from './requests.js';
import { visibleCaseCityIds } from './discovery.js';
import { getCity, getRoute, visitLocationId, resolveMessage, type Language } from '@meridiano/case-schema';
import { isFixedCase, ORIGINAL_OBJECT } from './fixed-case.js';
import { revealInspection, canCollect, revealTalk, queryRule, matureEvidence, revealEvidence, FIXED_ANALYSIS_RULE } from './fixed-evidence.js';
import { generatedAnalysis, generatedQueryRule, matureGeneratedEvidence, revealGeneratedInspection, revealGeneratedTalk } from './generated-mechanics.js';
import { requestWarrant, matureSelectedWarrant } from './warrants.js';
export { canIssueWarrant, knownSuspect } from './warrants.js';
export { knowsEvidence } from './fixed-evidence.js';
export { misconductFactsForNpc } from './irregular.js';
export { arrestFactsForNpc } from './arrest.js';
export { describeLockedActions } from './action-availability.js';
export type { LockedAction, LockedMissing } from './action-availability.js';
export { availableOffers } from './offers.js';
export { visibleCaseCityIds, discoveredCityIds } from './discovery.js';
export { liveObjectives, completeFinalReport, scoreForReport, SCORE_MAX, buildFinalReport } from './final-report.js';
export type { ActionOffer } from './offers.js';
import { EngineStateError } from './state-error.js';
export { EngineStateError } from './state-error.js';
import { buildFinalReport, completeFinalReport } from './final-report.js';
import { advanceMinute, hasExpired, seededDelay } from './clock.js';
import type {
  CaseDefinition,
  CaseRun,
  PlayerView,
  FinalReport,
  ScheduledResult,
} from '@meridiano/case-schema';

/** Versión de ejecución; admite el formato de definición engineCompatibility=1. */
export const ENGINE_VERSION = 14;

// ── Acciones ──────────────────────────────────────────────────────────────────

import type { Action, ActionResult, EngineEvent, ActionPreview } from './types.js';
export type { Action, ActionType, ActionResult, EngineEvent, ActionPreview, BatchStep } from './types.js';

// ── Hash ──────────────────────────────────────────────────────────────────────

function publicFinalReport(def: CaseDefinition, run: CaseRun): FinalReport | null {
  return completeFinalReport(def, run);
}

export function projectToPlayerView(def: CaseDefinition, run: CaseRun): PlayerView {
  const visibleCities = visibleCaseCityIds(def, run);

  const discoveredLocations = def.locations
    .filter((l) => run.discoveries.includes(l.id))
    .map((l) => l.id);

  const discoveredObjects = run.inventory.filter((id) =>
    def.evidence.some((e) => e.id === id),
  );

  return {
    runId: run.id,
    version: run.version,
    minute: run.minute,
    deadlineMinutes: def.deadlineMinutes,
    position: { cityId: run.position.cityId, locationId: run.position.locationId },
    visibleCities,
    discoveredLocations,
    discoveredObjects,
    dossier: [...run.discoveries],
    conversation: [...run.conversationRecords],
    pendingRequests: run.pendingRequests.map(request => ({ id: request.id, dueMinute: request.dueMinute })),
    warrants: [...run.warrants],
    detentions: [...run.detentions],
    finalReport: publicFinalReport(def, run),
  };
}

// ── Motor interno ─────────────────────────────────────────────────────────────

function makeEvent(minute: number, type: string, payload: Record<string, unknown>): EngineEvent {
  return { ordinal: 0, minute, type, payload };
}

function requireRunCounters(run: CaseRun): void {
  if (!Number.isSafeInteger(run.version) || run.version < 1) throw new EngineStateError('RUN_VERSION_INVALID');
  if (!Number.isSafeInteger(run.eventOrdinal) || run.eventOrdinal < 0) throw new EngineStateError('EVENT_SEQUENCE_INVALID');
  if (!Number.isSafeInteger(run.tripCount) || run.tripCount < 0) throw new EngineStateError('TRAVEL_SEQUENCE_INVALID');
}

function requireTransitionVersion(before: CaseRun, after: CaseRun): void {
  if (!Number.isSafeInteger(after.version) || after.version < before.version) throw new EngineStateError('RUN_VERSION_INVALID');
  if (!Number.isSafeInteger(after.tripCount) || after.tripCount < before.tripCount) throw new EngineStateError('TRAVEL_SEQUENCE_INVALID');
}

function completeTransition(run: CaseRun, action: Action, work: () => ActionResult, language: Language = 'es'): ActionResult {
  const refuse = (reason: string): ActionResult => ({ status: 'impossible', run, events: [], reason });
  if (run.engineVersion !== ENGINE_VERSION) throw new EngineStateError('ENGINE_VERSION_UNSUPPORTED');
  if (run.status === 'closed') return refuse(resolveMessage(language, 'engine.reason.runClosed'));
  if (run.pendingBatch !== null && action.type !== 'batch_decision') return refuse(resolveMessage(language, 'engine.reason.batchPending'));
  requireRunCounters(run);
  const result = work();
  requireTransitionVersion(run, result.run);
  if (result.events.length === 0) return result;
  const end = run.eventOrdinal + result.events.length;
  if (!Number.isSafeInteger(end)) throw new EngineStateError('EVENT_SEQUENCE_EXHAUSTED');
  const events = [...result.events].sort((a, b) => a.minute - b.minute)
    .map((event, index) => ({ ...event, ordinal: run.eventOrdinal + index + 1 }));
  return { ...result, run: { ...result.run, eventOrdinal: end }, events };
}

export function resolveAction(def: CaseDefinition, run: CaseRun, action: Action, language: Language = 'es'): ActionResult {
  return completeTransition(run, action, () => previewAction(def, run, action, language), language);
}

export function confirmAction(def: CaseDefinition, run: CaseRun, action: Action, language: Language = 'es'): ActionResult {
  return completeTransition(run, action, () => confirmActionInternal(def, run, action, language), language);
}

/** Preview propia de la detención: siempre pide confirmación
 * (irreversible) y su descripción dice de qué modo es — en persona o
 * coordinada con las autoridades (GDD §12). Sin plan válido, es
 * imposible, con el mismo motivo que al confirmar. */
function previewDetention(def: CaseDefinition, run: CaseRun, action: Action, language: Language): ActionResult {
  const suspectId = typeof action.params.suspectId === 'string' ? action.params.suspectId : undefined;
  const plan = suspectId === undefined ? undefined : detentionPlan(def, run, suspectId, action.params.mode, action.params);
  if (!plan?.ok) return { status: 'impossible', run, events: [], reason: resolveMessage(language, 'engine.reason.detentionUnavailable') };
  const name = def.npcs.find(npc => npc.id === plan.suspect.id)?.name ?? plan.suspect.id;
  const minutes = plan.minutes;
  return { status: 'confirmation_required', run, events: [], preview: {
    actionType: 'detain', estimatedMinutes: minutes, estimatedEndTime: run.minute + minutes,
    description: action.params.mode === 'automatic'
      ? resolveMessage(language, 'engine.preview.detainAutomatic', { name, minutes })
      : resolveMessage(language, 'engine.preview.detainInteractive', { name, minutes }),
  } };
}

function previewAction(def: CaseDefinition, run: CaseRun, action: Action, language: Language = 'es'): ActionResult {
  // La acción irregular siempre pide confirmación con los riesgos
  // conocidos (testigos, advertencia, retirada): su descripción no es la
  // genérica de `confirmation`, nombra quién puede verte y qué está en juego.
  if (action.type === 'irregular') {
    const preview = irregularPreview(def, run, action, language);
    if (!preview) return { status: 'impossible', run, events: [], reason: resolveMessage(language, 'engine.reason.irregularUnavailable') };
    return { status: 'confirmation_required', run, events: [], preview };
  }
  // La detención siempre pide confirmación (irreversible) y su
  // descripción dice de qué modo es: en persona o coordinada con las
  // autoridades (GDD §12). Sin plan válido, es imposible, con el mismo
  // motivo que al confirmar.
  if (action.type === 'detain') return previewDetention(def, run, action, language);
  const result = resolvePreview(def, run, action, language);
  requireTransitionVersion(run, result.run);
  if (result.status === 'impossible') return result;
  const minutes = materialMinutes(def, run, action);
  if (minutes > 0) return confirmation(run, action, minutes, language);
  if (action.type === 'wait') return confirmation(run, action, Number(action.params.minutes), language);
  return previewBatchResult(run, action, result, language);
}

function resolvePreview(def: CaseDefinition, run: CaseRun, action: Action, language: Language): ActionResult {
  if (action.type === 'batch') return resolveBatch(def, run, action, true, language);
  if (action.type === 'batch_decision') return resolveBatchDecision(def, run, action, true, language);
  return resolveActionInternal(def, run, action, language);
}

function previewBatchResult(run: CaseRun, action: Action, result: ActionResult, language: Language): ActionResult {
  const elapsed = result.run.minute - run.minute;
  const closesCase = result.events.some(event => event.type === 'finish');
  if (action.type === 'batch_decision' && action.params.decision === 'continue_independent') return batchConfirmation(run, action, elapsed, closesCase, language);
  if (action.type === 'batch' && (elapsed > 0 || closesCase || result.events.some(event => event.type === 'travel'))) return batchConfirmation(run, action, elapsed, closesCase, language);
  return result;
}

function batchConfirmation(run: CaseRun, action: Action, elapsed: number, closesCase: boolean, language: Language): ActionResult {
  const result = confirmation(run, action, elapsed, language);
  if (result.status !== 'confirmation_required') return result;
  return { ...result, preview: { ...result.preview,
    description: resolveMessage(language, 'engine.preview.batch', { elapsed }) +
      (closesCase ? resolveMessage(language, 'engine.preview.batchCloses') : '') } };
}

function applyMaterial(def: CaseDefinition, run: CaseRun, action: Action, language: Language): ActionResult {
  const validation = resolveActionInternal(def, run, action, language);
  if (validation.status !== 'applied') return validation;
  const minutes = materialMinutes(def, run, action);
  if (minutes === 0) return validation;
  const elapsed = resolveWait(def, run, { type: 'wait', params: { minutes } }, language);
  if (elapsed.status === 'case_closed') return { ...elapsed, run: { ...elapsed.run, pendingBatch: null },
    events: elapsed.events.map(event => event.type === 'wait' ? makeEvent(elapsed.run.minute, 'action_interrupted', { actionType: action.type, elapsedMinutes: elapsed.run.minute - run.minute }) : event) };
  const result = resolveActionInternal(def, elapsed.run, action, language);
  return { ...result, run: { ...result.run, version: run.version + 1 },
    events: [...elapsed.events.filter(event => event.type !== 'wait'), ...result.events] };
}

// ── Inspect ───────────────────────────────────────────────────────────────────

/** Revela lo que la inspección descubre: vía fija o vía genérica (T4-08). */
function revealInspect(def: CaseDefinition, run: CaseRun, target: string, element?: string): CaseRun {
  return isFixedCase(def) ? revealInspection(def, run, target, element) : revealGeneratedInspection(def, run, target, element);
}

function doInspect(def: CaseDefinition, run: CaseRun, targetId: string, language: Language): { run: CaseRun; events: EngineEvent[] } | { impossible: string } {
  const location = def.locations.find((l) => l.id === targetId);
  if (!location || !location.accessible || location.cityId !== run.position.cityId) {
    return { impossible: resolveMessage(language, 'engine.reason.targetUnavailable') };
  }
  const newDiscoveries = run.discoveries.includes(targetId)
    ? run.discoveries
    : [...run.discoveries, targetId];
  const newRun: CaseRun = {
    ...run,
    version: run.version + 1,
    discoveries: newDiscoveries,
  };
  const events = [makeEvent(run.minute, 'inspect', { targetId, general: true })];
  return { run: revealInspect(def, newRun, targetId), events };
}

function doInspectSpecific(def: CaseDefinition, run: CaseRun, targetId: string, elementId: string, language: Language): { run: CaseRun; events: EngineEvent[] } | { impossible: string } {
  const location = def.locations.find((l) => l.id === targetId);
  if (!location || !location.accessible || location.cityId !== run.position.cityId) {
    return { impossible: resolveMessage(language, 'engine.reason.targetUnavailable') };
  }
  const newDiscoveries = run.discoveries.includes(targetId)
    ? run.discoveries
    : [...run.discoveries, targetId];
  const newRun: CaseRun = {
    ...run,
    version: run.version + 1,
    discoveries: newDiscoveries,
  };
  const events = [makeEvent(run.minute, 'inspect', { targetId, elementId, specific: true })];
  return { run: revealInspect(def, newRun, targetId, elementId), events };
}

// ── Collect ───────────────────────────────────────────────────────────────────

function doCollect(def: CaseDefinition, run: CaseRun, evidenceId: string, language: Language): { run: CaseRun; events: EngineEvent[] } | { impossible: string } {
  const ev = def.evidence.find((e) => e.id === evidenceId);
  if (!ev || !canCollect(def, run, evidenceId)) {
    return { impossible: resolveMessage(language, 'engine.reason.evidenceUnavailable') };
  }
  if (run.inventory.includes(evidenceId)) {
    return { impossible: resolveMessage(language, 'engine.reason.alreadyCollected') };
  }
  const newAdmissibility = { ...run.admissibility, [evidenceId]: ev.admissible };
  const record = run.evidenceRecords?.[evidenceId];
  const newRun: CaseRun = {
    ...run,
    version: run.version + 1,
    inventory: [...run.inventory, evidenceId],
    admissibility: newAdmissibility,
    ...(record ? { evidenceRecords: { ...run.evidenceRecords, [evidenceId]: { ...record, collectedMinute: run.minute } } } : {}),
  };
  const events = [makeEvent(run.minute, 'collect', { evidenceId, type: ev.type, origin: ev.origin, minute: run.minute })];
  return { run: newRun, events };
}

// ── Talk ──────────────────────────────────────────────────────────────────────

function doTalk(def: CaseDefinition, run: CaseRun, npcId: string, topicId?: unknown, language: Language = 'es'): { run: CaseRun; events: EngineEvent[] } | { impossible: string } {
  const npc = def.npcs.find((n) => n.id === npcId);
  if (!npc || npc.cityId !== run.position.cityId) {
    return { impossible: resolveMessage(language, 'engine.reason.npcNotAccessible') };
  }
  const newRecords = [...run.conversationRecords, `talk:${npcId}@${run.minute}`];
  const newRelations = { ...run.npcRelations };
  if (!(npcId in newRelations)) {
    newRelations[npcId] = npc.cooperation;
  }
  const newRun: CaseRun = {
    ...run,
    version: run.version + 1,
    conversationRecords: newRecords,
    npcRelations: newRelations,
  };
  const revealed = isFixedCase(def) ? revealTalk(def, newRun, npcId, topicId) : revealGeneratedTalk(def, newRun, npcId, topicId);
  const factIds = revealed.discoveries.filter(id => !run.discoveries.includes(id));
  const events = [makeEvent(run.minute, 'talk', { npcId, factIds })];
  return { run: revealed, events };
}

function inspectAction(def: CaseDefinition, run: CaseRun, action: Action, language: Language) {
  const target = action.params.targetId;
  if (typeof target !== 'string') return { impossible: resolveMessage(language, 'engine.reason.targetUnavailable') };
  if (action.params.elementId !== undefined && typeof action.params.elementId !== 'string') return { impossible: resolveMessage(language, 'engine.reason.targetUnavailable') };
  if (isFixedCase(def) && target === 'MAD-SALA' && action.params.elementId !== undefined && !['cerradura', 'caja'].includes(String(action.params.elementId))) return { impossible: resolveMessage(language, 'engine.reason.targetUnavailable') };
  return typeof action.params.elementId === 'string'
    ? doInspectSpecific(def, run, target, action.params.elementId, language) : doInspect(def, run, target, language);
}

// ── Batch / Sequence ──────────────────────────────────────────────────────────

// ── Procesamiento de solicitudes programadas ──────────────────────────────────

function maturedEvents(requests: ScheduledResult[], run: CaseRun): EngineEvent[] {
  return requests.map(request => makeEvent(request.dueMinute,
    run.discoveries.includes('warrant-denied:' + request.id) ? 'warrant_denied' : 'request_matured',
    { requestId: request.id, type: request.type }));
}

function queueEvidence(run: CaseRun, evidenceId: string, delay: number, method: 'analyze' | 'query', language: Language): ActionResult {
  if (pendingEvidence(run, evidenceId)) return { status: 'impossible', run, events: [], reason: resolveMessage(language, 'engine.reason.requestInProgress') };
  const id = `req-${run.version + 1}`;
  const dueMinute = run.minute + delay;
  if (!Number.isSafeInteger(dueMinute)) throw new EngineStateError('REQUEST_STATE_INVALID');
  const request: ScheduledResult = { id, dueMinute, type: 'fixed_evidence', payload: { evidenceId, method } };
  return { status: 'applied', run: appendRequest(run, request),
    events: [makeEvent(run.minute, 'request_submitted', { requestId: id })] };
}

function requestAnalysis(def: CaseDefinition, run: CaseRun, action: Action, language: Language): ActionResult {
  const generic = generatedAnalysis(def, run, action.params.evidenceId);
  if (generic) return queueEvidence(run, generic.resultEvidenceId, generic.delayMinutes, 'analyze', language);
  if (!isFixedCase(def) || action.params.evidenceId !== FIXED_ANALYSIS_RULE.inputEvidenceId
    || !run.inventory.includes(FIXED_ANALYSIS_RULE.inputEvidenceId)) {
    return { status: 'impossible', run, events: [], reason: resolveMessage(language, 'engine.reason.analysisUnavailable') };
  }
  if (run.discoveries.includes(FIXED_ANALYSIS_RULE.resultEvidenceId)) return { status: 'impossible', run, events: [], reason: resolveMessage(language, 'engine.reason.analysisAvailable') };
  return queueEvidence(run, FIXED_ANALYSIS_RULE.resultEvidenceId, FIXED_ANALYSIS_RULE.delayMinutes, 'analyze', language);
}

function requestQuery(def: CaseDefinition, run: CaseRun, action: Action, language: Language): ActionResult {
  const rule = queryRule(def, run, action.params.topicId) ?? generatedQueryRule(def, run, action.params.topicId);
  if (!rule) return { status: 'impossible', run, events: [], reason: resolveMessage(language, 'engine.reason.queryUnavailable') };
  if (run.discoveries.includes(rule.evidenceId)) return { status: 'impossible', run, events: [], reason: resolveMessage(language, 'engine.reason.queryAvailable') };
  return queueEvidence(run, rule.evidenceId, rule.delayMinutes, 'query', language);
}

function processMaturedRequests(def: CaseDefinition, run: CaseRun, newMinute: number, expired: boolean): { run: CaseRun; matured: ScheduledResult[] } {
  const matured: ScheduledResult[] = [];
  const remaining: ScheduledResult[] = [];
  let currentRun = run;
  for (const request of [...run.pendingRequests].sort((a, b) => a.dueMinute - b.dueMinute)) {
    const due = expired ? request.dueMinute < newMinute : request.dueMinute <= newMinute;
    if (!due) { remaining.push(request); continue; }
    matured.push(request);
    if (request.type === 'warrant') currentRun = matureSelectedWarrant(def, currentRun, request);
    if (request.type === 'fixed_evidence') currentRun = isFixedCase(def)
      ? matureEvidence(def, currentRun, request)
      : matureGeneratedEvidence(def, currentRun, request);
    if (request.type === 'communicate') currentRun = matureCommunication(currentRun, request);
  }
  return { run: { ...currentRun, pendingRequests: remaining }, matured };
}

// ── Warrant ───────────────────────────────────────────────────────────────────

// ── resolveAction ─────────────────────────────────────────────────────────────

function resolveActionInternal(def: CaseDefinition, run: CaseRun, action: Action, language: Language): ActionResult {
  if (!Object.hasOwn(handlers, action.type)) return { status: 'impossible', run, events: [], reason: resolveMessage(language, 'engine.reason.actionUnavailable') };
  return handlers[action.type](def, run, action, language);
}

function resolveInspection(def: CaseDefinition, run: CaseRun, action: Action, language: Language): ActionResult {
  const res = inspectAction(def, run, action, language);
  if ('impossible' in res) return { status: 'impossible', run, events: [], reason: res.impossible };
  return { status: 'applied', run: res.run, events: res.events };
}

function resolveCollection(def: CaseDefinition, run: CaseRun, action: Action, language: Language): ActionResult {
  const evidenceId = action.params.evidenceId;
  if (typeof evidenceId !== 'string') {
    return { status: 'impossible', run, events: [], reason: resolveMessage(language, 'engine.reason.invalidEvidence') };
  }
  const res = doCollect(def, run, evidenceId, language);
  if ('impossible' in res) {
    return { status: 'impossible', run, events: [], reason: res.impossible };
  }
  return { status: 'applied', run: res.run, events: res.events };
}

function resolveTalk(def: CaseDefinition, run: CaseRun, action: Action, language: Language): ActionResult {
  const npcId = action.params.npcId;
  if (typeof npcId !== 'string') {
    return { status: 'impossible', run, events: [], reason: resolveMessage(language, 'engine.reason.invalidNpc') };
  }
  const res = doTalk(def, run, npcId, action.params.topicId, language);
  if ('impossible' in res) {
    return { status: 'impossible', run, events: [], reason: res.impossible };
  }
  return { status: 'applied', run: res.run, events: res.events };
}

function nextTripCount(run: CaseRun): number {
  const count = run.tripCount + 1;
  if (!Number.isSafeInteger(count)) throw new EngineStateError('TRAVEL_SEQUENCE_INVALID');
  return count;
}

/** Duración de un viaje (GDD §5, REQ-G05-01): la ruta del expediente
 * manda para sus ciudades —puede diferir de la del catálogo—; para un
 * viaje con al menos un extremo fuera del expediente vale la ruta del
 * catálogo de geografía (sin ella, desde una ciudad turística no habría
 * forma de volver al caso: el expediente no tiene rutas desde fuera).
 * Sin ruta en ninguno de los dos, no hay viaje: el catálogo no finge
 * cobertura universal. */
function travelDuration(def: CaseDefinition, fromCityId: string, toCityId: string): number | undefined {
  const cased = def.travelDurations.find(
    (d) => d.fromCityId === fromCityId && d.toCityId === toCityId,
  );
  if (cased) return cased.minutes;
  const fromIsCase = def.cities.some(city => city.id === fromCityId);
  const toIsCase = def.cities.some(city => city.id === toCityId);
  if (fromIsCase && toIsCase) return undefined;
  return getRoute(fromCityId, toCityId)?.minutes;
}

function previewTravel(def: CaseDefinition, run: CaseRun, action: Action, language: Language): ActionResult {
  const toCityId = action.params.toCityId;
  if (typeof toCityId !== 'string') {
    return { status: 'impossible', run, events: [], reason: resolveMessage(language, 'engine.reason.invalidCity') };
  }
  const minutes = travelDuration(def, run.position.cityId, toCityId);
  if (minutes === undefined) {
    return { status: 'impossible', run, events: [], reason: resolveMessage(language, 'engine.reason.noRoute') };
  }
  nextTripCount(run);
  const baseCost = minutes;
  const destination = def.cities.find(city => city.id === toCityId) ?? getCity(toCityId);
  const preview: ActionPreview = {
    actionType: 'travel',
    estimatedMinutes: baseCost,
    estimatedEndTime: run.minute + baseCost,
    description: resolveMessage(language, 'engine.preview.travel', { city: destination?.name ?? toCityId, minutes: baseCost }),
  };
  return { status: 'confirmation_required', run, events: [], preview };
}

function executeBatchStep(def: CaseDefinition, run: CaseRun, action: Action, estimateOnly: boolean, language: Language): ActionResult {
  if (action.type === 'travel') return confirmTravel(def, run, action, estimateOnly, language);
  if (action.type === 'finish') return finishCase(def, run, language);
  return applyMaterial(def, run, action, language);
}

function resolveBatch(def: CaseDefinition, run: CaseRun, action: Action, estimateOnly = false, language: Language = 'es'): ActionResult {
  return startBatch(run, action.params, (current, step) => executeBatchStep(def, current, step, estimateOnly, language), language);
}

function resolveBatchDecision(def: CaseDefinition, run: CaseRun, action: Action, estimateOnly = false, language: Language = 'es'): ActionResult {
  return decideBatch(run, action.params, (current, step) => executeBatchStep(def, current, step, estimateOnly, language), language);
}

function resolveWait(def: CaseDefinition, run: CaseRun, action: Action, language: Language): ActionResult {
  const minutes = action.params.minutes;
  if (typeof minutes !== 'number' || !Number.isSafeInteger(minutes) || minutes < 1 || !Number.isSafeInteger(run.minute + minutes)) {
    return { status: 'impossible', run, events: [], reason: resolveMessage(language, 'engine.reason.invalidMinutes') };
  }
  const newMinute = advanceMinute(run.minute, minutes, def.deadlineMinutes);
  const expired = hasExpired(newMinute, def.deadlineMinutes);

  const baseRun: CaseRun = {
    ...run,
    version: run.version + 1,
    minute: newMinute,
  };
  const { run: processedRun, matured } = processMaturedRequests(def, baseRun, newMinute, expired);
  const newRun = processedRun;
  const events = [...maturedEvents(matured, newRun), makeEvent(newMinute, 'wait', { minutes, matured: matured.length })];

  if (expired) {
    const report = buildFinalReport(def, newRun, 'deadline', language);
    const closedRun: CaseRun = { ...newRun, status: 'closed', finalReport: report };
    return { status: 'case_closed', run: closedRun, events, report };
  }

  return { status: 'applied', run: newRun, events };
}

function resolveTeam(def: CaseDefinition, run: CaseRun, action: Action, language: Language): ActionResult {
  return submitTeam(def, run, action.params, language);
}
function resolveCommunication(def: CaseDefinition, run: CaseRun, action: Action, language: Language): ActionResult {
  return submitCommunication(def, run, action.params, language);
}

function resolveIrregular(def: CaseDefinition, run: CaseRun, action: Action, language: Language): ActionResult {
  return submitIrregular(def, run, action.params, language);
}

function applyDetention(run: CaseRun, suspectId: string, mode: unknown): ActionResult {
  return { status: 'applied', run: { ...run, version: run.version + 1, detentions: [...run.detentions, suspectId] },
    events: [makeEvent(run.minute, 'detain', { suspectId, mode: mode === 'automatic' ? 'automatic' : 'interactive' })] };
}

function resolveDetention(def: CaseDefinition, run: CaseRun, action: Action, language: Language): ActionResult {
  const refuse = (reason: string): ActionResult => ({ status: 'impossible', run, events: [], reason });
  const suspectId = typeof action.params.suspectId === 'string' ? action.params.suspectId : undefined;
  if (suspectId === undefined) return refuse(resolveMessage(language, 'engine.reason.detentionUnavailable'));
  if (run.detentions.includes(suspectId)) return refuse(resolveMessage(language, 'engine.reason.detentionDone'));
  const plan = detentionPlan(def, run, suspectId, action.params.mode, action.params);
  if (!plan.ok) return refuse(resolveMessage(language, 'engine.reason.detentionUnavailable'));
  return applyDetention(run, plan.suspect.id, action.params.mode);
}

interface RecoveryTarget { objectId: string; cityId: string; locationId: string; evidenceId: string; requiresAccessWarrant: boolean }

function recoveryTarget(def: CaseDefinition): RecoveryTarget | undefined {
  if (isFixedCase(def)) return { objectId: ORIGINAL_OBJECT, cityId: 'lisboa', locationId: 'LIS-ALM', evidenceId: 'EV-11', requiresAccessWarrant: true };
  const recovery = def.mechanics?.recovery;
  if (!recovery) return undefined;
  return { objectId: recovery.objectId, cityId: recovery.cityId, locationId: recovery.locationId, evidenceId: recovery.evidenceId, requiresAccessWarrant: recovery.requiresAccessWarrant };
}

function resolveRecovery(def: CaseDefinition, run: CaseRun, action: Action, language: Language): ActionResult {
  const refuse = (reason: string): ActionResult => ({ status: 'impossible', run, events: [], reason });
  const irregular = run.discoveries.includes('forced-entry');
  const access = run.warrants.includes('warrant:access') || irregular;
  const target = recoveryTarget(def);
  if (!target || action.params.objectId !== target.objectId || run.position.cityId !== target.cityId ||
      run.position.locationId !== target.locationId || (target.requiresAccessWarrant && !access)) {
    return refuse(resolveMessage(language, 'engine.reason.recoveryUnavailable'));
  }
  if (run.recoveredObjects.includes(target.objectId)) return refuse(resolveMessage(language, 'engine.reason.objectRecovered'));
  const revealed = revealEvidence(def, run, target.evidenceId, run.minute, 'recover');
  return { status: 'applied', run: { ...revealed, version: run.version + 1, recoveredObjects: [...run.recoveredObjects, target.objectId],
    inventory: [...run.inventory, target.evidenceId], admissibility: { ...revealed.admissibility, [target.evidenceId]: !irregular } },
    events: [makeEvent(run.minute, 'recover', { objectId: target.objectId, irregular })] };
}

function finishParams(action: Action): boolean {
  return typeof action.params === 'object' && action.params !== null && !Array.isArray(action.params) && Object.keys(action.params).length === 0;
}
function resolveFinish(_def: CaseDefinition, run: CaseRun, action: Action, language: Language): ActionResult {
  if (!finishParams(action)) return { status: 'impossible', run, events: [], reason: resolveMessage(language, 'engine.reason.closeParamsInvalid') };
  return { status: 'confirmation_required', run, events: [], preview: {
    actionType: 'finish', estimatedMinutes: 0, estimatedEndTime: run.minute, description: resolveMessage(language, 'engine.preview.finish'),
  }};
}
function finishCase(def: CaseDefinition, run: CaseRun, language: Language = 'es'): ActionResult {
  const report = buildFinalReport(def, run, 'finished', language);
  const newRun: CaseRun = {
    ...run,
    version: run.version + 1,
    status: 'closed',
    finalReport: report,
  };
  const events = [makeEvent(run.minute, 'finish', { result: report.result })];
  return { status: 'case_closed', run: newRun, events, report };
}

type Handler = (def: CaseDefinition, run: CaseRun, action: Action, language: Language) => ActionResult;
const handlers: Readonly<Record<Action['type'], Handler>> = Object.freeze({
  inspect: resolveInspection, collect: resolveCollection, talk: resolveTalk, travel: previewTravel,
  analyze: requestAnalysis, query: requestQuery,
  request_warrant: (def, run, action, language) => requestWarrant(def, run, action.params, language),
  batch: (def, run, action, language) => resolveBatch(def, run, action, false, language),
  batch_decision: (def, run, action, language) => resolveBatchDecision(def, run, action, false, language),
  wait: resolveWait,
  communicate: resolveCommunication, detain: resolveDetention, recover: resolveRecovery, finish: resolveFinish,
  irregular: resolveIrregular, team: resolveTeam,
});

// ── Confirmación de acciones con coste ─────────────────────────────────────────

function confirmActionInternal(def: CaseDefinition, run: CaseRun, action: Action, language: Language): ActionResult {
  switch (action.type) {
    case 'finish': return finishParams(action) ? finishCase(def, run, language) : resolveFinish(def, run, action, language);
    case 'travel': return confirmTravel(def, run, action, false, language);
    case 'analyze': return requestAnalysis(def, run, action, language);
    case 'inspect':
    case 'detain':
    case 'recover':
    case 'irregular': return applyMaterial(def, run, action, language);
    // Enviar un documento avanza el reloj (trámite) antes de enviarlo;
    // escribir un mensaje no cuesta tiempo y va directo.
    case 'communicate': return applyCommunication(def, run, action, language);
    default: return resolveActionInternal(def, run, action, language);
  }
}

/** Confirmar un envío de la central: el documento es un trámite con
 * coste de tiempo; el mensaje va directo, sin avanzar el reloj. */
function applyCommunication(def: CaseDefinition, run: CaseRun, action: Action, language: Language): ActionResult {
  return typeof action.params.documentId === 'string'
    ? applyMaterial(def, run, action, language) : resolveActionInternal(def, run, action, language);
}

function travelPosition(def: CaseDefinition, run: CaseRun, toCityId: string, expired: boolean): CaseRun['position'] {
  if (expired) return { ...run.position };
  const destination = def.locations.find(location => location.cityId === toCityId && location.accessible);
  if (destination) return { cityId: toCityId, locationId: destination.id };
  // Ciudad del expediente sin lugar accesible: se queda sin lugar. Ciudad
  // admitida fuera del expediente: lugar sintético de visita (la API lo
  // proyecta con la información turística; no es un escenario investigable).
  if (def.cities.some(city => city.id === toCityId)) return { cityId: toCityId, locationId: '' };
  return { cityId: toCityId, locationId: visitLocationId(toCityId) };
}

function confirmTravel(def: CaseDefinition, run: CaseRun, action: Action, estimateOnly = false, language: Language = 'es'): ActionResult {
  const toCityId = action.params.toCityId;
  if (typeof toCityId !== 'string') {
    return { status: 'impossible', run, events: [], reason: resolveMessage(language, 'engine.reason.invalidCity') };
  }
  const minutes = travelDuration(def, run.position.cityId, toCityId);
  if (minutes === undefined) {
    return { status: 'impossible', run, events: [], reason: resolveMessage(language, 'engine.reason.noRoute') };
  }
  const confirmedTrips = nextTripCount(run);
  const baseCost = minutes;
  const delay = estimateOnly ? 0 : seededDelay(def.seed, run.tripCount);
  const totalCost = baseCost + delay;
  const newMinute = advanceMinute(run.minute, totalCost, def.deadlineMinutes);
  const expired = hasExpired(newMinute, def.deadlineMinutes);

  const newDiscoveries = run.discoveries.includes(`travel:${toCityId}`)
    ? run.discoveries
    : [...run.discoveries, `travel:${toCityId}`];

  const baseRun: CaseRun = {
    ...run,
    version: run.version + 1,
    minute: newMinute,
    tripCount: confirmedTrips,
    position: travelPosition(def, run, toCityId, expired),
    discoveries: expired ? [...run.discoveries] : newDiscoveries,
  };
  const { run: processedRun, matured } = processMaturedRequests(def, baseRun, newMinute, expired);
  const events = [...maturedEvents(matured, processedRun), makeEvent(newMinute, expired ? 'travel_interrupted' : 'travel', { toCityId, baseCost, delay, totalCost })];

  if (expired) {
    const report = buildFinalReport(def, processedRun, 'deadline', language);
    const closedRun: CaseRun = {
      ...processedRun,
      status: 'closed',
      finalReport: report,
    };
    return { status: 'case_closed', run: closedRun, events, report };
  }

  return { status: 'applied', run: processedRun, events };
}

// ── Helpers para el motor ─────────────────────────────────────────────────────

export function createInitialRun(
  def: CaseDefinition,
  ownerId: string,
  runId: string,
  definitionHash: string,
): CaseRun {
  if (typeof definitionHash !== 'string' || !/^[a-f0-9]{64}$/.test(definitionHash)) throw new EngineStateError('DEFINITION_HASH_INVALID');
  return {
    id: runId,
    ownerId,
    definitionId: def.id,
    definitionHash,
    engineVersion: ENGINE_VERSION,
    eventOrdinal: 0,
    tripCount: 0,
    version: 1,
    minute: 0,
    status: 'active',
    position: { cityId: def.cities[0]?.id ?? '', locationId: def.locations[0]?.id ?? '' },
    discoveries: [],
    inventory: [],
    admissibility: {},
    npcRelations: {},
    conversationRecords: [],
    pendingRequests: [],
    warrants: [],
    detentions: [],
    recoveredObjects: [],
    pendingBatch: null,
    finalReport: null,
  };
}

export { astrolabioDefinition } from './fixtures/case-astrolabio.js';
export { generadoFraudeDefinition } from './fixtures/case-generado-fraude.js';
export { previewAction };
