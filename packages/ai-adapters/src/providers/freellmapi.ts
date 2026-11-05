// Adaptador FreeLLMAPI: transporte OpenAI-compatible con los valores por
// defecto del servicio (https://api.freellmapi.com/v1, gpt-4o-mini). En el VPS
// se apunta al contenedor local con baseUrl http://freellmapi:3001/v1 y modelo
// `auto`; esa configuración vive en el entorno, no aquí.

import { OpenAIChatProvider, parseOpenAIChatConfig, type OpenAIChatConfig } from './openai-chat.js';

export type FreeLLMAPIConfig = OpenAIChatConfig;

export function parseFreeLLMAPIConfig(value: unknown = {}): FreeLLMAPIConfig {
  return parseOpenAIChatConfig(value, { id: 'freellmapi', baseUrl: 'https://api.freellmapi.com/v1', defaultModel: 'gpt-4o-mini' });
}

export class FreeLLMAPIProvider extends OpenAIChatProvider {
  constructor(config: Partial<FreeLLMAPIConfig> = {}) {
    super('freellmapi', parseFreeLLMAPIConfig(config));
  }
}

export function createFreeLLMAPIProvider(config: Partial<FreeLLMAPIConfig> = {}): FreeLLMAPIProvider {
  return new FreeLLMAPIProvider(config);
}
