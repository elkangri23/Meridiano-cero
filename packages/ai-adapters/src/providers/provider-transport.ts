// Transporte compartido por los adaptadores de IA del juego: reintentos con
// espera creciente, cancelación por timeout o señal del llamador, y
// normalización de errores de transporte a los códigos del juego
// (UNAUTHORIZED, RATE_LIMITED, MODEL_UNAVAILABLE, CANCELLED).

import type { AIFunction } from '../types.js';
import { parseJSONResponse, validateGameOutput } from './game-prompts.js';

export function mapHttpStatus(status: number): Error {
  if (status === 401) return new Error('UNAUTHORIZED');
  if (status === 429) return new Error('RATE_LIMITED');
  return new Error('TRANSPORT_ERROR');
}

export function normalizeTransportError(error: unknown): Error {
  return error instanceof Error ? error : new Error('TRANSPORT_ERROR');
}

export function isCancellation(error: Error): boolean {
  return error.name === 'AbortError' || error.message === 'CANCELLED';
}

export function classifyFinalError(lastError: Error | null): Error {
  if (lastError?.message === 'UNAUTHORIZED') return new Error('UNAUTHORIZED');
  if (lastError?.message === 'RATE_LIMITED') return new Error('RATE_LIMITED');
  return new Error('MODEL_UNAVAILABLE');
}

/** Ejecuta un intento con reintentos; la cancelación no se reintenta. */
export async function executeWithRetries<T>(
  limits: { timeoutMs: number; maxRetries: number },
  cancellationSignal: AbortSignal | undefined,
  attempt: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), limits.timeoutMs);
  let lastError: Error | null = null;
  try {
    for (let retry = 0; retry <= limits.maxRetries; retry++) {
      try {
        const signal = cancellationSignal
          ? AbortSignal.any([cancellationSignal, controller.signal])
          : controller.signal;
        return await attempt(signal);
      } catch (error: unknown) {
        lastError = normalizeTransportError(error);
        if (isCancellation(lastError)) throw new Error('CANCELLED', { cause: error });
        if (retry === limits.maxRetries) break;
        await new Promise(resolve => setTimeout(resolve, 1000 * (retry + 1)));
      }
    }
    throw classifyFinalError(lastError);
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Extrae y valida el JSON del texto del modelo para la función pedida. */
export function parseGamePayload(text: string, functionName: AIFunction): unknown {
  const parsed = parseJSONResponse(text);
  validateGameOutput(functionName, parsed);
  return parsed;
}

export function emptyUsage(): { promptTokens: number; completionTokens: number; totalTokens: number } {
  return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
}
