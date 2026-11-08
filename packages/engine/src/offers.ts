import type { CaseDefinition, CaseRun, NPC } from '@meridiano/case-schema';
import { ARREST_COORDINATION_MINUTES, arrestTypeOf, FORENSIC_TYPE_KEYS, resolveMessage, evidenceText, forensicTypeForAnalysis, DEFAULT_TRAVEL_ROUTES, getCity } from '@meridiano/case-schema';
import type { Action } from './types.js';
import { isFixedCase, fixedSuspect, ORIGINAL_OBJECT } from './fixed-case.js';
import { knowsEvidence, canCollect, queryRule, inspectedEvidence, listQueryIds, listInspectableElements, FIXED_ANALYSIS_RULE } from './fixed-evidence.js';
import { canIssueWarrant, knownSuspect } from './warrants.js';
import { irregularPlan, hasUnrevealedTalkFacts } from './irregular.js';
import { detentionPlan } from './arrest.js';
import { visibleCaseCityIds } from './discovery.js';
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
  /** Tipo forense del laboratorio, solo en ofertas de análisis (GDD §11). */
  forensicType?: string;
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

/** Espejo de `detentionPlan` (arrest.ts): conocido, con orden y sin
 * detener; presencia exacta solo en el modo interactivo. La automática
 * se coordina desde cualquier ciudad, con la orden válida y la ubicación
 * conocida. */
function detentionAvailable(def: CaseDefinition, run: CaseRun, suspectId: string): boolean {
  if (!isFixedCase(def)) return generatedDetentionAvailable(def, run, suspectId);
  return detentionPlan(def, run, suspectId, arrestTypeOf(def)).ok;
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
    // La etiqueta nombra la evidencia por su texto legible, nunca por su
    // ID crudo (`EV-06`): el texto viene del expediente (generado) o del
    // catálogo fijo; sin texto se mantiene el ID para no ocultar la oferta.
    .map((evidence): ActionOffer => ({ id: `collect:${evidence.id}`, label: `Recoger ${evidenceText(evidence.id, def.texts) ?? evidence.id} · ${evidenceTypeLabel[evidence.type] ?? evidence.type}`,
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
  // Un detenido ya no está en la escena: sin este filtro, Inés seguía
  // listada como presente en Lisboa tras ser detenida en París.
  for (const npc of def.npcs.filter(item => item.cityId === run.position.cityId && !run.detentions.includes(item.id))) {
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
      .map((rule): ActionOffer => {
        const type = forensicTypeForAnalysis(def, rule);
        return { id: `analyze:${rule.inputEvidenceId}`, label: `Análisis de ${resolveMessage('es', FORENSIC_TYPE_KEYS[type]).toLowerCase()} — ${evidenceText(rule.inputEvidenceId, def.texts) ?? rule.inputEvidenceId}`,
          detail: `El resultado tarda ${rule.delayMinutes} min`, forensicType: type,
          action: { type: 'analyze', params: { evidenceId: rule.inputEvidenceId } } };
      });
  }
  if (!isFixedCase(def) || !run.inventory.includes(FIXED_ANALYSIS_RULE.inputEvidenceId)
    || run.discoveries.includes(FIXED_ANALYSIS_RULE.resultEvidenceId)) return [];
  const type = forensicTypeForAnalysis(def, FIXED_ANALYSIS_RULE);
  return [{ id: `analyze:${FIXED_ANALYSIS_RULE.inputEvidenceId}`, label: `Análisis de ${resolveMessage('es', FORENSIC_TYPE_KEYS[type]).toLowerCase()} — ${evidenceText(FIXED_ANALYSIS_RULE.inputEvidenceId, def.texts) ?? FIXED_ANALYSIS_RULE.inputEvidenceId}`,
    detail: `El resultado tarda ${FIXED_ANALYSIS_RULE.delayMinutes} min`, forensicType: type,
    action: { type: 'analyze', params: { evidenceId: FIXED_ANALYSIS_RULE.inputEvidenceId } } }];
}

/** Ofertas de viaje (GDD §5, REQ-G05-01/02): las rutas del expediente
 * para sus ciudades y las del catálogo de geografía para las admitidas
 * fuera del expediente. En modo libre, una ciudad del expediente no
 * descubierta no se ofrece en la escena —se descubre investigando—; los
 * destinos turísticos del catálogo son información pública del atlas y se
 * ofrecen siempre. La ruta del expediente manda cuando existe. */
function travelOffers(def: CaseDefinition, run: CaseRun): ActionOffer[] {
  const offers: ActionOffer[] = [];
  // Ciudades del expediente visibles (GDD §5): en libre, la inicial, la
  // actual y las descubiertas; el resto no se ofrece en la escena.
  const visible = new Set(visibleCaseCityIds(def, run));
  for (const duration of def.travelDurations.filter(item => item.fromCityId === run.position.cityId)) {
    const destination = def.cities.find(city => city.id === duration.toCityId);
    if (!destination || !visible.has(destination.id)) continue;
    offers.push({ id: `travel:${destination.id}`, label: `Viajar a ${destination.name}`,
      detail: `${duration.minutes} min`, action: { type: 'travel', params: { toCityId: destination.id } } });
  }
  const caseIds = new Set(def.cities.map(city => city.id));
  const fromIsCaseCity = caseIds.has(run.position.cityId);
  for (const route of DEFAULT_TRAVEL_ROUTES.filter(item => item.fromCityId === run.position.cityId)) {
    const destination = getCity(route.toCityId);
    if (!destination) continue;
    // Entre ciudades del expediente manda su ruta (ya ofrecida arriba o
    // oculta en libre por no descubierta). Desde una ciudad turística, el
    // catálogo es la única forma de volver al caso: se ofrece solo a las
    // ciudades del expediente visibles, sin anunciar las no descubiertas.
    if (caseIds.has(route.toCityId) && (fromIsCaseCity || !visible.has(route.toCityId))) continue;
    offers.push({ id: `travel:${destination.id}`, label: `Viajar a ${destination.name}`,
      detail: `${route.minutes} min`, action: { type: 'travel', params: { toCityId: destination.id } } });
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
    // Con la orden ya concedida no se vuelve a ofrecer: sin este filtro
    // «Solicitar orden» seguía apareciendo tras madurar la solicitud.
    .filter(suspectId => knownSuspect(def, run, suspectId) && !warrantPending(run, suspectId) && !run.warrants.includes('warrant:' + suspectId) && canIssueWarrant(def, run, suspectId))
    .map((suspectId): ActionOffer => ({ id: `request_warrant:${suspectId}`, label: `Solicitar orden contra ${npcName(def, suspectId)}`,
      detail: 'Se resuelve en 30 min',
      action: { type: 'request_warrant', params: { suspectId, evidenceIds: knownEvidenceIds } } }));
}

/** Oferta de detención: en persona en los casos interactivos, coordinada
 * con las autoridades en los automáticos (GDD §12). El modo es el del
 * expediente; la oferta solo aparece cuando el plan es viable. */
function detainOffers(def: CaseDefinition, run: CaseRun): ActionOffer[] {
  const automatic = arrestTypeOf(def) === 'automatic';
  return suspectIds(def)
    .filter(suspectId => detentionAvailable(def, run, suspectId))
    .map((suspectId): ActionOffer => {
      const locationId = def.mechanics?.suspects.find(suspect => suspect.id === suspectId)?.locationId ?? fixedSuspect(suspectId)?.locationId ?? '';
      return automatic
        ? { id: `detain:${suspectId}`, label: `Coordinar la detención de ${npcName(def, suspectId)} con las autoridades`,
          detail: `${ARREST_COORDINATION_MINUTES} min · orden válida · actúan las autoridades`,
          action: { type: 'detain', params: { suspectId, warrantId: 'warrant:' + suspectId, locationId, mode: 'automatic' } } }
        : { id: `detain:${suspectId}`, label: `Detener a ${npcName(def, suspectId)}`,
          action: { type: 'detain', params: { suspectId, warrantId: 'warrant:' + suspectId, locationId, mode: 'interactive' } } };
    });
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

/** Acciones irregulares (GDD §14): forzar el acceso al lugar de
 * recuperación cuando exige orden y no la hay, y sobornar o suplantar a
 * un personaje presente que aún tenga algo que contar. No se ofrecen si
 * no hay nada que ganar con ellas (acceso ya forzado o con orden, o el
 * personaje ya lo ha contado todo): son intentos con riesgo, no botones
 * decorativos. La confirmación con los riesgos la pone el motor. */
/** Lugar de recuperación con orden de acceso del expediente, si lo exige. */
function forceEntryTarget(def: CaseDefinition): { locationId: string; cityId: string } | undefined {
  if (isFixedCase(def)) return { locationId: 'LIS-ALM', cityId: 'lisboa' };
  const recovery = def.mechanics?.recovery;
  return recovery?.requiresAccessWarrant ? { locationId: recovery.locationId, cityId: recovery.cityId } : undefined;
}

/** Oferta de forzar el acceso al lugar de recuperación, solo cuando se
 * está en ese lugar y aún no hay orden ni acceso forzado. */
function forceEntryOffer(def: CaseDefinition, run: CaseRun): ActionOffer | undefined {
  const forceTarget = forceEntryTarget(def);
  if (!forceTarget || run.position.locationId !== forceTarget.locationId) return undefined;
  if (!irregularPlan(def, run, 'force_entry', forceTarget.locationId).ok) return undefined;
  const place = def.locations.find(location => location.id === forceTarget.locationId)?.name ?? forceTarget.locationId;
  return { id: `irregular:force_entry:${forceTarget.locationId}`, label: `Forzar el acceso a ${place}`,
    // El detalle avisa de la alternativa legal: la orden de acceso se pide
    // con una orden que incluya una prueba de acceso (el juego no lo dejaba
    // claro y el jugador solo veía la vía irregular).
    detail: '30 min · pueden verte · lo obtenido no será admisible · o pide una orden con una prueba de acceso',
    action: { type: 'irregular', params: { kind: 'force_entry', targetId: forceTarget.locationId } } };
}

/** Ofertas de sobornar o suplantar a un personaje presente que aún tenga
 * algo que contar. Sin nada que revelar, no hay intento con sentido. */
function npcIrregularOffers(def: CaseDefinition, run: CaseRun, npc: NPC): ActionOffer[] {
  if (!hasUnrevealedTalkFacts(def, run, npc.id)) return [];
  const offers: ActionOffer[] = [];
  for (const kind of ['bribe', 'impersonate'] as const) {
    if (!irregularPlan(def, run, kind, npc.id).ok) continue;
    offers.push({ id: `irregular:${kind}:${npc.id}`,
      label: kind === 'bribe' ? `Sobornar a ${npc.name}` : `Suplantar a alguien hablando con ${npc.name}`,
      detail: '30 min · lo que diga no será admisible',
      action: { type: 'irregular', params: { kind, targetId: npc.id } } });
  }
  return offers;
}

function irregularOffers(def: CaseDefinition, run: CaseRun): ActionOffer[] {
  const force = forceEntryOffer(def, run);
  return [
    ...(force ? [force] : []),
    // Como en `talkOffers`: un detenido ya no está en la escena y no se le
    // puede sobornar ni suplantar a nadie hablando con él.
    ...def.npcs.filter(item => item.cityId === run.position.cityId && !run.detentions.includes(item.id))
      .flatMap(npc => npcIrregularOffers(def, run, npc)),
  ];
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
    ...irregularOffers(def, run),
    { id: 'finish', label: 'Cerrar el caso y presentar el informe', action: { type: 'finish', params: {} } },
  ];
}
