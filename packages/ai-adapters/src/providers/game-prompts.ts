// Prompts y validación de salida compartidos por los adaptadores de IA del juego.
// La redacción es única para todos los proveedores: solo cambia el transporte.
// Ningún prompt incluye la solución del caso ni hechos no autorizados.

import type { AIContext, AIFunction } from '../types.js';

export function buildGameSystemPrompt(functionName: AIFunction, context: AIContext): string {
  return `Eres un asistente de IA para el videojuego Meridiano-cero. Tu función es: ${functionName}.

REGLAS FUNDAMENTALES:
1. NUNCA reveles la solución del caso, hechos ocultos, ni la culpabilidad de sospechosos.
2. Solo usa hechos autorizados que se te proporcionen en el contexto.
3. Si no tienes información suficiente, responde con plantilla factual breve.
4. No inventes hechos, testimonios, ni pruebas.
5. Mantén el tono: profesional, objetivo, ambientado en investigación.
6. Responde SOLO con JSON válido según el esquema solicitado.

Contexto autorizado:
${JSON.stringify(context.authorizedContext, null, 2)}

Límites:
- Timeout: ${context.limits.timeoutMs}ms
- Max tokens: ${context.limits.maxTokens ?? 'default'}
- Max reintentos: ${context.limits.maxRetries}

Responde SOLO con JSON válido.`;
}

export function buildGameFunctionPrompt(functionName: AIFunction): string {
  const functionInstructions: Record<AIFunction, string> = {
    // El esquema de salida es el contrato del director de la API
    // (apps/api/src/ai/schemas.ts): la interpretación elige ofertas por id
    // y la narración/conversación elige acto de habla y hechos por id.
    // Cualquier otro esquema lo rechaza el director como invalid_response.
    interpretAction: `
INTERPRETAR ACCIÓN DEL JUGADOR
Entrada: texto libre del jugador, vista del jugador (PlayerView), acciones disponibles (cada una con su id).
Salida: JSON con { kind, actionIds }
- kind debe ser 'actions' si el texto corresponde a una o varias de las acciones disponibles, o 'clarification' si es ambiguo o no corresponde a ninguna.
- actionIds: lista con los ids EXACTOS de las acciones elegidas, copiados tal cual de la entrada (1 a 8). Si kind es 'clarification', actionIds debe ser [].
- No inventes ids ni acciones que no estén en la entrada.
NO ejecutes la acción, solo interpreta.`,

    narrateResult: `
NARRAR RESULTADO DE ACCIÓN
Entrada: hechos públicos confirmados (cada uno con su id), actos de habla permitidos (allowedActs).
Salida: JSON con { act, factIds }
- act: un acto de habla de allowedActs (para narrar un resultado confirmado usa 'state').
- factIds: lista con los ids EXACTOS de los hechos referenciados, copiados tal cual de la entrada. Al narrar un resultado confirmado hay que incluir TODOS los hechos de la entrada, sin suprimir consecuencias.
- No inventes hechos ni reveles culpabilidad.`,

    converse: `
CONVERSAR CON NPC
Entrada: persona del NPC, hechos conocidos (cada uno con su id), fragmento de conversación, trato recibido, actos de habla permitidos (allowedActs).
Salida: JSON con { act, factIds }
- act: un acto de habla de allowedActs. Solo existen estos cuatro: 'state', 'acknowledge', 'decline', 'silence'. No uses ningún otro.
- 'state': la pregunta se responde con uno o varios hechos autorizados (la identidad del NPC, su tarea, lo que vio). factIds con los ids EXACTOS de esos hechos, copiados tal cual de la entrada.
- 'acknowledge': la pregunta NO se puede responder con los hechos autorizados y NO pide declarar sobre el robo, acusar a nadie ni revelar hechos no autorizados. factIds debe ser [].
- 'decline': SOLO cuando la pregunta pide declarar sobre el robo, acusar a alguien o revelar hechos que no están autorizados. factIds debe ser [].
- 'silence': SOLO cuando el personaje se niega a hablar en absoluto. factIds debe ser [].
- Sobre su identidad, su tarea y lo que vio, el NPC responde con los hechos autorizados; nunca se niega a eso. La negativa ('decline') es solo para declarar sobre el robo.
El NPC NO sabe la solución. No inventes hechos ni reveles culpabilidad.`,

    generateCase: `
GENERAR CASO (etapa del pipeline de generación de Meridiano-cero)
El contexto autorizado trae: { stage, schema, crimeType, contentRating, duration, seed, cities, contentRules, premise?, npcs?, definition?, goldenPath?, budgetMinutes?, repairFeedback? }. El campo schema es el esquema JSON de salida de esa etapa: sus claves y tipos son exactos.
- Lee el campo stage del contexto: 1 premisa, 3 NPC, 4 red de pistas y textos (en DOS llamadas: 4a mundo y 4b reglas, distinguidas por el campo part del contexto), 7 revisión semántica.
- Salida: SOLO el JSON de esa etapa, con las claves exactas del esquema del contexto. No añadas claves, pensamientos ni texto fuera del JSON.
- Si el contexto trae repairFeedback, son los errores de tu salida anterior en esta misma etapa: corrige exactamente lo que dicen, no repitas la misma salida.
- Etapa 1: título, delito, verdad, solución (NPC), señuelo (NPC), 1-2 testigos, motivo, objetivos (detener/recuperar como frases), etiqueta del objeto e introducción (speaker, title, 3 párrafos sin spoilers). Los ids de NPC son nombres propios en minúsculas con guiones (p. ej. marcos, laura, jorge; NUNCA marcadores como suspect_01 o witness_01) y cada NPC (solución, señuelo y CADA testigo) lleva cityId, un id EXACTO de cities.
- Etapa 3: un objeto en npcs por cada id del reparto de la premisa (solución, señuelo y testigos, en ese orden): { id EXACTO de la premisa, persona (1-2 frases en primera persona), knowledge (1-3 ids cortos en minúsculas con guiones, p. ej. fondo-falso, registro-banco; SIN espacios ni frases), cooperation (entero 0-10) }. timeline: lista de 2 a 8 hitos cronológicos, cada uno una FRASE corta (cadena de texto, NUNCA un objeto con campo milestone).
- Etapa 4a (mundo): 3 lugares (uno por ciudad; id en MAYÚSCULAS como MAD-SALA: 2-4 letras de ciudad + guion + 3-8 letras, p. ej. BIL-OFIC, BAR-GALERIA, MAL-ALMACEN, cityId EXACTO de cities, name y description), 11 evidencias EV-01..EV-11 en orden con los tipos fijados por el esquema (EV-01 observation, EV-02 object, EV-03 analysis, EV-04 record, EV-05 record, EV-06 object, EV-07 record, EV-08 record, EV-09 testimony, EV-10 record, EV-11 object; origin = id de lugar o de ciudad, NUNCA el id de un personaje (ni siquiera para testimonios: un testimonio se origina en el lugar donde se habla con el testigo); relations = requisitos previos: SOLO ids EV-XX con número MENOR que el propio, p. ej. EV-03 puede depender de EV-02, nunca de EV-04 ni de sí misma; nunca enlaces en ambos sentidos, el grafo debe resolverse en orden) y textos (evidence: un texto por cada EV-XX; knowledge: un texto por CADA id de knowledge de la etapa 3, todos sin omitir ninguno; greetings: un saludo por cada NPC).
- Etapa 4b (reglas): mecánica completa y goldenPath, usando EXACTAMENTE los ids de lugares y evidencias que trae el contexto en locations y evidence (no inventes otros). Mecánica: inspectables 3, queries 5 con delayMinutes, analyses 1, talkEvidence 1, suspects 1-2 con warrantCombinations de ids EV-XX, recovery con objectId/cityId/locationId/evidenceId. REPARTO FIJO de las evidencias (no lo adivines): los 3 inspeccionables conceden EV-01 (la sala, sin elementId), EV-02 y EV-06 (los dos elementos); las 5 consultas conceden EV-04, EV-05, EV-07, EV-08 y EV-10 (una cada una); el análisis convierte EV-02 en EV-03; el tema de conversación concede EV-09; EV-11 es el objeto de la recuperación y se obtiene con la acción recover, NUNCA con un inspeccionable ni recogiéndolo antes. Nombres de campo EXACTOS de la mecánica: inspectables {locationId, elementId, label, evidenceId}; consultas {id, label, cityId, locationId, evidenceId, requires, delayMinutes} (id en kebab-case, p. ej. registro-mercantil, NUNCA queryId ni Q-01; requires es SIEMPRE un array, aunque esté vacío); análisis {inputEvidenceId, resultEvidenceId, delayMinutes}; tema {npcId, topicId, label, evidenceId}; sospechosos {id, cityId, locationId, knownFromEvidence, warrantCombinations} (id = id del NPC, NUNCA suspectId; uno de ellos DEBE ser la solución; knownFromEvidence = lista de ids EV-XX que hacen conocido al sospechoso, p. ej. ['EV-03', 'EV-05']; warrantCombinations = lista de combinaciones de ids EV-XX que autorizan la orden, p. ej. [['EV-03', 'EV-05'], ['EV-06', 'EV-07', 'EV-08']]); recuperación {objectId, label, cityId, locationId, evidenceId, requiresAccessWarrant}. TODOS los ids (elementId, objectId, topicId, id de consulta, id de NPC) en minúsculas con guiones, SOLO letras a-z SIN acentos, números y guiones (p. ej. quiosco-periodicos, maletin; NUNCA quiosco-periódicos ni maletín). TODAS las referencias usan EXACTAMENTE los ids definidos en la salida 4a y en la etapa 1: un id inventado en la mecánica no existe. La evidencia concedida se llama evidenceId, NUNCA grantsEvidenceId. La ruta dorada debe poder JUGARSE en orden por el motor: cada acción exige haber obtenido antes sus requisitos (recoger el objeto antes de analizarlo, analizar antes de pedir la orden con esa evidencia, inspeccionar el lugar que concede EV-11 antes de recuperar el objeto, pedir la orden y esperar a que madure antes de detener). Cada evidencia (salvo EV-11, el objeto de la recuperación) debe poder obtenerse por su vía: observación y objeto por inspeccionar, registro por consulta, análisis por analyze, testimonio por hablar. goldenPath de 10 a 40 acciones { type, params } con los tipos del motor (inspect, collect, talk, query, analyze, travel, wait, request_warrant, detain, recover, finish), que incluye detain y recover y termina en finish. Parámetros EXACTOS de la ruta dorada: inspect {targetId = id del lugar, elementId}, collect {evidenceId}, analyze {evidenceId}, talk {npcId, topicId}, query {topicId = id de la consulta, NUNCA queryId}, wait {minutes}, travel {toCityId = id de la ciudad destino, NUNCA cityId ni locationId}, request_warrant {suspectId, evidenceIds}, detain {suspectId, warrantId: 'warrant:<id>', locationId, mode: 'interactive'}, recover {objectId}, finish {}. Regla de recogida: collect SOLO sirve para evidencias de tipo object (EV-02, EV-06, EV-11); una observación (EV-01) se revela al inspeccionar la sala y NO se recoge; un registro llega por consulta, un análisis por analyze y un testimonio por hablar. La primera acción suele ser inspeccionar la sala (sin elementId), que revela EV-01. La ciudad de inicio es startCityId (la primera de la lista cities): la ruta empieza allí; la primera acción NUNCA es un viaje (ya estás allí) y cada viaje va a una ciudad DISTINTA de la actual. Cada acción ocurre en la ciudad donde estás en ese momento de la ruta (inspeccionar, consultar y detener solo en tu ciudad actual).
- Etapa 7: { coherent, issues }: revisa si la definición es coherente (la solución se sigue de las evidencias, los requisitos son alcanzables, los tiempos caben en el presupuesto) y lista los problemas concretos; coherent=false si hay alguno.
- Respeta contentRules (Familiar: sin asesinatos ni temas perturbadores). No inventes ciudades fuera de la lista cities del contexto, ni hechos fuera del expediente. Nunca reveles la solución fuera del JSON de la etapa.`,

    validateCase: `
VALIDAR CASO
Entrada: definición de caso completa.
Salida: JSON con { valid: boolean, errors[], warnings[] }
Revisa coherencia, referencias, presupuesto temporal, dos rutas.`,
  };
  return functionInstructions[functionName] ?? '';
}

/** Extrae el primer objeto JSON del texto del modelo; rechaza lo demás. */
export function parseJSONResponse(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('INVALID_OUTPUT');
  }
}

type FieldKind = 'string' | 'number' | 'object' | 'array';

function requireField(obj: Record<string, unknown>, key: string, kind: FieldKind): void {
  const value = obj[key];
  const ok = kind === 'string' ? typeof value === 'string' && value.length > 0
    : kind === 'number' ? typeof value === 'number'
    : kind === 'object' ? value !== null && typeof value === 'object' && !Array.isArray(value)
    : Array.isArray(value);
  if (!ok) throw new Error('INVALID_OUTPUT');
}

function exactKeys(value: Record<string, unknown>, allowed: string[]): void {
  const keys = Object.keys(value);
  if (keys.length !== allowed.length || keys.some(key => !allowed.includes(key))) throw new Error('INVALID_OUTPUT');
}

function validateInterpretation(value: Record<string, unknown>): void {
  exactKeys(value, ['kind', 'actionIds']);
  requireField(value, 'kind', 'string');
  requireField(value, 'actionIds', 'array');
  const ids = value.actionIds as unknown[];
  if (ids.length > 8 || ids.some(id => typeof id !== 'string')) throw new Error('INVALID_OUTPUT');
  if (value.kind === 'actions' && ids.length === 0) throw new Error('INVALID_OUTPUT');
  if (value.kind === 'clarification' && ids.length !== 0) throw new Error('INVALID_OUTPUT');
  if (value.kind !== 'actions' && value.kind !== 'clarification') throw new Error('INVALID_OUTPUT');
}

function validateFactual(value: Record<string, unknown>): void {
  exactKeys(value, ['act', 'factIds']);
  requireField(value, 'act', 'string');
  requireField(value, 'factIds', 'array');
  const ids = value.factIds as unknown[];
  if (ids.length > 16 || ids.some(id => typeof id !== 'string')) throw new Error('INVALID_OUTPUT');
}

/** Valida la forma mínima de la salida del modelo según la función.
 * interpretAction/narrateResult/converse usan el esquema del director de la
 * API (schemas.ts): {kind, actionIds} y {act, factIds}. Las claves deben ser
 * exactamente las del esquema: el modelo no puede inyectar pensamientos,
 * razonamientos ni metadatos no solicitados. */
export function validateGameOutput(functionName: AIFunction, value: unknown): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('INVALID_OUTPUT');
  }
  const obj = value as Record<string, unknown>;
  switch (functionName) {
    case 'interpretAction':
      validateInterpretation(obj);
      break;
    case 'narrateResult':
    case 'converse':
      validateFactual(obj);
      break;
    case 'generateCase':
      // La salida de generación varía por etapa (premisa, NPC, pistas,
      // revisión) y la valida en forma el pipeline (stages.ts), no el
      // adaptador: aquí solo se exige un objeto JSON no vacío.
      if (Object.keys(obj).length === 0) throw new Error('INVALID_OUTPUT');
      break;
  }
}
