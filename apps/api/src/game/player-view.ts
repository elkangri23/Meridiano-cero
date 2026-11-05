// Proyección general de partida (Fase A): construye PlayerViewDto y eventos
// públicos a partir de la definición del caso y el estado del motor.
// No serializa nunca EngineEvent.payload ni CaseRun internos.
import type { CaseDefinition, CaseRun, FinalReport } from '@meridiano/case-schema';
import { isPublicBatchStep, type PlayerViewDto, type PublicEvent } from '@meridiano/contracts';
import { availableOffers, ENGINE_VERSION, type EngineEvent } from '@meridiano/engine';
import { RunStoreError, type StoredRun } from './runs.ts';

type FullRun = StoredRun & CaseRun;

export function publicFinalReport(run: CaseRun): FinalReport | null {
  if (run.status !== 'closed' || !run.finalReport) return null;
  return {
    result: run.finalReport.result,
    objectivesAchieved: [...run.finalReport.objectivesAchieved],
    reason: run.finalReport.reason,
    minute: run.finalReport.minute,
  };
}

type PublicBatchStep = NonNullable<PlayerViewDto['batch']>['steps'][number];

function parseBatchStep(item: unknown): PublicBatchStep | null {
  if (typeof item !== 'string') return null;
  let parsed: unknown;
  try { parsed = JSON.parse(item) as unknown; } catch { return null; }
  return isPublicBatchStep(parsed) ? parsed : null;
}

function batchSteps(raw: unknown): PlayerViewDto['batch'] {
  if (!Array.isArray(raw)) return null;
  const steps: PublicBatchStep[] = [];
  for (const item of raw) {
    const step = parseBatchStep(item);
    if (!step) return null;
    steps.push(step);
  }
  return { steps };
}

/** Vista completa de una partida v14. Para motores antiguos, usar initialPlayerView. */
export function playerViewDto(definition: CaseDefinition, run: FullRun, manualCount: number): PlayerViewDto {
  if (run.engineVersion !== ENGINE_VERSION) throw new RunStoreError('DEPENDENCY_UNAVAILABLE');
  const city = definition.cities.find(item => item.id === run.position.cityId);
  const location = definition.locations.find(item => item.id === run.position.locationId);
  if (!city || !location || location.cityId !== city.id) throw new RunStoreError('DEPENDENCY_UNAVAILABLE');

  const visibleCities = definition.explorationMode === 'guided'
    ? definition.cities
    : run.discoveries.includes('map') ? definition.cities : [city];
  const discoveredIds = new Set(run.discoveries);
  const locations = definition.locations
    .filter(item => item.id === location.id || discoveredIds.has(item.id))
    .map(item => ({ id: item.id, name: item.name, description: item.description }));
  const objects = run.inventory.flatMap(id => {
    const evidence = definition.evidence.find(item => item.id === id);
    if (!evidence) return [];
    const record = run.evidenceRecords?.[id];
    const admissible = Object.hasOwn(run.admissibility, id)
      ? (run.admissibility[id] ?? evidence.admissible)
      : evidence.admissible;
    return [{
      id,
      type: evidence.type,
      origin: record?.origin ?? evidence.origin,
      minute: record?.revealedMinute ?? evidence.minute,
      admissible,
    }];
  });

  return {
    schemaVersion: 1,
    runId: run.id,
    branchId: run.branchId,
    version: run.revision,
    status: run.status,
    caseId: run.definitionId,
    clock: { minute: run.minute, deadlineMinutes: definition.deadlineMinutes },
    position: {
      city: { id: city.id, name: city.name, country: city.country },
      location: { id: location.id, name: location.name, description: location.description },
    },
    cities: visibleCities.map(item => ({ id: item.id, name: item.name, country: item.country })),
    locations,
    objects,
    dossier: [...run.discoveries],
    conversation: [...run.conversationRecords],
    pendingRequests: run.pendingRequests.map(request => {
      const payload = (request.payload ?? {}) as Record<string, unknown>;
      const method = payload.method;
      return {
        id: request.id,
        type: method === 'analyze' ? 'analysis' as const : method === 'query' ? 'query' as const : 'request' as const,
        dueMinute: request.dueMinute,
      };
    }),
    warrants: [...run.warrants],
    detentions: [...run.detentions],
    batch: batchSteps(run.pendingBatch),
    finalReport: publicFinalReport(run),
    officialResult: null,
    offers: availableOffers(definition, run),
    saveCapabilities: {
      manualLimit: 10,
      manualCount,
      canSave: run.status === 'active' && manualCount < 10,
      canLoad: manualCount > 0,
    },
    recovery: { retryCreationWithSameKey: true, creationLookup: true, operationLookup: false },
  };
}

// ── Eventos públicos ────────────────────────────────────────────────────────────
// Resumen factual sin spoilers: solo nombres que el jugador ya conoce (ciudades,
// lugares, NPC y evidencias descubiertas) y magnitudes. El payload del motor no
// se serializa: contiene factIds, reglas internas y resultados no autorizados.
type EventPayload = Record<string, unknown>;
type EventNamer = (definition: CaseDefinition, payload: EventPayload) => string;
const eventSummaries: Record<string, EventNamer> = {
  inspect: (definition, payload) => {
    const target = payload.targetId;
    const location = definition.locations.find(item => item.id === target)?.name ?? String(target ?? '');
    return typeof payload.elementId === 'string'
      ? 'Inspección de ' + payload.elementId + ' en ' + location + '.'
      : 'Inspección en ' + location + '.';
  },
  collect: (_definition, payload) => 'Objeto ' + String(payload.evidenceId ?? '') + ' recogido.',
  talk: (definition, payload) => {
    const npc = definition.npcs.find(item => item.id === payload.npcId)?.name ?? String(payload.npcId ?? '');
    return 'Conversación con ' + npc + '.';
  },
  travel: (definition, payload) => {
    const city = definition.cities.find(item => item.id === payload.toCityId)?.name ?? String(payload.toCityId ?? '');
    return 'Viaje a ' + city + '.';
  },
  travel_interrupted: (definition, payload) => {
    const city = definition.cities.find(item => item.id === payload.toCityId)?.name ?? String(payload.toCityId ?? '');
    return 'Viaje a ' + city + ' interrumpido.';
  },
  wait: (_definition, payload) => 'Espera de ' + String(payload.minutes ?? '') + ' minutos.',
  action_interrupted: () => 'Acción interrumpida por el plazo.',
  request_submitted: () => 'Solicitud enviada; el resultado llegará a su hora.',
  request_matured: () => 'Una solicitud ha dado resultado.',
  warrant_denied: () => 'Una orden solicitada ha sido denegada.',
  detain: (definition, payload) => {
    const npc = definition.npcs.find(item => item.id === payload.suspectId)?.name ?? String(payload.suspectId ?? '');
    return 'Detención de ' + npc + '.';
  },
  recover: () => 'Objeto original recuperado.',
  finish: () => 'La investigación ha concluido.',
  batch_paused: () => 'Lote en pausa: un paso no se pudo aplicar.',
  batch_step_skipped: () => 'Paso de lote omitido por dependencia no aplicada.',
  batch_completed: () => 'Lote completado.',
  batch_cancelled: () => 'Lote cancelado.',
};

function eventSummary(definition: CaseDefinition, event: EngineEvent): string {
  const summarizer = eventSummaries[event.type];
  return summarizer ? summarizer(definition, event.payload as EventPayload) : 'La investigación avanza.';
}

export function projectEvents(definition: CaseDefinition, events: EngineEvent[]): PublicEvent[] {
  return events.map(event => ({
    id: 'evt-' + event.ordinal,
    sequence: event.ordinal,
    minute: event.minute,
    type: event.type,
    summary: eventSummary(definition, event),
  }));
}
