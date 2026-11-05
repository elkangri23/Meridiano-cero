import type { CaseDefinition, CaseRun } from '@meridiano/case-schema';
import type { Action } from './types.js';
import { isFixedCase, fixedSuspect, ORIGINAL_OBJECT } from './fixed-case.js';
import { knowsEvidence, canCollect, queryRule, inspectedEvidence, listQueryIds, listInspectableElements } from './fixed-evidence.js';
import { canIssueWarrant, knownSuspect } from './warrants.js';

/**
 * Acciones que el jugador puede intentar desde el estado actual, calculadas
 * por el motor a partir de la definición y la partida. Solo datos públicos:
 * nombres de lugares y personajes, evidencias ya reveladas y solicitudes
 * disponibles. La UI las muestra como botones y las envía a interpret como
 * ofertas; el motor sigue siendo quien valida cada acción al confirmarla.
 * El orden es el de la escena (inspeccionar, recoger, hablar, consultar,
 * viajar…), no el de la solución.
 */
export interface ActionOffer {
  id: string;
  label: string;
  detail?: string;
  action: Action;
}

const evidenceTypeLabel: Record<string, string> = {
  object: 'objeto', observation: 'observación', testimony: 'testimonio', analysis: 'análisis', record: 'registro',
};
const elementLabel: Record<string, string> = { cerradura: 'la cerradura', caja: 'la caja' };
const queryLabel: Record<string, string> = {
  'herramienta-hv17': 'Consultar el registro de herramientas (HV-17)',
  'traslado-ines': 'Consultar el registro de traslados',
  'firma-sello': 'Consultar la firma del sello',
  'custodia-envio': 'Consultar la custodia del envío',
  'accesos-tomas': 'Consultar los accesos de Tomás',
};

function npcName(def: CaseDefinition, npcId: string): string {
  return def.npcs.find(npc => npc.id === npcId)?.name ?? npcId;
}

function warrantPending(run: CaseRun, suspectId: string): boolean {
  return run.pendingRequests.some(request => {
    if (request.type !== 'warrant' || typeof request.payload !== 'object' || request.payload === null) return false;
    return (request.payload as Record<string, unknown>).suspectId === suspectId;
  });
}

function detentionAvailable(def: CaseDefinition, run: CaseRun, suspectId: string): boolean {
  const suspect = fixedSuspect(suspectId);
  if (!suspect || !isFixedCase(def)) return false;
  // Espejo de detentionAuthorized (index.ts): conocido, presente, con orden y sin detener.
  const known = run.discoveries.includes('identity:' + suspect.id) && run.discoveries.includes('location:' + suspect.id);
  const present = run.position.cityId === suspect.cityId && run.position.locationId === suspect.locationId;
  return known && present && run.warrants.includes('warrant:' + suspect.id) && !run.detentions.includes(suspect.id);
}

function inspectOffers(def: CaseDefinition, run: CaseRun): ActionOffer[] {
  const location = def.locations.find(item => item.id === run.position.locationId);
  if (!location) return [];
  const offers: ActionOffer[] = [{ id: `inspect:${location.id}`, label: `Inspeccionar ${location.name}`,
    action: { type: 'inspect', params: { targetId: location.id } } }];
  if (!run.discoveries.includes(location.id)) return offers;
  for (const element of listInspectableElements(location.id)) {
    const evidenceId = inspectedEvidence(location.id, element);
    if (evidenceId && !knowsEvidence(run, evidenceId)) {
      offers.push({ id: `inspect:${location.id}:${element}`, label: `Inspeccionar ${elementLabel[element] ?? element}`,
        action: { type: 'inspect', params: { targetId: location.id, elementId: element } } });
    }
  }
  return offers;
}

function collectOffers(def: CaseDefinition, run: CaseRun): ActionOffer[] {
  return def.evidence
    .filter(evidence => canCollect(def, run, evidence.id) && !run.inventory.includes(evidence.id))
    .map((evidence): ActionOffer => ({ id: `collect:${evidence.id}`, label: `Recoger ${evidence.id} · ${evidenceTypeLabel[evidence.type] ?? evidence.type}`,
      action: { type: 'collect', params: { evidenceId: evidence.id } } }));
}

function talkOffers(def: CaseDefinition, run: CaseRun): ActionOffer[] {
  const offers: ActionOffer[] = [];
  for (const npc of def.npcs.filter(item => item.cityId === run.position.cityId)) {
    offers.push({ id: `talk:${npc.id}:identidad`, label: `Hablar con ${npc.name} sobre su identidad`,
      action: { type: 'talk', params: { npcId: npc.id, topicId: 'identidad' } } });
    if (npc.id === 'lucia' && npc.knowledge.includes('tomas-moved-box') &&
        (run.npcRelations.lucia ?? 0) > 0 && !knowsEvidence(run, 'EV-09')) {
      offers.push({ id: 'talk:lucia:caja', label: 'Preguntar a Lucía por la caja',
        action: { type: 'talk', params: { npcId: 'lucia', topicId: 'caja' } } });
    }
  }
  return offers;
}

function queryOffers(def: CaseDefinition, run: CaseRun): ActionOffer[] {
  return listQueryIds()
    .map(queryId => ({ queryId, rule: queryRule(def, run, queryId) }))
    .filter(entry => entry.rule && !run.discoveries.includes(entry.rule.evidenceId))
    .map((entry): ActionOffer => ({ id: `query:${entry.queryId}`, label: queryLabel[entry.queryId] ?? `Consultar ${entry.queryId}`,
      detail: 'La respuesta tarda 30 min', action: { type: 'query', params: { topicId: entry.queryId } } }));
}

function analyzeOffer(def: CaseDefinition, run: CaseRun): ActionOffer[] {
  if (!isFixedCase(def) || !run.inventory.includes('EV-02') || run.discoveries.includes('EV-03')) return [];
  return [{ id: 'analyze:EV-02', label: 'Analizar EV-02 en el laboratorio',
    detail: 'El resultado tarda 90 min', action: { type: 'analyze', params: { evidenceId: 'EV-02' } } }];
}

function travelOffers(def: CaseDefinition, run: CaseRun): ActionOffer[] {
  const offers: ActionOffer[] = [];
  for (const duration of def.travelDurations.filter(item => item.fromCityId === run.position.cityId)) {
    const destination = def.cities.find(city => city.id === duration.toCityId);
    if (!destination) continue;
    offers.push({ id: `travel:${destination.id}`, label: `Viajar a ${destination.name}`,
      detail: `${duration.minutes} min`, action: { type: 'travel', params: { toCityId: destination.id } } });
  }
  return offers;
}

function waitOffer(run: CaseRun): ActionOffer[] {
  return run.pendingRequests.length > 0
    ? [{ id: 'wait:30', label: 'Esperar 30 minutos', action: { type: 'wait', params: { minutes: 30 } } }]
    : [];
}

function warrantOffers(def: CaseDefinition, run: CaseRun): ActionOffer[] {
  const knownEvidenceIds = def.evidence.filter(item => knowsEvidence(run, item.id)).map(item => item.id);
  if (knownEvidenceIds.length === 0) return [];
  return ['ines', 'tomas']
    .map(suspectId => fixedSuspect(suspectId))
    .filter((suspect): suspect is NonNullable<typeof suspect> => suspect !== undefined &&
      knownSuspect(run, suspect.id) && !warrantPending(run, suspect.id) && canIssueWarrant(def, run, suspect.id))
    .map((suspect): ActionOffer => ({ id: `request_warrant:${suspect.id}`, label: `Solicitar orden contra ${npcName(def, suspect.id)}`,
      detail: 'Se resuelve en 30 min',
      action: { type: 'request_warrant', params: { suspectId: suspect.id, evidenceIds: knownEvidenceIds } } }));
}

function detainOffers(def: CaseDefinition, run: CaseRun): ActionOffer[] {
  return ['ines', 'tomas']
    .map(suspectId => fixedSuspect(suspectId))
    .filter((suspect): suspect is NonNullable<typeof suspect> => suspect !== undefined && detentionAvailable(def, run, suspect.id))
    .map((suspect): ActionOffer => ({ id: `detain:${suspect.id}`, label: `Detener a ${npcName(def, suspect.id)}`,
      action: { type: 'detain', params: { suspectId: suspect.id, warrantId: 'warrant:' + suspect.id, locationId: suspect.locationId, mode: 'interactive' } } }));
}

function recoverOffer(def: CaseDefinition, run: CaseRun): ActionOffer[] {
  const access = run.warrants.includes('warrant:access') || run.discoveries.includes('forced-entry');
  if (!isFixedCase(def) || run.position.cityId !== 'lisboa' || run.position.locationId !== 'LIS-ALM' ||
      !access || run.recoveredObjects.includes(ORIGINAL_OBJECT)) return [];
  return [{ id: 'recover:astrolabio-original', label: 'Recuperar el astrolabio original',
    action: { type: 'recover', params: { objectId: ORIGINAL_OBJECT } } }];
}

export function availableOffers(def: CaseDefinition, run: CaseRun): ActionOffer[] {
  if (run.status !== 'active') return [];
  return [
    ...inspectOffers(def, run),
    ...collectOffers(def, run),
    ...talkOffers(def, run),
    ...queryOffers(def, run),
    ...analyzeOffer(def, run),
    ...travelOffers(def, run),
    ...waitOffer(run),
    ...warrantOffers(def, run),
    ...detainOffers(def, run),
    ...recoverOffer(def, run),
    { id: 'finish', label: 'Cerrar el caso y presentar el informe', action: { type: 'finish', params: {} } },
  ];
}
