import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app.ts';
import { readBootstrapConfig } from './config.ts';
const local = { APP_MODE: 'development', API_HOST: '127.0.0.1', API_PORT: '3000', PUBLIC_ORIGIN: 'http://127.0.0.1:5173', LOCAL_DEV_AUTH_ENABLED: 'false', REGISTRATION_ENABLED: 'false', DATABASE_URL: 'postgres://app:app@localhost:5432/app' };

describe('base HTTP sin datos del juego', () => {
  const app = createApp();
  app.post('/prueba', async () => { throw new Error('SECRETO_SINTETICO'); });
  beforeAll(async () => {
    await app.ready();
    // inject carga su transporte de prueba de forma perezosa; prepararlo fuera
    // del tiempo de cada escenario. El arranque HTTP real se verifica en smoke.
    const warmup = await app.inject({ method: 'GET', url: '/api/v1/health' });
    expect(warmup.statusCode).toBe(200);
  });
  afterAll(async () => { await app.close(); });

  it('solo expone estado de proceso y genera requestId propio', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/health', headers: { 'x-request-id': 'controlado-por-cliente' } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
    expect(response.headers['x-request-id']).not.toBe('controlado-por-cliente');
    expect(response.headers['cache-control']).toBe('no-store');
  });
  it('distingue JSON inválido, exceso de cuerpo y fallo interno sin filtrar datos', async () => {
    const malformed = await app.inject({ method: 'POST', url: '/prueba', headers: { 'content-type': 'application/json' }, payload: '{' });
    expect(malformed.statusCode).toBe(400);
    expect(malformed.json().error.code).toBe('INVALID_REQUEST');
    const oversized = await app.inject({ method: 'POST', url: '/prueba', headers: { 'content-type': 'application/json' }, payload: JSON.stringify({ text: 'x'.repeat(65536) }) });
    expect(oversized.statusCode).toBe(413);
    const internal = await app.inject({ method: 'POST', url: '/prueba', payload: {} });
    expect(internal.statusCode).toBe(500);
    expect(internal.json().error.code).toBe('INTERNAL_ERROR');
    expect(internal.body).not.toContain('SECRETO_SINTETICO');
  });
  it('no anuncia readiness ni login ni sesión sin configuración', async () => {
    const ready = await app.inject({ method: 'GET', url: '/api/v1/ready' });
    expect(ready.statusCode).toBe(404);
    for (const url of ['/api/v1/auth/local-session', '/api/v1/auth/login']) {
      const response = await app.inject({ method: 'GET', url });
      expect(response.statusCode).toBe(404);
      expect(JSON.stringify(response.json())).not.toContain(url);
    }
  });
});

describe('arranque cerrado', () => {
  it('admite únicamente configuración local explícita', () => {
    expect(readBootstrapConfig(local)).toEqual({ host: '127.0.0.1', port: 3000 });
  });
  it.each([
    { APP_MODE: 'public' }, { APP_MODE: undefined }, { API_HOST: '0.0.0.0' },
    { API_PORT: '0' }, { API_PORT: '65536' }, { API_PORT: '3000x' },
    { PUBLIC_ORIGIN: 'http://localhost:5173' }, { PUBLIC_ORIGIN: 'http://127.0.0.1:5173/path' },
    { PUBLIC_ORIGIN: 'http://usuario:secreto@127.0.0.1:5173' },
    { LOCAL_DEV_AUTH_ENABLED: 'true' }, { REGISTRATION_ENABLED: 'true' },
  ])('rechaza configuración insegura o capacidad ausente: %j', patch => {
    expect(() => readBootstrapConfig({ ...local, ...patch })).toThrow();
  });
});
