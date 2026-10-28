import type {
  AIProvider,
  AIContext,
  AIResponse,
  AIFunction,
  ProviderId,
  AIContext as AIContextType,
} from '../index.ts';

export interface OllamaConfig {
  baseUrl: string;
  defaultModel: string;
  timeoutMs: number;
  maxRetries: number;
  maxContextTokens: number;
}

interface OllamaChatRequest {
  model: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  stream: false;
  options?: {
    num_predict?: number;
    temperature?: number;
    top_p?: number;
    top_k?: number;
    stop?: string[];
  };
}

interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: { role: 'assistant'; content: string };
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
  eval_duration?: number;
}

function buildSystemPrompt(functionName: AIFunction, context: AIContextType): string {
  const basePrompt = `Eres un asistente de IA para el videojuego Meridiano-cero. Tu función es: ${functionName}.

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

  return basePrompt;
}

function buildPrompt(functionName: AIFunction, input: unknown): string {
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
GENERAR CASO NUEVO
Entrada: parámetros de generación (seed, dificultad, modo, región, duración).
Salida: CaseDefinition completo con todos los campos requeridos.
DEBE ser consistente, jugable, con dos rutas independientes.`,

    validateCase: `
VALIDAR CASO
Entrada: CaseDefinition completa.
Salida: { valid: boolean, errors: string[] }
Verifica: estructura, referencias, dos rutas independientes, costes, plazo.`,
  };

  return `${functionInstructions[functionName]}\n\nInput:\n${JSON.stringify(input, null, 2)}`;
}

function parseJSONResponse<T>(text: string): T {
  try {
    // Intentar extraer JSON de la respuesta (puede venir con markdown o texto extra)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as T;
    }
    return JSON.parse(text) as T;
  } catch {
    throw new Error('INVALID_OUTPUT: No se pudo parsear JSON de la respuesta');
  }
}

export class OllamaProvider implements AIProvider {
  readonly id: ProviderId = 'ollama';
  readonly capabilities: AIFunction[] = [
    'interpretAction',
    'narrateResult',
    'converse',
    'generateCase',
    'validateCase',
  ];
  readonly maxContextTokens: number;
  readonly defaultModel: string;

  private config: OllamaConfig;

  constructor(config: OllamaConfig) {
    this.config = config;
    this.maxContextTokens = config.maxContextTokens;
    this.defaultModel = config.defaultModel;
  }

  async execute<T>(context: AIContext): Promise<AIResponse<T>> {
    const startTime = Date.now();
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const prompt = buildPrompt(context.function, context.authorizedContext);
        const systemPrompt = buildSystemPrompt(context.function, context);

        const response = await this.callOllamaChat(context.function, systemPrompt, prompt, context);
        const latencyMs = Date.now() - startTime;

        return {
          payload: response as T,
          usage: {
            promptTokens: response.prompt_eval_count ?? 0,
            completionTokens: response.eval_count ?? 0,
            totalTokens: (response.prompt_eval_count ?? 0) + (response.eval_count ?? 0),
          },
          latencyMs,
          finishReason: response.done ? 'stop' : 'length',
        };
      } catch (error) {
        lastError = error as Error;

        // No reintentar en errores de validación de salida
        if ((error as Error).message.startsWith('INVALID_OUTPUT')) {
          throw error;
        }

        // Esperar antes de reintentar (backoff exponencial)
        if (attempt < this.config.maxRetries) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    const latencyMs = Date.now() - startTime;
    return {
      payload: null as T,
      latencyMs,
      finishReason: 'error',
      error: {
        code: lastError?.message?.startsWith('TRANSPORT') ? 'TRANSPORT_ERROR' : 'MODEL_UNAVAILABLE',
        message: lastError?.message ?? 'Error desconocido tras reintentos',
      },
    };
  }

  private async callOllamaChat(
    _functionName: AIFunction,
    systemPrompt: string,
    prompt: string,
    context: AIContext
  ): Promise<OllamaChatResponse & { prompt_eval_count?: number; eval_count?: number }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(`${this.config.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: context.model || this.defaultModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
          ],
          stream: false,
          options: {
            num_predict: context.limits.maxTokens ?? 2048,
            temperature: 0.3,
            top_p: 0.9,
            top_k: 40,
          },
        } as OllamaChatRequest),
        signal: context.cancellationSignal ?? controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`TRANSPORT_ERROR: ${response.status} ${errorText}`);
      }

      const data = await response.json() as OllamaChatResponse;

      if (!data.done) {
        throw new Error('MODEL_UNAVAILABLE: Respuesta incompleta');
      }

      // Parsear el contenido JSON de la respuesta del modelo
      const content = data.message?.content ?? '';
      const parsed = parseJSONResponse(content);

      // Validar según la función
      this.validateOutput(context.function, parsed);

      return {
        ...data,
        prompt_eval_count: data.prompt_eval_count,
        eval_count: data.eval_count,
      } as OllamaChatResponse & { prompt_eval_count?: number; eval_count?: number };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private validateOutput(functionName: AIFunction, output: unknown): void {
    const requiredFields: Record<AIFunction, string[]> = {
      interpretAction: ['actionType', 'params', 'confidence'],
      narrateResult: ['narrative', 'factReferences', 'style'],
      converse: ['text', 'actOfSpeech'],
      generateCase: ['definition', 'validationReport'],
      validateCase: ['valid', 'errors'],
    };

    const fields = requiredFields[functionName];
    if (!fields) {
      throw new Error(`INVALID_OUTPUT: función desconocida '${functionName}'`);
    }
    for (const field of fields) {
      if (!(field in (output as Record<string, unknown>))) {
        throw new Error(`INVALID_OUTPUT: Falta campo requerido '${field}' para ${functionName}`);
      }
    }

    // Validaciones específicas
    switch (functionName) {
      case 'interpretAction': {
        const out = output as { actionType: string; confidence: number };
        const validActions = ['inspect', 'collect', 'talk', 'travel', 'analyze', 'communicate', 'query', 'wait', 'request_warrant', 'detain', 'recover', 'finish', 'batch'];
        if (!validActions.includes(out.actionType)) {
          throw new Error(`INVALID_OUTPUT: actionType inválido '${out.actionType}'`);
        }
        if (out.confidence < 0 || out.confidence > 1) {
          throw new Error(`INVALID_OUTPUT: confidence fuera de rango [0,1]`);
        }
        break;
      }
      case 'converse': {
        const out = output as { actOfSpeech: string };
        const validActs = ['inform', 'question', 'refusal', 'evasion', 'silence'];
        if (!validActs.includes(out.actOfSpeech)) {
          throw new Error(`INVALID_OUTPUT: actOfSpeech inválido '${out.actOfSpeech}'`);
        }
        break;
      }
    }
  }

  async healthCheck(): Promise<{ available: boolean; latencyMs?: number; error?: string }> {
    const startTime = Date.now();
    try {
      const response = await fetch(`${this.config.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      const latencyMs = Date.now() - startTime;
      return { available: response.ok, latencyMs };
    } catch (error) {
      return { available: false, error: (error as Error).message };
    }
  }

  estimateTokens(text: string): number {
    // Estimación aproximada: ~4 chars por token para español
    return Math.ceil(text.length / 4);
  }
}

export function createOllamaProvider(config: Partial<OllamaConfig> = {}): OllamaProvider {
  const defaultConfig: OllamaConfig = {
    baseUrl: 'http://localhost:11434',
    defaultModel: 'llama3.1:8b',
    timeoutMs: 60000,
    maxRetries: 1,
    maxContextTokens: 8192,
    ...config,
  };
  return new OllamaProvider(defaultConfig);
}
