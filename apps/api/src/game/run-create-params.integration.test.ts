import { randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.ts';
import { readAppConfig, readDatabaseUrl } from '../config.ts';
import { createDatabase } from '../database/connection.ts';
import { migrate } from '../database/migrations.ts';
import { tokenDigest } from '../auth/store.ts';
import { createTelemetry } from '../telemetry.ts';
import { Writable } from 'node:stream';

describe('Crear partida con delito y contenido (GDD §3/§14)', () => {
  const config = readAppConfig(process.env);
  const database = createDatabase(config.databaseUrl);
  const owner = createDatabase(readDatabaseUrl(process.env.DATABASE_MIGRATION_URL));
  const lines: string[] = [];
  const sink = new Writable({ write(chunk, _encoding, done) { lines.push(String(chunk)); done(); } });
  const app = createApp({ config, database, telemetry: createTelemetry(sink) });
  const player = { id: randomUUID(), token: randomBytes(32).toString('base64url'), csrf: randomBytes(32).toString('base64url') };
  const headers = { cookie: 'meridiano_session=' + player.token, origin: config.origin, 'x-csrf-token': player.csrf };
  const create = (payload: Record<string, unknown>) => app.inject({ method: 'POST', url: '/api/v1/runs', headers, payload });

  beforeAll(async () => {
    await migrate(readDatabaseUrl(process.env.DATABASE_MIGRATION_URL));
    await owner.pool.query('INSERT INTO profiles(id,local_key,display_name) VALUES ($1,$2,$3)', [player.id, 'create-params-synthetic-' + player.id, 'Detective sintético']);
    await owner.pool.query("INSERT INTO sessions(token_hash,profile_id,csrf_token,expires_at) VALUES ($1,$2,$3,now()+interval '8 hours')", [tokenDigest(player.token), player.id, player.csrf]);
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
    await owner.pool.query('DELETE FROM run_creations WHERE owner_id=$1', [player.id]);
    await owner.pool.query('DELETE FROM runs WHERE owner_id=$1', [player.id]);
    await owner.pool.query('DELETE FROM sessions WHERE profile_id=$1', [player.id]);
    await owner.pool.query('DELETE FROM profiles WHERE id=$1', [player.id]);
    await database.pool.end(); await owner.pool.end();
  });

  it('el catálogo expone delito y contenido del astrolabio', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/cases', headers });
    expect(response.statusCode).toBe(200);
    const item = response.json().items.find((entry: { caseId: string }) => entry.caseId === 'astrolabio-tres-ciudades');
    expect(item.crimeType).toBe('robo');
    expect(item.contentRating).toBe('familiar');
  });

  it('crear con delito y contenido correctos devuelve 201 con caseMeta', async () => {
    const response = await create({ caseId: 'astrolabio-tres-ciudades', idempotencyKey: randomUUID(), difficulty: 'normal', crimeType: 'robo', contentRating: 'familiar' });
    expect(response.statusCode).toBe(201);
    expect(response.json().caseMeta).toEqual({ crimeType: 'robo', contentRating: 'familiar' });
  });

  it('crear sin delito ni contenido sigue funcionando (se derivan del expediente)', async () => {
    const response = await create({ caseId: 'astrolabio-tres-ciudades', idempotencyKey: randomUUID() });
    expect(response.statusCode).toBe(201);
    expect(response.json().caseMeta).toEqual({ crimeType: 'robo', contentRating: 'familiar' });
  });

  it('delito que no corresponde al expediente es 400 VALIDATION_ERROR con mensaje honesto', async () => {
    const response = await create({ caseId: 'astrolabio-tres-ciudades', idempotencyKey: randomUUID(), crimeType: 'fraude', contentRating: 'familiar' });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
    expect(response.json().error.message).toBe('El delito elegido no corresponde al expediente elegido.');
  });

  it('contenido que no corresponde al expediente es 400 VALIDATION_ERROR', async () => {
    const response = await create({ caseId: 'astrolabio-tres-ciudades', idempotencyKey: randomUUID(), crimeType: 'robo', contentRating: 'general' });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
    expect(response.json().error.message).toBe('El contenido elegido no corresponde al expediente elegido.');
  });

  it('delito inválido y claves desconocidas son 400 INVALID_REQUEST', async () => {
    const invalid = await create({ caseId: 'astrolabio-tres-ciudades', idempotencyKey: randomUUID(), crimeType: 'inventado' });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json().error.code).toBe('INVALID_REQUEST');
    const unknown = await create({ caseId: 'astrolabio-tres-ciudades', idempotencyKey: randomUUID(), pista: 'x' });
    expect(unknown.statusCode).toBe(400);
    expect(unknown.json().error.code).toBe('INVALID_REQUEST');
  });
});
