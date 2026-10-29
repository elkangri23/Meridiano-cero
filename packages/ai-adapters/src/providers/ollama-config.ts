export interface OllamaConfig {
  baseUrl: string;
  defaultModel: string;
  timeoutMs: number;
  maxRetries: number;
  maxContextTokens: number;
}

function stringOption(value: unknown, fallback: string): string {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !value.trim() || value.length > 256) throw new Error('Configuración Ollama inválida.');
  return value;
}

function integerOption(value: unknown, fallback: number, minimum: number, maximum: number): number {
  if (value === undefined) return fallback;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error('Configuración Ollama inválida.');
  }
  return value;
}

function origin(value: unknown): string {
  const candidate = stringOption(value, 'http://localhost:11434');
  let url: URL;
  try { url = new URL(candidate); }
  catch { throw new Error('Configuración Ollama inválida.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('Configuración Ollama inválida.');
  }
  return url.origin;
}

export function parseOllamaConfig(value: unknown = {}): OllamaConfig {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Configuración Ollama inválida.');
  const input = value as Record<string, unknown>;
  const keys = ['baseUrl', 'defaultModel', 'timeoutMs', 'maxRetries', 'maxContextTokens'];
  if (Object.keys(input).some(key => !keys.includes(key))) throw new Error('Configuración Ollama inválida.');
  return {
    baseUrl: origin(input.baseUrl), defaultModel: stringOption(input.defaultModel, 'llama3.1:8b'),
    timeoutMs: integerOption(input.timeoutMs, 60000, 1, 60000),
    maxRetries: integerOption(input.maxRetries, 1, 0, 2),
    maxContextTokens: integerOption(input.maxContextTokens, 8192, 1, 131072),
  };
}
