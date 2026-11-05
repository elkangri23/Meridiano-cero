import { buildGameFunctionPrompt, buildGameSystemPrompt } from './game-prompts.js';
import { parseGamePayload } from './provider-transport.js';
import { parseOllamaConfig, type OllamaConfig } from './ollama-config.js';
export type { OllamaConfig } from './ollama-config.js';
import type {
  AIProvider,
  AIContext,
  AIResponse,
  AIFunction,
  ProviderId,
} from '../types.js';

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
  message: { content: string };
  done: true;
  prompt_eval_count?: unknown;
  eval_count?: unknown;
}

function responseObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function decodeEnvelope(value: unknown): OllamaChatResponse {
  if (!responseObject(value) || value.done !== true || !responseObject(value.message)) throw new Error('INVALID_OUTPUT');
  if (typeof value.message.content !== 'string') throw new Error('INVALID_OUTPUT');
  return { done: true, message: { content: value.message.content },
    prompt_eval_count: value.prompt_eval_count, eval_count: value.eval_count };
}

type ChatResult = { data: OllamaChatResponse; payload: unknown };

function tokenCount(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

function responseUsage(data: OllamaChatResponse): AIResponse['usage'] {
  const prompt = tokenCount(data.prompt_eval_count);
  const completion = tokenCount(data.eval_count);
  if (prompt === undefined && completion === undefined) return undefined;
  const total = prompt !== undefined && completion !== undefined ? tokenCount(prompt + completion) : undefined;
  return { ...(prompt !== undefined ? { promptTokens: prompt } : {}),
    ...(completion !== undefined ? { completionTokens: completion } : {}),
    ...(total !== undefined ? { totalTokens: total } : {}) };
}

function successfulResponse<T>(response: ChatResult, start: number): AIResponse<T> {
  const usage = responseUsage(response.data);
  return { payload: response.payload as T, ...(usage ? { usage } : {}),
    latencyMs: Math.max(0, performance.now() - start), finishReason: 'stop' };
}

function failedResponse<T>(start: number): AIResponse<T> {
  return { payload: null, latencyMs: Math.max(0, performance.now() - start), finishReason: 'error',
    error: { code: 'MODEL_UNAVAILABLE', message: 'El proveedor no está disponible.' } };
}

function terminalFailure(error: unknown, context: AIContext): Error | undefined {
  if (context.cancellationSignal?.aborted) return new Error('CANCELLED', { cause: error });
  if (error instanceof Error && error.message.startsWith('INVALID_OUTPUT')) return new Error('INVALID_OUTPUT', { cause: error });
  return undefined;
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
    this.config = parseOllamaConfig(config);
    this.maxContextTokens = this.config.maxContextTokens;
    this.defaultModel = this.config.defaultModel;
  }

  async execute<T>(context: AIContext): Promise<AIResponse<T>> {
    const startTime = performance.now();
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        context.cancellationSignal?.throwIfAborted();
        const prompt = buildGameFunctionPrompt(context.function);
        const systemPrompt = buildGameSystemPrompt(context.function, context);
        const response = await this.callOllamaChat(context.function, systemPrompt, prompt, context);
        return successfulResponse<T>(response, startTime);
      } catch (error) {
        const terminal = terminalFailure(error, context);
        if (terminal) throw terminal;
        if (attempt < this.config.maxRetries) await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
    return failedResponse<T>(startTime);
  }

  private async callOllamaChat(
    _functionName: AIFunction,
    systemPrompt: string,
    prompt: string,
    context: AIContext
  ): Promise<ChatResult> {
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
        signal: context.cancellationSignal ? AbortSignal.any([context.cancellationSignal, controller.signal]) : controller.signal,
      });

      if (!response.ok) {
        throw new Error('TRANSPORT_ERROR');
      }

      const data = decodeEnvelope(await response.json());

      // Parsear el contenido JSON de la respuesta del modelo
      const content = data.message.content;
      const parsed = parseGamePayload(content, context.function);

      return { data, payload: parsed };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async healthCheck(): Promise<{ available: boolean; latencyMs?: number; error?: string }> {
    const startTime = performance.now();
    try {
      const response = await fetch(`${this.config.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      const latencyMs = Math.max(0, performance.now() - startTime);
      return { available: response.ok, latencyMs };
    } catch {
      return { available: false, error: 'El proveedor no está disponible.' };
    }
  }

  estimateTokens(text: string): number {
    // Estimación aproximada: ~4 chars por token para español
    return Math.ceil(text.length / 4);
  }
}

export function createOllamaProvider(config: Partial<OllamaConfig> = {}): OllamaProvider {
  return new OllamaProvider(parseOllamaConfig(config));
}
