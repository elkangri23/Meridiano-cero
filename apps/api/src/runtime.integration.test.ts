import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from './app.ts';
import { readAppConfig, readDatabaseUrl } from './config.ts';
import { createDatabase } from './database/connection.ts';
import { migrate } from './database/migrations.ts';

describe('saturación de DB y readiness con PostgreSQL real', () => {
  const config = readAppConfig(process.env);
  const database = createDatabase(config.databaseUrl);
  const state = { draining: false };
  const app = createApp({ config, database, state });
  beforeAll(async () => { await migrate(readDatabaseUrl(process.env.DATABASE_MIGRATION_URL)); await app.ready(); });
  afterAll(async () => { await app.close(); await database.pool.end(); });

  it('BOR-075: pool admite cinco conexiones y hasta 25 esperas, sin cola infinita', async () => {
    const held = await Promise.all(Array.from({ length: 5 }, () => database.pool.connect()));
    const pending = Array.from({ length: 25 }, () => database.pool.connect().then(client => { client.release(); }));
    try {
      expect(database.pool.waitingCount).toBe(25);
      await expect(database.pool.connect()).rejects.toThrow('DB_CAPACITY_EXCEEDED');
      await expect(database.pool.query('SELECT 1')).rejects.toThrow('DB_CAPACITY_EXCEEDED');
      expect(database.pool.waitingCount).toBe(25);
    } finally { held.forEach(client => client.release()); await Promise.all(pending); }
    expect(database.pool.waitingCount).toBe(0);
  });

  it('BOR-075: probes simultáneas comparten una única espera SQL y se recuperan', async () => {
    const held = await Promise.all(Array.from({ length: 5 }, () => database.pool.connect()));
    const pending = Array.from({ length: 40 }, () => app.inject('/api/v1/ready').then(response => response.statusCode));
    try {
      await vi.waitFor(() => { expect(database.pool.waitingCount).toBe(1); }, { timeout: 1200, interval: 20 });
      expect((await app.inject('/api/v1/health')).statusCode).toBe(200);
    } finally { held.forEach(client => client.release()); }
    expect(await Promise.all(pending)).toEqual(Array(40).fill(200));
    expect(database.pool.waitingCount).toBe(0);
  });

  it('BOR-076 parcial: draining cierra readiness y admisión sin abrir otra query', async () => {
    state.draining = true;
    try {
      expect((await app.inject('/api/v1/ready')).statusCode).toBe(503);
      expect((await app.inject('/api/v1/health')).statusCode).toBe(200);
      expect((await app.inject({ method: 'POST', url: '/api/v1/runs', payload: {} })).statusCode).toBe(503);
      expect(database.pool.waitingCount).toBe(0);
    } finally { state.draining = false; }
  });
});
