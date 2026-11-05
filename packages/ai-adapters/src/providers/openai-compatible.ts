// Adaptador genérico OpenAI-compatible: cualquier endpoint con protocolo
// chat/completions (LM Studio en http://localhost:1234/v1, proxies y otros
// servicios compatibles). La base URL y el modelo son obligatorios: no hay
// valores por defecto porque cada endpoint es distinto. La validación de
// destino (qué URLs admite cada entorno) vive en la API, no aquí.

import { OpenAIChatProvider, parseOpenAIChatConfig, type OpenAIChatConfig } from './openai-chat.js';

export type OpenAICompatibleConfig = OpenAIChatConfig;

export function parseOpenAICompatibleConfig(value: unknown = {}): OpenAICompatibleConfig {
  const config = parseOpenAIChatConfig(value, { id: 'openai-compatible', baseUrl: '', defaultModel: '' });
  if (!config.baseUrl) throw new Error('Configuración openai-compatible inválida.');
  if (!config.defaultModel) throw new Error('Configuración openai-compatible inválida.');
  return config;
}

export class OpenAICompatibleProvider extends OpenAIChatProvider {
  constructor(config: Partial<OpenAICompatibleConfig> = {}) {
    super('openai-compatible', parseOpenAICompatibleConfig(config));
  }
}

export function createOpenAICompatibleProvider(config: Partial<OpenAICompatibleConfig> = {}): OpenAICompatibleProvider {
  return new OpenAICompatibleProvider(config);
}
