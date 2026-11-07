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
Entrada: persona del NPC, hechos conocidos (cada uno con su id), fragmento de conversación (turnos con lo que preguntó el jugador y lo que respondió el personaje), trato recibido, actos de habla permitidos (allowedActs).
Salida: JSON con { act, factIds, text }
- act: un acto de habla de allowedActs. Solo existen estos cuatro: 'state', 'acknowledge', 'decline', 'silence'. No uses ningún otro.
- 'state': la pregunta se responde con uno o varios hechos autorizados (la identidad del NPC, su tarea, lo que vio). factIds con los ids EXACTOS de esos hechos, copiados tal cual de la entrada. text es tu respuesta: 1-3 frases, en español, en primera persona y en la voz del personaje, que CONTESTE a la pregunta usando SOLO lo que dicen esos hechos. No copies los textos de los hechos literalmente: compón una respuesta natural con su contenido, sin añadir detalles que no estén en los hechos citados. Si te piden información sobre un tema, da la información que los hechos contienen, no te limites a decir que lo conoces. Si te preguntan si viste algo, di qué viste según tus hechos. Si te preguntan qué conoces, enumera tu conocimiento como una frase natural, no como una lista de temas.
- 'acknowledge': la pregunta NO se puede responder con los hechos autorizados y NO pide declarar sobre el robo, acusar a nadie ni revelar hechos no autorizados. factIds debe ser []. text es tu respuesta: 1-3 frases, en español, en primera persona y en la voz del personaje. Si es charla ajena al caso (el tiempo, lo que vende, lo que sea), responde con naturalidad como lo haría ese personaje. Si es sobre el caso pero ningún hecho lo cubre, desvía en personaje sin inventar nada. Nunca inventes hechos del caso, mentiras ni acusaciones.
- 'decline': SOLO cuando la pregunta pide declarar sobre el robo, acusar a alguien o revelar hechos que no están autorizados. factIds debe ser []. text debe ser cadena vacía: el servidor usa la negativa del personaje.
- 'silence': SOLO cuando el personaje se niega a hablar en absoluto. factIds debe ser []. text debe ser cadena vacía.
- Sobre su identidad, su tarea y lo que vio, el NPC responde con los hechos autorizados; nunca se niega a eso. La negativa ('decline') es solo para declarar sobre el robo. Preguntas vagas sobre lo que vio o conoce («¿viste algo?», «¿qué había?», «¿qué sabes?») se responden con sus hechos autorizados ('state') cuando alguno los cubre; nunca con 'decline'.
- Sigue el hilo del fragmento de conversación: no repitas lo ya dicho y entiende las referencias a lo anterior.
El NPC NO sabe la solución. No inventes hechos ni reveles culpabilidad. Las equivocaciones honestas o la incertidumbre sobre el caso no se improvisan: si ningún hecho autorizado las respalda, desvía en personaje ('acknowledge') sin inventar; 'decline' es solo para declarar sobre el robo, acusar a alguien o revelar hechos no autorizados.`,

    generateCase: `
GENERAR CASO (etapa del pipeline de generación de Meridiano-cero)
El contexto autorizado trae: { stage, schema, crimeType, contentRating, duration, seed, cities, contentRules, premise?, npcs?, definition?, goldenPath?, alternativePath?, budgetMinutes?, repairFeedback? }. El campo schema es el esquema JSON de salida de esa etapa: sus claves y tipos son exactos.
- Lee el campo stage del contexto: 1 premisa, 3 NPC, 4 red de pistas y textos (en DOS llamadas: 4a mundo y 4b reglas, distinguidas por el campo part del contexto), 7 revisión semántica.
- Salida: SOLO el JSON de esa etapa, con las claves exactas del esquema del contexto. No añadas claves, pensamientos ni texto fuera del JSON. El campo schema describe la FORMA de la salida: NUNCA lo devuelvas tal cual; devuelve los DATOS con esas claves.
- Si el contexto trae repairFeedback, son los errores de tu salida anterior en esta misma etapa: corrige exactamente lo que dicen, no repitas la misma salida.
- Etapa 1: título, delito, verdad, solución (NPC), señuelo (NPC), 1-2 testigos, motivo, objetivos (detener/recuperar como frases), etiqueta del objeto e introducción (speaker, title, 3 párrafos sin spoilers). El título es el nombre del caso (p. ej. «Caso: desaparición en el Meridiano-cero»): NUNCA empiece por «Expediente:». Los ids de NPC son nombres propios en minúsculas con guiones (p. ej. marcos, laura, jorge; NUNCA marcadores como suspect_01 o witness_01) y cada NPC (solución, señuelo y CADA testigo) lleva cityId, un id EXACTO de cities.
- Etapa 3: un objeto en npcs por cada id del reparto de la premisa (solución, señuelo y testigos, en ese orden): { id EXACTO de la premisa, persona (1-2 frases en primera persona), knowledge (1-3 ids cortos en minúsculas con guiones, p. ej. fondo-falso, registro-banco; SIN espacios ni frases), cooperation (entero 0-10), channels (canales remotos de la central de comunicaciones que tiene sentido usar con este personaje, de call, whatsapp, sms, email, fax; p. ej. un administrativo: ["email", "call"]; un sospechoso que solo habla en persona: []) }. timeline: lista de 2 a 8 hitos cronológicos, cada uno una FRASE corta (cadena de texto, NUNCA un objeto con campo milestone).
- Etapa 4a (mundo): 3 lugares (uno por ciudad; id en MAYÚSCULAS como MAD-SALA: 2-4 letras de ciudad + guion + 3-12 letras, p. ej. BIL-OFIC, BAR-GALERIA, MAL-BIBLIOTECA, cityId EXACTO de cities, name y description), 11 evidencias EV-01..EV-11 en orden con los tipos fijados por el esquema (EV-01 observation, EV-02 object, EV-03 analysis, EV-04 record, EV-05 record, EV-06 object, EV-07 record, EV-08 record, EV-09 testimony, EV-10 record, EV-11 object; origin = id de lugar o de ciudad, NUNCA el id de un personaje (ni siquiera para testimonios: un testimonio se origina en el lugar donde se habla con el testigo) y NUNCA otro EV-XX (el análisis EV-03 se origina en el mismo lugar que EV-02, donde se analiza el objeto); relations = requisitos previos: SOLO ids EV-XX con número MENOR que el propio, p. ej. EV-03 puede depender de EV-02, nunca de EV-04 ni de sí misma; nunca enlaces en ambos sentidos, el grafo debe resolverse en orden) y textos (evidence: un texto por cada EV-XX; knowledge: un texto por CADA id de knowledge de la etapa 3, todos sin omitir ninguno; greetings: un saludo por cada NPC). Los textos de knowledge son lo que el personaje DICE cuando le preguntan por ese tema: 1-2 frases en primera persona que diría de verdad («Conozco…», «Sé que…», «Trabajo con…»), NUNCA una etiqueta del tema («Información sobre…», «Conocimiento de…», «Datos sobre…») ni una descripción en tercera persona; y cada texto debe nombrar al menos un elemento CONCRETO del mundo de este caso — un lugar, un objeto, un procedimiento o un suceso de las evidencias, los lugares o la mecánica de este expediente (p. ej. «la etiqueta de envío del archivo», «el registro de seguridad», «el cuaderno de campo», «la factura de transporte») — porque el personaje solo puede contar lo que los hechos contienen: un texto que solo nombra el tema («Conozco el mercado…», «Sé que los traslados…») no vale, aunque esté en primera persona; un mismo texto puede ser de varios NPC, así que debe sonar natural en boca de cualquiera de ellos (sin posesivos ligados a una sola persona); y nunca inventes sucesos, lugares, personas ni afirmaciones que el caso no respalde.
- Etapa 4b (reglas): mecánica completa, goldenPath y alternativePath, usando EXACTAMENTE los ids de lugares y evidencias que trae el contexto en locations y evidence (no inventes otros). Mecánica: inspectables 3, queries 5 con delayMinutes, analyses 1, talkEvidence 1, suspects 1-2 con warrantCombinations de ids EV-XX, recovery con objectId/cityId/locationId/evidenceId. REPARTO FIJO de las evidencias (no lo adivines): los 3 inspeccionables conceden EV-01 (la sala, con elementId '' — cadena vacía, la clave NUNCA se omite), EV-02 y EV-06 (los dos elementos); las 5 consultas conceden EV-04, EV-05, EV-07, EV-08 y EV-10 (una cada una); el análisis convierte EV-02 en EV-03; el tema de conversación concede EV-09; EV-11 es el objeto de la recuperación y se obtiene con la acción recover, NUNCA con un inspeccionable ni recogiéndolo antes. Nombres de campo EXACTOS de la mecánica: inspectables {locationId, elementId, label, evidenceId}; consultas {id, label, cityId, locationId, evidenceId, requires, delayMinutes} (id en kebab-case, p. ej. registro-mercantil, NUNCA queryId ni Q-01; requires es SIEMPRE un array, aunque esté vacío); análisis {inputEvidenceId, resultEvidenceId, delayMinutes, forensicType}; tema {npcId, topicId, label, evidenceId}; sospechosos {id, cityId, locationId, knownFromEvidence, warrantCombinations, accessEvidenceIds} (id = id del NPC, NUNCA suspectId; uno de ellos DEBE ser la solución; knownFromEvidence = lista de ids EV-XX que hacen conocido al sospechoso, p. ej. ['EV-03', 'EV-05']; warrantCombinations = lista de combinaciones de ids EV-XX que autorizan la orden, p. ej. [['EV-03', 'EV-05'], ['EV-06', 'EV-07', 'EV-08']]; el sospechoso solución DEBE tener al menos DOS combinaciones SIN NINGUNA evidencia en común: una para la ruta dorada y otra para la ruta alternativa (GDD §4/§18); si recovery.requiresAccessWarrant es true, cada combinación incluye una evidencia de acceso de SU propia cadena (p. ej. EV-05 en la primera y EV-08 en la segunda), para que cada ruta pueda recuperar sin la cadena de la otra; accessEvidenceIds = lista de ids EV-XX que, al incluirse en la orden, conceden warrant:access para recuperar; al menos una en el sospechoso solución cuando recovery.requiresAccessWarrant es true, NUNCA se omite); recuperación {objectId, label, cityId, locationId, evidenceId, requiresAccessWarrant}. El forensicType del análisis es el método de laboratorio que examina la prueba (GDD §11): uno de huellas, documentos, fotografias, audio, muestras o materiales, EXACTAMENTE así (sin acentos, en minúsculas). Elige el que corresponde a lo que el análisis examina de verdad: huellas para marcas, residuos o restos de herramientas; documentos para cuadernos, registros, notas, firmas o etiquetas; fotografias para imágenes; audio para grabaciones; muestras para restos biológicos o químicos; materiales para objetos y dispositivos. Nunca elijas un tipo que el contenido del análisis no respalde. TODOS los ids (elementId, objectId, topicId, id de consulta, id de NPC) en minúsculas con guiones, SOLO letras a-z SIN acentos, números y guiones (p. ej. quiosco-periodicos, maletin; NUNCA quiosco-periódicos ni maletín). TODAS las referencias usan EXACTAMENTE los ids definidos en la salida 4a y en la etapa 1: un id inventado en la mecánica no existe. La evidencia concedida se llama evidenceId, NUNCA grantsEvidenceId. La ruta dorada debe poder JUGARSE en orden por el motor: cada acción exige haber obtenido antes sus requisitos (recoger el objeto antes de analizarlo, analizar antes de pedir la orden con esa evidencia, inspeccionar el lugar que concede EV-11 antes de recuperar el objeto, pedir la orden y esperar a que madure antes de detener). Cada evidencia (salvo EV-11, el objeto de la recuperación) debe poder obtenerse por su vía: observación y objeto por inspeccionar, registro por consulta, análisis por analyze, testimonio por hablar. goldenPath de 10 a 40 acciones { type, params } con los tipos del motor (inspect, collect, talk, query, analyze, travel, wait, request_warrant, detain, recover, finish), que incluye detain y recover y termina en finish. ADEMÁS, alternativePath: una SEGUNDA ruta completa, de 10 a 40 acciones con la misma forma, que resuelve el mismo caso por otra vía (GDD §4/§18): usa la OTRA combinación de orden del sospechoso solución (nunca la de la dorada), con su propia cadena de evidencias (otras inspecciones, consultas o análisis), SIN compartir ninguna evidencia de la orden con la dorada, y debe poder JUGARSE SOLA de principio a fin por el motor —sin ninguna evidencia de la dorada, ni como requisito de una consulta ni como evidencia de acceso— y cerrar el caso (detención + recuperación + finish) dentro del mismo presupuesto que la dorada. Si recovery.requiresAccessWarrant es true, la request_warrant de cada ruta incluye una evidencia de acceso de SU propia cadena. No vale una variación de la dorada con otros waits o viajes: si las dos rutas piden la orden con las mismas evidencias, el caso se rechaza. El contexto trae arrestType: el tipo de detención de este caso (GDD §12). Si es 'automatic', antes de detener a un sospechoso hay TRES requisitos del motor, sin excepción: (1) conocer su ubicación (location:<id> en los descubrimientos; se aprende hablando con él con topicId 'identidad', que revela identity:<id> y location:<id>); (2) pedir la orden con request_warrant usando UNA combinación completa de sus warrantCombinations; (3) esperar 30 min con wait a que la orden madure. La detención se coordina con las autoridades desde la ciudad donde estés: NO hace falta viajar a la ciudad del sospechoso ni estar en su lugar, y la ruta dorada puede detener justo después de que madure la orden, estés donde estés. Si es 'interactive', hay CUATRO requisitos: los tres anteriores MÁS conocer también su identidad (identity:<id>, que solo se revela hablando con él con topicId 'identidad') y estar en su ciudad y en su lugar exactos (cityId y locationId del sospechoso en la mecánica) antes de detener. Sin los requisitos, el motor rechaza la detención con 'Intervención no disponible'. Una consulta solo se puede hacer estando en la ciudad Y el lugar que declara su propia regla (cityId y locationId de la consulta) y después de haber obtenido al menos una de sus evidencias requires (cualquiera de ellas basta); si la ruta la pide en otra ciudad, en otro lugar o antes de su requisito, el motor la rechaza con 'Consulta no disponible'. Una consulta o un análisis NO entrega su evidencia al instante: la pide y el resultado llega solo cuando pasa el tiempo (delayMinutes); después de cada consulta o análisis cuya evidencia necesite otro paso, pon un wait de al menos su delayMinutes (o un viaje) antes de usarla. delayMinutes: consultas 30, análisis 90; NUNCA 0 (con 0 el resultado queda en curso y el paso siguiente que lo necesita se rechaza). La recuperación solo se puede hacer estando en la ciudad y el lugar de recovery (cityId y locationId de recovery); y si recovery.requiresAccessWarrant es true, la request_warrant del sospechoso DEBE incluir al menos una evidencia de sus accessEvidenceIds (si no, la orden de detención se concede pero la recuperación se rechaza con 'Recuperación no disponible'). Antes de cerrar la ruta, repásala paso a paso: cada consulta va DESPUÉS del paso que revela al menos una de sus requires; la recuperación va DESPUÉS de una request_warrant que incluya una evidencia de acceso y de un wait de 30 min; la detención va DESPUÉS de conocer la ubicación del sospechoso, de la request_warrant con una combinación completa y de un wait de 30 min (y, si el caso es interactivo, DESPUÉS de hablar con él con topicId 'identidad' y de viajar a su ciudad y lugar). Parámetros EXACTOS de la ruta dorada: inspect {targetId = id del lugar, elementId}, collect {evidenceId}, analyze {evidenceId}, talk {npcId, topicId}, query {topicId = id de la consulta, NUNCA queryId}, wait {minutes}, travel {toCityId = id de la ciudad destino, NUNCA cityId ni locationId}, request_warrant {suspectId, evidenceIds}, detain {suspectId, warrantId: 'warrant:<id>', locationId, mode: <arrestType del contexto, EXACTAMENTE así: 'automatic' o 'interactive'>}, recover {objectId}, finish {}. Regla de recogida: collect SOLO sirve para evidencias de tipo object (EV-02, EV-06, EV-11); una observación (EV-01) se revela al inspeccionar la sala y NO se recoge; un registro llega por consulta, un análisis por analyze y un testimonio por hablar. La primera acción suele ser inspeccionar la sala (sin elementId), que revela EV-01. La ciudad de inicio es startCityId (la primera de la lista cities): la ruta empieza allí; la primera acción NUNCA es un viaje (ya estás allí) y cada viaje va a una ciudad DISTINTA de la actual. Cada acción ocurre en la ciudad donde estás en ese momento de la ruta (inspeccionar y consultar solo en tu ciudad actual; detener, solo en tu ciudad actual si el caso es interactivo; si es automático, la detención se coordina desde donde estés y no exige viajar).
- Etapa 7: { coherent, issues }: revisa si la definición es coherente (la solución se sigue de las evidencias, los requisitos son alcanzables, los tiempos caben en el presupuesto, las dos rutas —goldenPath y alternativePath— resuelven el caso por vías distintas sin compartir evidencias de la orden) y lista los problemas concretos; coherent=false si hay alguno.
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

/** Longitud máxima de la respuesta escrita por el modelo en `state` y
 * `acknowledge` (1-3 frases en personaje): por encima es verborrea, no
 * conversación. */
export const MAX_CONVERSE_TEXT_LENGTH = 600;

/** La conversación libre devuelve { act, factIds, text }: el texto es la
 * respuesta del NPC escrita por el modelo cuando el acto es `state`
 * (redacción natural de los hechos citados, GDD §7: el LLM expresa
 * conversaciones; lo probatorio sigue siendo los factIds, que el servidor
 * valida contra los hechos autorizados) o `acknowledge` (charla o desvío
 * no probatorio). Para `decline` y `silence` valen sus líneas fijas: el
 * contrato no acepta texto probatorio libre (CONVERSACIONES.md), así que
 * el texto del modelo en esos actos se ignora y no se valida su contenido,
 * solo su longitud. Un `state` o un `acknowledge` sin texto no es una
 * respuesta: es salida inválida. */
function validateConverse(value: Record<string, unknown>): void {
  exactKeys(value, ['act', 'factIds', 'text']);
  requireField(value, 'act', 'string');
  requireField(value, 'factIds', 'array');
  // El texto puede ser vacío: el prompt pide `text: ''` en `decline` y
  // `silence` (el servidor muestra sus textos fijos). Por eso no vale
  // `requireField(..., 'string')`, que exige longitud > 0. En `state` y
  // `acknowledge` el texto es la respuesta y no puede ser vacío.
  if (typeof value.text !== 'string') throw new Error('INVALID_OUTPUT');
  if (!['state', 'acknowledge', 'decline', 'silence'].includes(value.act as string)) throw new Error('INVALID_OUTPUT');
  const ids = value.factIds as unknown[];
  if (ids.length > 16 || ids.some(id => typeof id !== 'string') || new Set(ids).size !== ids.length) throw new Error('INVALID_OUTPUT');
  const text = value.text as string;
  if (text.length > MAX_CONVERSE_TEXT_LENGTH) throw new Error('INVALID_OUTPUT');
  if ((value.act === 'acknowledge' || value.act === 'state') && text.trim().length === 0) throw new Error('INVALID_OUTPUT');
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
      validateFactual(obj);
      break;
    case 'converse':
      validateConverse(obj);
      break;
    case 'generateCase':
      // La salida de generación varía por etapa (premisa, NPC, pistas,
      // revisión) y la valida en forma el pipeline (stages.ts), no el
      // adaptador: aquí solo se exige un objeto JSON no vacío.
      if (Object.keys(obj).length === 0) throw new Error('INVALID_OUTPUT');
      break;
  }
}
