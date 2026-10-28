export type AiOperation = 'interpretAction' | 'narrateResult' | 'converse';
export type AiErrorCode = 'unavailable' | 'timeout' | 'cancelled' | 'invalid_response' | 'budget_exceeded';
export class AiError extends Error {
  readonly code: AiErrorCode;
  constructor(code: AiErrorCode) { super(code); this.code = code; }
}
export interface AiRequest {
  operation: AiOperation;
  requestId: string;
  schema: Record<string, unknown>;
  context: Record<string, unknown>;
  signal?: AbortSignal;
}
export interface AiResponse {
  payload: unknown;
  usage: { inputTokens: number; outputTokens: number } | null;
  latencyMs: number;
  finishReason: 'stop';
}
export interface AiProvider {
  readonly providerId: string;
  readonly model: string;
  request(input: AiRequest): Promise<AiResponse>;
}
export function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function exactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}
