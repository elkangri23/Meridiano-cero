import type { AIProvider, AIContext, AIResponse, AIFunction, ProviderId } from '../index.ts';

export interface FreeLLMAPIConfig {
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
  timeoutMs: number;
  maxRetries: number;
}

interface FreeLLMAPIChatRequest {
  model: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream: false;
}

interface FreeLLMAPIChatResponse {
  choices: Array<{ message: { content: string }; finish_reason: string }>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

function parseJSONResponse(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('INVALID_OUTPUT');
  }
}

function validateFreeLLMAPIOutput(functionName: AIFunction, value: unknown): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('INVALID_OUTPUT');
  }
  const obj = value as Record<string, unknown>;
  switch (functionName) {
    case 'interpretAction':
      if (!obj.actionType || typeof obj.actionType !== 'string') throw new Error('INVALID_OUTPUT');
      if (!obj.params || typeof obj.params !== 'object') throw new Error('INVALID_OUTPUT');
      if (typeof obj.confidence !== 'number') throw new Error('INVALID_OUTPUT');
      break;
    case 'narrateResult':
      if (!obj.narrative || typeof obj.narrative !== 'string') throw new Error('INVALID_OUTPUT');
      if (!Array.isArray(obj.factReferences)) throw new Error('INVALID_OUTPUT');
      break;
    case 'converse':
      if (!obj.text || typeof obj.text !== 'string') throw new Error('INVALID_OUTPUT');
      if (!Array.isArray(obj.factIds)) throw new Error('INVALID_OUTPUT');
      if (!obj.actOfSpeech || typeof obj.actOfSpeech !== 'string') throw new Error('INVALID_OUTPUT');
      break;
    case 'generateCase':
      if (!obj.truth || typeof obj.truth !== 'string') throw new Error('INVALID_OUTPUT');
      break;
  }
}

export class FreeLLMAPIProvider implements AIProvider {
  readonly id: ProviderId = 'freellmapi';
  readonly capabilities: AIFunction[] = ['interpretAction', 'narrateResult', 'converse', 'generateCase'];
  readonly maxContextTokens = 8192;
  readonly defaultModel: string;

  private config: FreeLLMAPIConfig;

  constructor(config: Partial<FreeLLMAPIConfig> = {}) {
    this.config = {
      baseUrl: config.baseUrl ?? 'https://api.freellmapi.com/v1',
      apiKey: config.apiKey ?? '',
      defaultModel: config.defaultModel ?? 'gpt-4o-mini',
      timeoutMs: config.timeoutMs ?? 60000,
      maxRetries: config.maxRetries ?? 2,
    };
    this.defaultModel = this.config.defaultModel;
  }

  private buildSystemPrompt(functionName: AIFunction, context: AIContext): string {
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

  private buildPrompt(functionName: AIFunction, _input: unknown): string {
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

  async execute<T>(context: AIContext): Promise<AIResponse<T>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), context.limits.timeoutMs);

    const messages = [
      { role: 'system', content: this.buildSystemPrompt(context.function, context) },
      { role: 'user', content: this.buildPrompt(context.function, context.authorizedContext) },
    ];

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const httpResponse = await fetch(`${this.config.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify({
            model: context.model || this.defaultModel,
            messages,
            max_tokens: context.limits.maxTokens,
            temperature: 0.3,
            top_p: 0.9,
            stream: false,
          } as FreeLLMAPIChatRequest),
          signal: context.cancellationSignal
            ? AbortSignal.any([context.cancellationSignal, controller.signal])
            : controller.signal,
        });

        if (!httpResponse.ok) {
          if (httpResponse.status === 401) throw new Error('UNAUTHORIZED');
          if (httpResponse.status === 429) throw new Error('RATE_LIMITED');
          throw new Error('TRANSPORT_ERROR');
        }

        const data = await httpResponse.json() as FreeLLMAPIChatResponse;
        clearTimeout(timeoutId);

        if (!data.choices?.[0]?.message?.content) {
          throw new Error('INVALID_OUTPUT');
        }

        const content = data.choices[0].message.content;
        const parsed = parseJSONResponse(content);
        validateFreeLLMAPIOutput(context.function, parsed);

        const aiResponse: AIResponse<T> = {
          payload: parsed as T,
          usage: data.usage ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          } : { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          latencyMs: Date.now() - Date.now(),
          finishReason: 'stop',
        };
        return aiResponse;
      } catch (error: any) {
        lastError = error;
        if (error.name === 'AbortError' || error.message === 'CANCELLED') {
          throw new Error('CANCELLED');
        }
        if (attempt === this.config.maxRetries) break;
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    }

    clearTimeout(timeoutId);

    if (lastError?.message === 'UNAUTHORIZED') throw new Error('UNAUTHORIZED');
    if (lastError?.message === 'RATE_LIMITED') throw new Error('RATE_LIMITED');
    throw new Error('MODEL_UNAVAILABLE');
  }

  async healthCheck(): Promise<{ available: boolean; latencyMs?: number; error?: string }> {
    const startTime = performance.now();
    try {
      if (!this.config.apiKey) {
        return { available: false, error: 'API key no configurada' };
      }
      const response = await fetch(`${this.config.baseUrl}/models`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${this.config.apiKey}` },
        signal: AbortSignal.timeout(5000),
      });
      const latencyMs = Math.max(0, performance.now() - startTime);
      const result: { available: boolean; latencyMs?: number; error?: string } = { available: response.ok, latencyMs };
      if (!response.ok) result.error = `HTTP ${response.status}`;
      return result;
    } catch {
      return { available: false, error: 'El proveedor no está disponible.' };
    }
  }

  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}

export function createFreeLLMAPIProvider(config: Partial<FreeLLMAPIConfig> = {}): FreeLLMAPIProvider {
  return new FreeLLMAPIProvider(config);
}