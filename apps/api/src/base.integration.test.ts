import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app.ts';
import { readAppConfig, readDatabaseUrl } from './config.ts';
import { createDatabase } from './database/connection.ts';
import { migrate } from './database/migrations.ts';
import { tokenDigest } from './auth/store.ts';

describe('PostgreSQL real y sesión sintética', () => {
  const config = readAppConfig(process.env);
  const database = createDatabase(config.databaseUrl);
  const app = createApp({ config, database });
  const origin = config.origin;
  let cookie = '';
  let csrf = '';
  let profileId = '';
  beforeAll(async () => {
    const url = readDatabaseUrl(process.env.DATABASE_MIGRATION_URL);
    await migrate(url);
    await migrate(url);
    await app.ready();
  });
  afterAll(async () => { await app.close(); await database.pool.end(); });
  it('migración idempotente y readiness mínima', async () => {
    const response = await app.inject('/api/v1/ready');
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ready' });
  });
  it('GET anónimo no crea sesión', async () => {
    expect((await app.inject('/api/v1/me')).statusCode).toBe(401);
  });
  it('bootstrap rechaza Origin y campos extra', async () => {
    for (const headers of [{}, { origin: 'http://malicioso.invalid' }]) {
      expect((await app.inject({ method: 'POST', url: '/api/v1/auth/local-session', headers, payload: {} })).statusCode).toBe(403);
    }
    expect((await app.inject({ method: 'POST', url: '/api/v1/auth/local-session', headers: { origin }, payload: { ownerId: 'ajeno' } })).statusCode).toBe(400);
  });
  it('cookie HttpOnly y digest; ningún token en JSON', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/v1/auth/local-session', headers: { origin }, payload: {} });
    expect(response.statusCode).toBe(200);
    const header = response.headers['set-cookie'];
    if (typeof header !== 'string') throw new Error('Cookie ausente');
    cookie = header.split(';')[0] ?? '';
    expect(header).toContain('HttpOnly');
    expect(header).toContain('SameSite=Lax');
    expect(header).toContain('Path=/api/v1');
    csrf = response.json().csrfToken;
    profileId = response.json().profile.id;
    const token = cookie.slice('meridiano_session='.length);
    expect(response.body).not.toContain(token);
    const stored = await database.pool.query('SELECT token_hash FROM sessions WHERE token_hash=$1', [tokenDigest(token)]);
    expect(stored.rows).toHaveLength(1);
    expect(stored.rows[0].token_hash).not.toBe(token);
  });
  it('otra instancia API reanuda perfil y sesión', async () => {
    const second = createApp({ config, database });
    try {
      const response = await second.inject({ url: '/api/v1/me', headers: { cookie } });
      expect(response.statusCode).toBe(200);
      expect(response.json().profile.id).toBe(profileId);
      expect(response.json().csrfToken).toBe(csrf);
    } finally { await second.close(); }
  });
  it('rotación revoca cookie previa y logout exige CSRF; repetición idempotente', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/v1/auth/local-session', headers: { origin, cookie }, payload: {} });
    expect(response.statusCode).toBe(200);
    expect((await app.inject({ url: '/api/v1/me', headers: { cookie } })).statusCode).toBe(401);
    const header = response.headers['set-cookie'];
    if (typeof header !== 'string') throw new Error('Cookie ausente');
    cookie = header.split(';')[0] ?? '';
    csrf = response.json().csrfToken;
    expect((await app.inject({ method: 'POST', url: '/api/v1/auth/logout', headers: { origin, cookie, 'x-csrf-token': 'erróneo' } })).statusCode).toBe(403);
    expect((await app.inject({ url: '/api/v1/me', headers: { cookie } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: '/api/v1/auth/logout', headers: { origin, cookie, 'x-csrf-token': csrf } })).statusCode).toBe(204);
    expect((await app.inject({ method: 'POST', url: '/api/v1/auth/logout', headers: { origin, cookie } })).statusCode).toBe(204);
  });
  it('expiración y mínimos privilegios DB', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/v1/auth/local-session', headers: { origin }, payload: {} });
    const header = response.headers['set-cookie'];
    if (typeof header !== 'string') throw new Error('Cookie ausente');
    const current = header.split(';')[0] ?? '';
    await database.pool.query("UPDATE sessions SET created_at=now()-interval '10 hours', expires_at=now()-interval '1 hour' WHERE token_hash=$1", [tokenDigest(current.slice('meridiano_session='.length))]);
    expect((await app.inject({ url: '/api/v1/me', headers: { cookie: current } })).statusCode).toBe(401);
    await expect(database.pool.query('CREATE TABLE forbidden_probe (id integer)')).rejects.toThrow();
  });
  it('bandera desactivada no registra bootstrap', async () => {
    const disabled = createApp({ config: { ...config, localAuth: false }, database });
    try { expect((await disabled.inject({ method: 'POST', url: '/api/v1/auth/local-session', headers: { origin }, payload: {} })).statusCode).toBe(404); }
    finally { await disabled.close(); }
  });

  it('dos migradores concurrentes y esquema futuro fallan de forma segura', async () => {
    const migrationUrl = readDatabaseUrl(process.env.DATABASE_MIGRATION_URL);
    await Promise.all([migrate(migrationUrl), migrate(migrationUrl)]);
    const owner = createDatabase(migrationUrl);
    try {
      await owner.pool.query("INSERT INTO base_migrations(name,hash) VALUES ('9999_future.sql',$1)", ['0'.repeat(64)]);
      expect((await app.inject('/api/v1/ready')).statusCode).toBe(503);
      expect((await app.inject('/api/v1/cases')).statusCode).toBe(503);
      await expect(migrate(migrationUrl)).rejects.toThrow('SCHEMA_INCOMPATIBLE');
    } finally {
      await owner.pool.query("DELETE FROM base_migrations WHERE name='9999_future.sql'");
      await owner.pool.end();
    }
    expect((await app.inject('/api/v1/ready')).statusCode).toBe(200);
  });
  it('rate limit antes de crear sesiones y cookie ambigua rechazada', async () => {
    const limited = createApp({ config, database });
    try {
      for (let index = 0; index < 10; index++) {
        expect((await limited.inject({ method: 'POST', url: '/api/v1/auth/local-session', headers: { origin }, payload: { invalid: true } })).statusCode).toBe(400);
      }
      const response = await limited.inject({ method: 'POST', url: '/api/v1/auth/local-session', headers: { origin }, payload: {} });
      expect(response.statusCode).toBe(429);
      expect(response.headers['retry-after']).toBe('60');
      expect((await limited.inject({ url: '/api/v1/me', headers: { cookie: 'meridiano_session=' + 'a'.repeat(43) + '; meridiano_session=' + 'b'.repeat(43) } })).statusCode).toBe(401);
    } finally { await limited.close(); }
  });

});
