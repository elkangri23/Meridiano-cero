// Adaptador OpenAI directo: transporte OpenAI-compatible contra
// https://api.openai.com/v1 con la clave personal del usuario.

import { OpenAIChatProvider, parseOpenAIChatConfig, type OpenAIChatConfig } from './openai-chat.js';

export type OpenAIConfig = OpenAIChatConfig;

export function parseOpenAIConfig(value: unknown = {}): OpenAIConfig {
  return parseOpenAIChatConfig(value, { id: 'openai', baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o-mini' });
}

export class OpenAIProvider extends OpenAIChatProvider {
  constructor(config: Partial<OpenAIConfig> = {}) {
    super('openai', parseOpenAIConfig(config));
  }
}

export function createOpenAIProvider(config: Partial<OpenAIConfig> = {}): OpenAIProvider {
  return new OpenAIProvider(config);
}
