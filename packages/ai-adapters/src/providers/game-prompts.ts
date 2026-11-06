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
GENERAR CASO
Entrada: parámetros de generación, catálogo, verdad, motivaciones.
Salida: JSON con { crimeType, objectives[], truth, motivations, difficulty, duration, region }
NO incluyas solución ni secretos.`,

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
      requireField(obj, 'truth', 'string');
      break;
  }
}
