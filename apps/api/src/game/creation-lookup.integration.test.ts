import { Writable } from 'node:stream';
import { randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.ts';
import { readAppConfig, readDatabaseUrl } from '../config.ts';
import { createDatabase } from '../database/connection.ts';
import { migrate } from '../database/migrations.ts';
import { tokenDigest } from '../auth/store.ts';
import { createTelemetry } from '../telemetry.ts';

describe('T3-06: localizar creación propia sin respuesta original', () => {
  const config = readAppConfig(process.env);
  const database = createDatabase(config.databaseUrl);
  const owner = createDatabase(readDatabaseUrl(process.env.DATABASE_MIGRATION_URL));
  const lines: string[] = [];
  const sink = new Writable({ write(chunk, _encoding, done) { lines.push(String(chunk)); done(); } });
  const app = createApp({ config, database, telemetry: createTelemetry(sink) });
  const actors = Array.from({ length: 4 }, () => ({ id: randomUUID(), token: randomBytes(32).toString('base64url'), csrf: randomBytes(32).toString('base64url') }));
  const [player, other, racer, expired] = actors;
  if (!player || !other || !racer || !expired) throw new Error('Missing synthetic actors');
  type Actor = typeof actors[number];
  const keys: string[] = [];
  const intent = () => { const key = randomUUID(); keys.push(key); return key; };
  const headers = (actor: Actor) => ({ cookie: 'meridiano_session=' + actor.token, origin: config.origin, 'x-csrf-token': actor.csrf });
  const url = '/api/v1/run-creations/lookup';
  const lookup = (actor: Actor, key: string) => app.inject({ method: 'POST', url, headers: headers(actor), payload: { idempotencyKey: key } });
  const create = (actor: Actor, key: string) => app.inject({ method: 'POST', url: '/api/v1/runs', headers: headers(actor), payload: { caseId: 'astrolabio-tres-ciudades', idempotencyKey: key } });

  beforeAll(async () => {
    await migrate(readDatabaseUrl(process.env.DATABASE_MIGRATION_URL));
    for (const actor of actors) {
      await owner.pool.query('INSERT INTO profiles(id,local_key,display_name) VALUES ($1,$2,$3)', [actor.id, 'lookup-synthetic-' + actor.id, 'Detective sintético']);
      await owner.pool.query("INSERT INTO sessions(token_hash,profile_id,csrf_token,expires_at) VALUES ($1,$2,$3,now()+interval '8 hours')", [tokenDigest(actor.token), actor.id, actor.csrf]);
    }
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
    for (const actor of actors) {
      await owner.pool.query('DELETE FROM run_creations WHERE owner_id=$1', [actor.id]);
      await owner.pool.query('DELETE FROM runs WHERE owner_id=$1', [actor.id]);
      await owner.pool.query('DELETE FROM sessions WHERE profile_id=$1', [actor.id]);
      await owner.pool.query('DELETE FROM profiles WHERE id=$1', [actor.id]);
    }
    await database.pool.end(); await owner.pool.end();
  });

  it('recupera solo con la clave y otra instancia, sin repetir creación ni devolver estado', async () => {
    const key = intent();
    const created = await create(player, key);
    expect(created.statusCode).toBe(201);
    expect(created.json().recovery).toEqual({ retryCreationWithSameKey: true, creationLookup: true, operationLookup: false });
    const expected = { schemaVersion: 1, kind: 'create_run', status: 'committed', runId: created.json().runId };
    expect((await lookup(player, key)).json()).toEqual(expected);
    const secondDatabase = createDatabase(config.databaseUrl);
    const second = createApp({ config, database: secondDatabase });
    try {
      const response = await second.inject({ method: 'POST', url, headers: headers(player), payload: { idempotencyKey: key } });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(expected);
    } finally { await second.close(); await secondDatabase.pool.end(); }
    expect((await lookup(player, key)).json()).toEqual(expected);
    const rows = await owner.pool.query('SELECT count(*)::int AS n FROM run_creations WHERE owner_id=$1 AND idempotency_key=$2', [player.id, key]);
    expect(rows.rows[0].n).toBe(1);
  });
  it('clave ajena e inexistente son indistinguibles; la misma clave en otra cuenta resuelve solo lo propio', async () => {
    const key = intent(); const a = await create(player, key);
    const borrowed = await lookup(other, key);
    const absent = await lookup(other, intent());
    expect(borrowed.statusCode).toBe(404); expect(absent.statusCode).toBe(404);
    expect(borrowed.json().error.code).toBe('NOT_FOUND');
    expect(borrowed.json().error.message).toBe(absent.json().error.message);
    const b = await create(other, key);
    expect(b.statusCode).toBe(201);
    expect(a.json().runId).not.toBe(b.json().runId);
    expect((await lookup(player, key)).json().runId).toBe(a.json().runId);
    expect((await lookup(other, key)).json().runId).toBe(b.json().runId);
  });
  it('consulta metadata aun con estado no proyectable y no escribe ni filtra contenido privado', async () => {
    const key = intent(); const created = await create(player, key); const id = created.json().runId;
    await owner.pool.query('UPDATE runs SET engine_version=999,revision=2,engine_state=$1::jsonb WHERE id=$2', [JSON.stringify({ privateMarker: 'SYNTHETIC_PRIVATE_MARKER' }), id]);
    const before = await owner.pool.query('SELECT * FROM runs WHERE id=$1', [id]);
    const response = await lookup(player, key);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ schemaVersion: 1, kind: 'create_run', status: 'committed', runId: id });
    for (const marker of ['SYNTHETIC_PRIVATE_MARKER', 'engine', 'branchId', 'definition', 'idempotencyKey', '999']) expect(response.body).not.toContain(marker);
    expect((await app.inject({ url: '/api/v1/runs/' + id, headers: headers(player) })).statusCode).toBe(503);
    expect((await owner.pool.query('SELECT * FROM runs WHERE id=$1', [id])).rows).toEqual(before.rows);
  });
  it('sesión, Origin, CSRF y cuerpo cerrado se exigen aunque sea una consulta', async () => {
    const payload = { idempotencyKey: intent() };
    expect((await app.inject({ method: 'POST', url, payload })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url, headers: { ...headers(player), origin: 'https://invalid.example' }, payload })).statusCode).toBe(403);
    expect((await app.inject({ method: 'POST', url, headers: { ...headers(player), 'x-csrf-token': 'wrong' }, payload })).statusCode).toBe(403);
    const before = await owner.pool.query('SELECT count(*)::int AS n FROM runs WHERE owner_id=$1', [player.id]);
    for (const body of [null, [], {}, { idempotencyKey: 1 }, { idempotencyKey: 'short' }, { idempotencyKey: 'a'.repeat(129) },
      { ...payload, ownerId: other.id }, { ...payload, caseId: 'extra' }]) {
      const response = await app.inject({ method: 'POST', url, headers: { ...headers(player), 'content-type': 'application/json' }, payload: JSON.stringify(body) });
      expect(response.statusCode).toBe(400);
    }
    expect((await app.inject({ method: 'POST', url: url + '?extra=1', headers: headers(player), payload })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url, headers: { ...headers(player), 'content-type': 'application/octet-stream' }, payload: JSON.stringify(payload) })).statusCode).toBe(415);
    expect((await owner.pool.query('SELECT count(*)::int AS n FROM runs WHERE owner_id=$1', [player.id])).rows).toEqual(before.rows);
  });
  it('un 404 con creación en vuelo es provisional; tras commit se encuentra la misma intención', async () => {
    const key = intent(); const holder = await owner.pool.connect();
    let pending: Promise<{ statusCode: number }> | undefined;
    try {
      const pid = (await holder.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0]?.pid;
      if (!pid) throw new Error('Missing barrier pid');
      await holder.query('BEGIN');
      await holder.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [JSON.stringify([player.id, key])]);
      pending = create(player, key).then(response => response);
      await vi.waitFor(async () => {
        const blocked = await owner.pool.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND $1=ANY(pg_blocking_pids(pid)) AND query LIKE 'SELECT pg_advisory_xact_lock(hashtextextended%'", [pid]);
        expect(blocked.rows[0].n).toBeGreaterThan(0);
      }, { timeout: 1200, interval: 20 });
      expect((await lookup(player, key)).statusCode).toBe(404);
      await holder.query('COMMIT');
      expect((await pending).statusCode).toBe(201);
      const found = await lookup(player, key);
      expect(found.statusCode).toBe(200);
      const row = await owner.pool.query('SELECT run_id FROM run_creations WHERE owner_id=$1 AND idempotency_key=$2', [player.id, key]);
      expect(found.json().runId).toBe(row.rows[0].run_id);
    } finally { await holder.query('ROLLBACK'); holder.release(); if (pending) await pending; }
  });
  it('revocación posterior al primer control impide resolver la clave con autoridad antigua', async () => {
    const key = intent(); expect((await create(racer, key)).statusCode).toBe(201);
    const holder = await owner.pool.connect(); let pending: Promise<{ statusCode: number }> | undefined;
    try {
      const pid = (await holder.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0]?.pid;
      if (!pid) throw new Error('Missing barrier pid');
      await holder.query('BEGIN');
      await holder.query('SELECT token_hash FROM sessions WHERE token_hash=$1 FOR UPDATE', [tokenDigest(racer.token)]);
      pending = lookup(racer, key).then(response => response);
      await vi.waitFor(async () => {
        const blocked = await owner.pool.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND $1=ANY(pg_blocking_pids(pid)) AND query LIKE 'SELECT profile_id FROM sessions%'", [pid]);
        expect(blocked.rows[0].n).toBeGreaterThan(0);
      }, { timeout: 1200, interval: 20 });
      await holder.query('UPDATE sessions SET revoked_at=now() WHERE token_hash=$1', [tokenDigest(racer.token)]);
      await holder.query('COMMIT');
      expect((await pending).statusCode).toBe(401);
    } finally { await holder.query('ROLLBACK'); holder.release(); if (pending) await pending; }
  });
  it('sesión caducada no recupera creaciones propias y las claves no aparecen en telemetría', async () => {
    const key = intent(); expect((await create(expired, key)).statusCode).toBe(201);
    await owner.pool.query("UPDATE sessions SET created_at=now()-interval '2 hours',expires_at=now()-interval '1 second' WHERE token_hash=$1", [tokenDigest(expired.token)]);
    expect((await lookup(expired, key)).statusCode).toBe(401);
    const logs = lines.join('');
    for (const value of [...keys, ...actors.flatMap(actor => [actor.id, actor.token, actor.csrf]), 'SYNTHETIC_PRIVATE_MARKER', '/run-creations/lookup']) expect(logs).not.toContain(value);
    expect(lines.length).toBeGreaterThan(0);
  });
});
