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
import { RECURRENT_NPCS } from './npc-catalog.js';
import type { CaseTexts } from './types.js';

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
 * texto viene del expediente; sin él, del catálogo fijo. */
export function evidenceText(evidenceId: string, texts?: CaseTexts): string | undefined {
  return texts ? texts.evidence[evidenceId] : EVIDENCE_TEXTS[evidenceId];
}

/** Informe final: resultado y motivo del cierre, en español. El motor
 * trabaja con identificadores en inglés (`complete`, `finished`…); la
 * pantalla del jugador nunca los enseña tal cual. Un valor desconocido se
 * devuelve tal cual: nunca se oculta el resultado por no tener texto. */
export const REPORT_RESULT_TEXT: Record<string, string> = {
  complete: 'completado',
  partial: 'parcial',
  incorrect: 'incorrecto',
  unresolved: 'sin resolver',
};

export const REPORT_REASON_TEXT: Record<string, string> = {
  finished: 'finalizado',
  deadline: 'plazo agotado',
};

/** Frase de un resultado del informe final. */
export function reportResultText(result: string): string {
  return REPORT_RESULT_TEXT[result] ?? result;
}

/** Frase de un motivo de cierre del informe final. */
export function reportReasonText(reason: string): string {
  return REPORT_REASON_TEXT[reason] ?? reason;
}

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

export function knowledgeContentAnchors(world: KnowledgeContentWorld): KnowledgeContentAnchors {
  const sources: string[] = [];
  for (const location of world.locations ?? []) {
    if (location.name) sources.push(location.name);
    if (location.description) sources.push(location.description);
  }
  for (const city of world.cities ?? []) if (city.name) sources.push(city.name);
  for (const npc of world.npcs ?? []) {
    if (npc.name) sources.push(npc.name);
    if (npc.persona) sources.push(npc.persona);
  }
  for (const text of world.evidenceTexts ?? []) sources.push(text);
  for (const text of world.greetings ?? []) sources.push(text);
  for (const text of world.briefing ?? []) sources.push(text);
  for (const text of world.labels ?? []) sources.push(text);
  const bigrams = new Set<string>();
  for (const source of sources) for (const bigram of knowledgeContentBigrams(source)) bigrams.add(bigram);
  const names = new Set<string>();
  for (const city of world.cities ?? []) if (city.name) names.add(stripAccents(city.name.toLowerCase()));
  for (const npc of world.npcs ?? []) if (npc.name) names.add(stripAccents(npc.name.toLowerCase()));
  return { bigrams, names };
}

export function hasKnowledgeContent(text: string, anchors: KnowledgeContentAnchors): boolean {
  const normalized = stripAccents(text.toLowerCase());
  for (const name of anchors.names) {
    if (name && new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(normalized)) return true;
  }
  for (const bigram of knowledgeContentBigrams(text)) if (anchors.bigrams.has(bigram)) return true;
  return false;
}

/** Frase de un objetivo logrado del informe final. */
export function objectiveText(objectiveId: string): string {
  return OBJECTIVE_TEXT[objectiveId] ?? objectiveId;
}

/** Hechos que un personaje puede declarar, con su texto, según su
 * conocimiento (RECURRENT_NPCS). Con `texts` y `knowledgeIds` (expediente
 * generado), el conocimiento y los textos vienen del expediente. */
export function npcKnowledgeFacts(npcId: string, texts?: CaseTexts, knowledgeIds?: string[]): Array<{ id: string; text: string }> {
  const knowledge = texts ? (knowledgeIds ?? []) : (RECURRENT_NPCS.find(item => item.id === npcId)?.knowledge ?? []);
  const source = texts ? texts.knowledge : KNOWLEDGE_TEXTS;
  return knowledge.flatMap(id => {
    const text = source[id];
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
export function npcRefusal(npcId: string, texts?: CaseTexts): string | undefined {
  return texts ? texts.refusals?.[npcId] : NPC_REFUSALS[npcId];
}

/** Saludo de un personaje al empezar a hablar con él. */
export function npcGreeting(npcId: string, texts?: CaseTexts): string | undefined {
  return texts ? texts.greetings[npcId] : NPC_GREETINGS[npcId];
}

/** Frase del primer viaje a una ciudad (`travel:<ciudad>`): el motor lo
 * registra como descubrimiento. Nunca se muestra la clave cruda. */
function travelDiscovery(id: string, lookup: DiscoveryLookup): string | undefined {
  if (!id.startsWith('travel:')) return undefined;
  const city = lookup.cityName(id.slice('travel:'.length));
  return city ? `Viajas a ${city}.` : 'Viaje realizado.';
}

/** Frase para un marcador del motor (análisis, identidad, ubicación,
 * respuesta recibida u orden denegada); undefined si no es un marcador. */
function markerDiscovery(id: string, lookup: DiscoveryLookup, texts?: CaseTexts): string | undefined {
  const travel = travelDiscovery(id, lookup);
  if (travel) return travel;
  if (id.startsWith('analysis:')) {
    const inner = evidenceText(id.slice('analysis:'.length), texts);
    return inner ? `Análisis completado: ${inner}` : id;
  }
  if (id.startsWith('identity:')) {
    const name = lookup.npcName(id.slice('identity:'.length));
    return name ? `Confirmaste la identidad de ${name}.` : id;
  }
  if (id.startsWith('location:')) {
    const name = lookup.npcName(id.slice('location:'.length));
    return name ? `Sabes dónde encontrar a ${name}.` : id;
  }
  if (id.startsWith('communication_received:')) return 'Llegó la respuesta a tu solicitud.';
  if (id.startsWith('warrant-denied:')) return 'Una orden solicitada ha sido denegada.';
  return undefined;
}

/** Frase narrativa de un viaje confirmado: de la ciudad de origen a la de
 * destino. Solo usa nombres que el jugador ya conoce; no inventa hechos
 * del caso (es narración genérica de desplazamiento). */
export function travelText(fromCity: string | undefined, toCity: string): string {
  return fromCity && fromCity !== toCity ? `Sales de ${fromCity} y llegas a ${toCity}.` : `Llegas a ${toCity}.`;
}

/** Frase legible para un hallazgo del dossier. Los identificadores que el
 * motor produce para el caso fijo son: evidencias (EV-xx), lugares
 * (MAD-SALA…), ciudades (paris, lisboa…), marcadores de identidad y
 * ubicación (`identity:<npc>`, `location:<npc>`), análisis madurados
 * (`analysis:EV-xx`), respuestas recibidas y órdenes denegadas. Un
 * identificador desconocido se devuelve tal cual: nunca se oculta un
 * hallazgo por no tener texto. */
export function discoveryText(id: string, lookup: DiscoveryLookup, texts?: CaseTexts): string {
  const evidence = texts ? texts.evidence[id] : EVIDENCE_TEXTS[id];
  if (evidence) return evidence;
  const marker = markerDiscovery(id, lookup, texts);
  if (marker) return marker;
  const location = lookup.locationName(id);
  if (location) return `Lugar conocido: ${location}.`;
  const city = lookup.cityName(id);
  if (city) return `Ciudad conocida: ${city}.`;
  return id;
}

/** Frase legible para un registro de conversación (`talk:<npc>@<minuto>` o
 * `communication_received:<id>@<minuto>`). Un registro desconocido se
 * devuelve tal cual. */
export function conversationRecordText(record: string, npcName: (id: string) => string | undefined): string {
  const talk = /^talk:([A-Za-z0-9._:-]+)@(\d+)$/.exec(record);
  if (talk) {
    const name = npcName(talk[1] ?? '');
    return name ? `Hablaste con ${name} (min ${talk[2]}).` : record;
  }
  const received = /^communication_received:[A-Za-z0-9._:-]+@(\d+)$/.exec(record);
  if (received) return `Respuesta recibida (min ${received[1]}).`;
  return record;
}
