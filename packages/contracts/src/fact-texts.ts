// Textos legibles para lo que el jugador descubre y escucha (caso fijo del
// astrolabio). Todo sale de SPEC-003: la tabla de evidencias («Hecho
// revelado»), el apartado de lugares y conocimiento, y la verdad fijada.
// No se inventa ningún hecho: cada texto solo se muestra cuando el motor ya
// ha revelado el identificador correspondiente, así que nunca filtra
// spoilers. El motor sigue trabajando con IDs; esto solo traduce lo que el
// jugador ya ha descubierto a frases que una persona puede leer.
//
// Los expedientes generados (T4-08) traen sus propios textos en
// `CaseDefinition.texts`: las funciones de este módulo aceptan un `texts`
// opcional y, cuando está presente, lo usan en vez del catálogo fijo. Sin
// él, el comportamiento es el de siempre (caso fijo).
import { RECURRENT_NPCS, remoteChannelInSentence } from './npc-catalog.js';
import { teamMember } from './team.js';
import type { LocaleKey } from './locales/es.js';
import type { Language } from './preferences.js';
import { resolveMessage } from './i18n.js';
import { caseText } from './locales/cases.js';

/**
 * Textos narrativos de un expediente generado (T4-08). El caso fijo los
 * tiene hardcodeados en este módulo; los generados los traen aquí.
 * `evidence` es el hecho revelado por cada evidencia; `knowledge`, lo que
 * cada personaje puede contar sobre lo que sabe (en primera persona);
 * `greetings`, el saludo al hablar con cada NPC; `refusals`, la negativa en
 * personaje (normalmente solo la del sospechoso sobre el delito).
 */
export interface CaseTexts {
  evidence: Record<string, string>;
  knowledge: Record<string, string>;
  greetings: Record<string, string>;
  refusals?: Record<string, string>;
}

/** Hecho revelado por cada evidencia (SPEC-003, tabla de evidencias). */
export const EVIDENCE_TEXTS: Record<string, string> = {
  'EV-01': 'La caja está a la vista. Su etiqueta remite al archivo de París.',
  'EV-02': 'La cerradura de la vitrina tiene residuo de herramienta.',
  'EV-03': 'La huella técnica es compatible con una herramienta de la serie HV-17. No acusa a nadie por sí sola.',
  'EV-04': 'El registro firmado asigna la herramienta HV-17 a Inés Valera.',
  'EV-05': 'El envío va a Lisboa. La titular del depósito es Inés Valera, taquilla L-7.',
  'EV-06': 'La caja guarda una copia del manifiesto, con sello y firma verificables.',
  'EV-07': 'La firma y la autorización de Inés están verificadas: el envío es original, no una copia.',
  'EV-08': 'Hay un asiento independiente de recepción del envío por Inés, en el depósito L-7.',
  'EV-09': 'Lucía declara que Tomás movió la caja; no vio qué había dentro.',
  'EV-10': 'El registro muestra el acceso real de Tomás durante la preparación del envío.',
  'EV-11': 'El astrolabio original está recuperado.',
};

/** Lo que cada personaje puede contar sobre lo que sabe (SPEC-003,
 * «Lugares y conocimiento»). Se escribe en primera persona porque es lo que
 * el personaje dice cuando se le pregunta; el director solo elige qué
 * hechos declarar, nunca inventa el texto. La verdad de Inés se limita a su
 * identidad: puede negarse a declarar sobre el robo y nunca inventa una
 * coartada, así que declarar este hecho nunca filtra la solución. */
export const KNOWLEDGE_TEXTS: Record<string, string> = {
  'his-task': 'Yo solo moví la caja vacía de la sala de embalaje, como me tocaba por mi trabajo. La caja estaba vacía cuando la moví.',
  'authorized-persons': 'Tengo la lista de personas autorizadas para el traslado.',
  'tomas-moved-box': 'Vi a Tomás mover la caja, pero no vi qué había dentro.',
  'tool-registry': 'Llevo el registro de herramientas del archivo y puedo comprobar a quién se asignó cada herramienta.',
  'deposit-record': 'Tengo el registro de custodia del almacén y puedo comprobar quién recibió cada envío.',
  'locker-l7': 'La taquilla L-7 es un depósito de custodia del almacén.',
  truth: 'Soy Inés Valera, restauradora contratada para el traslado del astrolabio.',
};

/** Saludo al confirmar «hablar con» alguien (tema identidad, SPEC-003):
 * el personaje confirma quién es y deja claro que se le puede preguntar.
 * Inés confirma su identidad y avisa de que no declarará sobre el robo. */
export const NPC_GREETINGS: Record<string, string> = {
  lucia: 'Soy Lucía, conservadora del Instituto Horizonte. ¿En qué puedo ayudarte?',
  emile: 'Soy Émile, archivero de conservación. ¿Qué registro buscas?',
  marta: 'Soy Marta, encargada del almacén de depósito. ¿Qué necesitas?',
  tomas: 'Soy Tomás Ríos, transportista del Instituto Horizonte. ¿Qué quieres saber?',
  ines: 'Soy Inés Valera, restauradora. Puedo confirmar mi identidad, pero no voy a declarar sobre el robo.',
};

export interface DiscoveryLookup {
  locationName: (id: string) => string | undefined;
  cityName: (id: string) => string | undefined;
  npcName: (id: string) => string | undefined;
}

/** Texto de una evidencia, si existe. Con `texts` (expediente generado), el
 * texto viene del expediente; sin él, del catálogo fijo. Con `caseId` e
 * idioma distinto de español, la traducción del caso manda y el español de
 * la definición es el fallback. */
export function evidenceText(evidenceId: string, texts?: CaseTexts, caseId?: string, language: Language = 'es'): string | undefined {
  if (caseId) {
    const translated = caseText(caseId, 'texts.evidence.' + evidenceId, language);
    if (translated) return translated;
  }
  return texts ? texts.evidence[evidenceId] : EVIDENCE_TEXTS[evidenceId];
}

/** Informe final: resultado y motivo del cierre, en español. Viven en el
 * índice de este paquete (`REPORT_RESULT_KEYS`, `REPORT_REASON_KEYS`,
 * `reportResultText`, `reportReasonText`); este módulo no los re-exporta
 * para no cerrar un ciclo con el índice. */

/** Claves de las etiquetas de acción irregular (GDD §14, i18n): el texto
 * vive en `locales/es.ts` y la web lo resuelve con `t()`. */
export const IRREGULAR_KIND_KEYS: Record<string, LocaleKey> = {
  force_entry: 'labels.irregular.force_entry',
  bribe: 'labels.irregular.bribe',
  impersonate: 'labels.irregular.impersonate',
};

/** Objetivos del caso fijo, como frases: la descripción es la que trae la
 * definición del expediente (nada inventado). Un identificador desconocido
 * (p. ej. de un caso generado) se devuelve tal cual. */
export const OBJECTIVE_TEXT: Record<string, string> = {
  'obj-detener': 'Detener a Inés con orden válida',
  'obj-recuperar': 'Recuperar el astrolabio original',
};

/** Etiquetas de tema que no son frases que diría el personaje («Información
 * sobre…», «Conocimiento del mercado…», «Datos sobre…»): el director
 * muestra el texto del hecho tal cual al declarar (`state`), así que una
 * etiqueta se repite como loro y nunca suena a conversación (GDD §7: el NPC
 * tiene personalidad y memoria; la conversación la expresa el LLM sin
 * alterar hechos). La etapa 4a debe escribir frases en primera persona que
 * el NPC diría («Conozco…», «Sé que…») y el validador rechaza las
 * etiquetas. Solo detecta el patrón etiqueta: una descripción en tercera
 * persona («El registro documenta…») no es etiqueta y la acepta el
 * validador, aunque la regla del prompt pida primera persona. */
const KNOWLEDGE_LABEL_PATTERN = /^(información|conocimiento|datos|detalles|descripción|gestión|registro|informe)\s+(sobre|de|del)\b/i;
export function isKnowledgeLabelText(text: string): boolean {
  return KNOWLEDGE_LABEL_PATTERN.test(text.trim());
}

/**
 * Contenido real en un texto de conocimiento (tercera vuelta de la
 * conversación natural, 2026-11-07): no basta con que el texto sea una frase
 * en primera persona; debe nombrar al menos un elemento concreto del mundo
 * del caso — un lugar, un objeto, un procedimiento o un suceso de las
 * evidencias, los lugares o la mecánica — porque el modelo solo puede
 * declarar lo que los hechos autorizados contienen: si el hecho es solo el
 * tema («Conozco el mercado…», «Sé que los traslados…»), la respuesta solo
 * puede parafrasear el tema y nunca da información. Fechas, rutas o
 * cantidades no existen en estos mundos y no se exigen; el contenido es
 * objeto/lugar/procedimiento/suceso.
 *
 * La comprobación es heurística y deliberadamente léxica, como el detector
 * de etiquetas: el texto pasa si comparte al menos un bigrama de palabras
 * de contenido con el mundo del caso (p. ej. «registro de seguridad»,
 * «etiqueta de envío», «cuaderno de campo», «archivo municipal») o si
 * nombra una ciudad o un personaje del caso. Las palabras funcionales y los
 * términos genéricos de tema (mercado, traslados, movimientos, objetos,
 * conocimiento, información…) no cuentan: «Conozco el mercado de
 * antigüedades y los canales de venta» no comparte ningún bigrama con el
 * mundo y se rechaza, aunque «antigüedades» aparezca en alguna evidencia.
 * Es un suelo, no una garantía de profundidad: un texto puede nombrar un
 * lugar y seguir siendo vago, pero sin ancla al mundo no puede dar
 * información. El humo en producción con preguntas reales es la aceptación.
 */
export interface KnowledgeContentWorld {
  locations?: Array<{ name?: string | undefined; description?: string | undefined }>;
  cities?: Array<{ name?: string | undefined }>;
  npcs?: Array<{ name?: string | undefined; persona?: string | undefined }>;
  evidenceTexts?: string[];
  greetings?: string[];
  briefing?: string[];
  labels?: string[];
}

const KNOWLEDGE_CONTENT_STOP_WORDS: ReadonlySet<string> = new Set([
  'de', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas', 'en', 'con', 'por', 'a', 'y', 'o',
  'su', 'sus', 'mi', 'mis', 'tu', 'tus', 'se', 'que', 'es', 'son', 'fue', 'fueron', 'ha', 'han', 'he',
  'del', 'al', 'lo', 'le', 'les', 'me', 'te', 'nos', 'os', 'si', 'no', 'ya', 'mas', 'muy', 'pero',
  'como', 'cuando', 'donde', 'porque', 'tambien', 'entre', 'hasta', 'desde', 'hacia', 'cada',
  'ante', 'bajo', 'tras', 'segun', 'aunque', 'ademas', 'luego', 'ahora', 'antes', 'despues',
  'siempre', 'nunca', 'mucho', 'poco', 'bien', 'mal', 'tanto', 'tanta', 'todo', 'toda', 'todos',
  'todas', 'esto', 'esta', 'este', 'estos', 'estas', 'otro', 'otra', 'otros', 'otras', 'mismo',
  'misma', 'parte', 'forma', 'manera', 'general', 'ser', 'estar', 'haber', 'poder', 'deber',
  'hacer', 'saber', 'decir', 'ver', 'venir', 'salir', 'entrar', 'pasar', 'quedar', 'poner', 'dar',
  'tener', 'conozco', 'conoces', 'conoce', 'sabes', 'sabe', 'trabajo', 'trabaja', 'gestiono',
  'gestiona', 'llevo', 'lleva', 'puedo', 'puede', 'reviso', 'revisa', 'controlo', 'controla',
  'tengo', 'tiene', 'recuerdo', 'recuerda', 'observe', 'observo', 'note', 'noto', 'veo', 'dice',
  'dicen', 'creo', 'cree', 'parece', 'parecia', 'hay', 'estoy', 'estas', 'estan', 'era', 'eran', 'sera',
]);

function stripAccents(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function knowledgeContentWords(text: string): string[] {
  return stripAccents(text.toLowerCase()).split(/[^a-z0-9]+/).filter(word => word.length > 0 && !KNOWLEDGE_CONTENT_STOP_WORDS.has(word));
}

function knowledgeContentBigrams(text: string): Set<string> {
  const words = knowledgeContentWords(text);
  const out = new Set<string>();
  for (let i = 0; i + 1 < words.length; i++) out.add(`${words[i]} ${words[i + 1]}`);
  return out;
}

export interface KnowledgeContentAnchors {
  bigrams: Set<string>;
  names: Set<string>;
}

function anchorSources(world: KnowledgeContentWorld): string[] {
  const locations = (world.locations ?? []).flatMap(location => [location.name, location.description]);
  const cities = (world.cities ?? []).map(city => city.name);
  const npcs = (world.npcs ?? []).flatMap(npc => [npc.name, npc.persona]);
  return [...locations, ...cities, ...npcs, ...(world.evidenceTexts ?? []), ...(world.greetings ?? []), ...(world.briefing ?? []), ...(world.labels ?? [])]
    .filter((source): source is string => typeof source === 'string');
}

function anchorNames(world: KnowledgeContentWorld, includeNpcs: boolean): Set<string> {
  const names = new Set<string>();
  for (const city of world.cities ?? []) if (city.name) names.add(stripAccents(city.name.toLowerCase()));
  if (includeNpcs) for (const npc of world.npcs ?? []) if (npc.name) names.add(stripAccents(npc.name.toLowerCase()));
  return names;
}

export function knowledgeContentAnchors(world: KnowledgeContentWorld, includeNpcNames = true): KnowledgeContentAnchors {
  const bigrams = new Set<string>();
  for (const source of anchorSources(world)) for (const bigram of knowledgeContentBigrams(source)) bigrams.add(bigram);
  return { bigrams, names: anchorNames(world, includeNpcNames) };
}

export function hasKnowledgeContent(text: string, anchors: KnowledgeContentAnchors): boolean {
  const normalized = stripAccents(text.toLowerCase());
  for (const name of anchors.names) {
    if (name && new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(normalized)) return true;
  }
  for (const bigram of knowledgeContentBigrams(text)) if (anchors.bigrams.has(bigram)) return true;
  return false;
}

/** Frase de un objetivo logrado del informe final. Con `caseId` e idioma
 * distinto de español, la traducción del caso manda y la frase española de
 * la definición es el fallback. */
export function objectiveText(objectiveId: string, caseId?: string, language: Language = 'es'): string {
  if (caseId) {
    const translated = caseText(caseId, 'objective.' + objectiveId, language);
    if (translated) return translated;
  }
  return OBJECTIVE_TEXT[objectiveId] ?? objectiveId;
}

/** Hechos que un personaje puede declarar, con su texto, según su
 * conocimiento (RECURRENT_NPCS). Con `texts` y `knowledgeIds` (expediente
 * generado), el conocimiento y los textos vienen del expediente. Con
 * `caseId` e idioma distinto de español, la traducción del caso manda. */
export function npcKnowledgeFacts(npcId: string, texts?: CaseTexts, knowledgeIds?: string[], caseId?: string, language: Language = 'es'): Array<{ id: string; text: string }> {
  const knowledge = texts ? (knowledgeIds ?? []) : (RECURRENT_NPCS.find(item => item.id === npcId)?.knowledge ?? []);
  const source = texts ? texts.knowledge : KNOWLEDGE_TEXTS;
  return knowledge.flatMap(id => {
    const text = (caseId ? caseText(caseId, 'texts.knowledge.' + id, language) : undefined) ?? source[id];
    return text ? [{ id, text }] : [];
  });
}

/** Negativa en personaje al pedirle que declare sobre el robo. Solo Inés
 * tiene una: es la sospechosa y su saludo ya avisa de que no declarará.
 * Los demás personajes no tienen negativa propia y usan la genérica del
 * director. Negarse no es confesar: no revela la solución ni acusa a nadie. */
export const NPC_REFUSALS: Record<string, string> = {
  ines: 'No voy a declarar sobre el robo.',
};

/** Negativa en personaje de un NPC al declarar sobre el robo, si la tiene. */
export function npcRefusal(npcId: string, texts?: CaseTexts, caseId?: string, language: Language = 'es'): string | undefined {
  if (caseId) {
    const translated = caseText(caseId, 'texts.refusals.' + npcId, language);
    if (translated) return translated;
  }
  return texts ? texts.refusals?.[npcId] : NPC_REFUSALS[npcId];
}

/** Saludo de un personaje al empezar a hablar con él. */
export function npcGreeting(npcId: string, texts?: CaseTexts, caseId?: string, language: Language = 'es'): string | undefined {
  if (caseId) {
    const translated = caseText(caseId, 'texts.greetings.' + npcId, language);
    if (translated) return translated;
  }
  return texts ? texts.greetings[npcId] : NPC_GREETINGS[npcId];
}

/** Frase del primer viaje a una ciudad (`travel:<ciudad>`): el motor lo
 * registra como descubrimiento. Nunca se muestra la clave cruda. */
function travelDiscovery(id: string, lookup: DiscoveryLookup, language: Language): string | undefined {
  if (!id.startsWith('travel:')) return undefined;
  const city = lookup.cityName(id.slice('travel:'.length));
  return city ? resolveMessage(language, 'engine.discovery.travel', { city }) : resolveMessage(language, 'engine.discovery.travelFallback');
}

/** Frase para un marcador del motor (análisis, identidad, ubicación,
 * respuesta recibida u orden denegada); undefined si no es un marcador. */
/** Marcadores de conducta irregular en el dossier: el acceso forzado y
 * la advertencia de A.C.M.E. se leen como frases, nunca como claves. */
function irregularMarker(id: string, language: Language): string | undefined {
  if (id === 'forced-entry') return resolveMessage(language, 'engine.discovery.forcedEntry');
  // La regla es retirar el caso a la 3.ª vez visto (motor `misconduct.ts`,
  // `WITNESSED_WITHDRAWAL_COUNT`): el texto anterior decía «si te ven otra
  // vez», que es la 2.ª, y mentía sobre la regla.
  if (id === 'warning') return resolveMessage(language, 'engine.discovery.warning', { count: 3 });
  return undefined;
}

function markerDiscovery(id: string, lookup: DiscoveryLookup, texts?: CaseTexts, caseId?: string, language: Language = 'es'): string | undefined {
  const travel = travelDiscovery(id, lookup, language);
  if (travel) return travel;
  const prefixed = prefixedMarker(id, lookup, texts, caseId, language);
  if (prefixed) return prefixed;
  if (id.startsWith('communication_received:')) return resolveMessage(language, 'engine.discovery.communicationReceived');
  if (id.startsWith('warrant-denied:')) return resolveMessage(language, 'engine.discovery.warrantDenied');
  return irregularMarker(id, language);
}

/** Hallazgos con prefijo (`analysis:`, `identity:`, `location:`): el texto
 * del hecho o del personaje, o el identificador tal cual si no se conoce. */
function prefixedMarker(id: string, lookup: DiscoveryLookup, texts?: CaseTexts, caseId?: string, language: Language = 'es'): string | undefined {
  if (id.startsWith('analysis:')) {
    const inner = evidenceText(id.slice('analysis:'.length), texts, caseId, language);
    return inner ? resolveMessage(language, 'engine.discovery.analysis', { text: inner }) : id;
  }
  if (id.startsWith('identity:')) {
    const name = lookup.npcName(id.slice('identity:'.length));
    return name ? resolveMessage(language, 'engine.discovery.identity', { name }) : id;
  }
  if (id.startsWith('location:')) {
    const name = lookup.npcName(id.slice('location:'.length));
    return name ? resolveMessage(language, 'engine.discovery.location', { name }) : id;
  }
  return undefined;
}

/** Frase narrativa de un viaje confirmado: de la ciudad de origen a la de
 * destino. Solo usa nombres que el jugador ya conoce; no inventa hechos
 * del caso (es narración genérica de desplazamiento). */
export function travelText(fromCity: string | undefined, toCity: string, language: Language = 'es'): string {
  return fromCity && fromCity !== toCity
    ? resolveMessage(language, 'engine.travel.fromTo', { from: fromCity, to: toCity })
    : resolveMessage(language, 'engine.travel.arrive', { to: toCity });
}

/** Frase legible para un hallazgo del dossier. Los identificadores que el
 * motor produce para el caso fijo son: evidencias (EV-xx), lugares
 * (MAD-SALA…), ciudades (paris, lisboa…), marcadores de identidad y
 * ubicación (`identity:<npc>`, `location:<npc>`), análisis madurados
 * (`analysis:EV-xx`), respuestas recibidas y órdenes denegadas. Un
 * identificador desconocido se devuelve tal cual: nunca se oculta un
 * hallazgo por no tener texto. */
export function discoveryText(id: string, lookup: DiscoveryLookup, texts?: CaseTexts, caseId?: string, language: Language = 'es'): string {
  const evidence = evidenceText(id, texts, caseId, language);
  if (evidence) return evidence;
  const marker = markerDiscovery(id, lookup, texts, caseId, language);
  if (marker) return marker;
  const location = lookup.locationName(id);
  if (location) return resolveMessage(language, 'engine.discovery.knownLocation', { name: location });
  const city = lookup.cityName(id);
  if (city) return resolveMessage(language, 'engine.discovery.knownCity', { name: city });
  return id;
}

/** Frase legible para un registro de conversación (`talk:<npc>@<minuto>`,
 * `communication_sent:<id>:<canal>:<npc>[:<documento>]@<minuto>` o
 * `communication_received:<id>@<minuto>`). Un registro desconocido se
 * devuelve tal cual. El documento se nombra por su texto cuando
 * `documentText` lo resuelve; sin él, por su código. */
function talkRecordText(record: string, npcName: (id: string) => string | undefined, language: Language): string | null {
  const talk = /^talk:([A-Za-z0-9._:-]+)@(\d+)$/.exec(record);
  if (!talk) return null;
  const name = npcName(talk[1] ?? '');
  return name ? resolveMessage(language, 'engine.record.talk', { name, minute: talk[2] ?? '' }) : record;
}

function sentRecordText(record: string, npcName: (id: string) => string | undefined, documentText?: (id: string) => string | undefined, language: Language = 'es'): string | null {
  const sent = /^communication_sent:(?:[^:@]+):(call|whatsapp|sms|email|fax):([^:@]+)(?::([^:@]+))?@(\d+)$/.exec(record);
  if (!sent) return null;
  const name = npcName(sent[2] ?? '');
  if (!name) return record;
  const channel = remoteChannelInSentence(sent[1] as 'call' | 'whatsapp' | 'sms' | 'email' | 'fax', language);
  const document = sentDocumentText(sent, documentText);
  const minute = sent[4] ?? '';
  return document
    ? resolveMessage(language, 'engine.record.sentDocument', { name, channel, document, minute })
    : resolveMessage(language, 'engine.record.sentMessage', { name, channel, minute });
}

/** Nombre del documento de un envío: por su texto cuando se resuelve, por
 * su código si no, o vacío cuando el envío no llevaba documento. */
function sentDocumentText(sent: RegExpExecArray, documentText?: (id: string) => string | undefined): string {
  return sent[3] ? (documentText?.(sent[3]) ?? sent[3]) : '';
}

/** Frase legible para un registro de conducta irregular
 * (`irregular:<tipo>:<objetivo>@<minuto>`, GDD §14): el objetivo es un
 * personaje (soborno, suplantación) o un lugar (acceso forzado). Sin
 * nombre conocido se devuelve el registro tal cual: nunca se oculta. */
function irregularRecordText(
  record: string,
  npcName: (id: string) => string | undefined,
  locationName?: (id: string) => string | undefined,
  language: Language = 'es',
): string | null {
  const match = /^irregular:(force_entry|bribe|impersonate):([A-Za-z0-9._:-]+)@(\d+)$/.exec(record);
  if (!match) return null;
  const kind = match[1];
  const target = match[2] ?? '';
  const minute = match[3] ?? '';
  if (kind === 'force_entry') {
    const place = locationName?.(target) ?? target;
    return resolveMessage(language, 'engine.record.irregularForce', { place, minute });
  }
  const name = npcName(target);
  if (!name) return record;
  return kind === 'bribe'
    ? resolveMessage(language, 'engine.record.irregularBribe', { name, minute })
    : resolveMessage(language, 'engine.record.irregularImpersonate', { name, minute });
}

/** Frase legible para un registro de petición al equipo A.C.M.E.
 * (`team:<miembro>:<servicio>[:<objetivo>]@<minuto>`, GDD §8). Sin
 * nombre conocido se devuelve el registro tal cual: nunca se oculta. */
function teamRecordText(record: string, language: Language): string | null {
  const match = /^team:([a-z]+):([a-z]+)(?::([A-Za-z0-9._:-]+))?@(\d+)$/.exec(record);
  if (!match) return null;
  const [, memberId = '', serviceId = '', targetId = '', minute = ''] = match;
  const member = teamMember(memberId);
  if (!member) return record;
  const phrases: Record<string, { key: string; vars: Record<string, string> }> = {
    briefing: { key: 'engine.record.team.briefing', vars: {} },
    explain: targetId
      ? { key: 'engine.record.team.explain', vars: { target: targetId } }
      : { key: 'engine.record.team.explainNoTarget', vars: {} },
    lookup: { key: 'engine.record.team.lookup', vars: {} },
    routes: { key: 'engine.record.team.routes', vars: {} },
    organize: { key: 'engine.record.team.organize', vars: {} },
    // La evaluación de carrera de Margaret faltaba y el dossier enseñaba
    // el registro crudo `team:margaret:evaluate@10`.
    evaluate: { key: 'engine.record.team.evaluate', vars: {} },
    advice: { key: 'engine.record.team.advice', vars: {} },
  };
  const phrase = phrases[serviceId];
  if (!phrase) return record;
  return resolveMessage(language, phrase.key, { name: member.name, minute, ...phrase.vars });
}

export function conversationRecordText(record: string, npcName: (id: string) => string | undefined, documentText?: (id: string) => string | undefined, locationName?: (id: string) => string | undefined, language: Language = 'es'): string {
  const talk = talkRecordText(record, npcName, language);
  if (talk !== null) return talk;
  const sent = sentRecordText(record, npcName, documentText, language);
  if (sent !== null) return sent;
  const received = /^communication_received:[A-Za-z0-9._:-]+@(\d+)$/.exec(record);
  if (received) return resolveMessage(language, 'engine.record.received', { minute: received[1] ?? '' });
  const irregular = irregularRecordText(record, npcName, locationName, language);
  if (irregular !== null) return irregular;
  const team = teamRecordText(record, language);
  if (team !== null) return team;
  const warning = /^warning:([A-Za-z0-9._:-]+)@(\d+)$/.exec(record);
  if (warning) return resolveMessage(language, 'engine.record.warning', { minute: warning[2] ?? '' });
  return record;
}
