import { randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.ts';
import { readAppConfig, readDatabaseUrl } from '../config.ts';
import { createDatabase } from '../database/connection.ts';
import { migrate } from '../database/migrations.ts';
import { tokenDigest } from '../auth/store.ts';
import { createStoredRun } from './runs.ts';
import { astrolabioDefinition } from '@meridiano/engine';
import type { RunListDto } from '@meridiano/contracts';

describe('T3-02: lista paginada propia PostgreSQL/HTTP', () => {
  const config = readAppConfig(process.env);
  const database = createDatabase(config.databaseUrl);
  const owner = createDatabase(readDatabaseUrl(process.env.DATABASE_MIGRATION_URL));
  const app = createApp({ config, database });
  const actors = Array.from({ length: 4 }, () => ({ id: randomUUID(), token: randomBytes(32).toString('base64url'), csrf: randomBytes(32).toString('base64url') }));
  const [player, other, empty, revoked] = actors;
  if (!player || !other || !empty || !revoked) throw new Error('Missing actors');
  const ids: string[] = [];
  let otherRun = '';
  const headers = (actor: typeof player) => ({ cookie: 'meridiano_session=' + actor.token });
  const list = (actor: typeof player, query = '') => app.inject({ url: '/api/v1/runs' + query, headers: headers(actor) });
  const create = (actor: typeof player) => createStoredRun(database, tokenDigest(actor.token), astrolabioDefinition, randomUUID());

  beforeAll(async () => {
    await migrate(readDatabaseUrl(process.env.DATABASE_MIGRATION_URL));
    for (const actor of actors) {
      await owner.pool.query('INSERT INTO profiles(id,local_key,display_name) VALUES ($1,$2,$3)', [actor.id, 'list-synthetic-' + actor.id, 'Detective sintético']);
      await owner.pool.query("INSERT INTO sessions(token_hash,profile_id,csrf_token,expires_at) VALUES ($1,$2,$3,now()+interval '8 hours')", [tokenDigest(actor.token), actor.id, actor.csrf]);
    }
    for (let index = 0; index < 6; index++) {
      const created = await create(player); ids.push(created.run.id);
      const date = '2026-01-01T00:00:00.' + String(index + 1).padStart(6, '0') + 'Z';
      await owner.pool.query('UPDATE runs SET created_at=$1::timestamptz WHERE id=$2', [date, created.run.id]);
    }
    // Estados controlados de metadata, no aceptación de cierre o progreso del juego.
    for (const index of [1, 4]) await owner.pool.query("UPDATE runs SET engine_state=jsonb_set(engine_state,'{status}','\"closed\"') WHERE id=$1", [ids[index]]);
    await owner.pool.query("UPDATE runs SET engine_version=999,revision=2,engine_state=engine_state || '{\"privateMarker\":\"SYNTHETIC_LIST_PRIVATE\"}'::jsonb WHERE id=$1", [ids[5]]);
    otherRun = (await create(other)).run.id;
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

  it('exige sesión y devuelve solo metadata propia con no-store', async () => {
    expect((await app.inject('/api/v1/runs')).statusCode).toBe(401);
    const response = await list(player);
    expect(response.statusCode).toBe(200); expect(response.headers['cache-control']).toBe('no-store');
    const body = response.json<RunListDto>();
    expect(body.profileId).toBe(player.id);
    expect(body.items.every(item => item.caseTitle === 'El astrolabio de las tres ciudades')).toBe(true);
    expect(body.items.map(item => item.runId)).toEqual([...ids].reverse()); expect(body.nextCursor).toBeNull();
    for (const item of body.items) expect(Object.keys(item).sort()).toEqual(['caseId', 'caseTitle', 'createdAt', 'runId', 'status', 'version']);
    for (const marker of [otherRun, 'SYNTHETIC_LIST_PRIVATE', 'definitionHash', 'engineState', 'finalReport', 'ines-valera']) expect(response.body).not.toContain(marker);
    expect(body.items.every(item => item.createdAt === '2026-01-01T00:00:00.000Z')).toBe(true);
  });
  it('keyset conserva microsegundos aunque el DTO muestre la misma fecha', async () => {
    const collected: string[] = []; let cursor: string | null = null;
    for (let page = 0; page < 3; page++) {
      const response = await list(player, '?limit=2' + (cursor ? '&cursor=' + cursor : ''));
      expect(response.statusCode).toBe(200);
      const body = response.json<RunListDto>(); collected.push(...body.items.map(item => item.runId)); cursor = body.nextCursor;
    }
    expect(collected).toEqual([...ids].reverse()); expect(new Set(collected).size).toBe(6); expect(cursor).toBeNull();
  });
  it('filtra active/closed y devuelve lista vacía sin cursor ficticio', async () => {
    const active = (await list(player, '?status=active')).json<RunListDto>();
    const closed = (await list(player, '?status=closed')).json<RunListDto>();
    expect(active.items.map(item => item.runId)).toEqual([ids[5], ids[3], ids[2], ids[0]]);
    expect(closed.items.map(item => item.runId)).toEqual([ids[4], ids[1]]);
    expect((await list(empty)).json()).toEqual({ profileId: empty.id, items: [], nextCursor: null });
  });
  it('cursor no concede acceso a otra cuenta ni ámbito y permite cambiar límite dentro del filtro', async () => {
    const first = (await list(player, '?status=active&limit=1')).json<RunListDto>();
    if (!first.nextCursor) throw new Error('Missing cursor');
    expect((await list(player, '?status=active&limit=3&cursor=' + first.nextCursor)).json<RunListDto>().items.map(item => item.runId)).toEqual([ids[3], ids[2], ids[0]]);
    const foreign = await list(other, '?status=active&cursor=' + first.nextCursor);
    const missing = await list(other, '?status=active&cursor=v1.active.' + randomUUID());
    expect(foreign.statusCode).toBe(400); expect(missing.statusCode).toBe(400);
    expect(foreign.json().error.code).toBe(missing.json().error.code);
    expect((await list(player, '?cursor=' + first.nextCursor)).statusCode).toBe(400);
    expect((await list(player, '?status=closed&cursor=' + first.nextCursor)).statusCode).toBe(400);
    expect((await list(other)).json<RunListDto>().items.map(item => item.runId)).toEqual([otherRun]);
  });
  it('rechaza campos extra, límites inválidos, duplicados y cursor como entrada no confiable', async () => {
    for (const query of ['?limit=0', '?limit=101', '?limit=-1', '?limit=01', '?limit=1.5', '?limit=1&limit=2', '?ownerId=someone', '?status=unknown', '?status=active&status=closed', '?cursor=bad', '?cursor=', '?cursor=bad&cursor=bad', '?cursor=v1.all.%27%20OR%201=1']) {
      expect((await list(player, query)).statusCode).toBe(400);
    }
    expect((await list(player, '?limit=100')).statusCode).toBe(200);
  });
  it('listar no escribe ni afirma compatibilidad del progreso no proyectable', async () => {
    const before = await owner.pool.query('SELECT * FROM runs WHERE owner_id=$1 ORDER BY id', [player.id]);
    const response = await list(player);
    expect(response.statusCode).toBe(200); expect(response.json<RunListDto>().items[0]?.version).toBe(2);
    expect((await app.inject({ url: '/api/v1/runs/' + ids[5], headers: headers(player) })).statusCode).toBe(503);
    expect((await owner.pool.query('SELECT * FROM runs WHERE owner_id=$1 ORDER BY id', [player.id])).rows).toEqual(before.rows);
  });
  it('insertar partida más reciente no la inyecta al continuar hacia atrás', async () => {
    const first = (await list(player, '?limit=2')).json<RunListDto>();
    const inserted = (await create(player)).run.id;
    try {
      const rest = await list(player, '?limit=100&cursor=' + first.nextCursor);
      expect(rest.statusCode).toBe(200);
      const remaining = rest.json<RunListDto>().items.map(item => item.runId);
      expect([...first.items.map(item => item.runId), ...remaining]).toEqual([...ids].reverse());
      expect(remaining).not.toContain(inserted);
    } finally {
      await owner.pool.query('DELETE FROM run_creations WHERE run_id=$1', [inserted]);
      await owner.pool.query('DELETE FROM runs WHERE id=$1', [inserted]);
    }
  });
  it('estado no soportado falla cerrado sin reflejar contenido privado', async () => {
    const before = (await owner.pool.query('SELECT engine_state FROM runs WHERE id=$1', [otherRun])).rows[0].engine_state;
    try {
      await owner.pool.query("UPDATE runs SET engine_state=jsonb_set(engine_state,'{status}','\"SYNTHETIC_BAD_STATUS\"') WHERE id=$1", [otherRun]);
      const response = await list(other);
      expect(response.statusCode).toBe(503); expect(response.body).not.toContain('SYNTHETIC_BAD_STATUS');
    } finally { await owner.pool.query('UPDATE runs SET engine_state=$1::jsonb WHERE id=$2', [JSON.stringify(before), otherRun]); }
  });
  it('caso sin ficha pública devuelve título null sin inventarlo desde estado privado', async () => {
    try {
      await owner.pool.query('UPDATE runs SET definition_id=$1 WHERE id=$2', ['synthetic-unknown-case', otherRun]);
      const response = await list(other);
      expect(response.statusCode).toBe(200);
      expect(response.json<RunListDto>()).toMatchObject({ profileId: other.id, items: [{ caseTitle: null, caseId: 'synthetic-unknown-case' }] });
    } finally { await owner.pool.query('UPDATE runs SET definition_id=$1 WHERE id=$2', [astrolabioDefinition.id, otherRun]); }
  });
  it('revocación posterior al control HTTP se revalida antes de leer filas', async () => {
    const holder = await owner.pool.connect(); let pending: Promise<{ statusCode: number }> | undefined;
    try {
      const pid = (await holder.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0]?.pid;
      if (!pid) throw new Error('Missing barrier');
      await holder.query('BEGIN');
      await holder.query('SELECT token_hash FROM sessions WHERE token_hash=$1 FOR UPDATE', [tokenDigest(revoked.token)]);
      pending = list(revoked).then(response => response);
      await vi.waitFor(async () => {
        const blocked = await owner.pool.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND $1=ANY(pg_blocking_pids(pid)) AND query LIKE 'SELECT profile_id FROM sessions%'", [pid]);
        expect(blocked.rows[0].n).toBeGreaterThan(0);
      }, { timeout: 1200, interval: 20 });
      await holder.query('UPDATE sessions SET revoked_at=now() WHERE token_hash=$1', [tokenDigest(revoked.token)]);
      await holder.query('COMMIT'); expect((await pending).statusCode).toBe(401);
    } finally { await holder.query('ROLLBACK'); holder.release(); if (pending) await pending; }
  });
});
