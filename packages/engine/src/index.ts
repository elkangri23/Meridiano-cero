import { submitCommunication, matureCommunication } from './communications.js';
import { startBatch, decideBatch } from './batch.js';
import { materialMinutes, confirmation } from './timed-action.js';
import { appendRequest, pendingEvidence } from './requests.js';
import { isFixedCase, fixedSuspect, ORIGINAL_OBJECT } from './fixed-case.js';
import { revealInspection, canCollect, revealTalk, queryRule, matureEvidence, revealEvidence } from './fixed-evidence.js';
import { generatedAnalysis, generatedQueryRule, generatedSuspect, matureGeneratedEvidence, revealGeneratedInspection, revealGeneratedTalk } from './generated-mechanics.js';
import { requestWarrant, matureSelectedWarrant } from './warrants.js';
export { canIssueWarrant, knownSuspect } from './warrants.js';
export { knowsEvidence } from './fixed-evidence.js';
export { availableOffers } from './offers.js';
export { liveObjectives } from './final-report.js';
export type { ActionOffer } from './offers.js';
import { EngineStateError } from './state-error.js';
export { EngineStateError } from './state-error.js';
import { buildFinalReport } from './final-report.js';
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

function publicFinalReport(run: CaseRun): FinalReport | null {
  if (run.status !== 'closed' || !run.finalReport) return null;
  return {
    result: run.finalReport.result,
    objectivesAchieved: [...run.finalReport.objectivesAchieved],
    reason: run.finalReport.reason,
    minute: run.finalReport.minute,
  };
}

export function projectToPlayerView(def: CaseDefinition, run: CaseRun): PlayerView {
  const visibleCities = run.discoveries.includes('map')
    ? def.cities.map((c) => c.id)
    : [run.position.cityId];

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
    finalReport: publicFinalReport(run),
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

function completeTransition(run: CaseRun, action: Action, work: () => ActionResult): ActionResult {
  const refuse = (reason: string): ActionResult => ({ status: 'impossible', run, events: [], reason });
  if (run.engineVersion !== ENGINE_VERSION) throw new EngineStateError('ENGINE_VERSION_UNSUPPORTED');
  if (run.status === 'closed') return refuse('La partida ya está cerrada.');
  if (run.pendingBatch !== null && action.type !== 'batch_decision') return refuse('Hay un lote pendiente de decisión.');
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

export function resolveAction(def: CaseDefinition, run: CaseRun, action: Action): ActionResult {
  return completeTransition(run, action, () => previewAction(def, run, action));
}

export function confirmAction(def: CaseDefinition, run: CaseRun, action: Action): ActionResult {
  return completeTransition(run, action, () => confirmActionInternal(def, run, action));
}

function previewAction(def: CaseDefinition, run: CaseRun, action: Action): ActionResult {
  const result = resolvePreview(def, run, action);
  requireTransitionVersion(run, result.run);
  if (result.status === 'impossible') return result;
  const minutes = materialMinutes(def, run, action);
  if (minutes > 0) return confirmation(run, action, minutes);
  if (action.type === 'wait') return confirmation(run, action, Number(action.params.minutes));
  return previewBatchResult(run, action, result);
}

function resolvePreview(def: CaseDefinition, run: CaseRun, action: Action): ActionResult {
  if (action.type === 'batch') return resolveBatch(def, run, action, true);
  if (action.type === 'batch_decision') return resolveBatchDecision(def, run, action, true);
  return resolveActionInternal(def, run, action);
}

function previewBatchResult(run: CaseRun, action: Action, result: ActionResult): ActionResult {
  const elapsed = result.run.minute - run.minute;
  const closesCase = result.events.some(event => event.type === 'finish');
  if (action.type === 'batch_decision' && action.params.decision === 'continue_independent') return batchConfirmation(run, action, elapsed, closesCase);
  if (action.type === 'batch' && (elapsed > 0 || closesCase || result.events.some(event => event.type === 'travel'))) return batchConfirmation(run, action, elapsed, closesCase);
  return result;
}

function batchConfirmation(run: CaseRun, action: Action, elapsed: number, closesCase: boolean): ActionResult {
  const result = confirmation(run, action, elapsed);
  if (result.status !== 'confirmation_required') return result;
  return { ...result, preview: { ...result.preview,
    description: 'Confirmar secuencia: ' + elapsed + ' minutos estimados; los viajes pueden retrasarse y cambiar la viabilidad de pasos posteriores.' +
      (closesCase ? ' Incluye cierre del caso; no se ejecutarán pasos posteriores.' : '') } };
}

function applyMaterial(def: CaseDefinition, run: CaseRun, action: Action): ActionResult {
  const validation = resolveActionInternal(def, run, action);
  if (validation.status !== 'applied') return validation;
  const minutes = materialMinutes(def, run, action);
  if (minutes === 0) return validation;
  const elapsed = resolveWait(def, run, { type: 'wait', params: { minutes } });
  if (elapsed.status === 'case_closed') return { ...elapsed, run: { ...elapsed.run, pendingBatch: null },
    events: elapsed.events.map(event => event.type === 'wait' ? makeEvent(elapsed.run.minute, 'action_interrupted', { actionType: action.type, elapsedMinutes: elapsed.run.minute - run.minute }) : event) };
  const result = resolveActionInternal(def, elapsed.run, action);
  return { ...result, run: { ...result.run, version: run.version + 1 },
    events: [...elapsed.events.filter(event => event.type !== 'wait'), ...result.events] };
}

// ── Inspect ───────────────────────────────────────────────────────────────────

/** Revela lo que la inspección descubre: vía fija o vía genérica (T4-08). */
function revealInspect(def: CaseDefinition, run: CaseRun, target: string, element?: string): CaseRun {
  return isFixedCase(def) ? revealInspection(def, run, target, element) : revealGeneratedInspection(def, run, target, element);
}

function doInspect(def: CaseDefinition, run: CaseRun, targetId: string): { run: CaseRun; events: EngineEvent[] } | { impossible: string } {
  const location = def.locations.find((l) => l.id === targetId);
  if (!location || !location.accessible || location.cityId !== run.position.cityId) {
    return { impossible: 'Objetivo no accesible.' };
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

function doInspectSpecific(def: CaseDefinition, run: CaseRun, targetId: string, elementId: string): { run: CaseRun; events: EngineEvent[] } | { impossible: string } {
  const location = def.locations.find((l) => l.id === targetId);
  if (!location || !location.accessible || location.cityId !== run.position.cityId) {
    return { impossible: 'Objetivo no accesible.' };
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

function doCollect(def: CaseDefinition, run: CaseRun, evidenceId: string): { run: CaseRun; events: EngineEvent[] } | { impossible: string } {
  const ev = def.evidence.find((e) => e.id === evidenceId);
  if (!ev || !canCollect(def, run, evidenceId)) {
    return { impossible: 'Evidencia no disponible.' };
  }
  if (run.inventory.includes(evidenceId)) {
    return { impossible: 'Ya recogida.' };
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

function doTalk(def: CaseDefinition, run: CaseRun, npcId: string, topicId?: unknown): { run: CaseRun; events: EngineEvent[] } | { impossible: string } {
  const npc = def.npcs.find((n) => n.id === npcId);
  if (!npc || npc.cityId !== run.position.cityId) {
    return { impossible: 'NPC no accesible.' };
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

function inspectAction(def: CaseDefinition, run: CaseRun, action: Action) {
  const target = action.params.targetId;
  if (typeof target !== 'string') return { impossible: 'Objetivo no accesible.' };
  if (action.params.elementId !== undefined && typeof action.params.elementId !== 'string') return { impossible: 'Objetivo no accesible.' };
  if (isFixedCase(def) && target === 'MAD-SALA' && action.params.elementId !== undefined && !['cerradura', 'caja'].includes(String(action.params.elementId))) return { impossible: 'Objetivo no accesible.' };
  return typeof action.params.elementId === 'string'
    ? doInspectSpecific(def, run, target, action.params.elementId) : doInspect(def, run, target);
}

// ── Batch / Sequence ──────────────────────────────────────────────────────────

// ── Procesamiento de solicitudes programadas ──────────────────────────────────

function payloadString(request: ScheduledResult, field: string): string | undefined {
  if (typeof request.payload !== 'object' || request.payload === null || !Object.hasOwn(request.payload, field)) return undefined;
  const value = (request.payload as Record<string, unknown>)[field];
  return typeof value === 'string' ? value : undefined;
}

function matureAnalysis(run: CaseRun, request: ScheduledResult): CaseRun {
  const evidenceId = payloadString(request, 'evidenceId');
  if (!evidenceId || run.discoveries.includes(`analysis:${evidenceId}`)) return run;
  return { ...run, discoveries: [...run.discoveries, `analysis:${evidenceId}`] };
}

function maturedEvents(requests: ScheduledResult[], run: CaseRun): EngineEvent[] {
  return requests.map(request => makeEvent(request.dueMinute,
    run.discoveries.includes('warrant-denied:' + request.id) ? 'warrant_denied' : 'request_matured',
    { requestId: request.id, type: request.type }));
}

function queueEvidence(run: CaseRun, evidenceId: string, delay: number, method: 'analyze' | 'query'): ActionResult {
  if (pendingEvidence(run, evidenceId)) return { status: 'impossible', run, events: [], reason: 'Solicitud ya en curso.' };
  const id = `req-${run.version + 1}`;
  const dueMinute = run.minute + delay;
  if (!Number.isSafeInteger(dueMinute)) throw new EngineStateError('REQUEST_STATE_INVALID');
  const request: ScheduledResult = { id, dueMinute, type: 'fixed_evidence', payload: { evidenceId, method } };
  return { status: 'applied', run: appendRequest(run, request),
    events: [makeEvent(run.minute, 'request_submitted', { requestId: id })] };
}

function requestAnalysis(def: CaseDefinition, run: CaseRun, action: Action): ActionResult {
  const generic = generatedAnalysis(def, run, action.params.evidenceId);
  if (generic) return queueEvidence(run, generic.resultEvidenceId, generic.delayMinutes, 'analyze');
  if (!isFixedCase(def) || action.params.evidenceId !== 'EV-02' || !run.inventory.includes('EV-02')) {
    return { status: 'impossible', run, events: [], reason: 'Análisis no disponible.' };
  }
  if (run.discoveries.includes('EV-03')) return { status: 'impossible', run, events: [], reason: 'Análisis ya disponible.' };
  return queueEvidence(run, 'EV-03', 90, 'analyze');
}

function requestQuery(def: CaseDefinition, run: CaseRun, action: Action): ActionResult {
  const rule = queryRule(def, run, action.params.topicId) ?? generatedQueryRule(def, run, action.params.topicId);
  if (!rule) return { status: 'impossible', run, events: [], reason: 'Consulta no disponible.' };
  if (run.discoveries.includes(rule.evidenceId)) return { status: 'impossible', run, events: [], reason: 'Consulta ya disponible.' };
  return queueEvidence(run, rule.evidenceId, rule.delayMinutes, 'query');
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
    if (request.type === 'analyze') currentRun = matureAnalysis(currentRun, request);
    if (request.type === 'fixed_evidence') currentRun = isFixedCase(def)
      ? matureEvidence(def, currentRun, request)
      : matureGeneratedEvidence(def, currentRun, request);
    if (request.type === 'communicate') currentRun = matureCommunication(currentRun, request);
  }
  return { run: { ...currentRun, pendingRequests: remaining }, matured };
}

// ── Warrant ───────────────────────────────────────────────────────────────────

// ── resolveAction ─────────────────────────────────────────────────────────────

function resolveActionInternal(def: CaseDefinition, run: CaseRun, action: Action): ActionResult {
  if (!Object.hasOwn(handlers, action.type)) return { status: 'impossible', run, events: [], reason: 'Acción no disponible.' };
  return handlers[action.type](def, run, action);
}

function resolveInspection(def: CaseDefinition, run: CaseRun, action: Action): ActionResult {
  const res = inspectAction(def, run, action);
  if ('impossible' in res) return { status: 'impossible', run, events: [], reason: res.impossible };
  return { status: 'applied', run: res.run, events: res.events };
}

function resolveCollection(def: CaseDefinition, run: CaseRun, action: Action): ActionResult {
  const evidenceId = action.params.evidenceId;
  if (typeof evidenceId !== 'string') {
    return { status: 'impossible', run, events: [], reason: 'evidenceId inválido.' };
  }
  const res = doCollect(def, run, evidenceId);
  if ('impossible' in res) {
    return { status: 'impossible', run, events: [], reason: res.impossible };
  }
  return { status: 'applied', run: res.run, events: res.events };
}

function resolveTalk(def: CaseDefinition, run: CaseRun, action: Action): ActionResult {
  const npcId = action.params.npcId;
  if (typeof npcId !== 'string') {
    return { status: 'impossible', run, events: [], reason: 'npcId inválido.' };
  }
  const res = doTalk(def, run, npcId, action.params.topicId);
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

function previewTravel(def: CaseDefinition, run: CaseRun, action: Action): ActionResult {
  const toCityId = action.params.toCityId;
  if (typeof toCityId !== 'string') {
    return { status: 'impossible', run, events: [], reason: 'toCityId inválido.' };
  }
  const duration = def.travelDurations.find(
    (d) => d.fromCityId === run.position.cityId && d.toCityId === toCityId,
  );
  if (!duration) {
    return { status: 'impossible', run, events: [], reason: 'No hay ruta disponible.' };
  }
  nextTripCount(run);
  const baseCost = duration.minutes;
  const destination = def.cities.find(city => city.id === toCityId);
  const preview: ActionPreview = {
    actionType: 'travel',
    estimatedMinutes: baseCost,
    estimatedEndTime: run.minute + baseCost,
    description: `Viaje a ${destination?.name ?? toCityId}: ${baseCost} minutos estimados; puede haber retrasos.`,
  };
  return { status: 'confirmation_required', run, events: [], preview };
}

function executeBatchStep(def: CaseDefinition, run: CaseRun, action: Action, estimateOnly: boolean): ActionResult {
  if (action.type === 'travel') return confirmTravel(def, run, action, estimateOnly);
  if (action.type === 'finish') return finishCase(def, run);
  return applyMaterial(def, run, action);
}

function resolveBatch(def: CaseDefinition, run: CaseRun, action: Action, estimateOnly = false): ActionResult {
  return startBatch(run, action.params, (current, step) => executeBatchStep(def, current, step, estimateOnly));
}

function resolveBatchDecision(def: CaseDefinition, run: CaseRun, action: Action, estimateOnly = false): ActionResult {
  return decideBatch(run, action.params, (current, step) => executeBatchStep(def, current, step, estimateOnly));
}

function resolveWait(def: CaseDefinition, run: CaseRun, action: Action): ActionResult {
  const minutes = action.params.minutes;
  if (typeof minutes !== 'number' || !Number.isSafeInteger(minutes) || minutes < 1 || !Number.isSafeInteger(run.minute + minutes)) {
    return { status: 'impossible', run, events: [], reason: 'minutes inválido.' };
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
    const report = buildFinalReport(def, newRun, 'deadline');
    const closedRun: CaseRun = { ...newRun, status: 'closed', finalReport: report };
    return { status: 'case_closed', run: closedRun, events, report };
  }

  return { status: 'applied', run: newRun, events };
}

function resolveCommunication(def: CaseDefinition, run: CaseRun, action: Action): ActionResult {
  return submitCommunication(def, run, action.params);
}

function detentionAuthorized(run: CaseRun, suspect: { id: string; cityId: string; locationId: string }, params: Record<string, unknown>): boolean {
  const known = run.discoveries.includes('identity:' + suspect.id) && run.discoveries.includes('location:' + suspect.id);
  const present = run.position.cityId === suspect.cityId && run.position.locationId === suspect.locationId;
  const warrant = 'warrant:' + suspect.id;
  return known && present && params.warrantId === warrant && run.warrants.includes(warrant);
}

function applyDetention(run: CaseRun, suspectId: string): ActionResult {
  return { status: 'applied', run: { ...run, version: run.version + 1, detentions: [...run.detentions, suspectId] },
    events: [makeEvent(run.minute, 'detain', { suspectId })] };
}

function resolveDetention(def: CaseDefinition, run: CaseRun, action: Action): ActionResult {
  const refuse = (reason: string): ActionResult => ({ status: 'impossible', run, events: [], reason });
  const suspectId = typeof action.params.suspectId === 'string' ? action.params.suspectId : undefined;
  const suspect = suspectId === undefined ? undefined : (isFixedCase(def) ? fixedSuspect(suspectId) : generatedSuspect(def, suspectId));
  if (!suspect || action.params.mode !== 'interactive' || action.params.locationId !== suspect.locationId) return refuse('Intervención no disponible.');
  if (!detentionAuthorized(run, suspect, action.params)) return refuse('Intervención no disponible.');
  if (run.detentions.includes(suspect.id)) return refuse('Detención ya realizada.');
  return applyDetention(run, suspect.id);
}

interface RecoveryTarget { objectId: string; cityId: string; locationId: string; evidenceId: string; requiresAccessWarrant: boolean }

function recoveryTarget(def: CaseDefinition): RecoveryTarget | undefined {
  if (isFixedCase(def)) return { objectId: ORIGINAL_OBJECT, cityId: 'lisboa', locationId: 'LIS-ALM', evidenceId: 'EV-11', requiresAccessWarrant: true };
  const recovery = def.mechanics?.recovery;
  if (!recovery) return undefined;
  return { objectId: recovery.objectId, cityId: recovery.cityId, locationId: recovery.locationId, evidenceId: recovery.evidenceId, requiresAccessWarrant: recovery.requiresAccessWarrant };
}

function resolveRecovery(def: CaseDefinition, run: CaseRun, action: Action): ActionResult {
  const refuse = (reason: string): ActionResult => ({ status: 'impossible', run, events: [], reason });
  const irregular = run.discoveries.includes('forced-entry');
  const access = run.warrants.includes('warrant:access') || irregular;
  const target = recoveryTarget(def);
  if (!target || action.params.objectId !== target.objectId || run.position.cityId !== target.cityId ||
      run.position.locationId !== target.locationId || (target.requiresAccessWarrant && !access)) {
    return refuse('Recuperación no disponible.');
  }
  if (run.recoveredObjects.includes(target.objectId)) return refuse('Objeto ya recuperado.');
  const revealed = revealEvidence(def, run, target.evidenceId, run.minute, 'recover');
  return { status: 'applied', run: { ...revealed, version: run.version + 1, recoveredObjects: [...run.recoveredObjects, target.objectId],
    inventory: [...run.inventory, target.evidenceId], admissibility: { ...revealed.admissibility, [target.evidenceId]: !irregular } },
    events: [makeEvent(run.minute, 'recover', { objectId: target.objectId, irregular })] };
}

function finishParams(action: Action): boolean {
  return typeof action.params === 'object' && action.params !== null && !Array.isArray(action.params) && Object.keys(action.params).length === 0;
}
function resolveFinish(_def: CaseDefinition, run: CaseRun, action: Action): ActionResult {
  if (!finishParams(action)) return { status: 'impossible', run, events: [], reason: 'Parámetros de cierre inválidos.' };
  return { status: 'confirmation_required', run, events: [], preview: {
    actionType: 'finish', estimatedMinutes: 0, estimatedEndTime: run.minute, description: 'Confirmar cierre del caso.',
  }};
}
function finishCase(def: CaseDefinition, run: CaseRun): ActionResult {
  const report = buildFinalReport(def, run, 'finished');
  const newRun: CaseRun = {
    ...run,
    version: run.version + 1,
    status: 'closed',
    finalReport: report,
  };
  const events = [makeEvent(run.minute, 'finish', { result: report.result })];
  return { status: 'case_closed', run: newRun, events, report };
}

type Handler = (def: CaseDefinition, run: CaseRun, action: Action) => ActionResult;
const handlers: Readonly<Record<Action['type'], Handler>> = Object.freeze({
  inspect: resolveInspection, collect: resolveCollection, talk: resolveTalk, travel: previewTravel,
  analyze: requestAnalysis, query: requestQuery,
  request_warrant: (def, run, action) => requestWarrant(def, run, action.params),
  batch: resolveBatch, batch_decision: resolveBatchDecision, wait: resolveWait,
  communicate: resolveCommunication, detain: resolveDetention, recover: resolveRecovery, finish: resolveFinish,
});

// ── Confirmación de acciones con coste ─────────────────────────────────────────

function confirmActionInternal(def: CaseDefinition, run: CaseRun, action: Action): ActionResult {
  switch (action.type) {
    case 'finish': return finishParams(action) ? finishCase(def, run) : resolveFinish(def, run, action);
    case 'travel': return confirmTravel(def, run, action);
    case 'analyze': return requestAnalysis(def, run, action);
    case 'inspect':
    case 'detain':
    case 'recover': return applyMaterial(def, run, action);
    default: return resolveActionInternal(def, run, action);
  }
}

function travelPosition(def: CaseDefinition, run: CaseRun, toCityId: string, expired: boolean): CaseRun['position'] {
  if (expired) return { ...run.position };
  const destination = def.locations.find(location => location.cityId === toCityId && location.accessible);
  return { cityId: toCityId, locationId: destination?.id ?? '' };
}

function confirmTravel(def: CaseDefinition, run: CaseRun, action: Action, estimateOnly = false): ActionResult {
  const toCityId = action.params.toCityId;
  if (typeof toCityId !== 'string') {
    return { status: 'impossible', run, events: [], reason: 'toCityId inválido.' };
  }
  const duration = def.travelDurations.find(
    (d) => d.fromCityId === run.position.cityId && d.toCityId === toCityId,
  );
  if (!duration) {
    return { status: 'impossible', run, events: [], reason: 'No hay ruta disponible.' };
  }
  const confirmedTrips = nextTripCount(run);
  const baseCost = duration.minutes;
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
    const report = buildFinalReport(def, processedRun, 'deadline');
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
