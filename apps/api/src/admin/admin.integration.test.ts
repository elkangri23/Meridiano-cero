import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.ts';
import { readAppConfig, readDatabaseUrl } from '../config.ts';
import { createDatabase } from '../database/connection.ts';
import { migrate } from '../database/migrations.ts';

describe('Panel admin (Fase 2): endpoints de datos con sesión real', () => {
  const base = readAppConfig(process.env);
  const config = { ...base, registrationEnabled: true, localAuth: false };
  const database = createDatabase(config.databaseUrl);
  const app = createApp({ config, database });
  const origin = config.origin;
  const adminEmail = 'prueba-admin@sintetico.invalid';
  const playerEmail = 'prueba-jugador@sintetico.invalid';
  const password = 'contraseña-sintética-admin-123';
  let adminCookie = '';
  let playerCookie = '';

  function headers(extra: Record<string, string> = {}) {
    return { origin, ...extra };
  }

  async function login(email: string) {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: headers(),
      payload: { email, password },
    });
    expect(response.statusCode).toBe(200);
    const header = response.headers['set-cookie'];
    expect(typeof header).toBe('string');
    return (header as string).split(';')[0] ?? '';
  }

  beforeAll(async () => {
    const url = readDatabaseUrl(process.env.DATABASE_MIGRATION_URL);
    await migrate(url);
    await app.ready();

    const owner = createDatabase(readDatabaseUrl(process.env.DATABASE_MIGRATION_URL));
    try {
      // Registrar admin y jugador, promover al admin ANTES de iniciar sesión
      // para que la sesión nazca ya con rol admin.
      for (const email of [adminEmail, playerEmail]) {
        const registered = await app.inject({
          method: 'POST',
          url: '/api/v1/auth/register',
          headers: headers(),
          payload: { email, displayName: 'Detective sintético', password },
        });
        expect(registered.statusCode).toBe(200);
      }
      await owner.pool.query('UPDATE profiles SET role = $1 WHERE local_key = $2', ['admin', adminEmail]);
    } finally {
      await owner.pool.end();
    }
    adminCookie = await login(adminEmail);
    playerCookie = await login(playerEmail);
  });

  afterAll(async () => {
    const owner = createDatabase(readDatabaseUrl(process.env.DATABASE_MIGRATION_URL));
    try {
      await owner.pool.query('DELETE FROM sessions USING profiles WHERE sessions.profile_id = profiles.id AND profiles.local_key IN ($1, $2)', [adminEmail, playerEmail]);
      await owner.pool.query('DELETE FROM admin_audit_log USING profiles WHERE admin_audit_log.admin_id = profiles.id AND profiles.local_key IN ($1, $2)', [adminEmail, playerEmail]);
      await owner.pool.query('DELETE FROM profiles WHERE local_key IN ($1, $2)', [adminEmail, playerEmail]);
    } finally {
      await owner.pool.end();
    }
    await app.close();
    await database.pool.end();
  });

  it('la sesión admin devuelve role admin en /api/v1/me (bug A)', async () => {
    const response = await app.inject({ url: '/api/v1/me', headers: { cookie: adminCookie } });
    expect(response.statusCode).toBe(200);
    expect(response.json().profile.role).toBe('admin');
  });

  it('invitado recibe 401 y jugador 403 en los endpoints admin', async () => {
    for (const path of ['/api/v1/admin/metrics', '/api/v1/admin/users', '/api/v1/admin/runs', '/api/v1/admin/ai/metrics', '/api/v1/admin/ai/quotas', '/api/v1/admin/audit']) {
      expect((await app.inject({ url: path, headers: headers() })).statusCode).toBe(401);
      expect((await app.inject({ url: path, headers: { ...headers(), cookie: playerCookie } })).statusCode).toBe(403);
    }
  });

  it('admin recibe 200 con datos en los 5 endpoints (bug B)', async () => {
    const cookie = { cookie: adminCookie };
    const metrics = await app.inject({ url: '/api/v1/admin/metrics', headers: cookie });
    expect(metrics.statusCode).toBe(200);
    expect(metrics.json()).toMatchObject({ usersTotal: expect.any(Number), runsTotal: expect.any(Number) });

    const users = await app.inject({ url: '/api/v1/admin/users', headers: cookie });
    expect(users.statusCode).toBe(200);
    expect(Array.isArray(users.json())).toBe(true);

    const runs = await app.inject({ url: '/api/v1/admin/runs', headers: cookie });
    expect(runs.statusCode).toBe(200);
    expect(Array.isArray(runs.json())).toBe(true);

    const aiMetrics = await app.inject({ url: '/api/v1/admin/ai/metrics', headers: cookie });
    expect(aiMetrics.statusCode).toBe(200);
    expect(Array.isArray(aiMetrics.json())).toBe(true);

    const quotas = await app.inject({ url: '/api/v1/admin/ai/quotas', headers: cookie });
    expect(quotas.statusCode).toBe(200);
    expect(Array.isArray(quotas.json())).toBe(true);
  });

  it('la auditoría devuelve { logs, total } como espera el cliente web', async () => {
    const response = await app.inject({ url: '/api/v1/admin/audit', headers: { cookie: adminCookie } });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(Array.isArray(body.logs)).toBe(true);
    expect(typeof body.total).toBe('number');
  });

  it('la auditoría acepta filtros sin romper la SQL', async () => {
    for (const query of ['?action=view_audit', '?startDate=2026-01-01', '?endDate=2027-01-01', '?startDate=2026-01-01&endDate=2027-01-01&action=view_audit']) {
      const response = await app.inject({ url: '/api/v1/admin/audit' + query, headers: { cookie: adminCookie } });
      expect(response.statusCode).toBe(200);
      expect(Array.isArray(response.json().logs)).toBe(true);
    }
  });
});
