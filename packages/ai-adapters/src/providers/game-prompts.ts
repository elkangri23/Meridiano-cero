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
    interpretAction: `
INTERPRETAR ACCIÓN DEL JUGADOR
Entrada: texto libre del jugador, vista del jugador (PlayerView), acciones disponibles.
Salida: JSON con { actionType, params, confidence, clarificationQuestion? }
- actionType debe ser uno de: inspect, collect, talk, travel, analyze, communicate, query, wait, request_warrant, detain, recover, finish, batch
- params: parámetros específicos según actionType
- confidence: 0-1
- clarificationQuestion: solo si el texto es ambiguo
NO ejecutes la acción, solo interpreta.`,

    narrateResult: `
NARRAR RESULTADO DE ACCIÓN
Entrada: eventos públicos confirmados, escenas autorizadas, estilo.
Salida: JSON con { narrative, factReferences[], style }
- narrative: texto narrativo sin revelar solución
- factReferences: IDs de hechos referenciados
- style: 'brief' | 'detailed' | 'ambient'
NO inventes hechos ni reveles culpabilidad.`,

    converse: `
CONVERSAR CON NPC
Entrada: persona del NPC, hechos conocidos, fragmento de conversación, trato recibido.
Salida: JSON con { text, factIds[], actOfSpeech, cooperationChange?, newKnowledge? }
- text: respuesta del NPC
- factIds: IDs de hechos revelados (debe ser subset de knownFacts)
- actOfSpeech: 'inform' | 'question' | 'refusal' | 'evasion' | 'silence'
- cooperationChange: -10 a +10 (opcional)
- newKnowledge: nuevos hechos que el NPC puede revelar en futuras conversaciones
El NPC NO sabe la solución. Puede mentir, evadir, o guardar silencio según su personalidad.`,

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

/** Valida la forma mínima de la salida del modelo según la función. */
export function validateGameOutput(functionName: AIFunction, value: unknown): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('INVALID_OUTPUT');
  }
  const obj = value as Record<string, unknown>;
  switch (functionName) {
    case 'interpretAction':
      requireField(obj, 'actionType', 'string');
      requireField(obj, 'params', 'object');
      requireField(obj, 'confidence', 'number');
      break;
    case 'narrateResult':
      requireField(obj, 'narrative', 'string');
      requireField(obj, 'factReferences', 'array');
      break;
    case 'converse':
      requireField(obj, 'text', 'string');
      requireField(obj, 'factIds', 'array');
      requireField(obj, 'actOfSpeech', 'string');
      break;
    case 'generateCase':
      requireField(obj, 'truth', 'string');
      break;
  }
}
