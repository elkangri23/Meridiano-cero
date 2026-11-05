// Transporte genérico OpenAI-compatible (chat/completions) para los adaptadores
// del juego. FreeLLMAPI, OpenAI directo y endpoints compatibles (LM Studio)
// comparten protocolo; solo cambian el identificador y los valores por defecto.

import type { AIProvider, AIContext, AIResponse, AIFunction, ProviderId } from '../types.js';
import { buildGameSystemPrompt, buildGameFunctionPrompt } from './game-prompts.js';
import { mapHttpStatus, executeWithRetries, parseGamePayload, emptyUsage } from './provider-transport.js';

export interface OpenAIChatConfig {
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
  timeoutMs: number;
  maxRetries: number;
}

interface OpenAIChatRequest {
  model: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream: false;
}

interface OpenAIChatResponse {
  choices: Array<{ message: { content: string }; finish_reason: string }>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

const CONFIG_KEYS = ['baseUrl', 'apiKey', 'defaultModel', 'timeoutMs', 'maxRetries'];

function stringOption(value: unknown, fallback: string, label: string): string {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !value.trim() || value.length > 512) throw new Error(label);
  return value;
}

// La clave vacía es un estado válido («sin configurar»); solo se rechaza
// que no sea texto o que sea absurdamente larga.
function apiKeyOption(value: unknown, label: string): string {
  if (value === undefined) return '';
  if (typeof value !== 'string' || value.length > 512) throw new Error(label);
  return value;
}

function integerOption(value: unknown, fallback: number, minimum: number, maximum: number, label: string): number {
  if (value === undefined) return fallback;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(label);
  }
  return value;
}

function origin(value: unknown, fallback: string, label: string): string {
  const candidate = stringOption(value, fallback, label);
  let url: URL;
  try { url = new URL(candidate); } catch { throw new Error(label); }
  // Se admite ruta (p. ej. /v1), pero nunca credenciales, query ni fragmento.
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error(label);
  }
  return url.origin + url.pathname.replace(/\/+$/, '');
}

export function parseOpenAIChatConfig(
  value: unknown,
  defaults: { id: string; baseUrl: string; defaultModel: string },
): OpenAIChatConfig {
  const label = `Configuración ${defaults.id} inválida.`;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(label);
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some(key => !CONFIG_KEYS.includes(key))) throw new Error(label);
  const config: OpenAIChatConfig = {
    baseUrl: origin(input.baseUrl, defaults.baseUrl, label),
    apiKey: apiKeyOption(input.apiKey, label),
    defaultModel: stringOption(input.defaultModel, defaults.defaultModel, label),
    timeoutMs: integerOption(input.timeoutMs, 60000, 1, 60000, label),
    maxRetries: integerOption(input.maxRetries, 2, 0, 2, label),
  };
  if (!config.baseUrl) throw new Error(label);
  return config;
}

function parseChatCompletion(data: OpenAIChatResponse, functionName: AIFunction): {
  payload: unknown;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
} {
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('INVALID_OUTPUT');
  const usage = data.usage ? {
    promptTokens: data.usage.prompt_tokens,
    completionTokens: data.usage.completion_tokens,
    totalTokens: data.usage.total_tokens,
  } : emptyUsage();
  return { payload: parseGamePayload(content, functionName), usage };
}

export class OpenAIChatProvider implements AIProvider {
  readonly id: ProviderId;
  readonly capabilities: AIFunction[] = ['interpretAction', 'narrateResult', 'converse', 'generateCase'];
  readonly maxContextTokens = 8192;
  readonly defaultModel: string;

  protected config: OpenAIChatConfig;

  constructor(id: ProviderId, config: OpenAIChatConfig) {
    this.id = id;
    this.config = config;
    this.defaultModel = config.defaultModel;
  }

  async execute<T>(context: AIContext): Promise<AIResponse<T>> {
    const started = Date.now();
    const messages = [
      { role: 'system', content: buildGameSystemPrompt(context.function, context) },
      { role: 'user', content: buildGameFunctionPrompt(context.function) },
    ];
    return executeWithRetries(context.limits, context.cancellationSignal, async (signal) => {
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
        } as OpenAIChatRequest),
        signal,
        redirect: 'error',
      });
      if (!httpResponse.ok) throw mapHttpStatus(httpResponse.status);
      const data = await httpResponse.json() as OpenAIChatResponse;
      const { payload, usage } = parseChatCompletion(data, context.function);
      return {
        payload: payload as T,
        usage,
        latencyMs: Date.now() - started,
        finishReason: 'stop',
      };
    });
  }

  async healthCheck(): Promise<{ available: boolean; latencyMs?: number; error?: string }> {
    const startTime = performance.now();
    try {
      if (!this.config.apiKey) {
        return { available: false, error: 'API key no configurada' };
      }
      if (!this.config.baseUrl) {
        return { available: false, error: 'Base URL no configurada' };
      }
      const response = await fetch(`${this.config.baseUrl}/models`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${this.config.apiKey}` },
        signal: AbortSignal.timeout(5000),
        redirect: 'error',
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
