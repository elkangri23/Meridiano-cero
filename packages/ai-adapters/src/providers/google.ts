// Adaptador Google (Gemini): API generateContent.
// Transporte propio; comparte prompts y validación de salida con el resto
// de adaptadores del juego (game-prompts.ts).

import type { AIProvider, AIContext, AIResponse, AIFunction, ProviderId } from '../types.js';
import { buildGameSystemPrompt, buildGameFunctionPrompt } from './game-prompts.js';
import { mapHttpStatus, executeWithRetries, parseGamePayload, emptyUsage } from './provider-transport.js';

export interface GoogleConfig {
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
  timeoutMs: number;
  maxRetries: number;
}

const CONFIG_KEYS = ['baseUrl', 'apiKey', 'defaultModel', 'timeoutMs', 'maxRetries'];
const LABEL = 'Configuración google inválida.';

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

// La API de Google admite ruta (/v1beta), pero nunca credenciales, query ni fragmento.
function normalizeGoogleBaseUrl(value: string): string {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error(LABEL); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error(LABEL);
  }
  return url.origin + url.pathname.replace(/\/+$/, '');
}

export function parseGoogleConfig(value: unknown = {}): GoogleConfig {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(LABEL);
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some(key => !CONFIG_KEYS.includes(key))) throw new Error(LABEL);
  return {
    baseUrl: normalizeGoogleBaseUrl(stringOption(input.baseUrl, 'https://generativelanguage.googleapis.com/v1beta')),
    apiKey: apiKeyOption(input.apiKey),
    defaultModel: stringOption(input.defaultModel, 'gemini-2.5-flash'),
    timeoutMs: integerOption(input.timeoutMs, 60000, 1, 60000),
    maxRetries: integerOption(input.maxRetries, 2, 0, 2),
  };
}

interface GeminiGenerateResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
}

function firstGeminiText(data: GeminiGenerateResponse): string | undefined {
  return data.candidates?.[0]?.content?.parts?.find(part => typeof part.text === 'string')?.text;
}

function parseGeminiResponse(data: GeminiGenerateResponse, functionName: AIFunction): {
  payload: unknown;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
} {
  const text = firstGeminiText(data);
  if (!text) throw new Error('INVALID_OUTPUT');
  const usage = data.usageMetadata ? {
    promptTokens: data.usageMetadata.promptTokenCount ?? 0,
    completionTokens: data.usageMetadata.candidatesTokenCount ?? 0,
    totalTokens: data.usageMetadata.totalTokenCount ?? 0,
  } : emptyUsage();
  return { payload: parseGamePayload(text, functionName), usage };
}

export class GoogleProvider implements AIProvider {
  readonly id: ProviderId = 'google';
  readonly capabilities: AIFunction[] = ['interpretAction', 'narrateResult', 'converse', 'generateCase'];
  readonly maxContextTokens = 1000000;
  readonly defaultModel: string;

  private config: GoogleConfig;

  constructor(config: Partial<GoogleConfig> = {}) {
    this.config = parseGoogleConfig(config);
    this.defaultModel = this.config.defaultModel;
  }

  async execute<T>(context: AIContext): Promise<AIResponse<T>> {
    const started = Date.now();
    const model = encodeURIComponent(context.model || this.defaultModel);
    return executeWithRetries(context.limits, context.cancellationSignal, async (signal) => {
      const httpResponse = await fetch(`${this.config.baseUrl}/models/${model}:generateContent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.config.apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: buildGameSystemPrompt(context.function, context) }] },
          contents: [{ role: 'user', parts: [{ text: buildGameFunctionPrompt(context.function) }] }],
          generationConfig: {
            temperature: 0.3,
            topP: 0.9,
            maxOutputTokens: context.limits.maxTokens ?? 1024,
          },
        }),
        signal,
        redirect: 'error',
      });
      if (!httpResponse.ok) throw mapHttpStatus(httpResponse.status);
      const data = await httpResponse.json() as GeminiGenerateResponse;
      const { payload, usage } = parseGeminiResponse(data, context.function);
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
      const response = await fetch(`${this.config.baseUrl}/models`, {
        method: 'GET',
        headers: { 'x-goog-api-key': this.config.apiKey },
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

export function createGoogleProvider(config: Partial<GoogleConfig> = {}): GoogleProvider {
  return new GoogleProvider(config);
}
