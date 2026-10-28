import { createHash } from 'node:crypto';
import { advanceMinute, hasExpired, seededDelay } from './clock.js';
import type {
  CaseDefinition,
  CaseRun,
  PlayerView,
  FinalReport,
  ScheduledResult,
} from '@meridiano/case-schema';

// ── Acciones ──────────────────────────────────────────────────────────────────

export type ActionType =
  | 'inspect'
  | 'collect'
  | 'talk'
  | 'travel'
  | 'analyze'
  | 'communicate'
  | 'query'
  | 'wait'
  | 'request_warrant'
  | 'detain'
  | 'recover'
  | 'finish'
  | 'batch'
  | 'batch_decision';

export interface Action {
  type: ActionType;
  params: Record<string, unknown>;
}

export type ActionResult =
  | { status: 'applied'; run: CaseRun; events: EngineEvent[] }
  | { status: 'clarification_required'; run: CaseRun; events: EngineEvent[]; question: string }
  | { status: 'impossible'; run: CaseRun; events: EngineEvent[]; reason: string }
  | { status: 'confirmation_required'; run: CaseRun; events: EngineEvent[]; preview: ActionPreview }
  | { status: 'case_closed'; run: CaseRun; events: EngineEvent[]; report: FinalReport }
  | { status: 'batch_paused'; run: CaseRun; events: EngineEvent[]; pausedAt: number; reason: string };

export interface EngineEvent {
  ordinal: number;
  minute: number;
  type: string;
  payload: Record<string, unknown>;
}

export interface ActionPreview {
  actionType: ActionType;
  estimatedMinutes: number;
  estimatedEndTime: number;
  description: string;
}

export interface BatchStep {
  ordinal: number;
  action: Action;
  status: 'pending' | 'applied' | 'impossible' | 'skipped';
  reason?: string;
}

// ── Hash ──────────────────────────────────────────────────────────────────────

export function hashDefinition(def: CaseDefinition): string {
  const { validationReport: _vr, ...rest } = def;
  const canonical = JSON.stringify(rest, Object.keys(rest).sort());
  return createHash('sha256').update(canonical).digest('hex');
}

// ── Proyección ────────────────────────────────────────────────────────────────

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
    position: run.position,
    visibleCities,
    discoveredLocations,
    discoveredObjects,
    dossier: [...run.discoveries],
    conversation: [...run.conversationRecords],
    pendingRequests: [...run.pendingRequests],
    warrants: [...run.warrants],
    detentions: [...run.detentions],
    finalReport: run.finalReport,
  };
}

// ── Motor interno ─────────────────────────────────────────────────────────────

let eventOrdinal = 0;

function nextOrdinal(): number {
  return ++eventOrdinal;
}

function makeEvent(minute: number, type: string, payload: Record<string, unknown>): EngineEvent {
  return { ordinal: nextOrdinal(), minute, type, payload };
}

// ── Inspect ───────────────────────────────────────────────────────────────────

function doInspect(def: CaseDefinition, run: CaseRun, targetId: string): { run: CaseRun; events: EngineEvent[] } | { impossible: string } {
  const location = def.locations.find((l) => l.id === targetId);
  if (!location || !location.accessible) {
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
  return { run: newRun, events };
}

function doInspectSpecific(def: CaseDefinition, run: CaseRun, targetId: string, elementId: string): { run: CaseRun; events: EngineEvent[] } | { impossible: string } {
  const location = def.locations.find((l) => l.id === targetId);
  if (!location || !location.accessible) {
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
  return { run: newRun, events };
}

// ── Collect ───────────────────────────────────────────────────────────────────

function doCollect(def: CaseDefinition, run: CaseRun, evidenceId: string): { run: CaseRun; events: EngineEvent[] } | { impossible: string } {
  const ev = def.evidence.find((e) => e.id === evidenceId);
  if (!ev) {
    return { impossible: 'Evidencia no encontrada.' };
  }
  if (run.inventory.includes(evidenceId)) {
    return { impossible: 'Ya recogida.' };
  }
  const newAdmissibility = { ...run.admissibility, [evidenceId]: ev.admissible };
  const newRun: CaseRun = {
    ...run,
    version: run.version + 1,
    inventory: [...run.inventory, evidenceId],
    admissibility: newAdmissibility,
  };
  const events = [makeEvent(run.minute, 'collect', { evidenceId, type: ev.type, origin: ev.origin, minute: run.minute })];
  return { run: newRun, events };
}

// ── Talk ──────────────────────────────────────────────────────────────────────

function doTalk(def: CaseDefinition, run: CaseRun, npcId: string): { run: CaseRun; events: EngineEvent[] } | { impossible: string } {
  const npc = def.npcs.find((n) => n.id === npcId);
  if (!npc) {
    return { impossible: 'NPC no encontrado.' };
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
  const events = [makeEvent(run.minute, 'talk', { npcId, knowledge: npc.knowledge })];
  return { run: newRun, events };
}

// ── Batch / Sequence ──────────────────────────────────────────────────────────

function executeBatchStep(def: CaseDefinition, run: CaseRun, step: BatchStep): { run: CaseRun; events: EngineEvent[]; status: 'applied' | 'impossible'; reason?: string } {
  const action = step.action;
  switch (action.type) {
    case 'inspect': {
      const targetId = action.params.targetId;
      if (typeof targetId !== 'string') return { run, events: [], status: 'impossible', reason: 'targetId inválido.' };
      const res = doInspect(def, run, targetId);
      if ('impossible' in res) return { run, events: [], status: 'impossible', reason: res.impossible };
      return { run: res.run, events: res.events, status: 'applied' };
    }
    case 'collect': {
      const evidenceId = action.params.evidenceId;
      if (typeof evidenceId !== 'string') return { run, events: [], status: 'impossible', reason: 'evidenceId inválido.' };
      const res = doCollect(def, run, evidenceId);
      if ('impossible' in res) return { run, events: [], status: 'impossible', reason: res.impossible };
      return { run: res.run, events: res.events, status: 'applied' };
    }
    case 'talk': {
      const npcId = action.params.npcId;
      if (typeof npcId !== 'string') return { run, events: [], status: 'impossible', reason: 'npcId inválido.' };
      const res = doTalk(def, run, npcId);
      if ('impossible' in res) return { run, events: [], status: 'impossible', reason: res.impossible };
      return { run: res.run, events: res.events, status: 'applied' };
    }
    default:
      return { run, events: [], status: 'impossible', reason: `Acción no soportada en lote: ${action.type}` };
  }
}

// ── resolveAction ─────────────────────────────────────────────────────────────

export function resolveAction(
  def: CaseDefinition,
  run: CaseRun,
  action: Action,
): ActionResult {
  if (run.status === 'closed') {
    return { status: 'impossible', run, events: [], reason: 'La partida ya está cerrada.' };
  }

  if (run.pendingBatch !== null) {
    // Solo se permite batch_decision cuando hay lote pendiente
    if (action.type !== 'batch_decision') {
      return { status: 'impossible', run, events: [], reason: 'Hay un lote pendiente de decisión. Cancela o continúa primero.' };
    }
  }

  switch (action.type) {
    case 'inspect': {
      const targetId = action.params.targetId;
      if (typeof targetId !== 'string') {
        return { status: 'impossible', run, events: [], reason: 'targetId inválido.' };
      }
      const elementId = action.params.elementId;
      const res = typeof elementId === 'string'
        ? doInspectSpecific(def, run, targetId, elementId)
        : doInspect(def, run, targetId);
      if ('impossible' in res) {
        return { status: 'impossible', run, events: [], reason: res.impossible };
      }
      return { status: 'applied', run: res.run, events: res.events };
    }

    case 'collect': {
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

    case 'talk': {
      const npcId = action.params.npcId;
      if (typeof npcId !== 'string') {
        return { status: 'impossible', run, events: [], reason: 'npcId inválido.' };
      }
      const res = doTalk(def, run, npcId);
      if ('impossible' in res) {
        return { status: 'impossible', run, events: [], reason: res.impossible };
      }
      return { status: 'applied', run: res.run, events: res.events };
    }

    case 'travel': {
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
      const baseCost = duration.minutes;
      const tripIndex = run.discoveries.filter((d) => d.startsWith('travel:')).length;
      const delay = seededDelay(def.seed, tripIndex);
      const preview: ActionPreview = {
        actionType: 'travel',
        estimatedMinutes: baseCost,
        estimatedEndTime: run.minute + baseCost + delay,
        description: `Viaje a ${toCityId}: ${baseCost} minutos (retraso posible: ${delay > 0 ? delay + ' min' : 'ninguno'}).`,
      };
      return { status: 'confirmation_required', run, events: [], preview };
    }

    case 'analyze': {
      const evidenceId = action.params.evidenceId;
      if (typeof evidenceId !== 'string' || !run.inventory.includes(evidenceId)) {
        return { status: 'impossible', run, events: [], reason: 'Evidencia no en inventario.' };
      }
      const cost = 30;
      const preview: ActionPreview = {
        actionType: 'analyze',
        estimatedMinutes: cost,
        estimatedEndTime: run.minute + cost,
        description: `Análisis de ${evidenceId}: ${cost} minutos.`,
      };
      return { status: 'confirmation_required', run, events: [], preview };
    }

    case 'batch': {
      const steps = action.params.steps;
      if (!Array.isArray(steps) || steps.length === 0) {
        return { status: 'impossible', run, events: [], reason: 'El lote debe tener al menos un paso.' };
      }
      if (steps.length > 10) {
        return { status: 'impossible', run, events: [], reason: 'Máximo 10 pasos por lote.' };
      }

      const batchSteps: BatchStep[] = steps.map((s, i) => ({
        ordinal: i,
        action: s as Action,
        status: 'pending',
      }));

      // Ejecutar pasos secuencialmente
      let currentRun = run;
      const allEvents: EngineEvent[] = [];
      let pausedAt = -1;
      let pauseReason = '';

      for (let i = 0; i < batchSteps.length; i++) {
        const step = batchSteps[i];
        if (!step) continue;
        const result = executeBatchStep(def, currentRun, step);
        if (result.status === 'applied') {
          step.status = 'applied';
          currentRun = result.run;
          allEvents.push(...result.events);
        } else {
          step.status = 'impossible';
          step.reason = result.reason ?? '';
          // Pausar: persistir pasos ya aplicados y resto pendiente
          pausedAt = i;
          pauseReason = result.reason ?? 'Paso imposible.';
          break;
        }
      }

      if (pausedAt >= 0) {
        // Marcar resto como pendiente
        for (let i = pausedAt + 1; i < batchSteps.length; i++) {
          const step = batchSteps[i];
          if (step) step.status = 'pending';
        }
        const newRun: CaseRun = {
          ...currentRun,
          version: currentRun.version + 1,
          pendingBatch: batchSteps.map((s) => JSON.stringify(s)),
        };
        return {
          status: 'batch_paused',
          run: newRun,
          events: allEvents,
          pausedAt,
          reason: pauseReason,
        };
      }

      // Todos los pasos aplicados
      const newRun: CaseRun = {
        ...currentRun,
        version: currentRun.version + 1,
        pendingBatch: null,
      };
      return { status: 'applied', run: newRun, events: allEvents };
    }

    case 'batch_decision': {
      const decision = action.params.decision;
      if (decision !== 'cancel' && decision !== 'continue_independent') {
        return { status: 'impossible', run, events: [], reason: 'Decisión inválida.' };
      }

      if (!run.pendingBatch) {
        return { status: 'impossible', run, events: [], reason: 'No hay lote pendiente.' };
      }

      const batchSteps: BatchStep[] = run.pendingBatch.map((s) => JSON.parse(s) as BatchStep);

      if (decision === 'cancel') {
        // Cancelar resto pendiente
        const newRun: CaseRun = {
          ...run,
          version: run.version + 1,
          pendingBatch: null,
        };
        const events = [makeEvent(run.minute, 'batch_cancelled', { stepsCancelled: batchSteps.filter((s) => s.status === 'pending').length })];
        return { status: 'applied', run: newRun, events };
      }

      // continue_independent: ejecutar solo los pasos independientes viables
      let currentRun = run;
      const allEvents: EngineEvent[] = [];
      const pausedIndex = batchSteps.findIndex((s) => s.status === 'impossible');

      for (let i = pausedIndex + 1; i < batchSteps.length; i++) {
        const step = batchSteps[i];
        if (!step || step.status !== 'pending') continue;
        const result = executeBatchStep(def, currentRun, step);
        if (result.status === 'applied') {
          step.status = 'applied';
          currentRun = result.run;
          allEvents.push(...result.events);
        } else {
          step.status = 'impossible';
          step.reason = result.reason ?? '';
          // Si falla de nuevo, pausar de nuevo
          const newRun: CaseRun = {
            ...currentRun,
            version: currentRun.version + 1,
            pendingBatch: batchSteps.map((s) => JSON.stringify(s)),
          };
          return {
            status: 'batch_paused',
            run: newRun,
            events: allEvents,
            pausedAt: i,
            reason: result.reason ?? 'Paso imposible.',
          };
        }
      }

      // Todos los pasos independientes aplicados
      const newRun: CaseRun = {
        ...currentRun,
        version: currentRun.version + 1,
        pendingBatch: null,
      };
      return { status: 'applied', run: newRun, events: allEvents };
    }

    case 'wait': {
      const minutes = action.params.minutes;
      if (typeof minutes !== 'number' || !Number.isInteger(minutes) || minutes < 1) {
        return { status: 'impossible', run, events: [], reason: 'minutes inválido.' };
      }
      const newMinute = advanceMinute(run.minute, minutes, def.deadlineMinutes);
      const expired = hasExpired(newMinute, def.deadlineMinutes);

      // Madurar solicitudes pendientes cuyo dueMinute <= newMinute
      const matured = run.pendingRequests.filter((r) => r.dueMinute <= newMinute);
      const remaining = run.pendingRequests.filter((r) => r.dueMinute > newMinute);

      const newRun: CaseRun = {
        ...run,
        version: run.version + 1,
        minute: newMinute,
        pendingRequests: remaining,
      };
      const events = [makeEvent(run.minute, 'wait', { minutes, matured: matured.length })];

      if (expired) {
        const report: FinalReport = {
          result: def.objectives.some((o) => o.achieved) ? 'partial' : 'unresolved',
          objectivesAchieved: def.objectives.filter((o) => o.achieved).map((o) => o.id),
          reason: 'deadline',
          minute: newMinute,
        };
        const closedRun: CaseRun = { ...newRun, status: 'closed', finalReport: report };
        return { status: 'case_closed', run: closedRun, events, report };
      }

      return { status: 'applied', run: newRun, events };
    }

    case 'communicate': {
      const channel = action.params.channel;
      const recipient = action.params.recipient;
      const content = action.params.content;
      if (typeof channel !== 'string' || typeof recipient !== 'string') {
        return { status: 'impossible', run, events: [], reason: 'channel/recipient inválidos.' };
      }
      const requestId = `req-${nextOrdinal()}`;
      const newRequest: ScheduledResult = {
        id: requestId,
        dueMinute: run.minute + 30,
        type: 'communicate',
        payload: { channel, recipient, content },
      };
      const newRun: CaseRun = {
        ...run,
        version: run.version + 1,
        pendingRequests: [...run.pendingRequests, newRequest],
      };
      const events = [makeEvent(run.minute, 'communicate', { requestId, channel, recipient })];
      return { status: 'applied', run: newRun, events };
    }

    case 'query': {
      const topic = action.params.topic;
      if (typeof topic !== 'string') {
        return { status: 'impossible', run, events: [], reason: 'topic inválido.' };
      }
      const requestId = `req-${nextOrdinal()}`;
      const newRequest: ScheduledResult = {
        id: requestId,
        dueMinute: run.minute + 30,
        type: 'query',
        payload: { topic },
      };
      const newRun: CaseRun = {
        ...run,
        version: run.version + 1,
        pendingRequests: [...run.pendingRequests, newRequest],
      };
      const events = [makeEvent(run.minute, 'query', { requestId, topic })];
      return { status: 'applied', run: newRun, events };
    }

    case 'finish': {
      if (action.params.confirmed !== true) {
        return { status: 'confirmation_required', run, events: [], preview: {
          actionType: 'finish',
          estimatedMinutes: 0,
          estimatedEndTime: run.minute,
          description: 'Confirmar cierre del caso.',
        }};
      }
      const allObjectivesAchieved = def.objectives.every((o) => o.achieved);
      const hasWrongDetention = run.detentions.some((d) => {
        return !def.solution.includes(d);
      });
      let result: FinalReport['result'];
      if (hasWrongDetention) {
        result = 'incorrect';
      } else if (allObjectivesAchieved) {
        result = 'complete';
      } else if (def.objectives.some((o) => o.achieved)) {
        result = 'partial';
      } else {
        result = 'unresolved';
      }
      const report: FinalReport = {
        result,
        objectivesAchieved: def.objectives.filter((o) => o.achieved).map((o) => o.id),
        reason: 'finished',
        minute: run.minute,
      };
      const newRun: CaseRun = {
        ...run,
        version: run.version + 1,
        status: 'closed',
        finalReport: report,
      };
      const events = [makeEvent(run.minute, 'finish', { result })];
      return { status: 'case_closed', run: newRun, events, report };
    }

    default:
      return {
        status: 'impossible',
        run,
        events: [],
        reason: `Acción desconocida: ${action.type}`,
      };
  }
}

// ── Confirmación de acciones con coste ─────────────────────────────────────────

export function confirmAction(
  def: CaseDefinition,
  run: CaseRun,
  action: Action,
): ActionResult {
  switch (action.type) {
    case 'travel': {
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
      const baseCost = duration.minutes;
      const tripIndex = run.discoveries.filter((d) => d.startsWith('travel:')).length;
      const delay = seededDelay(def.seed, tripIndex);
      const totalCost = baseCost + delay;
      const newMinute = advanceMinute(run.minute, totalCost, def.deadlineMinutes);
      const expired = hasExpired(newMinute, def.deadlineMinutes);

      const newDiscoveries = run.discoveries.includes(`travel:${toCityId}`)
        ? run.discoveries
        : [...run.discoveries, `travel:${toCityId}`];

      const newRun: CaseRun = {
        ...run,
        version: run.version + 1,
        minute: newMinute,
        position: { cityId: toCityId, locationId: run.position.locationId },
        discoveries: newDiscoveries,
      };
      const events = [makeEvent(run.minute, 'travel', { toCityId, baseCost, delay, totalCost })];

      if (expired) {
        // Vencimiento: cerrar por plazo
        const report: FinalReport = {
          result: def.objectives.some((o) => o.achieved) ? 'partial' : 'unresolved',
          objectivesAchieved: def.objectives.filter((o) => o.achieved).map((o) => o.id),
          reason: 'deadline',
          minute: newMinute,
        };
        const closedRun: CaseRun = {
          ...newRun,
          status: 'closed',
          finalReport: report,
        };
        return { status: 'case_closed', run: closedRun, events, report };
      }

      return { status: 'applied', run: newRun, events };
    }

    case 'analyze': {
      const evidenceId = action.params.evidenceId;
      if (typeof evidenceId !== 'string' || !run.inventory.includes(evidenceId)) {
        return { status: 'impossible', run, events: [], reason: 'Evidencia no en inventario.' };
      }
      const cost = 30;
      const newMinute = run.minute + cost;
      const newRun: CaseRun = {
        ...run,
        version: run.version + 1,
        minute: newMinute,
      };
      const events = [makeEvent(run.minute, 'analyze', { evidenceId, cost })];
      return { status: 'applied', run: newRun, events };
    }

    default:
      return resolveAction(def, run, action);
  }
}

// ── Helpers para el motor ─────────────────────────────────────────────────────

export function createInitialRun(
  def: CaseDefinition,
  ownerId: string,
  runId: string,
): CaseRun {
  return {
    id: runId,
    ownerId,
    definitionId: def.id,
    definitionHash: hashDefinition(def),
    engineVersion: def.engineCompatibility,
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