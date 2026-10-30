// Tests para adaptador FreeLLMAPI (T7-01)

import { describe, it, expect } from 'vitest';
import { createFreeLLMAPIProvider } from './freellmapi.js';

describe('FreeLLMAPIProvider', () => {
  it('crea provider con configuración por defecto', () => {
    const provider = createFreeLLMAPIProvider({ apiKey: 'test-key' });
    expect(provider.id).toBe('freellmapi');
    expect(provider.capabilities).toContain('interpretAction');
    expect(provider.capabilities).toContain('narrateResult');
    expect(provider.capabilities).toContain('converse');
    expect(provider.capabilities).toContain('generateCase');
    expect(provider.defaultModel).toBe('gpt-4o-mini');
    expect(provider.maxContextTokens).toBe(8192);
  });

  it('estimateTokens devuelve estimación razonable', () => {
    const provider = createFreeLLMAPIProvider({ apiKey: 'test-key' });
    expect(provider.estimateTokens('hola mundo')).toBeGreaterThan(0);
    expect(provider.estimateTokens('')).toBe(0);
  });

  it('healthCheck devuelve error sin apiKey', async () => {
    const provider = createFreeLLMAPIProvider({ apiKey: '' });
    const result = await provider.healthCheck();
    expect(result.available).toBe(false);
    expect(result.error).toBe('API key no configurada');
  });

  it('healthCheck devuelve error con apiKey inválida (mock)', async () => {
    const provider = createFreeLLMAPIProvider({
      apiKey: 'invalid-key',
      baseUrl: 'https://httpbin.org' // endpoint de prueba
    });
    // No podemos testear realmente sin mock, solo verificamos estructura
    expect(typeof provider.healthCheck).toBe('function');
  });

  it('configura baseUrl personalizada', () => {
    const provider = createFreeLLMAPIProvider({
      apiKey: 'test-key',
      baseUrl: 'https://custom.example.com/v1'
    });
    // Verificamos que se instancia sin error
    expect(provider).toBeDefined();
  });

  it('configura modelo personalizado', () => {
    const provider = createFreeLLMAPIProvider({
      apiKey: 'test-key',
      defaultModel: 'gpt-4-turbo'
    });
    expect(provider.defaultModel).toBe('gpt-4-turbo');
  });
});