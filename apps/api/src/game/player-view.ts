// Proyección general de partida (Fase A): construye PlayerViewDto y eventos
// públicos a partir de la definición del caso y el estado del motor.
// No serializa nunca EngineEvent.payload ni CaseRun internos.
import type { CaseDefinition, CaseRun, FinalReport } from '@meridiano/case-schema';
import { evidenceText } from '@meridiano/case-schema';
import { isPublicBatchStep, type PlayerViewDto, type PublicEvent } from '@meridiano/contracts';
import { availableOffers, completeFinalReport, ENGINE_VERSION, liveObjectives, type EngineEvent } from '@meridiano/engine';
import { RunStoreError, type StoredRun } from './runs.ts';
import { briefingForDefinition, metaForDefinition } from './catalog.ts';
import { npcChatForDefinition } from './npc-chat.ts';

type FullRun = StoredRun & CaseRun;

export function publicFinalReport(definition: CaseDefinition, run: CaseRun, timeline: PublicEvent[] = []): FinalReport | null {
  const report = completeFinalReport(definition, run);
  if (!report) return null;
  // La cronología no vive en el estado del motor: la API la reconstruye
  // desde los registros de operaciones al proyectar una partida cerrada.
  // La entrada del informe es FinalReportTimelineEntry (sin el id opaco
  // del evento público): si se colara el id, el validador del cliente
  // (isActionResponseDto) rechazaría la respuesta y la vista no se
  // actualizaría al cerrar.
  return { ...report, timeline: timeline.map(entry => ({ sequence: entry.sequence, minute: entry.minute, type: entry.type, summary: entry.summary })) };
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

/** Vista completa de una partida v14. Para motores antiguos, usar initialPlayerView.
 * `timeline` es la cronología de la rama actual (registros de operaciones);
 * solo se rellena en partidas cerradas, donde el informe final la enseña. */
export function playerViewDto(definition: CaseDefinition, run: FullRun, manualCount: number, timeline: PublicEvent[] = []): PlayerViewDto {
  if (run.engineVersion !== ENGINE_VERSION) throw new RunStoreError('DEPENDENCY_UNAVAILABLE');
  const city = definition.cities.find(item => item.id === run.position.cityId);
  const location = definition.locations.find(item => item.id === run.position.locationId);
  if (!city || !location || location.cityId !== city.id) throw new RunStoreError('DEPENDENCY_UNAVAILABLE');

  const visibleCities = definition.explorationMode === 'guided'
    ? definition.cities
    : run.discoveries.includes('map') ? definition.cities : [city];
  // Objetivos en vivo (lote 2): la misma evaluación que el informe final,
  // pero en esta revisión. La descripción es la del expediente; el estado
  // sale de las detenciones y los objetos recuperados del motor.
  const achievedObjectives = new Set(liveObjectives(definition, run));
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
    // Dificultad elegida al crear la partida: la cabecera la enseña junto
    // al reloj (antes no viajaba en la vista y la web no podía mostrarla).
    difficulty: run.difficulty,
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
    // Datos de charla libre de cada personaje del expediente: sin ellos la
    // web solo conocía el catálogo fijo y un NPC generado llegaba al
    // director sin hechos ni persona.
    npcChat: npcChatForDefinition(definition),
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
    finalReport: publicFinalReport(definition, run, timeline),
    officialResult: null,
    objectives: definition.objectives.map(objective => ({
      id: objective.id,
      description: objective.description,
      achieved: achievedObjectives.has(objective.id),
    })),
    offers: availableOffers(definition, run),
    briefing: briefingForDefinition(definition),
    caseMeta: metaForDefinition(definition),
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
  collect: (_definition, payload) => {
    // El hallazgo se narra con su texto, nunca con el ID crudo (antes:
    // «Objeto EV-01 recogido.»). Sin texto, se mantiene el resumen anterior.
    const id = String(payload.evidenceId ?? '');
    const text = evidenceText(id);
    return text ? 'Recogido: ' + text : 'Objeto ' + id + ' recogido.';
  },
  talk: (definition, payload) => {
    const npc = definition.npcs.find(item => item.id === payload.npcId)?.name ?? String(payload.npcId ?? '');
    return 'Conversación con ' + npc + '.';
  },
  request_warrant: (definition, payload) => {
    // Antes no tenía resumen propio y caía en el genérico «La investigación
    // avanza.»: el jugador no sabía ni qué había pedido.
    const npc = definition.npcs.find(item => item.id === payload.suspectId)?.name ?? String(payload.suspectId ?? '');
    return 'Solicitud de orden contra ' + npc + '.';
  },
  request_matured: (_definition, payload) => payload.type === 'warrant'
    ? 'Orden concedida.'
    : 'Una solicitud ha dado resultado.',
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
