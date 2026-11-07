// Etapas del pipeline de generación con LLM real (T4-08, SPEC-007).
//
// El generador no deja que el modelo invente la forma del caso: el esqueleto
// es fijo y probado (el del fixture «El contrato de las facturas falsas»:
// 3 ciudades con una localización cada una, 11 evidencias con tipos fijos
// por posición, 2 objetos recogibles, 1 análisis, 5 consultas, 1 tema de
// conversación con relación, 1-2 sospechosos, 2 combinaciones de orden,
// recuperación con acceso). El modelo rellena el contenido —nombres, textos,
// el cableado de requisitos y combinaciones— y la puerta de validación
// (validador v1.5 + simulación por el motor real) decide si entra en el
// catálogo. Sin esa puerta, ningún borrador se ofrece para jugar.
//
// 5 llamadas LLM como máximo por intento: premisa (1), NPC (3), red de
// pistas (4), revisión semántica (7) y una reparación opcional de la 4. El
// resto de etapas (geografía, ensamblaje, validación, simulación,
// persistencia) son deterministas.

import { GEOGRAPHIC_CATALOG, crimeAllowedForRating, getRoute, hasKnowledgeContent, isKnowledgeLabelText, knowledgeContentAnchors, type CaseDefinition, type CaseMechanics, type CaseTexts, type ContentRating, type KnowledgeContentAnchors } from '@meridiano/case-schema';
import type { GenerationParams, GenerationStage } from './pipeline.js';

/** Delitos generables (lista canónica sin 'aleatorio', que es modo de
 * selección). Homicidio y secuestro solo en General (GDD §14). */
export const GENERATABLE_CRIMES = ['robo', 'desaparicion', 'fraude', 'espionaje', 'sabotaje', 'misterio-historico', 'extorsion', 'contrabando', 'corrupcion', 'falsificacion', 'homicidio', 'secuestro'] as const;
export type GeneratableCrime = (typeof GENERATABLE_CRIMES)[number];

/** Plazo base del expediente según la duración pedida (minutos). La
 * dificultad de la PARTIDA lo multiplica después (fácil ×2, normal ×1,
 * difícil ×0,5); el simulador exige que la ruta dorada quepa en el plazo
 * de difícil, así que el caso es completable en cualquier dificultad. */
export const DEADLINE_BY_DURATION: Record<GenerationParams['duration'], number> = {
  short: 1440,
  medium: 2880,
  long: 5760,
};

/** Generador pseudoaleatorio determinista por semilla (mulberry32). */
export function seededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

export interface ResolvedChoice {
  crimeType: GeneratableCrime;
  contentRating: ContentRating;
}

/** Resuelve delito y contenido a partir de los parámetros (sorteo con la
 * semilla cuando el usuario pide sorpresa). Rechaza combinaciones no
 * admitidas (homicidio/secuestro en Familiar) y regiones sin ciudades
 * verificadas en el catálogo (hoy solo Europa). */
export function resolveGenerationChoice(params: GenerationParams): ResolvedChoice {
  const random = seededRandom(params.seed ?? 0);
  const crimeType = params.crimeType ?? GENERATABLE_CRIMES[Math.floor(random() * GENERATABLE_CRIMES.length)] as GeneratableCrime;
  const contentRating: ContentRating = params.surpriseMode === 'sorprende'
    ? (random() < 0.5 ? 'familiar' : 'general')
    : params.surpriseMode;
  if (!crimeAllowedForRating(crimeType, contentRating)) {
    throw new Error(`El delito ${crimeType} solo se admite en contenido General.`);
  }
  if (params.region !== undefined && params.region !== 'europa' && params.region !== 'global') {
    throw new Error(`La región ${params.region} no tiene ciudades verificadas en el catálogo (hoy solo Europa).`);
  }
  return { crimeType, contentRating };
}

// ── Geografía (etapa 2, determinista) ────────────────────────────────────────

export interface SelectedGeography {
  cities: Array<{ id: string; name: string; country: string }>;
  travelDurations: Array<{ fromCityId: string; toCityId: string; minutes: number }>;
}

/** Duración de viaje entre dos ciudades: la del catálogo cuando existe;
 * si no, 120 min en el mismo país y 180 entre países distintos. */
export function travelMinutes(fromCityId: string, toCityId: string): number {
  const route = getRoute(fromCityId, toCityId);
  if (route) return route.minutes;
  const from = GEOGRAPHIC_CATALOG.find(city => city.id === fromCityId);
  const to = GEOGRAPHIC_CATALOG.find(city => city.id === toCityId);
  if (!from || !to) return 180;
  return from.country === to.country ? 120 : 180;
}

/** Elige 3 ciudades del catálogo con la semilla: la primera es el inicio y
 * las otras dos minimizan el viaje total (el catálogo solo tiene Europa).
 * Una localización por ciudad: el motor aterriza siempre en la primera
 * accesible de la ciudad de destino. */
export function selectGeography(params: GenerationParams): SelectedGeography {
  const random = seededRandom((params.seed ?? 0) + 11);
  const cities = [...GEOGRAPHIC_CATALOG];
  const start = cities[Math.floor(random() * cities.length)];
  if (!start) throw new Error('Catálogo geográfico vacío.');
  const rest = cities.filter(city => city.id !== start.id)
    .map(city => ({ city, cost: travelMinutes(start.id, city.id) }))
    .sort((a, b) => a.cost - b.cost || a.city.id.localeCompare(b.city.id));
  const second = rest[0]?.city;
  const third = rest
    .filter(entry => entry.city.id !== second?.id)
    .map(entry => ({ city: entry.city, cost: entry.cost + travelMinutes(second?.id ?? start.id, entry.city.id) }))
    .sort((a, b) => a.cost - b.cost || a.city.id.localeCompare(b.city.id))[0]?.city;
  if (!second || !third) throw new Error('El catálogo no tiene 3 ciudades.');
  const selected = [start, second, third];
  const travelDurations: SelectedGeography['travelDurations'] = [];
  for (const from of selected) {
    for (const to of selected) {
      if (from.id === to.id) continue;
      travelDurations.push({ fromCityId: from.id, toCityId: to.id, minutes: travelMinutes(from.id, to.id) });
    }
  }
  return {
    cities: selected.map(city => ({ id: city.id, name: city.name, country: city.country })),
    travelDurations,
  };
}

// ── Contextos de etapa (lo que recibe el modelo) ─────────────────────────────

export interface StageContext {
  stage: GenerationStage;
  crimeType: GeneratableCrime;
  contentRating: ContentRating;
  duration: GenerationParams['duration'];
  seed: number;
  cities: Array<{ id: string; name: string; country: string }>;
  [key: string]: unknown;
}

const CONTENT_RULES: Record<ContentRating, string> = {
  familiar: 'Contenido Familiar: sin asesinatos ni temas perturbadores; nada de sangre, cadáveres, tortura, secuestros ni violencia explícita. El delito se resuelve con documentos, registros y testimonios.',
  general: 'Contenido General: se permiten temas serios (fraude, corrupción, extorsión); sin detalle explícito ni gore. La investigación sigue siendo documental.',
};

/** Contexto que se envía al modelo para cada etapa LLM. `prior` trae las
 * salidas de las etapas anteriores (premisa, NPC…); `feedback` trae los
 * errores de la última validación/simulación cuando se repara la etapa 4. */
export function buildStageContext(
  stage: GenerationStage,
  choice: ResolvedChoice,
  params: GenerationParams,
  geography: SelectedGeography,
  prior: Record<string, unknown>,
  feedback?: string[],
  part?: 'a' | 'b',
): StageContext {
  const base: StageContext = {
    stage,
    crimeType: choice.crimeType,
    contentRating: choice.contentRating,
    duration: params.duration,
    seed: params.seed ?? 0,
    cities: geography.cities,
    contentRules: CONTENT_RULES[choice.contentRating],
    // Errores de la tentativa anterior (reintento o reparación): el modelo
    // los recibe para corregir su salida en vez de repetir el mismo fallo.
    ...(feedback ? { repairFeedback: feedback } : {}),
  };
  if (stage === 1) return base;
  if (stage === 3) return { ...base, premise: prior.premise };
  if (stage === 4) return { ...stage4Context(base, prior, part), startCityId: geography.cities[0]?.id ?? '' };
  if (stage === 7) return { ...base, definition: prior.definition, goldenPath: prior.goldenPath, budgetMinutes: prior.budgetMinutes };
  return base;
}

// La etapa 4 se genera en dos llamadas (4a mundo, 4b reglas): la segunda
// trae los ids exactos de lugares y evidencias de la primera, así que la
// mecánica y la ruta dorada no tienen que adivinarlos.
function stage4Context(base: StageContext, prior: Record<string, unknown>, part?: 'a' | 'b'): StageContext {
  if (part === 'a') return { ...base, part, premise: prior.premise, npcs: prior.npcs };
  if (part === 'b') {
    const world = prior.world as Record<string, unknown> | undefined;
    return { ...base, part, premise: prior.premise, npcs: prior.npcs, locations: world?.locations, evidence: world?.evidence };
  }
  return { ...base, premise: prior.premise, npcs: prior.npcs };
}

// ── Esquemas de salida por etapa ─────────────────────────────────────────────

export const STAGE_OUTPUT_SCHEMAS: Record<number, Record<string, unknown>> = {
  1: {
    type: 'object',
    required: ['title', 'crimeLabel', 'truth', 'solution', 'decoy', 'witnesses', 'motive', 'objectives', 'objectLabel', 'briefing'],
    properties: {
      title: { type: 'string' },
      crimeLabel: { type: 'string' },
      truth: { type: 'string' },
      solution: { type: 'object', required: ['id', 'name', 'role', 'cityId'] },
      decoy: { type: 'object', required: ['id', 'name', 'role', 'cityId'] },
      witnesses: { type: 'array', minItems: 1, maxItems: 2, items: { type: 'object', required: ['id', 'name', 'role', 'cityId'] } },
      motive: { type: 'string' },
      objectives: { type: 'object', required: ['detain', 'recover'] },
      objectLabel: { type: 'string' },
      briefing: { type: 'object', required: ['speaker', 'title', 'paragraphs'] },
    },
  },
  3: {
    type: 'object',
    required: ['npcs', 'timeline'],
    properties: {
      npcs: { type: 'array', minItems: 3, maxItems: 4 },
      timeline: { type: 'array', minItems: 2, maxItems: 8 },
    },
  },
  // Etapa 4a (mundo: lugares, evidencias y textos). La mecánica y la ruta
  // dorada van en una segunda llamada (STAGE_4B_SCHEMA): en una sola salida
  // el modelo fallaba cada vez en un detalle distinto (un id de lugar de 7
  // letras, consultas sin `requires`…) y los reintentos no convergían.
  4: {
    type: 'object',
    required: ['locations', 'evidence', 'texts'],
    properties: {
      locations: { type: 'array', minItems: 3, maxItems: 3, items: { type: 'object', required: ['id', 'name', 'cityId', 'description'] } },
      evidence: { type: 'array', minItems: 11, maxItems: 11, items: { type: 'object', required: ['id', 'type', 'origin', 'relations'] } },
      texts: { type: 'object', required: ['evidence', 'knowledge', 'greetings'] },
    },
  },
  7: {
    type: 'object',
    required: ['coherent', 'issues'],
    properties: {
      coherent: { type: 'boolean' },
      issues: { type: 'array' },
    },
  },
};

/** Esquema JSON de la salida de una etapa LLM (falla si la etapa no tiene). */
export function stageOutputSchema(stage: GenerationStage, part?: 'a' | 'b'): Record<string, unknown> {
  if (stage === 4 && part === 'b') return STAGE_4B_SCHEMA;
  const schema = STAGE_OUTPUT_SCHEMAS[stage];
  if (!schema) throw new Error(`La etapa ${stage} no tiene esquema de salida.`);
  return schema;
}

// Etapa 4b (reglas: mecánica y ruta dorada). Los nombres de campo son
// EXACTOS: la mecánica solo referencia ids definidos en la salida 4a
// (lugares, EV-01..EV-11) y en la etapa 1 (NPC). Un id inventado en la
// mecánica no existe y el borrador se rechaza. Las consultas usan `id`
// (kebab-case, p. ej. registro-mercantil), NO `queryId`; los sospechosos
// usan `id` con el id del NPC, NO `suspectId`; las evidencias concedidas
// usan `evidenceId`, NO `grantsEvidenceId`.
export const STAGE_4B_SCHEMA: Record<string, unknown> = {
  type: 'object',
  required: ['mechanics', 'goldenPath'],
  properties: {
    mechanics: {
      type: 'object',
      required: ['inspectables', 'queries', 'analyses', 'talkEvidence', 'suspects', 'recovery'],
      properties: {
        inspectables: { type: 'array', minItems: 3, maxItems: 3, items: { type: 'object', required: ['locationId', 'elementId', 'label', 'evidenceId'] } },
        queries: { type: 'array', minItems: 5, maxItems: 5, items: { type: 'object', required: ['id', 'label', 'cityId', 'locationId', 'evidenceId', 'requires', 'delayMinutes'] } },
        analyses: { type: 'array', minItems: 1, maxItems: 1, items: { type: 'object', required: ['inputEvidenceId', 'resultEvidenceId', 'delayMinutes'] } },
        talkEvidence: { type: 'array', minItems: 1, maxItems: 1, items: { type: 'object', required: ['npcId', 'topicId', 'label', 'evidenceId'] } },
        suspects: { type: 'array', minItems: 1, maxItems: 2, items: { type: 'object', required: ['id', 'cityId', 'locationId', 'knownFromEvidence', 'warrantCombinations'] } },
        recovery: { type: 'object', required: ['objectId', 'label', 'cityId', 'locationId', 'evidenceId', 'requiresAccessWarrant'] },
      },
    },
    goldenPath: { type: 'array', minItems: 10, maxItems: 40 },
  },
};

// ── Validación de salidas de etapa (forma, no fondo) ─────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

const NPC_ID = /^[a-z][a-z0-9-]{0,31}$/;
const LOCATION_ID = /^[A-Z]{2,4}-[A-Z]{3,12}$/;
const EVIDENCE_ID = /^EV-\d{2}$/;
const FACT_ID = /^[A-Za-z0-9._:-]{1,128}$/;

function checkKeys(output: Record<string, unknown>, required: string[], errors: string[]): void {
  for (const key of required) if (!Object.hasOwn(output, key)) errors.push(`Falta la clave ${key}.`);
}

function checkCastMember(member: unknown, cityIds: Set<string>, ids: Set<string>, errors: string[]): void {
  if (!isRecord(member)) { errors.push('Un miembro del reparto no es un objeto.'); return; }
  if (typeof member.id !== 'string' || !NPC_ID.test(member.id)) errors.push(`id de NPC inválido: ${String(member.id)} (minúsculas con guiones, sin guiones bajos ni marcadores tipo suspect_01).`);
  if (ids.has(String(member.id))) errors.push(`id de NPC duplicado: ${String(member.id)}.`);
  ids.add(String(member.id));
  if (!isNonEmptyString(member.name)) errors.push(`NPC ${String(member.id)} sin nombre.`);
  if (!isNonEmptyString(member.role)) errors.push(`NPC ${String(member.id)} sin rol.`);
  if (typeof member.cityId !== 'string' || !cityIds.has(member.cityId)) errors.push(`NPC ${String(member.id)} en ciudad desconocida: cada NPC (solución, señuelo y testigos) necesita cityId, un id EXACTO de cities.`);
}

function checkPremiseBriefing(output: Record<string, unknown>, errors: string[]): void {
  if (!isRecord(output.objectives) || !isNonEmptyString(output.objectives.detain) || !isNonEmptyString(output.objectives.recover)) errors.push('objectives debe tener detain y recover como frases.');
  if (!isRecord(output.briefing) || !isNonEmptyString(output.briefing.speaker) || !isNonEmptyString(output.briefing.title) ||
      !Array.isArray(output.briefing.paragraphs) || output.briefing.paragraphs.length !== 3 ||
      !output.briefing.paragraphs.every(isNonEmptyString)) errors.push('briefing debe tener speaker, title y 3 párrafos.');
}

function validatePremise(output: unknown, cities: SelectedGeography['cities'], errors: string[]): void {
  if (!isRecord(output)) { errors.push('La premisa debe ser un objeto.'); return; }
  checkKeys(output, ['title', 'crimeLabel', 'truth', 'solution', 'decoy', 'witnesses', 'motive', 'objectives', 'objectLabel', 'briefing'], errors);
  if (!isNonEmptyString(output.title)) errors.push('title vacío.');
  // El título es el nombre del caso («Caso: …»): si empieza por
  // «Expediente:», la interfaz lo duplica al mostrarlo («Expediente:
  // Expediente: …»).
  if (isNonEmptyString(output.title) && /^expediente:/i.test(output.title.trim())) errors.push('El título no debe empezar por «Expediente:» (la interfaz ya lo añade al mostrarlo).');
  if (!isNonEmptyString(output.truth)) errors.push('truth vacío.');
  const cityIds = new Set(cities.map(city => city.id));
  const cast = [output.solution, output.decoy, ...(Array.isArray(output.witnesses) ? output.witnesses : [])];
  const ids = new Set<string>();
  for (const member of cast) checkCastMember(member, cityIds, ids, errors);
  if (!Array.isArray(output.witnesses) || output.witnesses.length < 1 || output.witnesses.length > 2) errors.push('witnesses debe tener 1 o 2 testigos.');
  checkPremiseBriefing(output, errors);
}

function checkNpcKnowledge(npc: Record<string, unknown>, errors: string[]): void {
  if (!Array.isArray(npc.knowledge) || npc.knowledge.length === 0) { errors.push(`NPC ${String(npc.id)} sin conocimiento.`); return; }
  const invalid = npc.knowledge.filter((token: unknown) => typeof token !== 'string' || !FACT_ID.test(token));
  if (invalid.length > 0) errors.push(`NPC ${String(npc.id)} con conocimiento inválido: ${JSON.stringify(invalid.slice(0, 3))} (ids cortos en minúsculas con guiones, sin espacios ni frases).`);
  if (typeof npc.cooperation !== 'number' || npc.cooperation < 0 || npc.cooperation > 10) errors.push(`NPC ${String(npc.id)} con cooperación fuera de 0-10.`);
}

function checkNpc(npc: unknown, castIds: string[], ids: Set<string>, errors: string[]): void {
  if (!isRecord(npc)) { errors.push('Un NPC no es un objeto.'); return; }
  if (typeof npc.id !== 'string' || !castIds.includes(npc.id)) errors.push(`NPC fuera del reparto: ${String(npc.id)}.`);
  ids.add(String(npc.id));
  if (!isNonEmptyString(npc.persona)) errors.push(`NPC ${String(npc.id)} sin persona.`);
  checkNpcKnowledge(npc, errors);
}

function validateNpcs(output: unknown, castIds: string[], errors: string[]): void {
  if (!isRecord(output)) { errors.push('La etapa de NPC debe ser un objeto.'); return; }
  checkKeys(output, ['npcs', 'timeline'], errors);
  if (!Array.isArray(output.npcs)) { errors.push('npcs debe ser una lista.'); return; }
  const ids = new Set<string>();
  for (const npc of output.npcs) checkNpc(npc, castIds, ids, errors);
  for (const id of castIds) if (!ids.has(id)) errors.push(`Falta el NPC ${id} del reparto.`);
  if (!Array.isArray(output.timeline) || output.timeline.length < 2) errors.push(`timeline debe tener al menos 2 hitos (tiene ${Array.isArray(output.timeline) ? output.timeline.length : 0}).`);
  else if (!output.timeline.every(isNonEmptyString)) {
    const bad = output.timeline.findIndex(item => !isNonEmptyString(item));
    errors.push(`timeline: cada hito debe ser una frase, no un objeto (el hito ${bad + 1} no lo es).`);
  }
}

/** Tipos de evidencia por posición (el esqueleto fijo, como el fixture del
 * fraude): observación, objeto, análisis, registro, registro, objeto,
 * registro, registro, testimonio, registro, objeto. */
export const EVIDENCE_SLOT_TYPES = ['observation', 'object', 'analysis', 'record', 'record', 'object', 'record', 'record', 'testimony', 'record', 'object'] as const;

function checkClueLocation(location: unknown, cityIds: Set<string>, locationIds: Set<string>, errors: string[]): void {
  if (!isRecord(location)) { errors.push('Un lugar no es un objeto.'); return; }
  if (typeof location.id !== 'string' || !LOCATION_ID.test(location.id)) errors.push(`id de lugar inválido: ${String(location.id)} (mayúsculas: 2-4 letras de ciudad + guion + 3-12 letras, p. ej. MAD-SALA, nunca minúsculas).`);
  locationIds.add(String(location.id));
  if (typeof location.cityId !== 'string' || !cityIds.has(location.cityId)) errors.push(`Lugar ${String(location.id)} en ciudad desconocida.`);
  if (!isNonEmptyString(location.name) || !isNonEmptyString(location.description)) errors.push(`Lugar ${String(location.id)} sin nombre o descripción.`);
}

function checkClueLocations(output: Record<string, unknown>, cityIds: Set<string>, errors: string[]): Set<string> | null {
  if (!Array.isArray(output.locations) || output.locations.length !== 3) { errors.push('locations debe tener exactamente 3 lugares (uno por ciudad).'); return null; }
  const locationIds = new Set<string>();
  for (const location of output.locations) checkClueLocation(location, cityIds, locationIds, errors);
  if (new Set([...output.locations].map((location: unknown) => isRecord(location) ? location.cityId : '')).size !== 3) errors.push('Cada ciudad debe tener exactamente un lugar.');
  return locationIds;
}

function checkEvidenceRelations(evidence: Record<string, unknown>, expectedId: string, errors: string[]): void {
  if (!Array.isArray(evidence.relations) || !evidence.relations.every((id: unknown) => typeof id === 'string' && EVIDENCE_ID.test(id))) {
    errors.push(`La evidencia ${expectedId} tiene relaciones inválidas.`);
    return;
  }
  // relations son requisitos previos: solo evidencias anteriores (número
  // menor). Un enlace en ambos sentidos o hacia adelante crea un ciclo y
  // el grafo no se puede resolver.
  for (const id of evidence.relations) {
    if (typeof id === 'string' && id >= expectedId) errors.push(`La evidencia ${expectedId} solo puede depender de evidencias anteriores (${id} no es anterior).`);
  }
}

function checkClueEvidence(output: Record<string, unknown>, locationIds: Set<string>, cityIds: Set<string>, errors: string[]): void {
  if (!Array.isArray(output.evidence) || output.evidence.length !== 11) { errors.push('evidence debe tener exactamente 11 evidencias (EV-01..EV-11).'); return; }
  output.evidence.forEach((evidence: unknown, index: number) => {
    if (!isRecord(evidence)) { errors.push(`Evidencia ${index + 1} no es un objeto.`); return; }
    const expectedId = `EV-${String(index + 1).padStart(2, '0')}`;
    if (evidence.id !== expectedId) errors.push(`La evidencia ${index + 1} debe ser ${expectedId}.`);
    if (evidence.type !== EVIDENCE_SLOT_TYPES[index]) errors.push(`La evidencia ${expectedId} debe ser de tipo ${EVIDENCE_SLOT_TYPES[index]}.`);
    if (typeof evidence.origin !== 'string' || (!locationIds.has(evidence.origin) && !cityIds.has(evidence.origin))) errors.push(`La evidencia ${expectedId} tiene origen desconocido: ${String(evidence.origin)} (debe ser un id de lugar o de ciudad de esta salida, nunca un personaje).`);
    checkEvidenceRelations(evidence, expectedId, errors);
  });
}

const MECHANIC_COUNTS: Array<{ key: string; count: number; message: string }> = [
  { key: 'inspectables', count: 3, message: 'mechanics.inspectables debe tener 3 entradas (sala + 2 elementos).' },
  { key: 'queries', count: 5, message: 'mechanics.queries debe tener 5 consultas.' },
  { key: 'analyses', count: 1, message: 'mechanics.analyses debe tener 1 análisis.' },
  { key: 'talkEvidence', count: 1, message: 'mechanics.talkEvidence debe tener 1 tema.' },
];

const MECHANIC_FIELDS: Array<{ key: string; fields: Array<[string, 'nonempty' | 'string' | 'array' | 'number' | 'boolean']> }> = [
  // elementId admite cadena vacía: la primera inspeccionable es la sala
  // misma (inspeccionar la sala, sin elemento concreto).
  { key: 'inspectables', fields: [['locationId', 'nonempty'], ['elementId', 'string'], ['label', 'nonempty'], ['evidenceId', 'nonempty']] },
  { key: 'queries', fields: [['id', 'nonempty'], ['label', 'nonempty'], ['cityId', 'nonempty'], ['locationId', 'nonempty'], ['evidenceId', 'nonempty'], ['requires', 'array'], ['delayMinutes', 'number']] },
  { key: 'analyses', fields: [['inputEvidenceId', 'nonempty'], ['resultEvidenceId', 'nonempty'], ['delayMinutes', 'number']] },
  { key: 'talkEvidence', fields: [['npcId', 'nonempty'], ['topicId', 'nonempty'], ['label', 'nonempty'], ['evidenceId', 'nonempty']] },
  { key: 'suspects', fields: [['id', 'nonempty'], ['cityId', 'nonempty'], ['locationId', 'nonempty'], ['knownFromEvidence', 'array'], ['warrantCombinations', 'array'], ['accessEvidenceIds', 'array']] },
];

const KEBAB_ID = /^[a-z][a-z0-9-]{0,63}$/;

// Ids de la mecánica que deben ser kebab-case ASCII (sin acentos ni
// espacios): el validador v1.5 solo exige ASCII, pero la convención del
// motor es minúsculas con guiones y el modelo inventa acentos si no se
// le exige aquí.
const MECHANIC_ID_FIELDS: Array<{ key: string; field: string }> = [
  { key: 'inspectables', field: 'elementId' },
  { key: 'queries', field: 'id' },
  { key: 'talkEvidence', field: 'topicId' },
  { key: 'suspects', field: 'id' },
];

function checkMechanicId(group: { key: string }, entry: Record<string, unknown>, index: number, errors: string[]): void {
  const idField = MECHANIC_ID_FIELDS.find(item => item.key === group.key)?.field;
  if (!idField) return;
  const value = entry[idField];
  // elementId vacío significa la sala misma: solo se exige el patrón
  // cuando hay un elemento concreto.
  if (typeof value === 'string' && value !== '' && !KEBAB_ID.test(value)) errors.push(`mechanics.${group.key}[${index}] ${idField} inválido: ${value} (minúsculas con guiones, sin acentos).`);
}

function checkMechanicFields(mechanics: Record<string, unknown>, errors: string[]): void {
  for (const group of MECHANIC_FIELDS) {
    const entries = mechanics[group.key];
    if (!Array.isArray(entries)) continue;
    entries.forEach((entry, index) => {
      if (!isRecord(entry)) { errors.push(`mechanics.${group.key}[${index}] no es un objeto.`); return; }
      for (const [field, kind] of group.fields) {
        const value = entry[field];
        const ok = kind === 'nonempty' ? isNonEmptyString(value)
          : kind === 'string' ? typeof value === 'string'
          : kind === 'array' ? Array.isArray(value)
          : kind === 'number' ? typeof value === 'number'
          : typeof value === 'boolean';
        if (!ok) errors.push(`mechanics.${group.key}[${index}] debe tener ${field} (${kind}).`);
      }
      checkMechanicId(group, entry, index, errors);
      // El validador v1.5 exige delayMinutes entero entre 1 y 240: con 0 el
      // resultado queda en curso y el paso siguiente que lo necesita se
      // rechaza en la simulación sin que el diagnóstico de orden lo explique.
      if ((group.key === 'queries' || group.key === 'analyses') && 'delayMinutes' in entry) {
        const delay = entry.delayMinutes;
        if (typeof delay !== 'number' || !Number.isInteger(delay) || delay < 1 || delay > 240) {
          errors.push(`mechanics.${group.key}[${index}] delayMinutes debe ser un entero entre 1 y 240 (es ${String(delay)}).`);
        }
      }
    });
  }
  const recovery = mechanics.recovery;
  if (isRecord(recovery)) {
    const recoveryFields: Array<[string, 'nonempty' | 'boolean']> = [['objectId', 'nonempty'], ['label', 'nonempty'], ['cityId', 'nonempty'], ['locationId', 'nonempty'], ['evidenceId', 'nonempty'], ['requiresAccessWarrant', 'boolean']];
    for (const [field, kind] of recoveryFields) {
      const value = recovery[field];
      const ok = kind === 'nonempty' ? isNonEmptyString(value) : typeof value === 'boolean';
      if (!ok) errors.push(`mechanics.recovery debe tener ${field} (${kind}).`);
    }
    if (typeof recovery.objectId === 'string' && !KEBAB_ID.test(recovery.objectId)) errors.push(`mechanics.recovery objectId inválido: ${recovery.objectId} (minúsculas con guiones, sin acentos).`);
  }
}

function checkClueMechanics(output: Record<string, unknown>, errors: string[]): void {
  if (!isRecord(output.mechanics)) { errors.push('mechanics debe ser un objeto.'); return; }
  const mechanics = output.mechanics;
  for (const entry of MECHANIC_COUNTS) {
    if (!Array.isArray(mechanics[entry.key]) || (mechanics[entry.key] as unknown[]).length !== entry.count) errors.push(entry.message);
  }
  if (!Array.isArray(mechanics.suspects) || mechanics.suspects.length < 1 || mechanics.suspects.length > 2) errors.push('mechanics.suspects debe tener 1 o 2 sospechosos.');
  if (!isRecord(mechanics.recovery)) errors.push('mechanics.recovery debe ser un objeto.');
  checkMechanicFields(mechanics, errors);
  // Sin evidencia de acceso declarada, la recuperación con orden de acceso
  // es imposible para cualquier sospechoso: el motor nunca concede
  // warrant:access. El campo era opcional y el modelo lo omitía.
  if (isRecord(mechanics.recovery) && mechanics.recovery.requiresAccessWarrant === true) {
    const suspects = Array.isArray(mechanics.suspects) ? mechanics.suspects : [];
    const withAccess = suspects.some(entry => isRecord(entry) && Array.isArray(entry.accessEvidenceIds) && entry.accessEvidenceIds.length > 0);
    if (!withAccess) errors.push('mechanics.suspects debe declarar accessEvidenceIds no vacío en al menos un sospechoso: recovery exige warrant:access y sin él la recuperación es imposible.');
  }
}

function checkClueKnowledgeTexts(texts: Record<string, unknown>, knowledgeIds: string[], errors: string[], anchors?: KnowledgeContentAnchors): void {
  if (!isRecord(texts.knowledge)) { errors.push('texts.knowledge debe ser un objeto.'); return; }
  for (const id of knowledgeIds) {
    const entry = (texts.knowledge as Record<string, unknown>)[id];
    if (!isNonEmptyString(entry)) errors.push(`Falta el texto de conocimiento de ${id} (uno por cada id de knowledge de la etapa 3).`);
    // El director muestra el texto del hecho tal cual al declarar: una
    // etiqueta de tema («Información sobre…») se repite como loro y nunca
    // suena a conversación. La etapa 4a debe escribir frases en primera
    // persona que el NPC diría («Conozco…», «Sé que…»).
    else if (isKnowledgeLabelText(entry)) errors.push(`El texto de conocimiento de ${id} es una etiqueta de tema, no una frase que diría el personaje.`);
    // Contenido real (tercera vuelta, 2026-11-07): el texto debe nombrar al
    // menos un elemento concreto del mundo del caso; si solo nombra el tema,
    // el modelo solo puede parafrasearlo y nunca da información.
    else if (anchors && !hasKnowledgeContent(entry, anchors)) errors.push(`El texto de conocimiento de ${id} no nombra ningún elemento concreto del mundo del caso (lugar, objeto, procedimiento o suceso de las evidencias).`);
  }
}

function checkClueTexts(output: Record<string, unknown>, castIds: string[], knowledgeIds: string[], errors: string[], geography?: SelectedGeography): void {
  if (!isRecord(output.texts)) { errors.push('texts debe ser un objeto.'); return; }
  const texts = output.texts;
  if (!isRecord(texts.evidence) || Object.keys(texts.evidence).length !== 11) errors.push('texts.evidence debe tener 11 textos.');
  if (!isRecord(texts.greetings)) errors.push('texts.greetings debe ser un objeto.');
  for (const id of castIds) if (!isRecord(texts.greetings) || !isNonEmptyString((texts.greetings as Record<string, unknown>)[id])) errors.push(`Falta el saludo de ${id}.`);
  // Anclas del mundo 4a (lugares, evidencias, ciudades, saludos): la
  // mecánica de 4b aún no existe aquí, así que la puerta de la etapa 4a usa
  // este subconjunto; el validador v1.5, con el expediente completo, exige
  // lo mismo con todas las anclas.
  const locations = Array.isArray(output.locations) ? output.locations.filter(isRecord) : [];
  checkClueKnowledgeTexts(texts, knowledgeIds, errors, knowledgeContentAnchors({
    locations: locations.map(entry => ({ name: typeof entry.name === 'string' ? entry.name : undefined, description: typeof entry.description === 'string' ? entry.description : undefined })),
    cities: (geography?.cities ?? []).map(city => ({ name: city.name })),
    evidenceTexts: isRecord(texts.evidence) ? Object.values(texts.evidence).filter((entry): entry is string => typeof entry === 'string') : [],
    greetings: isRecord(texts.greetings) ? Object.values(texts.greetings).filter((entry): entry is string => typeof entry === 'string') : [],
  }));
}

// Parámetros obligatorios (cadenas no vacías) de cada tipo de acción de
// la ruta dorada, según el motor: viajar usa toCityId (no cityId),
// consultar usa topicId (no queryId), inspeccionar exige targetId.
const GOLDEN_PARAM_STRINGS: Array<{ type: string; fields: string[] }> = [
  { type: 'travel', fields: ['toCityId'] },
  { type: 'query', fields: ['topicId'] },
  { type: 'inspect', fields: ['targetId'] },
  { type: 'collect', fields: ['evidenceId'] },
  { type: 'analyze', fields: ['evidenceId'] },
  { type: 'talk', fields: ['npcId', 'topicId'] },
  { type: 'detain', fields: ['suspectId', 'warrantId'] },
  { type: 'recover', fields: ['objectId'] },
];

function checkGoldenSpecialParams(action: Record<string, unknown>, index: number, errors: string[]): void {
  if (!isRecord(action.params) || typeof action.type !== 'string') return;
  if (action.type === 'request_warrant') {
    if (!isNonEmptyString(action.params.suspectId) || !Array.isArray(action.params.evidenceIds)) errors.push(`goldenPath[${index}] (request_warrant) debe tener suspectId y evidenceIds.`);
  }
  if (action.type === 'wait' && typeof action.params.minutes !== 'number') errors.push(`goldenPath[${index}] (wait) debe tener minutes.`);
}

function checkGoldenActionParams(action: Record<string, unknown>, index: number, errors: string[]): void {
  if (!isRecord(action.params) || typeof action.type !== 'string') return;
  const spec = GOLDEN_PARAM_STRINGS.find(item => item.type === action.type);
  if (spec) {
    for (const field of spec.fields) {
      if (!isNonEmptyString(action.params[field])) errors.push(`goldenPath[${index}] (${action.type}) debe tener ${field}.`);
    }
  }
  checkGoldenSpecialParams(action, index, errors);
}

function checkGoldenActions(output: Record<string, unknown>, errors: string[]): string[] {
  if (!Array.isArray(output.goldenPath)) return [];
  for (const action of output.goldenPath) {
    if (!isRecord(action) || !isNonEmptyString(action.type) || !isRecord(action.params)) errors.push('Una acción de goldenPath no tiene type/params.');
  }
  for (const [index, action] of (output.goldenPath as unknown[]).entries()) {
    if (isRecord(action)) checkGoldenActionParams(action, index, errors);
  }
  return output.goldenPath.map((action: unknown) => isRecord(action) && typeof action.type === 'string' ? action.type : '');
}

function checkGoldenPath(output: Record<string, unknown>, startCityId: string, errors: string[]): void {
  if (!Array.isArray(output.goldenPath) || output.goldenPath.length < 10 || output.goldenPath.length > 40) errors.push('goldenPath debe tener entre 10 y 40 acciones.');
  if (!Array.isArray(output.goldenPath)) return;
  const types = checkGoldenActions(output, errors);
  if (!types.includes('detain')) errors.push('goldenPath debe incluir una detención.');
  if (!types.includes('recover')) errors.push('goldenPath debe incluir una recuperación.');
  const last = output.goldenPath[output.goldenPath.length - 1];
  if (!isRecord(last) || last.type !== 'finish') errors.push('goldenPath debe terminar con el cierre del caso.');
  checkGoldenCollects(output, errors);
  checkGoldenPositions(output, startCityId, errors);
}

// La ruta empieza en la ciudad de inicio y cada acción ocurre en la ciudad
// donde se está en ese momento: un viaje a la ciudad actual no existe (no
// hay ruta de una ciudad a sí misma) y no se puede inspeccionar, consultar
// ni detener en una ciudad distinta. Se sigue la posición por la ruta.
function checkGoldenPositions(output: Record<string, unknown>, startCityId: string, errors: string[]): void {
  if (!Array.isArray(output.goldenPath)) return;
  const cityOfLocation = cityOfLocations(output);
  const cityOfQuery = cityOfQueries(output);
  let currentCity = startCityId;
  output.goldenPath.forEach((action: unknown, index: number) => {
    if (!isRecord(action)) return;
    currentCity = checkGoldenPosition(action, index, currentCity, cityOfLocation, cityOfQuery, errors);
  });
}

// Lugar → ciudad (para inspeccionar y detener en la ruta dorada).
function cityOfLocations(output: Record<string, unknown>): Map<string, string> {
  const map = new Map<string, string>();
  if (!Array.isArray(output.locations)) return map;
  for (const location of output.locations) {
    if (isRecord(location) && typeof location.id === 'string' && typeof location.cityId === 'string') map.set(location.id, location.cityId);
  }
  return map;
}

// Consulta → ciudad (para consultar en la ruta dorada).
function cityOfQueries(output: Record<string, unknown>): Map<string, string> {
  const map = new Map<string, string>();
  const mechanics = output.mechanics;
  if (!isRecord(mechanics) || !Array.isArray(mechanics.queries)) return map;
  for (const query of mechanics.queries) {
    if (isRecord(query) && typeof query.id === 'string' && typeof query.cityId === 'string') map.set(query.id, query.cityId);
  }
  return map;
}

// Comprueba una acción de la ruta dorada contra la ciudad actual y devuelve
// la ciudad tras la acción (cambia solo al viajar).
function checkGoldenPosition(
  action: Record<string, unknown>,
  index: number,
  currentCity: string,
  cityOfLocation: Map<string, string>,
  cityOfQuery: Map<string, string>,
  errors: string[],
): string {
  if (!isRecord(action.params)) return currentCity;
  if (action.type === 'travel') {
    const toCityId = action.params.toCityId;
    if (typeof toCityId !== 'string') return currentCity;
    if (toCityId === currentCity) errors.push(`goldenPath[${index}] (travel) viaja a ${toCityId}, la ciudad actual: la ruta empieza en la ciudad de inicio y cada viaje va a una ciudad distinta.`);
    return toCityId;
  }
  const city = actionCity(action, cityOfLocation, cityOfQuery);
  if (city && city !== currentCity) errors.push(`goldenPath[${index}] (${action.type}) ocurre en ${city} estando en ${currentCity}: cada acción ocurre en la ciudad donde estás en ese momento de la ruta.`);
  return currentCity;
}

// Ciudad donde ocurre una acción de la ruta (sin viajar): inspeccionar y
// detener por el lugar, consultar por la ciudad de la consulta.
function actionCity(action: Record<string, unknown>, cityOfLocation: Map<string, string>, cityOfQuery: Map<string, string>): string | undefined {
  const params = action.params;
  if (!isRecord(params)) return undefined;
  if (action.type === 'inspect' || action.type === 'detain') {
    const locationId = action.type === 'inspect' ? params.targetId : params.locationId;
    return typeof locationId === 'string' ? cityOfLocation.get(locationId) : undefined;
  }
  if (action.type === 'query') {
    const topicId = params.topicId;
    return typeof topicId === 'string' ? cityOfQuery.get(topicId) : undefined;
  }
  return undefined;
}

// Recoger solo sirve para evidencias de tipo object (EV-02, EV-06, EV-11):
// una observación se revela al inspeccionar y no se recoge; un registro
// llega por consulta, un análisis por analyze y un testimonio por hablar.
function checkGoldenCollects(output: Record<string, unknown>, errors: string[]): void {
  if (!Array.isArray(output.evidence) || !Array.isArray(output.goldenPath)) return;
  const types = new Map<string, string>();
  for (const evidence of output.evidence) {
    if (isRecord(evidence) && typeof evidence.id === 'string' && typeof evidence.type === 'string') types.set(evidence.id, evidence.type);
  }
  output.goldenPath.forEach((action: unknown, index: number) => {
    if (!isRecord(action) || action.type !== 'collect' || !isRecord(action.params)) return;
    const evidenceId = action.params.evidenceId;
    if (typeof evidenceId !== 'string') return;
    const type = types.get(evidenceId);
    if (type === undefined) errors.push(`goldenPath[${index}] (collect) recoge ${evidenceId}, que no existe.`);
    else if (type !== 'object') errors.push(`goldenPath[${index}] (collect) recoge ${evidenceId}, de tipo ${type}: solo se recogen evidencias de tipo object.`);
  });
}

function validateClueWorld(output: unknown, geography: SelectedGeography, castIds: string[], knowledgeIds: string[], errors: string[]): void {
  if (!isRecord(output)) { errors.push('La red de pistas debe ser un objeto.'); return; }
  checkKeys(output, ['locations', 'evidence', 'texts'], errors);
  const cityIds = new Set(geography.cities.map(city => city.id));
  const locationIds = checkClueLocations(output, cityIds, errors);
  if (locationIds) checkClueEvidence(output, locationIds, cityIds, errors);
  checkClueTexts(output, castIds, knowledgeIds, errors, geography);
}

function validateClueRules(output: unknown, world: unknown, geography: SelectedGeography, errors: string[]): void {
  if (!isRecord(output)) { errors.push('La red de pistas debe ser un objeto.'); return; }
  checkKeys(output, ['mechanics', 'goldenPath'], errors);
  // Las comprobaciones de la mecánica leen las evidencias del mundo (4a)
  // para validar recogidas y referencias.
  const merged = isRecord(world) ? { ...world, ...output } : output;
  checkClueMechanics(merged, errors);
  checkEvidenceObtainable(merged, errors);
  checkGoldenPath(merged, geography.cities[0]?.id ?? '', errors);
}

// Cada evidencia (salvo EV-11, el objeto de la recuperación, que se obtiene
// al recuperar) debe poder obtenerse por su vía: observación y objeto por
// inspeccionar, registro por consulta, análisis por analyze y testimonio por
// hablar. Sin esta comprobación el modelo declara objetos sin inspeccionable
// que los conceda y la ruta dorada falla al recogerlos («Evidencia no
// disponible») sin que el mensaje diga por qué.
function checkEvidenceObtainable(output: Record<string, unknown>, errors: string[]): void {
  if (!Array.isArray(output.evidence)) return;
  const mechanics = output.mechanics;
  if (!isRecord(mechanics)) return;
  const granted: GrantedSets = {
    inspect: grantedEvidenceIds(mechanics.inspectables),
    query: grantedEvidenceIds(mechanics.queries),
    analysis: grantedAnalysisResults(mechanics.analyses),
    talk: grantedEvidenceIds(mechanics.talkEvidence),
  };
  for (const evidence of output.evidence) {
    if (!isRecord(evidence) || typeof evidence.id !== 'string' || typeof evidence.type !== 'string') continue;
    if (evidence.id === 'EV-11') continue;
    const source = evidenceSource(evidence.id, evidence.type, granted);
    if (!source.granted) errors.push(`La evidencia ${evidence.id} (${evidence.type}) no se puede obtener: ${source.reason}.`);
  }
}

function grantedAnalysisResults(entries: unknown): Set<string> {
  const ids = new Set<string>();
  if (!Array.isArray(entries)) return ids;
  for (const analysis of entries) {
    if (isRecord(analysis) && typeof analysis.resultEvidenceId === 'string') ids.add(analysis.resultEvidenceId);
  }
  return ids;
}

function grantedEvidenceIds(entries: unknown): Set<string> {
  const ids = new Set<string>();
  if (!Array.isArray(entries)) return ids;
  for (const entry of entries) {
    if (isRecord(entry) && typeof entry.evidenceId === 'string') ids.add(entry.evidenceId);
  }
  return ids;
}

type GrantedSets = { inspect: Set<string>; query: Set<string>; analysis: Set<string>; talk: Set<string> };

// Vía por la que se obtiene una evidencia según su tipo, y si la mecánica
// la concede.
function evidenceSource(id: string, type: string, granted: GrantedSets): { granted: boolean; reason: string } {
  if (type === 'observation' || type === 'object') {
    return granted.inspect.has(id)
      ? { granted: true, reason: '' }
      : { granted: false, reason: 'ningún inspeccionable la concede (hay que inspeccionar el lugar o el elemento que la revela)' };
  }
  if (type === 'record') {
    return granted.query.has(id)
      ? { granted: true, reason: '' }
      : { granted: false, reason: 'ninguna consulta la concede' };
  }
  if (type === 'analysis') {
    return granted.analysis.has(id)
      ? { granted: true, reason: '' }
      : { granted: false, reason: 'ningún análisis la produce' };
  }
  if (type === 'testimony') {
    return granted.talk.has(id)
      ? { granted: true, reason: '' }
      : { granted: false, reason: 'ningún tema de conversación la concede' };
  }
  return { granted: false, reason: 'tipo de evidencia desconocido' };
}

function validateClues(output: unknown, geography: SelectedGeography, castIds: string[], knowledgeIds: string[], errors: string[]): void {
  validateClueWorld(output, geography, castIds, knowledgeIds, errors);
  validateClueRules(output, output, geography, errors);
}

/** Valida una de las dos mitades de la etapa 4 (a = mundo, b = reglas). */
export function validateStagePart(
  part: 'a' | 'b',
  output: unknown,
  context: { geography: SelectedGeography; castIds: string[]; knowledgeIds?: string[]; world?: unknown },
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (checkSchemaEcho(output, errors)) return { valid: false, errors };
  if (part === 'a') validateClueWorld(output, context.geography, context.castIds, context.knowledgeIds ?? [], errors);
  else validateClueRules(output, context.world, context.geography, errors);
  return { valid: errors.length === 0, errors };
}

function validateReview(output: unknown, errors: string[]): void {
  if (!isRecord(output)) { errors.push('La revisión debe ser un objeto.'); return; }
  checkKeys(output, ['coherent', 'issues'], errors);
  if (typeof output.coherent !== 'boolean') errors.push('coherent debe ser booleano.');
  if (!Array.isArray(output.issues) || !output.issues.every(isNonEmptyString)) errors.push('issues debe ser una lista de frases.');
}

/** Valida la forma de la salida del modelo para una etapa LLM. El fondo
 * (coherencia, referencias cruzadas, jugabilidad) lo comprueban el
 * validador v1.5 y el simulador en las etapas 6 y 8. */
export function validateStageOutput(stage: GenerationStage, output: unknown, context: { geography: SelectedGeography; castIds: string[]; knowledgeIds?: string[] }): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (checkSchemaEcho(output, errors)) return { valid: false, errors };
  if (stage === 1) validatePremise(output, context.geography.cities, errors);
  else if (stage === 3) validateNpcs(output, context.castIds, errors);
  else if (stage === 4) validateClues(output, context.geography, context.castIds, context.knowledgeIds ?? [], errors);
  else if (stage === 7) validateReview(output, errors);
  return { valid: errors.length === 0, errors };
}

// El modelo a veces devuelve el ESQUEMA (type/properties) en vez de los
// datos. Sin un mensaje propio, el error es solo «Falta la clave X» y el
// reintento repite el eco.
function checkSchemaEcho(output: unknown, errors: string[]): boolean {
  if (isRecord(output) && output.type === 'object' && isRecord(output.properties)) {
    errors.push('La salida es el esquema JSON, no los datos: devuelve el contenido de la etapa (lugares, evidencias, textos…), no la descripción del esquema.');
    return true;
  }
  return false;
}

// ── Ensamblaje (etapa 5, determinista) ───────────────────────────────────────

export interface AssemblyInput {
  caseId: string;
  choice: ResolvedChoice;
  params: GenerationParams;
  geography: SelectedGeography;
  premise: Record<string, unknown>;
  npcs: Record<string, unknown>;
  clues: Record<string, unknown>;
}

/** Ensambla la definición completa a partir de las salidas de etapa. La
 * dificultad de generación es siempre `normal`: la dificultad de la partida
 * se elige al crearla y multiplica el plazo. El informe de validación es
 * provisional: la etapa 6 lo sustituye por el real. */
export function assembleDefinition(input: AssemblyInput): CaseDefinition {
  const { caseId, choice, params, geography, premise, npcs, clues } = input;
  const cast = [premise.solution, premise.decoy, ...(premise.witnesses as Array<Record<string, unknown>>)] as Array<Record<string, unknown>>;
  const npcStage = (npcs.npcs as Array<Record<string, unknown>>);
  const cluesStage = clues as unknown as { locations: Array<Record<string, unknown>>; evidence: Array<Record<string, unknown>>; mechanics: CaseMechanics; texts: CaseTexts; goldenPath: Array<{ type: string; params: Record<string, unknown> }> };
  const knowledgeTokens = new Set<string>();
  for (const npc of npcStage) for (const token of npc.knowledge as string[]) knowledgeTokens.add(token);
  const evidenceIds = (cluesStage.evidence as Array<Record<string, unknown>>).map(evidence => String(evidence.id));
  const definition: CaseDefinition = {
    id: caseId,
    schemaVersion: 1,
    engineCompatibility: 1,
    contentVersion: 1,
    seed: params.seed ?? 0,
    contentMode: 'generated',
    difficulty: 'normal',
    explorationMode: params.explorationMode,
    catalogVersion: params.catalogVersion ?? '1.0',
    deadlineMinutes: DEADLINE_BY_DURATION[params.duration],
    solution: String((premise.solution as Record<string, unknown>).id),
    objectives: [
      { id: 'obj-detener', description: String((premise.objectives as Record<string, unknown>).detain), achieved: false },
      { id: 'obj-recuperar', description: String((premise.objectives as Record<string, unknown>).recover), achieved: false },
    ],
    cities: geography.cities.map(city => ({ id: city.id, name: city.name, country: city.country })),
    locations: (cluesStage.locations as Array<Record<string, unknown>>).map(location => ({
      id: String(location.id),
      cityId: String(location.cityId),
      name: String(location.name),
      description: String(location.description),
      accessible: true,
    })),
    npcs: cast.map(member => {
      const detail = npcStage.find(npc => npc.id === member.id) as Record<string, unknown>;
      return {
        id: String(member.id),
        name: String(member.name),
        cityId: String(member.cityId),
        knowledge: [...(detail.knowledge as string[])],
        cooperation: Number(detail.cooperation),
        role: String(member.role),
        persona: String(detail.persona),
      };
    }),
    facts: [...evidenceIds, ...knowledgeTokens],
    evidence: (cluesStage.evidence as Array<Record<string, unknown>>).map(evidence => ({
      id: String(evidence.id),
      type: String(evidence.type) as 'object' | 'observation' | 'testimony' | 'analysis' | 'record',
      origin: String(evidence.origin),
      minute: 0,
      admissible: true,
      relations: [...(evidence.relations as string[])],
    })),
    rules: [],
    travelDurations: geography.travelDurations,
    scheduledResults: [],
    validationReport: { validatorVersion: '1.5.0', scenarios: ['structural'], errors: [], status: 'validated' },
    mechanics: cluesStage.mechanics,
    texts: cluesStage.texts,
    // La definición es autocontenida: la intro y el delito/contenido viajan
    // con ella, así la vista del jugador no necesita otra fuente.
    briefing: premiseBriefing(premise),
    catalogMeta: { crimeType: choice.crimeType, contentRating: choice.contentRating },
  };
  return definition;
}

/** La introducción del caso (briefing sin spoilers) vive en la premisa y se
 * copia en la definición al ensamblar: la definición es autocontenida. */
export function premiseBriefing(premise: Record<string, unknown>): { speaker: string; title: string; paragraphs: string[] } {
  const briefing = premise.briefing as Record<string, unknown>;
  return {
    speaker: String(briefing.speaker),
    title: String(briefing.title),
    paragraphs: [...(briefing.paragraphs as string[])],
  };
}
