// Adaptador Anthropic (Claude): API Messages.
// Transporte propio; comparte prompts y validación de salida con el resto
// de adaptadores del juego (game-prompts.ts).

import type { AIProvider, AIContext, AIResponse, AIFunction, ProviderId } from '../types.js';
import { buildGameSystemPrompt, buildGameFunctionPrompt } from './game-prompts.js';
import { mapHttpStatus, executeWithRetries, parseGamePayload, emptyUsage } from './provider-transport.js';

export interface AnthropicConfig {
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
  timeoutMs: number;
  maxRetries: number;
}

const CONFIG_KEYS = ['baseUrl', 'apiKey', 'defaultModel', 'timeoutMs', 'maxRetries'];
const LABEL = 'Configuración anthropic inválida.';

function stringOption(value: unknown, fallback: string): string {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !value.trim() || value.length > 512) throw new Error(LABEL);
  return value;
}

function integerOption(value: unknown, fallback: number, minimum: number, maximum: number): number {
  if (value === undefined) return fallback;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(LABEL);
  }
  return value;
}

// La clave vacía es un estado válido («sin configurar»); solo se rechaza
// que no sea texto o que sea absurdamente larga.
function apiKeyOption(value: unknown): string {
  if (value === undefined) return '';
  if (typeof value !== 'string' || value.length > 512) throw new Error(LABEL);
  return value;
}

// La API de Anthropic es de origen fijo: sin ruta, query, fragmento ni credenciales.
function normalizeAnthropicBaseUrl(value: string): string {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error(LABEL); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error(LABEL);
  }
  return url.origin;
}

export function parseAnthropicConfig(value: unknown = {}): AnthropicConfig {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(LABEL);
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some(key => !CONFIG_KEYS.includes(key))) throw new Error(LABEL);
  return {
    baseUrl: normalizeAnthropicBaseUrl(stringOption(input.baseUrl, 'https://api.anthropic.com')),
    apiKey: apiKeyOption(input.apiKey),
    defaultModel: stringOption(input.defaultModel, 'claude-sonnet-4-5'),
    timeoutMs: integerOption(input.timeoutMs, 60000, 1, 60000),
    maxRetries: integerOption(input.maxRetries, 2, 0, 2),
  };
}

interface AnthropicMessageResponse {
  content?: Array<{ type?: string; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
  stop_reason?: string;
}

function parseAnthropicResponse(data: AnthropicMessageResponse, functionName: AIFunction): {
  payload: unknown;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
} {
  const text = data.content?.find(block => block.type === 'text' && typeof block.text === 'string')?.text;
  if (!text) throw new Error('INVALID_OUTPUT');
  const usage = data.usage ? {
    promptTokens: data.usage.input_tokens ?? 0,
    completionTokens: data.usage.output_tokens ?? 0,
    totalTokens: (data.usage.input_tokens ?? 0) + (data.usage.output_tokens ?? 0),
  } : emptyUsage();
  return { payload: parseGamePayload(text, functionName), usage };
}

export class AnthropicProvider implements AIProvider {
  readonly id: ProviderId = 'anthropic';
  readonly capabilities: AIFunction[] = ['interpretAction', 'narrateResult', 'converse', 'generateCase'];
  readonly maxContextTokens = 200000;
  readonly defaultModel: string;

  private config: AnthropicConfig;

  constructor(config: Partial<AnthropicConfig> = {}) {
    this.config = parseAnthropicConfig(config);
    this.defaultModel = this.config.defaultModel;
  }

  async execute<T>(context: AIContext): Promise<AIResponse<T>> {
    const started = Date.now();
    return executeWithRetries(context.limits, context.cancellationSignal, async (signal) => {
      const httpResponse = await fetch(`${this.config.baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: context.model || this.defaultModel,
          max_tokens: context.limits.maxTokens ?? 1024,
          system: buildGameSystemPrompt(context.function, context),
          messages: [{ role: 'user', content: buildGameFunctionPrompt(context.function) }],
        }),
        signal,
        redirect: 'error',
      });
      if (!httpResponse.ok) throw mapHttpStatus(httpResponse.status);
      const data = await httpResponse.json() as AnthropicMessageResponse;
      const { payload, usage } = parseAnthropicResponse(data, context.function);
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
      const response = await fetch(`${this.config.baseUrl}/v1/models`, {
        method: 'GET',
        headers: { 'x-api-key': this.config.apiKey },
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

export function createAnthropicProvider(config: Partial<AnthropicConfig> = {}): AnthropicProvider {
  return new AnthropicProvider(config);
}
