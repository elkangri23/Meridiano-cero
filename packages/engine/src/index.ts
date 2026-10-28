import { createHash } from 'node:crypto';
import type {
  CaseDefinition,
  CaseRun,
  PlayerView,
  FinalReport,
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
  | 'finish';

export interface Action {
  type: ActionType;
  params: Record<string, unknown>;
}

export type ActionResult =
  | { status: 'applied'; run: CaseRun; events: EngineEvent[] }
  | { status: 'clarification_required'; run: CaseRun; events: EngineEvent[]; question: string }
  | { status: 'impossible'; run: CaseRun; events: EngineEvent[]; reason: string }
  | { status: 'confirmation_required'; run: CaseRun; events: EngineEvent[]; preview: ActionPreview }
  | { status: 'case_closed'; run: CaseRun; events: EngineEvent[]; report: FinalReport };

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

// ── resolveAction ─────────────────────────────────────────────────────────────

let eventOrdinal = 0;

function nextOrdinal(): number {
  return ++eventOrdinal;
}

function makeEvent(minute: number, type: string, payload: Record<string, unknown>): EngineEvent {
  return { ordinal: nextOrdinal(), minute, type, payload };
}

export function resolveAction(
  def: CaseDefinition,
  run: CaseRun,
  action: Action,
): ActionResult {
  if (run.status === 'closed') {
    return {
      status: 'impossible',
      run,
      events: [],
      reason: 'La partida ya está cerrada.',
    };
  }

  if (run.pendingBatch !== null) {
    return {
      status: 'impossible',
      run,
      events: [],
      reason: 'Hay un lote pendiente de decisión. Cancela o continúa primero.',
    };
  }

  switch (action.type) {
    case 'inspect': {
      const targetId = action.params.targetId;
      if (typeof targetId !== 'string') {
        return { status: 'impossible', run, events: [], reason: 'targetId inválido.' };
      }
      const location = def.locations.find((l) => l.id === targetId);
      if (!location || !location.accessible) {
        return { status: 'impossible', run, events: [], reason: 'Objetivo no accesible.' };
      }
      const newDiscoveries = run.discoveries.includes(targetId)
        ? run.discoveries
        : [...run.discoveries, targetId];
      const newRun: CaseRun = {
        ...run,
        version: run.version + 1,
        discoveries: newDiscoveries,
      };
      const events = [makeEvent(run.minute, 'inspect', { targetId })];
      return { status: 'applied', run: newRun, events };
    }

    case 'collect': {
      const evidenceId = action.params.evidenceId;
      if (typeof evidenceId !== 'string') {
        return { status: 'impossible', run, events: [], reason: 'evidenceId inválido.' };
      }
      const ev = def.evidence.find((e) => e.id === evidenceId);
      if (!ev) {
        return { status: 'impossible', run, events: [], reason: 'Evidencia no encontrada.' };
      }
      if (run.inventory.includes(evidenceId)) {
        return { status: 'impossible', run, events: [], reason: 'Ya recogida.' };
      }
      const newRun: CaseRun = {
        ...run,
        version: run.version + 1,
        inventory: [...run.inventory, evidenceId],
      };
      const events = [makeEvent(run.minute, 'collect', { evidenceId })];
      return { status: 'applied', run: newRun, events };
    }

    case 'talk': {
      const npcId = action.params.npcId;
      if (typeof npcId !== 'string') {
        return { status: 'impossible', run, events: [], reason: 'npcId inválido.' };
      }
      const npc = def.npcs.find((n) => n.id === npcId);
      if (!npc) {
        return { status: 'impossible', run, events: [], reason: 'NPC no encontrado.' };
      }
      const newRecords = [...run.conversationRecords, `talk:${npcId}@${run.minute}`];
      const newRun: CaseRun = {
        ...run,
        version: run.version + 1,
        conversationRecords: newRecords,
      };
      const events = [makeEvent(run.minute, 'talk', { npcId })];
      return { status: 'applied', run: newRun, events };
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
      const cost = duration.minutes;
      const preview: ActionPreview = {
        actionType: 'travel',
        estimatedMinutes: cost,
        estimatedEndTime: run.minute + cost,
        description: `Viaje a ${toCityId}: ${cost} minutos.`,
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
        // Simplificado: un detenido es incorrecto si no está en la solución
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
      const cost = duration.minutes;
      const newMinute = run.minute + cost;
      const newRun: CaseRun = {
        ...run,
        version: run.version + 1,
        minute: newMinute,
        position: { cityId: toCityId, locationId: run.position.locationId },
      };
      const events = [makeEvent(run.minute, 'travel', { toCityId, cost })];
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