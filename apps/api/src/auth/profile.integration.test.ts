// Perfil de detective (§13): alias y avatar por jugador, con persistencia
// en detective_profiles (migración 0009). Sin fila, GET devuelve el avatar
// por defecto y sin alias; PATCH crea la fila (upsert) y exige sesión,
// Origin y CSRF como el resto de escrituras de la cuenta.
import { randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.ts';
import { readAppConfig, readDatabaseUrl } from '../config.ts';
import { createDatabase } from '../database/connection.ts';
import { migrate } from '../database/migrations.ts';
import { tokenDigest } from '../auth/store.ts';
import { createTelemetry } from '../telemetry.ts';
import { Writable } from 'node:stream';

describe('Perfil de detective (alias y avatar)', () => {
  const config = readAppConfig(process.env);
  const database = createDatabase(config.databaseUrl);
  const owner = createDatabase(readDatabaseUrl(process.env.DATABASE_MIGRATION_URL));
  const lines: string[] = [];
  const sink = new Writable({ write(chunk, _encoding, done) { lines.push(String(chunk)); done(); } });
  const app = createApp({ config, database, telemetry: createTelemetry(sink) });
  const player = { id: randomUUID(), token: randomBytes(32).toString('base64url'), csrf: randomBytes(32).toString('base64url') };
  const other = { id: randomUUID(), token: randomBytes(32).toString('base64url'), csrf: randomBytes(32).toString('base64url') };
  const fresh = { id: randomUUID(), token: randomBytes(32).toString('base64url'), csrf: randomBytes(32).toString('base64url') };
  const headersFor = (user: typeof player) => ({ cookie: 'meridiano_session=' + user.token, origin: config.origin, 'x-csrf-token': user.csrf });
  const jsonHeadersFor = (user: typeof player) => ({ ...headersFor(user), 'content-type': 'application/json' });

  beforeAll(async () => {
    await migrate(readDatabaseUrl(process.env.DATABASE_MIGRATION_URL));
    for (const user of [player, other, fresh]) {
      await owner.pool.query('INSERT INTO profiles(id,local_key,display_name) VALUES ($1,$2,$3)', [user.id, 'profile-synthetic-' + user.id, 'Detective sintético']);
      await owner.pool.query("INSERT INTO sessions(token_hash,profile_id,csrf_token,expires_at) VALUES ($1,$2,$3,now()+interval '8 hours')", [tokenDigest(user.token), user.id, user.csrf]);
    }
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
    for (const user of [player, other, fresh]) {
      await owner.pool.query('DELETE FROM detective_profiles WHERE user_id=$1', [user.id]);
      await owner.pool.query('DELETE FROM sessions WHERE profile_id=$1', [user.id]);
      await owner.pool.query('DELETE FROM profiles WHERE id=$1', [user.id]);
    }
    await database.pool.end(); await owner.pool.end();
  });

  it('GET sin sesión devuelve 401', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/profile/detective' });
    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('SESSION_REQUIRED');
  });

  it('GET sin fila devuelve el avatar por defecto y sin alias', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/profile/detective', headers: headersFor(player) });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ alias: null, avatar: 'detective', displayName: 'Detective sintético' });
  });

  it('PATCH sin CSRF devuelve 403', async () => {
    const response = await app.inject({
      method: 'PATCH', url: '/api/v1/profile/detective',
      headers: { cookie: 'meridiano_session=' + player.token, origin: config.origin, 'content-type': 'application/json' },
      payload: { alias: 'Sabueso' },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('CSRF_REJECTED');
  });

  it('PATCH sin Origin devuelve 403', async () => {
    const response = await app.inject({
      method: 'PATCH', url: '/api/v1/profile/detective',
      headers: { cookie: 'meridiano_session=' + player.token, 'x-csrf-token': player.csrf, 'content-type': 'application/json' },
      payload: { alias: 'Sabueso' },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('ORIGIN_REJECTED');
  });

  it('PATCH con avatar fuera del conjunto devuelve 400', async () => {
    const response = await app.inject({
      method: 'PATCH', url: '/api/v1/profile/detective',
      headers: jsonHeadersFor(player), payload: { avatar: 'superheroe' },
    });
    expect(response.statusCode).toBe(400);
  });

  it('PATCH con alias vacío devuelve 400', async () => {
    const response = await app.inject({
      method: 'PATCH', url: '/api/v1/profile/detective',
      headers: jsonHeadersFor(player), payload: { alias: '   ' },
    });
    expect(response.statusCode).toBe(400);
  });

  it('PATCH con alias y avatar los guarda y GET los devuelve', async () => {
    const patched = await app.inject({
      method: 'PATCH', url: '/api/v1/profile/detective',
      headers: jsonHeadersFor(player), payload: { alias: '  Sabueso  ', avatar: 'forense' },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json()).toEqual({ alias: 'Sabueso', avatar: 'forense', displayName: 'Detective sintético' });
    const fetched = await app.inject({ method: 'GET', url: '/api/v1/profile/detective', headers: headersFor(player) });
    expect(fetched.json()).toEqual({ alias: 'Sabueso', avatar: 'forense', displayName: 'Detective sintético' });
  });

  it('PATCH solo con avatar crea la fila heredando el nombre de la cuenta como alias', async () => {
    const patched = await app.inject({
      method: 'PATCH', url: '/api/v1/profile/detective',
      headers: jsonHeadersFor(fresh), payload: { avatar: 'archivista' },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json()).toEqual({ alias: 'Detective sintético', avatar: 'archivista', displayName: 'Detective sintético' });
  });

  it('PATCH de otro jugador no toca la fila del primero', async () => {
    const patched = await app.inject({
      method: 'PATCH', url: '/api/v1/profile/detective',
      headers: jsonHeadersFor(other), payload: { alias: 'Otro', avatar: 'inspector' },
    });
    expect(patched.statusCode).toBe(200);
    const mine = await app.inject({ method: 'GET', url: '/api/v1/profile/detective', headers: headersFor(player) });
    expect(mine.json()).toEqual({ alias: 'Sabueso', avatar: 'forense', displayName: 'Detective sintético' });
  });
});
