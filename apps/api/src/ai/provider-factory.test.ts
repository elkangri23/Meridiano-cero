// Tests de la fábrica de proveedores (Fase C): catálogo, construcción por
// adaptador y proveedor no disponible para configuraciones personales rotas.

import { describe, expect, it } from 'vitest';
import {
  PROVIDER_CATALOG, catalogEntry, buildProviderFromAdapter, buildAdminProvider,
  createUnavailableProvider, defaultModelFor,
} from './provider-factory.ts';
import { AiError } from './provider.ts';
import type { AppConfig } from '../config.ts';

function baseConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    host: '127.0.0.1', port: 3000, mode: 'development', origin: 'http://127.0.0.1:5173',
    localAuth: true, registrationEnabled: false, databaseUrl: 'postgresql://meridiano_app:x@127.0.0.1:15433/meridiano',
    aiProvider: 'mock', ...overrides,
  };
}

describe('catálogo de proveedores', () => {
  it('incluye los seis adaptadores con sus valores por defecto', () => {
    expect(PROVIDER_CATALOG.map(entry => entry.id)).toEqual(
      ['freellmapi', 'openai', 'anthropic', 'google', 'ollama', 'openai-compatible'],
    );
    expect(catalogEntry('openai')?.defaultModel).toBe('gpt-4o-mini');
    expect(catalogEntry('anthropic')?.defaultModel).toBe('claude-sonnet-4-5');
    expect(catalogEntry('google')?.defaultModel).toBe('gemini-2.5-flash');
    expect(catalogEntry('ollama')?.needsKey).toBe(false);
    expect(catalogEntry('openai-compatible')?.needsBaseUrl).toBe(true);
    expect(catalogEntry('freellmapi')?.fixedBaseUrl).toBe(true);
    expect(defaultModelFor('freellmapi')).toBe('gpt-4o-mini');
    expect(catalogEntry('inexistente')).toBeUndefined();
  });

  it('construye cada adaptador con su identificador y modelo', () => {
    for (const entry of PROVIDER_CATALOG) {
      const provider = buildProviderFromAdapter(entry.id, {
        baseUrl: entry.defaultBaseUrl,
        model: entry.defaultModel,
        apiKey: 'test-key',
      });
      expect(provider.providerId).toBe(entry.id);
      expect(provider.model).toBe(entry.defaultModel);
    }
  });

  it('el defecto del administrador sale del entorno', () => {
    const admin = buildAdminProvider(baseConfig({
      aiProvider: 'freellmapi', aiBaseUrl: 'http://freellmapi:3001/v1', aiModel: 'auto', aiApiKey: 'test-key',
    }));
    expect(admin.providerId).toBe('freellmapi');
    expect(admin.model).toBe('auto');
    expect(buildAdminProvider(baseConfig()).providerId).toBe('mock');
  });

  it('el proveedor no disponible falla sin llamar a red', async () => {
    const provider = createUnavailableProvider('openai', 'gpt-4o-mini');
    await expect(provider.request({
      operation: 'interpretAction', requestId: 'x', schema: {}, context: {},
    })).rejects.toBeInstanceOf(AiError);
    await expect(provider.request({
      operation: 'interpretAction', requestId: 'x', schema: {}, context: {},
    })).rejects.toMatchObject({ code: 'unavailable' });
  });
});
