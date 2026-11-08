// Proyección general de partida (Fase A): construye PlayerViewDto y eventos
// públicos a partir de la definición del caso y el estado del motor.
// No serializa nunca EngineEvent.payload ni CaseRun internos.
import type { CaseDefinition, CaseRun, FinalReport, Language } from '@meridiano/case-schema';
import { caseText, evidenceText, isRemoteChannel, localizedCountryName, remoteChannelInSentence, teamMember, GEOGRAPHIC_CATALOG, getCity, touristInfoFor, visitCityId, visitLocationName } from '@meridiano/case-schema';
import { isPublicBatchStep, resolveMessage, type AtlasCityDto, type CommunicationRecordDto, type PlayerViewDto, type PublicEvent } from '@meridiano/contracts';
import { availableOffers, completeFinalReport, ENGINE_VERSION, liveObjectives, visibleCaseCityIds, type EngineEvent } from '@meridiano/engine';
import { RunStoreError, type StoredRun } from './runs.ts';
import { briefingForDefinition, metaForDefinition } from './catalog.ts';
import { npcChatForDefinition } from './npc-chat.ts';

type FullRun = StoredRun & CaseRun;

export function publicFinalReport(definition: CaseDefinition, run: CaseRun, timeline: PublicEvent[] = [], language: Language = 'es'): FinalReport | null {
  const report = completeFinalReport(definition, run, language);
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
export function atlasFor(definition: CaseDefinition, run: CaseRun, language: Language = 'es'): AtlasCityDto[] {
  const visible = new Set(visibleCaseCityIds(definition, run));
  const caseIds = new Set(definition.cities.map(city => city.id));
  return GEOGRAPHIC_CATALOG.map(city => {
    const defCity = definition.cities.find(item => item.id === city.id);
    const isCase = caseIds.has(city.id);
    return {
      id: city.id,
      name: defCity?.name ?? city.name,
      // El atlas enseña el nombre completo del país en todas sus ciudades:
      // el expediente usa códigos ISO ('FR') y mezclarlos con nombres
      // ('España') en la misma lista se leía mal. En el idioma del
      // jugador: el nombre localizado del país, no el código.
      country: localizedCountryName(city.country, language),
      kind: isCase ? 'case' as const : 'tourist' as const,
      discovered: isCase ? visible.has(city.id) : true,
    };
  });
}

/** Ciudad pública de la posición: del expediente si es del caso, del
 * catálogo si es una admitida fuera de él. El país es el nombre
 * localizado (no el código 'ES' del expediente): la lista de ciudades y
 * el atlas enseñan el mismo nombre, y el validador exige que la posición
 * coincida con una de las dos. */
function positionCity(definition: CaseDefinition, run: FullRun, language: Language = 'es'): PlayerViewDto['position']['city'] {
  const caseCity = definition.cities.find(item => item.id === run.position.cityId);
  const geoCity = caseCity ?? getCity(run.position.cityId);
  if (!geoCity) throw new RunStoreError('DEPENDENCY_UNAVAILABLE');
  return { id: geoCity.id, name: geoCity.name, country: localizedCountryName(geoCity.country, language) };
}

/** Nombre y descripción públicos de un lugar, en el idioma del jugador (la
 * traducción tiene prioridad; la definición española es el fallback). */
export function localizedLocation(definition: CaseDefinition, location: { id: string; name: string; description: string }, language: Language = 'es'): { id: string; name: string; description: string } {
  return { id: location.id, name: caseText(definition.id, 'location.' + location.id + '.name', language) ?? location.name, description: caseText(definition.id, 'location.' + location.id + '.description', language) ?? location.description };
}

/** Posición pública de la partida: ciudad y lugar. En una ciudad admitida
 * fuera del expediente el lugar es sintético (`visit:<ciudad>`) y se
 * proyecta con la información turística del catálogo; no es un escenario
 * investigable, así que no se busca en la definición. */
function publicPosition(definition: CaseDefinition, run: FullRun, language: Language = 'es'): PlayerViewDto['position'] {
  const city = positionCity(definition, run, language);
  const visitCity = visitCityId(run.position.locationId);
  if (visitCity) return visitPosition(run, city, visitCity, language);
  const location = definition.locations.find(item => item.id === run.position.locationId);
  if (!location || location.cityId !== city.id) throw new RunStoreError('DEPENDENCY_UNAVAILABLE');
  return { city, location: localizedLocation(definition, location, language) };
}

/** Posición en una ciudad turística visitada: lugar sintético con el nombre
 * de la visita y el resumen turístico, sin ofertas de investigación. */
function visitPosition(run: FullRun, city: PlayerViewDto['position']['city'], visitCity: string, language: Language): PlayerViewDto['position'] {
  const geo = getCity(visitCity);
  if (!geo || geo.id !== city.id) throw new RunStoreError('DEPENDENCY_UNAVAILABLE');
  const info = touristInfoFor(geo.id, language);
  return { city, location: { id: run.position.locationId, name: visitLocationName(geo, language), description: info?.summary ?? '' } };
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
export function playerViewDto(definition: CaseDefinition, run: FullRun, manualCount: number, timeline: PublicEvent[] = [], officialResult: PlayerViewDto['officialResult'] = null, language: Language = 'es'): PlayerViewDto {
  if (run.engineVersion !== ENGINE_VERSION) throw new RunStoreError('DEPENDENCY_UNAVAILABLE');
  const position = publicPosition(definition, run, language);

  const visibleCities = visibleCitiesFor(definition, run);
  // Objetivos en vivo (lote 2): la misma evaluación que el informe final,
  // pero en esta revisión. La descripción es la del expediente; el estado
  // sale de las detenciones y los objetos recuperados del motor.
  const achievedObjectives = new Set(liveObjectives(definition, run));
  const discoveredIds = new Set(run.discoveries);
  const locations = definition.locations
    .filter(item => item.id === position.location.id || discoveredIds.has(item.id))
    .map(item => localizedLocation(definition, item, language));
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
    // Ciudad inicial del expediente (la primera de su catálogo, la misma
    // que `createInitialRun` usa al crear la partida): el resumen al
    // retomar la siembra como visitada.
    initialCityId: definition.cities[0]?.id ?? '',
    cities: visibleCities.map(item => ({ id: item.id, name: item.name, country: localizedCountryName(item.country, language) })),
    atlas: atlasFor(definition, run, language),
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
    npcChat: npcChatForDefinition(definition, run, language),
    // Textos legibles de las evidencias del expediente, por id: sin ellos
    // la web traducía los hallazgos con el catálogo fijo y el dossier de
    // un expediente generado enseñaba los textos del astrolabio.
    evidenceTexts: Object.fromEntries(definition.evidence.flatMap(evidence => {
      const text = evidenceText(evidence.id, definition.texts, definition.id, language);
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
    finalReport: publicFinalReport(definition, run, timeline, language),
    officialResult,
    objectives: definition.objectives.map(objective => ({
      id: objective.id,
      description: caseText(definition.id, 'objective.' + objective.id, language) ?? objective.description,
      achieved: achievedObjectives.has(objective.id),
    })),
    offers: availableOffers(definition, run, language),
    briefing: briefingForDefinition(definition, language),
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
function irregularKindLabel(kind: string, language: Language): string {
  if (kind === 'force_entry') return resolveMessage(language, 'engine.event.irregularForce');
  if (kind === 'bribe') return resolveMessage(language, 'engine.event.irregularBribe');
  if (kind === 'impersonate') return resolveMessage(language, 'engine.event.irregularImpersonate');
  return resolveMessage(language, 'engine.event.irregularUnknown');
}

/** Objetivo del acto por su nombre conocido (personaje o lugar), sin IDs. */
function irregularTarget(definition: CaseDefinition, targetId: string, language: Language): string {
  return definition.npcs.find(item => item.id === targetId)?.name
    ?? caseText(definition.id, 'location.' + targetId + '.name', language)
    ?? definition.locations.find(item => item.id === targetId)?.name ?? targetId;
}

type EventPayload = Record<string, unknown>;
type EventNamer = (definition: CaseDefinition, payload: EventPayload, language: Language) => string;
const eventSummaries: Record<string, EventNamer> = {
  inspect: (definition, payload, language) => {
    const target = payload.targetId;
    const location = definition.locations.find(item => item.id === target)?.name ?? String(target ?? '');
    if (typeof payload.elementId === 'string') {
      const element = caseText(definition.id, 'inspect.' + String(target ?? '') + '.' + payload.elementId, language) ?? payload.elementId;
      return resolveMessage(language, 'engine.event.inspectElement', { element, location });
    }
    return resolveMessage(language, 'engine.event.inspect', { location });
  },
  collect: (definition, payload, language) => {
    // El hallazgo se narra con su texto, nunca con el ID crudo (antes:
    // «Objeto EV-01 recogido.»). Sin texto, se mantiene el resumen anterior.
    // Con los textos del expediente, un generado también narra su texto.
    const id = String(payload.evidenceId ?? '');
    const text = evidenceText(id, definition.texts, definition.id, language);
    return text ? resolveMessage(language, 'engine.event.collect', { text }) : resolveMessage(language, 'engine.event.collectFallback', { id });
  },
  talk: (definition, payload, language) => {
    const npc = definition.npcs.find(item => item.id === payload.npcId)?.name ?? String(payload.npcId ?? '');
    return resolveMessage(language, 'engine.event.talk', { name: npc });
  },
  communicate: (definition, payload, language) => {
    // El envío queda en la cronología con su destinatario y su canal; el
    // texto libre no se narra (T2) y el documento se nombra por su texto,
    // nunca por el ID crudo.
    const npc = definition.npcs.find(item => item.id === payload.recipientId)?.name ?? String(payload.recipientId ?? '');
    const channel = typeof payload.channel === 'string' && isRemoteChannel(payload.channel)
      ? remoteChannelInSentence(payload.channel, language) : '';
    const key = typeof payload.documentId === 'string'
      ? (channel ? 'engine.event.communicateDocumentChannel' : 'engine.event.communicateDocument')
      : (channel ? 'engine.event.communicateMessageChannel' : 'engine.event.communicateMessage');
    return resolveMessage(language, key, { name: npc, channel });
  },
  request_warrant: (definition, payload, language) => {
    // Antes no tenía resumen propio y caía en el genérico «La investigación
    // avanza.»: el jugador no sabía ni qué había pedido.
    const npc = definition.npcs.find(item => item.id === payload.suspectId)?.name ?? String(payload.suspectId ?? '');
    return resolveMessage(language, 'engine.event.warrantRequested', { name: npc });
  },
  request_matured: (_definition, payload, language) => payload.type === 'warrant'
    ? resolveMessage(language, 'engine.event.warrantGranted')
    : resolveMessage(language, 'engine.event.requestMatured'),
  travel: (definition, payload, language) => {
    const city = definition.cities.find(item => item.id === payload.toCityId)?.name
      ?? getCity(String(payload.toCityId ?? ''))?.name ?? String(payload.toCityId ?? '');
    return resolveMessage(language, 'engine.event.travel', { city });
  },
  travel_interrupted: (definition, payload, language) => {
    const city = definition.cities.find(item => item.id === payload.toCityId)?.name
      ?? getCity(String(payload.toCityId ?? ''))?.name ?? String(payload.toCityId ?? '');
    return resolveMessage(language, 'engine.event.travelInterrupted', { city });
  },
  wait: (_definition, payload, language) => resolveMessage(language, 'engine.event.wait', { minutes: String(payload.minutes ?? '') }),
  action_interrupted: (_definition, _payload, language) => resolveMessage(language, 'engine.event.actionInterrupted'),
  request_submitted: (_definition, _payload, language) => resolveMessage(language, 'engine.event.requestSubmitted'),
  warrant_denied: (_definition, _payload, language) => resolveMessage(language, 'engine.event.warrantDenied'),
  detain: (definition, payload, language) => {
    const npc = definition.npcs.find(item => item.id === payload.suspectId)?.name ?? String(payload.suspectId ?? '');
    // La automática la ejecutan las autoridades (GDD §12): el resumen lo
    // dice, para que el jugador entienda quién detuvo y por qué no viajó.
    return payload.mode === 'automatic'
      ? resolveMessage(language, 'engine.event.detainAutomatic', { name: npc })
      : resolveMessage(language, 'engine.event.detain', { name: npc });
  },
  irregular: (definition, payload, language) => {
    // El acto queda en la cronología con su tipo y su objetivo; si te
    // vieron, se dice (la advertencia está en el dossier). Sin spoilers:
    // solo nombres que el jugador ya conoce.
    const kindLabel = irregularKindLabel(String(payload.kind ?? ''), language);
    const target = irregularTarget(definition, String(payload.targetId ?? ''), language);
    const seen = Array.isArray(payload.seenBy) && payload.seenBy.length > 0;
    return resolveMessage(language, seen ? 'engine.event.irregularSeen' : 'engine.event.irregularUnseen', { label: kindLabel, target });
  },
  case_withdrawn: (_definition, _payload, language) => resolveMessage(language, 'engine.event.withdrawn'),
  team: (_definition, payload, language) => {
    // Petición al equipo (GDD §8): quién y qué servicio, sin el texto
    // libre de la pregunta (T2). Solo nombres que el jugador ya conoce.
    const member = teamMember(String(payload.memberId ?? ''));
    const name = member?.name ?? String(payload.memberId ?? '');
    const service = String(payload.serviceId ?? '');
    const serviceLabel = resolveMessage(language, 'engine.event.team.' + service);
    if (serviceLabel === 'engine.event.team.' + service) return resolveMessage(language, 'engine.event.teamBaseNoService', { name });
    return resolveMessage(language, 'engine.event.teamBase', { name, service: serviceLabel });
  },
  recover: (_definition, _payload, language) => resolveMessage(language, 'engine.event.recover'),
  finish: (_definition, _payload, language) => resolveMessage(language, 'engine.event.finish'),
  batch_paused: (_definition, _payload, language) => resolveMessage(language, 'engine.event.batchPaused'),
  batch_step_skipped: (_definition, _payload, language) => resolveMessage(language, 'engine.event.batchSkipped'),
  batch_completed: (_definition, _payload, language) => resolveMessage(language, 'engine.event.batchCompleted'),
  batch_cancelled: (_definition, _payload, language) => resolveMessage(language, 'engine.event.batchCancelled'),
};

function eventSummary(definition: CaseDefinition, event: EngineEvent, language: Language = 'es'): string {
  const summarizer = eventSummaries[event.type];
  return summarizer ? summarizer(definition, event.payload as EventPayload, language) : resolveMessage(language, 'engine.event.fallback');
}

export function projectEvents(definition: CaseDefinition, events: EngineEvent[], language: Language = 'es'): PublicEvent[] {
  return events.map(event => ({
    id: 'evt-' + event.ordinal,
    sequence: event.ordinal,
    minute: event.minute,
    type: event.type,
    summary: eventSummary(definition, event, language),
  }));
}
