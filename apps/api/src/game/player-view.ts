// Proyección general de partida (Fase A): construye PlayerViewDto y eventos
// públicos a partir de la definición del caso y el estado del motor.
// No serializa nunca EngineEvent.payload ni CaseRun internos.
import type { CaseDefinition, CaseRun, FinalReport } from '@meridiano/case-schema';
import { evidenceText, REMOTE_CHANNEL_LABELS, teamMember, GEOGRAPHIC_CATALOG, getCity, touristInfoFor, visitCityId, visitLocationName } from '@meridiano/case-schema';
import { isPublicBatchStep, type AtlasCityDto, type CommunicationRecordDto, type PlayerViewDto, type PublicEvent } from '@meridiano/contracts';
import { availableOffers, completeFinalReport, ENGINE_VERSION, liveObjectives, visibleCaseCityIds, type EngineEvent } from '@meridiano/engine';
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

/** Historial de la central: ausente en partidas anteriores a la central. */
function communicationsOf(run: FullRun): CommunicationRecordDto[] {
  return [...(run.communications ?? [])];
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

/** Evidencias en poder del jugador, con su tipo, procedencia, minuto y
 * admisibilidad: lo revelado por vía irregular figura como no admisible. */
function viewObjects(definition: CaseDefinition, run: FullRun): PlayerViewDto['objects'] {
  return run.inventory.flatMap(id => {
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
}

/** Ciudades que la vista enseña: en modo guiado todas; en libre, la
 * inicial, la actual y las descubiertas investigando o viajando (la regla
 * vive en el motor, `visibleCaseCityIds`, para que la vista y las ofertas
 * no discrepen). */
function visibleCitiesFor(definition: CaseDefinition, run: FullRun): CaseDefinition['cities'] {
  const visible = new Set(visibleCaseCityIds(definition, run));
  return definition.cities.filter(city => visible.has(city.id));
}

/** Atlas A.C.M.E. (GDD §5): todas las ciudades admitidas del catálogo de
 * geografía, con su tipo —escenario investigable del expediente o destino
 * turístico/cultural— y si el jugador ya las conoce. Los destinos
 * turísticos son información pública del atlas y siempre se listan; una
 * ciudad del expediente no descubierta en modo libre no se lista. */
export function atlasFor(definition: CaseDefinition, run: CaseRun): AtlasCityDto[] {
  const visible = new Set(visibleCaseCityIds(definition, run));
  const caseIds = new Set(definition.cities.map(city => city.id));
  return GEOGRAPHIC_CATALOG.map(city => {
    const defCity = definition.cities.find(item => item.id === city.id);
    const isCase = caseIds.has(city.id);
    return {
      id: city.id,
      name: defCity?.name ?? city.name,
      country: defCity?.country ?? city.countryName,
      kind: isCase ? 'case' as const : 'tourist' as const,
      discovered: isCase ? visible.has(city.id) : true,
    };
  });
}

/** Ciudad pública de la posición: del expediente si es del caso, del
 * catálogo si es una admitida fuera de él. El país es el del expediente
 * para una ciudad del caso y el nombre completo del catálogo para una
 * turística (el código 'ES' no coincide con el atlas y el validador
 * rechazaría la vista). */
function positionCity(definition: CaseDefinition, run: FullRun): PlayerViewDto['position']['city'] {
  const caseCity = definition.cities.find(item => item.id === run.position.cityId);
  const geoCity = caseCity ?? getCity(run.position.cityId);
  if (!geoCity) throw new RunStoreError('DEPENDENCY_UNAVAILABLE');
  const geo = getCity(geoCity.id);
  return { id: geoCity.id, name: geoCity.name, country: caseCity?.country ?? geo?.countryName ?? geoCity.country };
}

/** Posición pública de la partida: ciudad y lugar. En una ciudad admitida
 * fuera del expediente el lugar es sintético (`visit:<ciudad>`) y se
 * proyecta con la información turística del catálogo; no es un escenario
 * investigable, así que no se busca en la definición. */
function publicPosition(definition: CaseDefinition, run: FullRun): PlayerViewDto['position'] {
  const city = positionCity(definition, run);
  const visitCity = visitCityId(run.position.locationId);
  if (visitCity) {
    const geo = getCity(visitCity);
    if (!geo || geo.id !== city.id) throw new RunStoreError('DEPENDENCY_UNAVAILABLE');
    const info = touristInfoFor(geo.id);
    return { city, location: { id: run.position.locationId, name: visitLocationName(geo), description: info?.summary ?? '' } };
  }
  const location = definition.locations.find(item => item.id === run.position.locationId);
  if (!location || location.cityId !== city.id) throw new RunStoreError('DEPENDENCY_UNAVAILABLE');
  return { city, location: { id: location.id, name: location.name, description: location.description } };
}

/** Evidencias reveladas por un análisis del laboratorio, en orden de
 * revelación: el motor registra el método en `evidenceRecords`, así que
 * el laboratorio enseña el resultado sin re-derivar la regla y sin tocar
 * el dossier (que lleva el hallazgo como `EV-xx`). */
function analysisResultsOf(run: FullRun): string[] {
  return Object.entries(run.evidenceRecords ?? {})
    .filter(([, record]) => record.method === 'analyze')
    .sort(([, a], [, b]) => a.revealedMinute - b.revealedMinute)
    .map(([id]) => id);
}

/** Vista completa de una partida v14. Para motores antiguos, usar initialPlayerView.
 * `timeline` es la cronología de la rama actual (registros de operaciones);
 * solo se rellena en partidas cerradas, donde el informe final la enseña.
 * `officialResult` es el resultado oficial de este contenido para el
 * perfil (DEC-020): null si aún no hay cierre oficial; lo carga quien
 * llama desde `official_results`, porque la vista es síncrona. */
export function playerViewDto(definition: CaseDefinition, run: FullRun, manualCount: number, timeline: PublicEvent[] = [], officialResult: PlayerViewDto['officialResult'] = null): PlayerViewDto {
  if (run.engineVersion !== ENGINE_VERSION) throw new RunStoreError('DEPENDENCY_UNAVAILABLE');
  const position = publicPosition(definition, run);

  const visibleCities = visibleCitiesFor(definition, run);
  // Objetivos en vivo (lote 2): la misma evaluación que el informe final,
  // pero en esta revisión. La descripción es la del expediente; el estado
  // sale de las detenciones y los objetos recuperados del motor.
  const achievedObjectives = new Set(liveObjectives(definition, run));
  const discoveredIds = new Set(run.discoveries);
  const locations = definition.locations
    .filter(item => item.id === position.location.id || discoveredIds.has(item.id))
    .map(item => ({ id: item.id, name: item.name, description: item.description }));
  const objects = viewObjects(definition, run);

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
    // Modo de exploración elegido al crear (GDD §5): la web lo enseña en
    // la cabecera y el atlas se comporta según él.
    explorationMode: definition.explorationMode,
    clock: { minute: run.minute, deadlineMinutes: definition.deadlineMinutes },
    position,
    cities: visibleCities.map(item => ({ id: item.id, name: item.name, country: item.country })),
    atlas: atlasFor(definition, run),
    locations,
    objects,
    dossier: [...run.discoveries],
    conversation: [...run.conversationRecords],
    // Historial de la central (GDD §10): ausente en partidas anteriores a
    // la central; se enseña vacío hasta el primer envío.
    communications: communicationsOf(run),
    // Acciones irregulares (GDD §14): ausentes en partidas anteriores;
    // se enseñan vacías hasta el primer acto.
    misconduct: [...(run.misconduct ?? [])],
    // Peticiones al equipo A.C.M.E. (GDD §8): ausentes en partidas
    // anteriores al equipo; se enseñan vacías hasta la primera petición.
    team: [...(run.teamRequests ?? [])],
    // Datos de charla libre de cada personaje del expediente: sin ellos la
    // web solo conocía el catálogo fijo y un NPC generado llegaba al
    // director sin hechos ni persona.
    npcChat: npcChatForDefinition(definition, run),
    // Textos legibles de las evidencias del expediente, por id: sin ellos
    // la web traducía los hallazgos con el catálogo fijo y el dossier de
    // un expediente generado enseñaba los textos del astrolabio.
    evidenceTexts: Object.fromEntries(definition.evidence.flatMap(evidence => {
      const text = evidenceText(evidence.id, definition.texts);
      return text ? [[evidence.id, text]] : [];
    })),
    analysisResults: analysisResultsOf(run),
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
    officialResult,
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
/** Verbo del acto irregular en la cronología, según su tipo. */
function irregularKindLabel(kind: string): string {
  if (kind === 'force_entry') return 'Forzaste el acceso a';
  if (kind === 'bribe') return 'Sobornaste a';
  if (kind === 'impersonate') return 'Suplantaste a alguien hablando con';
  return 'Acción irregular contra';
}

/** Objetivo del acto por su nombre conocido (personaje o lugar), sin IDs. */
function irregularTarget(definition: CaseDefinition, targetId: string): string {
  return definition.npcs.find(item => item.id === targetId)?.name
    ?? definition.locations.find(item => item.id === targetId)?.name ?? targetId;
}

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
  communicate: (definition, payload) => {
    // El envío queda en la cronología con su destinatario y su canal; el
    // texto libre no se narra (T2) y el documento se nombra por su texto,
    // nunca por el ID crudo.
    const npc = definition.npcs.find(item => item.id === payload.recipientId)?.name ?? String(payload.recipientId ?? '');
    const channel = typeof payload.channel === 'string'
      ? (REMOTE_CHANNEL_LABELS as Record<string, string>)[payload.channel] ?? payload.channel
      : '';
    const what = typeof payload.documentId === 'string'
      ? 'Documento enviado a ' + npc
      : 'Mensaje enviado a ' + npc;
    return channel ? what + ' por ' + channel + '.' : what + '.';
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
    const city = definition.cities.find(item => item.id === payload.toCityId)?.name
      ?? getCity(String(payload.toCityId ?? ''))?.name ?? String(payload.toCityId ?? '');
    return 'Viaje a ' + city + '.';
  },
  travel_interrupted: (definition, payload) => {
    const city = definition.cities.find(item => item.id === payload.toCityId)?.name
      ?? getCity(String(payload.toCityId ?? ''))?.name ?? String(payload.toCityId ?? '');
    return 'Viaje a ' + city + ' interrumpido.';
  },
  wait: (_definition, payload) => 'Espera de ' + String(payload.minutes ?? '') + ' minutos.',
  action_interrupted: () => 'Acción interrumpida por el plazo.',
  request_submitted: () => 'Solicitud enviada; el resultado llegará a su hora.',
  warrant_denied: () => 'Una orden solicitada ha sido denegada.',
  detain: (definition, payload) => {
    const npc = definition.npcs.find(item => item.id === payload.suspectId)?.name ?? String(payload.suspectId ?? '');
    // La automática la ejecutan las autoridades (GDD §12): el resumen lo
    // dice, para que el jugador entienda quién detuvo y por qué no viajó.
    return payload.mode === 'automatic'
      ? `Las autoridades han detenido a ${npc} por orden de A.C.M.E.`
      : 'Detención de ' + npc + '.';
  },
  irregular: (definition, payload) => {
    // El acto queda en la cronología con su tipo y su objetivo; si te
    // vieron, se dice (la advertencia está en el dossier). Sin spoilers:
    // solo nombres que el jugador ya conoce.
    const kindLabel = irregularKindLabel(String(payload.kind ?? ''));
    const target = irregularTarget(definition, String(payload.targetId ?? ''));
    const seen = Array.isArray(payload.seenBy) && payload.seenBy.length > 0;
    return `${kindLabel} ${target}.` + (seen ? ' Te han visto.' : ' Nadie te ha visto.');
  },
  case_withdrawn: () => 'A.C.M.E. ha retirado el caso por tu conducta.',
  team: (_definition, payload) => {
    // Petición al equipo (GDD §8): quién y qué servicio, sin el texto
    // libre de la pregunta (T2). Solo nombres que el jugador ya conoce.
    const member = teamMember(String(payload.memberId ?? ''));
    const name = member?.name ?? String(payload.memberId ?? '');
    const service = String(payload.serviceId ?? '');
    const what: Record<string, string> = {
      briefing: 'sobre el encargo',
      evaluate: 'que evaluara tu carrera',
      explain: 'que te explicara un análisis',
      lookup: 'en inteligencia',
      routes: 'por las rutas de viaje',
      organize: 'que organizara el expediente',
    };
    return `Pediste ayuda a ${name}${what[service] ? ' ' + what[service] : ''}.`;
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
