import type { CaseDefinition, CaseRun } from '@meridiano/case-schema';
import type { Action } from './types.js';
import { isFixedCase, fixedSuspect, ORIGINAL_OBJECT } from './fixed-case.js';
import { knowsEvidence, canCollect, queryRule, inspectedEvidence, listQueryIds, listInspectableElements } from './fixed-evidence.js';
import { canIssueWarrant, knownSuspect } from './warrants.js';
import { generatedAnalysis, generatedDetentionAvailable, generatedInspectLabel, generatedQueryRule, isGeneratedCase, listGeneratedInspectableElements } from './generated-mechanics.js';

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
  if (!isFixedCase(def)) return generatedDetentionAvailable(def, run, suspectId);
  const suspect = fixedSuspect(suspectId);
  if (!suspect || !isFixedCase(def)) return false;
  // Espejo de detentionAuthorized (index.ts): conocido, presente, con orden y sin detener.
  const known = run.discoveries.includes('identity:' + suspect.id) && run.discoveries.includes('location:' + suspect.id);
  const present = run.position.cityId === suspect.cityId && run.position.locationId === suspect.locationId;
  return known && present && run.warrants.includes('warrant:' + suspect.id) && !run.detentions.includes(suspect.id);
}

function inspectElementOffers(def: CaseDefinition, run: CaseRun, locationId: string): ActionOffer[] {
  const offers: ActionOffer[] = [];
  for (const element of [...listInspectableElements(locationId), ...listGeneratedInspectableElements(def, locationId)]) {
    const evidenceId = inspectedEvidence(locationId, element) ?? def.mechanics?.inspectables.find(entry => entry.locationId === locationId && entry.elementId === element)?.evidenceId;
    if (!evidenceId || knowsEvidence(run, evidenceId)) continue;
    offers.push({ id: `inspect:${locationId}:${element}`, label: `Inspeccionar ${generatedInspectLabel(def, locationId, element) ?? elementLabel[element] ?? element}`,
      action: { type: 'inspect', params: { targetId: locationId, elementId: element } } });
  }
  return offers;
}

function inspectOffers(def: CaseDefinition, run: CaseRun): ActionOffer[] {
  const location = def.locations.find(item => item.id === run.position.locationId);
  if (!location) return [];
  const offers: ActionOffer[] = [{ id: `inspect:${location.id}`, label: `Inspeccionar ${location.name}`,
    action: { type: 'inspect', params: { targetId: location.id } } }];
  if (!run.discoveries.includes(location.id)) return offers;
  return [...offers, ...inspectElementOffers(def, run, location.id)];
}

function collectOffers(def: CaseDefinition, run: CaseRun): ActionOffer[] {
  return def.evidence
    .filter(evidence => canCollect(def, run, evidence.id) && !run.inventory.includes(evidence.id))
    .map((evidence): ActionOffer => ({ id: `collect:${evidence.id}`, label: `Recoger ${evidence.id} · ${evidenceTypeLabel[evidence.type] ?? evidence.type}`,
      action: { type: 'collect', params: { evidenceId: evidence.id } } }));
}

function luciaBoxOffer(run: CaseRun, npc: CaseDefinition['npcs'][number]): ActionOffer | null {
  if (npc.id !== 'lucia' || !npc.knowledge.includes('tomas-moved-box') ||
      (run.npcRelations.lucia ?? 0) <= 0 || knowsEvidence(run, 'EV-09')) return null;
  return { id: 'talk:lucia:caja', label: 'Preguntar a Lucía por la caja',
    action: { type: 'talk', params: { npcId: 'lucia', topicId: 'caja' } } };
}

function generatedTalkOffers(def: CaseDefinition, run: CaseRun, npc: CaseDefinition['npcs'][number]): ActionOffer[] {
  const offers: ActionOffer[] = [];
  for (const entry of def.mechanics?.talkEvidence.filter(item => item.npcId === npc.id) ?? []) {
    if (knowsEvidence(run, entry.evidenceId)) continue;
    if (entry.requiresRelation && (run.npcRelations[npc.id] ?? 0) <= 0) continue;
    offers.push({ id: `talk:${npc.id}:${entry.topicId}`, label: entry.label,
      action: { type: 'talk', params: { npcId: npc.id, topicId: entry.topicId } } });
  }
  return offers;
}

function talkOffers(def: CaseDefinition, run: CaseRun): ActionOffer[] {
  const offers: ActionOffer[] = [];
  for (const npc of def.npcs.filter(item => item.cityId === run.position.cityId)) {
    offers.push({ id: `talk:${npc.id}:identidad`, label: `Hablar con ${npc.name} sobre su identidad`,
      action: { type: 'talk', params: { npcId: npc.id, topicId: 'identidad' } } });
    const lucia = luciaBoxOffer(run, npc);
    if (lucia) offers.push(lucia);
    // Expedientes generados (T4-08): temas declarados en la mecánica.
    offers.push(...generatedTalkOffers(def, run, npc));
  }
  return offers;
}

function queryOffers(def: CaseDefinition, run: CaseRun): ActionOffer[] {
  if (isGeneratedCase(def)) {
    return (def.mechanics?.queries ?? [])
      .map(query => ({ query, rule: generatedQueryRule(def, run, query.id) }))
      .filter(entry => entry.rule && !run.discoveries.includes(entry.rule.evidenceId))
      .map((entry): ActionOffer => ({ id: `query:${entry.query.id}`, label: entry.query.label,
        detail: `La respuesta tarda ${entry.query.delayMinutes} min`, action: { type: 'query', params: { topicId: entry.query.id } } }));
  }
  return listQueryIds()
    .map(queryId => ({ queryId, rule: queryRule(def, run, queryId) }))
    .filter(entry => entry.rule && !run.discoveries.includes(entry.rule.evidenceId))
    .map((entry): ActionOffer => ({ id: `query:${entry.queryId}`, label: queryLabel[entry.queryId] ?? `Consultar ${entry.queryId}`,
      detail: 'La respuesta tarda 30 min', action: { type: 'query', params: { topicId: entry.queryId } } }));
}

function analyzeOffer(def: CaseDefinition, run: CaseRun): ActionOffer[] {
  if (isGeneratedCase(def)) {
    return (def.mechanics?.analyses ?? [])
      .filter(rule => generatedAnalysis(def, run, rule.inputEvidenceId))
      .map((rule): ActionOffer => ({ id: `analyze:${rule.inputEvidenceId}`, label: `Analizar ${rule.inputEvidenceId} en el laboratorio`,
        detail: `El resultado tarda ${rule.delayMinutes} min`, action: { type: 'analyze', params: { evidenceId: rule.inputEvidenceId } } }));
  }
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

/** Sospechosos con oferta de orden/detención: los del caso fijo o los
 * declarados en la mecánica de un expediente generado. */
function suspectIds(def: CaseDefinition): string[] {
  return isGeneratedCase(def)
    ? (def.mechanics?.suspects.map(suspect => suspect.id) ?? [])
    : ['ines', 'tomas'];
}

function warrantOffers(def: CaseDefinition, run: CaseRun): ActionOffer[] {
  const knownEvidenceIds = def.evidence.filter(item => knowsEvidence(run, item.id)).map(item => item.id);
  if (knownEvidenceIds.length === 0) return [];
  return suspectIds(def)
    .filter(suspectId => knownSuspect(def, run, suspectId) && !warrantPending(run, suspectId) && canIssueWarrant(def, run, suspectId))
    .map((suspectId): ActionOffer => ({ id: `request_warrant:${suspectId}`, label: `Solicitar orden contra ${npcName(def, suspectId)}`,
      detail: 'Se resuelve en 30 min',
      action: { type: 'request_warrant', params: { suspectId, evidenceIds: knownEvidenceIds } } }));
}

function detainOffers(def: CaseDefinition, run: CaseRun): ActionOffer[] {
  return suspectIds(def)
    .filter(suspectId => detentionAvailable(def, run, suspectId))
    .map((suspectId): ActionOffer => ({ id: `detain:${suspectId}`, label: `Detener a ${npcName(def, suspectId)}`,
      action: { type: 'detain', params: { suspectId, warrantId: 'warrant:' + suspectId, locationId: def.mechanics?.suspects.find(suspect => suspect.id === suspectId)?.locationId ?? fixedSuspect(suspectId)?.locationId ?? '', mode: 'interactive' } } }));
}

function generatedRecoverOffer(def: CaseDefinition, run: CaseRun, access: boolean): ActionOffer[] {
  const recovery = def.mechanics?.recovery;
  if (!recovery || run.position.cityId !== recovery.cityId || run.position.locationId !== recovery.locationId ||
      (recovery.requiresAccessWarrant && !access) || run.recoveredObjects.includes(recovery.objectId)) return [];
  return [{ id: `recover:${recovery.objectId}`, label: recovery.label,
    action: { type: 'recover', params: { objectId: recovery.objectId } } }];
}

function recoverOffer(def: CaseDefinition, run: CaseRun): ActionOffer[] {
  const access = run.warrants.includes('warrant:access') || run.discoveries.includes('forced-entry');
  if (isGeneratedCase(def)) return generatedRecoverOffer(def, run, access);
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
