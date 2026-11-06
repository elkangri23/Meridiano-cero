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

import { GEOGRAPHIC_CATALOG, crimeAllowedForRating, getRoute, type CaseDefinition, type CaseMechanics, type CaseTexts, type ContentRating } from '@meridiano/case-schema';
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
): StageContext {
  const base: StageContext = {
    stage,
    crimeType: choice.crimeType,
    contentRating: choice.contentRating,
    duration: params.duration,
    seed: params.seed ?? 0,
    cities: geography.cities,
    contentRules: CONTENT_RULES[choice.contentRating],
  };
  if (stage === 1) return base;
  if (stage === 3) return { ...base, premise: prior.premise };
  if (stage === 4) return { ...base, premise: prior.premise, npcs: prior.npcs, ...(feedback ? { repairFeedback: feedback } : {}) };
  if (stage === 7) return { ...base, definition: prior.definition, goldenPath: prior.goldenPath, budgetMinutes: prior.budgetMinutes };
  return base;
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
      witnesses: { type: 'array', minItems: 1, maxItems: 2 },
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
  4: {
    type: 'object',
    required: ['locations', 'evidence', 'mechanics', 'texts', 'goldenPath'],
    properties: {
      locations: { type: 'array', minItems: 3, maxItems: 3 },
      evidence: { type: 'array', minItems: 11, maxItems: 11 },
      mechanics: { type: 'object' },
      texts: { type: 'object' },
      goldenPath: { type: 'array', minItems: 10, maxItems: 40 },
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
export function stageOutputSchema(stage: GenerationStage): Record<string, unknown> {
  const schema = STAGE_OUTPUT_SCHEMAS[stage];
  if (!schema) throw new Error(`La etapa ${stage} no tiene esquema de salida.`);
  return schema;
}

// ── Validación de salidas de etapa (forma, no fondo) ─────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

const NPC_ID = /^[a-z][a-z0-9-]{0,31}$/;
const LOCATION_ID = /^[A-Z]{2,4}-[A-Z]{3,6}$/;
const EVIDENCE_ID = /^EV-\d{2}$/;
const FACT_ID = /^[A-Za-z0-9._:-]{1,128}$/;

function checkKeys(output: Record<string, unknown>, required: string[], errors: string[]): void {
  for (const key of required) if (!Object.hasOwn(output, key)) errors.push(`Falta la clave ${key}.`);
}

function checkCastMember(member: unknown, cityIds: Set<string>, ids: Set<string>, errors: string[]): void {
  if (!isRecord(member)) { errors.push('Un miembro del reparto no es un objeto.'); return; }
  if (typeof member.id !== 'string' || !NPC_ID.test(member.id)) errors.push(`id de NPC inválido: ${String(member.id)}.`);
  if (ids.has(String(member.id))) errors.push(`id de NPC duplicado: ${String(member.id)}.`);
  ids.add(String(member.id));
  if (!isNonEmptyString(member.name)) errors.push(`NPC ${String(member.id)} sin nombre.`);
  if (!isNonEmptyString(member.role)) errors.push(`NPC ${String(member.id)} sin rol.`);
  if (typeof member.cityId !== 'string' || !cityIds.has(member.cityId)) errors.push(`NPC ${String(member.id)} en ciudad desconocida.`);
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
  if (!isNonEmptyString(output.truth)) errors.push('truth vacío.');
  const cityIds = new Set(cities.map(city => city.id));
  const cast = [output.solution, output.decoy, ...(Array.isArray(output.witnesses) ? output.witnesses : [])];
  const ids = new Set<string>();
  for (const member of cast) checkCastMember(member, cityIds, ids, errors);
  if (!Array.isArray(output.witnesses) || output.witnesses.length < 1 || output.witnesses.length > 2) errors.push('witnesses debe tener 1 o 2 testigos.');
  checkPremiseBriefing(output, errors);
}

function checkNpcKnowledge(npc: Record<string, unknown>, errors: string[]): void {
  if (!Array.isArray(npc.knowledge) || npc.knowledge.length === 0 || !npc.knowledge.every((token: unknown) => typeof token === 'string' && FACT_ID.test(token))) errors.push(`NPC ${String(npc.id)} con conocimiento inválido.`);
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
  if (!Array.isArray(output.timeline) || output.timeline.length < 2 || !output.timeline.every(isNonEmptyString)) errors.push('timeline debe tener al menos 2 hitos.');
}

/** Tipos de evidencia por posición (el esqueleto fijo, como el fixture del
 * fraude): observación, objeto, análisis, registro, registro, objeto,
 * registro, registro, testimonio, registro, objeto. */
export const EVIDENCE_SLOT_TYPES = ['observation', 'object', 'analysis', 'record', 'record', 'object', 'record', 'record', 'testimony', 'record', 'object'] as const;

function checkClueLocation(location: unknown, cityIds: Set<string>, locationIds: Set<string>, errors: string[]): void {
  if (!isRecord(location)) { errors.push('Un lugar no es un objeto.'); return; }
  if (typeof location.id !== 'string' || !LOCATION_ID.test(location.id)) errors.push(`id de lugar inválido: ${String(location.id)}.`);
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

function checkClueEvidence(output: Record<string, unknown>, locationIds: Set<string>, cityIds: Set<string>, errors: string[]): void {
  if (!Array.isArray(output.evidence) || output.evidence.length !== 11) { errors.push('evidence debe tener exactamente 11 evidencias (EV-01..EV-11).'); return; }
  output.evidence.forEach((evidence: unknown, index: number) => {
    if (!isRecord(evidence)) { errors.push(`Evidencia ${index + 1} no es un objeto.`); return; }
    const expectedId = `EV-${String(index + 1).padStart(2, '0')}`;
    if (evidence.id !== expectedId) errors.push(`La evidencia ${index + 1} debe ser ${expectedId}.`);
    if (evidence.type !== EVIDENCE_SLOT_TYPES[index]) errors.push(`La evidencia ${expectedId} debe ser de tipo ${EVIDENCE_SLOT_TYPES[index]}.`);
    if (typeof evidence.origin !== 'string' || (!locationIds.has(evidence.origin) && !cityIds.has(evidence.origin))) errors.push(`La evidencia ${expectedId} tiene origen desconocido.`);
    if (!Array.isArray(evidence.relations) || !evidence.relations.every((id: unknown) => typeof id === 'string' && EVIDENCE_ID.test(id))) errors.push(`La evidencia ${expectedId} tiene relaciones inválidas.`);
  });
}

const MECHANIC_COUNTS: Array<{ key: string; count: number; message: string }> = [
  { key: 'inspectables', count: 3, message: 'mechanics.inspectables debe tener 3 entradas (sala + 2 elementos).' },
  { key: 'queries', count: 5, message: 'mechanics.queries debe tener 5 consultas.' },
  { key: 'analyses', count: 1, message: 'mechanics.analyses debe tener 1 análisis.' },
  { key: 'talkEvidence', count: 1, message: 'mechanics.talkEvidence debe tener 1 tema.' },
];

function checkClueMechanics(output: Record<string, unknown>, errors: string[]): void {
  if (!isRecord(output.mechanics)) { errors.push('mechanics debe ser un objeto.'); return; }
  const mechanics = output.mechanics;
  for (const entry of MECHANIC_COUNTS) {
    if (!Array.isArray(mechanics[entry.key]) || (mechanics[entry.key] as unknown[]).length !== entry.count) errors.push(entry.message);
  }
  if (!Array.isArray(mechanics.suspects) || mechanics.suspects.length < 1 || mechanics.suspects.length > 2) errors.push('mechanics.suspects debe tener 1 o 2 sospechosos.');
  if (!isRecord(mechanics.recovery)) errors.push('mechanics.recovery debe ser un objeto.');
}

function checkClueTexts(output: Record<string, unknown>, castIds: string[], errors: string[]): void {
  if (!isRecord(output.texts)) { errors.push('texts debe ser un objeto.'); return; }
  const texts = output.texts;
  if (!isRecord(texts.evidence) || Object.keys(texts.evidence).length !== 11) errors.push('texts.evidence debe tener 11 textos.');
  if (!isRecord(texts.greetings)) errors.push('texts.greetings debe ser un objeto.');
  for (const id of castIds) if (!isRecord(texts.greetings) || !isNonEmptyString((texts.greetings as Record<string, unknown>)[id])) errors.push(`Falta el saludo de ${id}.`);
}

function checkGoldenActions(output: Record<string, unknown>, errors: string[]): string[] {
  if (!Array.isArray(output.goldenPath)) return [];
  for (const action of output.goldenPath) {
    if (!isRecord(action) || !isNonEmptyString(action.type) || !isRecord(action.params)) errors.push('Una acción de goldenPath no tiene type/params.');
  }
  return output.goldenPath.map((action: unknown) => isRecord(action) && typeof action.type === 'string' ? action.type : '');
}

function checkGoldenPath(output: Record<string, unknown>, errors: string[]): void {
  if (!Array.isArray(output.goldenPath) || output.goldenPath.length < 10 || output.goldenPath.length > 40) errors.push('goldenPath debe tener entre 10 y 40 acciones.');
  if (!Array.isArray(output.goldenPath)) return;
  const types = checkGoldenActions(output, errors);
  if (!types.includes('detain')) errors.push('goldenPath debe incluir una detención.');
  if (!types.includes('recover')) errors.push('goldenPath debe incluir una recuperación.');
  const last = output.goldenPath[output.goldenPath.length - 1];
  if (!isRecord(last) || last.type !== 'finish') errors.push('goldenPath debe terminar con el cierre del caso.');
}

function validateClues(output: unknown, geography: SelectedGeography, castIds: string[], errors: string[]): void {
  if (!isRecord(output)) { errors.push('La red de pistas debe ser un objeto.'); return; }
  checkKeys(output, ['locations', 'evidence', 'mechanics', 'texts', 'goldenPath'], errors);
  const cityIds = new Set(geography.cities.map(city => city.id));
  const locationIds = checkClueLocations(output, cityIds, errors);
  if (locationIds) checkClueEvidence(output, locationIds, cityIds, errors);
  checkClueMechanics(output, errors);
  checkClueTexts(output, castIds, errors);
  checkGoldenPath(output, errors);
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
export function validateStageOutput(stage: GenerationStage, output: unknown, context: { geography: SelectedGeography; castIds: string[] }): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (stage === 1) validatePremise(output, context.geography.cities, errors);
  else if (stage === 3) validateNpcs(output, context.castIds, errors);
  else if (stage === 4) validateClues(output, context.geography, context.castIds, errors);
  else if (stage === 7) validateReview(output, errors);
  return { valid: errors.length === 0, errors };
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
