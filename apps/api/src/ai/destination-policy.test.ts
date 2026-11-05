// Tests de la política de destinos de conexiones personales (Fase C).
// Sin red real salvo la comprobación DNS negativa (host inexistente).

import { describe, expect, it } from 'vitest';
import { validateConnectionBaseUrl } from './destination-policy.ts';

describe('política de destinos de conexiones personales', () => {
  it('Ollama exige loopback literal sin ruta', async () => {
    await expect(validateConnectionBaseUrl('ollama', 'http://127.0.0.1:11434', 'development'))
      .resolves.toBe('http://127.0.0.1:11434');
    await expect(validateConnectionBaseUrl('ollama', 'http://localhost:11434', 'development'))
      .rejects.toThrow('Ollama requiere');
    await expect(validateConnectionBaseUrl('ollama', 'https://127.0.0.1:11434', 'development'))
      .rejects.toThrow('Ollama requiere');
    await expect(validateConnectionBaseUrl('ollama', 'http://127.0.0.1:11434/api', 'development'))
      .rejects.toThrow('Ollama requiere');
  });

  it('en desarrollo admite loopback y LAN local para OpenAI-compatible', async () => {
    await expect(validateConnectionBaseUrl('openai-compatible', 'http://localhost:1234/v1', 'development'))
      .resolves.toBe('http://localhost:1234/v1');
    await expect(validateConnectionBaseUrl('openai-compatible', 'http://192.168.1.50:1234/v1/', 'development'))
      .resolves.toBe('http://192.168.1.50:1234/v1');
  });

  it('en producción exige HTTPS y rechaza loopback, privada y metadata', async () => {
    await expect(validateConnectionBaseUrl('openai-compatible', 'http://localhost:1234/v1', 'production'))
      .rejects.toThrow('HTTPS');
    await expect(validateConnectionBaseUrl('openai-compatible', 'https://127.0.0.1:1234/v1', 'production'))
      .rejects.toThrow('no está permitido');
    await expect(validateConnectionBaseUrl('openai-compatible', 'https://192.168.1.50:1234/v1', 'production'))
      .rejects.toThrow('no está permitido');
    await expect(validateConnectionBaseUrl('openai-compatible', 'https://localhost:1234/v1', 'production'))
      .rejects.toThrow('no está permitido');
    await expect(validateConnectionBaseUrl('openai-compatible', 'https://metadata.google.internal/v1', 'production'))
      .rejects.toThrow('no está permitido');
  });

  it('en producción rechaza hostnames que no resuelven a IP pública', async () => {
    await expect(validateConnectionBaseUrl('openai-compatible', 'https://nonexistent.invalid/v1', 'production'))
      .rejects.toThrow('público');
  });

  it('rechaza credenciales en la URL y URLs mal formadas', async () => {
    await expect(validateConnectionBaseUrl('openai-compatible', 'http://user:pass@example.com/v1', 'development'))
      .rejects.toThrow('no es válida');
    await expect(validateConnectionBaseUrl('openai-compatible', 'notaurl', 'development'))
      .rejects.toThrow('no es válida');
  });

  it('los proveedores de base fija no admiten URL personalizada', async () => {
    await expect(validateConnectionBaseUrl('openai', 'https://api.openai.com/v1', 'development'))
      .rejects.toThrow('no admite una URL personalizada');
  });
});
