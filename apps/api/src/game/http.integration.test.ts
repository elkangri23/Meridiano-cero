import { Writable } from 'node:stream';
import { createTelemetry } from '../telemetry.ts';
import { randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.ts';
import { readAppConfig, readDatabaseUrl } from '../config.ts';
import { createDatabase } from '../database/connection.ts';
import { migrate } from '../database/migrations.ts';
import { tokenDigest } from '../auth/store.ts';

describe('catálogo e inicio por HTTP con PostgreSQL real', () => {
  const config = readAppConfig(process.env);
  const database = createDatabase(config.databaseUrl);
  const owner = createDatabase(readDatabaseUrl(process.env.DATABASE_MIGRATION_URL));
  const lines: string[] = [];
  const sink = new Writable({ write(chunk, _encoding, done) { lines.push(String(chunk)); done(); } });
  const telemetry = createTelemetry(sink);
  const app = createApp({ config, database, telemetry });
  const players = [0, 1].map(() => ({ id: randomUUID(), token: randomBytes(32).toString('base64url'), csrf: randomBytes(32).toString('base64url') }));
  const player = players[0];
  const other = players[1];
  if (!player || !other) throw new Error('Missing synthetic players');
  const headers = { cookie: 'meridiano_session=' + player.token, origin: config.origin, 'x-csrf-token': player.csrf };
  const caseId = 'astrolabio-tres-ciudades';
  let runId = '';

  beforeAll(async () => {
    await migrate(readDatabaseUrl(process.env.DATABASE_MIGRATION_URL));
    for (const p of players) {
      await owner.pool.query('INSERT INTO profiles(id,local_key,display_name) VALUES ($1,$2,$3)', [p.id, 'http-synthetic-' + p.id, 'Detective sintético']);
      await owner.pool.query("INSERT INTO sessions(token_hash,profile_id,csrf_token,expires_at) VALUES ($1,$2,$3,now()+interval '8 hours')", [tokenDigest(p.token), p.id, p.csrf]);
    }
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
    for (const p of players) {
      await owner.pool.query('DELETE FROM run_creations WHERE owner_id=$1', [p.id]);
      await owner.pool.query('DELETE FROM runs WHERE owner_id=$1', [p.id]);
      await owner.pool.query('DELETE FROM sessions WHERE profile_id=$1', [p.id]);
      await owner.pool.query('DELETE FROM profiles WHERE id=$1', [p.id]);
    }
    await database.pool.end(); await owner.pool.end();
  });

  it('catálogo y partidas exigen sesión sin crear identidad', async () => {
    for (const url of ['/api/v1/cases', '/api/v1/cases/' + caseId, '/api/v1/runs/' + randomUUID()]) {
      expect((await app.inject(url)).statusCode).toBe(401);
    }
    expect((await app.inject({ method: 'POST', url: '/api/v1/runs', payload: { caseId, idempotencyKey: randomUUID() } })).statusCode).toBe(401);
  });

  it('lista y detalle contienen únicamente resumen, con límites estrictos', async () => {
    const response = await app.inject({ url: '/api/v1/cases?limit=1', headers });
    expect(response.statusCode).toBe(200);
    const summary = response.json().items[0];
    expect(summary.caseId).toBe(caseId);
    expect(summary.canStart).toBe(true);
    expect(response.json().nextCursor).toBeNull();
    expect((await app.inject({ url: '/api/v1/cases/' + caseId, headers })).json()).toEqual(summary);
    expect((await app.inject({ url: '/api/v1/cases/absent', headers })).statusCode).toBe(404);
    for (const query of ['limit=0', 'limit=101', 'limit=1.5', 'limit=1&limit=2', 'ownerId=someone', 'cursor=made-up']) {
      expect((await app.inject({ url: '/api/v1/cases?' + query, headers })).statusCode).toBe(400);
    }
    for (const marker of ['solution', 'seed', 'facts', 'npcs', 'ines-valera']) expect(response.body).not.toContain(marker);
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('Origin, CSRF, campos extra y tipos inválidos no crean partidas', async () => {
    const payload = { caseId, idempotencyKey: randomUUID() };
    expect((await app.inject({ method: 'POST', url: '/api/v1/runs', headers: { ...headers, origin: 'https://invalid.example' }, payload })).statusCode).toBe(403);
    expect((await app.inject({ method: 'POST', url: '/api/v1/runs', headers: { ...headers, 'x-csrf-token': 'wrong' }, payload })).statusCode).toBe(403);
    for (const body of [{ ...payload, ownerId: other.id }, { ...payload, expectedVersion: 1 }, { caseId, idempotencyKey: 123 }, [], null]) {
      expect((await app.inject({ method: 'POST', url: '/api/v1/runs', headers: { ...headers, 'content-type': 'application/octet-stream' }, payload: JSON.stringify(body) })).statusCode).toBe(415);
      expect((await app.inject({ method: 'POST', url: '/api/v1/runs', headers: { ...headers, 'content-type': 'application/json' }, payload: JSON.stringify(body) })).statusCode).toBe(400);
    }
    const rows = await owner.pool.query('SELECT count(*)::int AS n FROM runs WHERE owner_id=$1', [player.id]);
    expect(rows.rows[0].n).toBe(0);
  });

  it('BOR-002: límite multibyte por bytes y exceso de un byte no producen efectos', async () => {
    const base = { caseId, idempotencyKey: randomUUID(), padding: '' };
    const remaining = 65_536 - Buffer.byteLength(JSON.stringify(base));
    base.padding = 'é'.repeat(Math.floor(remaining / 2)) + (remaining % 2 ? 'a' : '');
    const payload = JSON.stringify(base);
    expect(Buffer.byteLength(payload)).toBe(65_536);
    const atLimit = await app.inject({ method: 'POST', url: '/api/v1/runs', headers: { ...headers, 'content-type': 'application/json' }, payload });
    expect(atLimit.statusCode).toBe(400); // llega al validador: padding no permitido.
    base.padding += 'a';
    const over = await app.inject({ method: 'POST', url: '/api/v1/runs', headers: { ...headers, 'content-type': 'application/json' }, payload: JSON.stringify(base) });
    expect(over.statusCode).toBe(413);
    const rows = await owner.pool.query('SELECT count(*)::int AS n FROM runs WHERE owner_id=$1', [player.id]);
    expect(rows.rows[0].n).toBe(0);
  });

  it('crea una vista inicial segura con ciudades guiadas y capacidades honestas', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/v1/runs', headers, payload: { caseId, idempotencyKey: randomUUID() } });
    expect(response.statusCode).toBe(201);
    const view = response.json();
    runId = view.runId;
    expect(view.schemaVersion).toBe(1);
    expect(view.version).toBe(1);
    expect(view.replayed).toBe(false);
    expect(view.branchId).toMatch(/^[a-f0-9-]{36}$/);
    expect(view.clock).toEqual({ minute: 0, deadlineMinutes: 2880 });
    expect(view.position.city.name).toBe('Madrid');
    expect(view.cities.map((city: { id: string }) => city.id)).toEqual(['madrid', 'paris', 'lisboa']);
    expect(view.locations).toHaveLength(1);
    expect(view.saveCapabilities).toEqual({ manualLimit: 10, manualCount: 0, canSave: false, canLoad: false });
    for (const marker of ['ines-valera', 'solution', 'definitionHash', 'ownerId', 'engineState', 'knowledge', 'cooperation']) expect(response.body).not.toContain(marker);
    expect(view.finalReport).toBeNull();
  });

  it('dos peticiones concurrentes con igual clave recuperan la misma partida', async () => {
    const payload = { caseId, idempotencyKey: randomUUID() };
    const results = await Promise.all([0, 1].map(() => app.inject({ method: 'POST', url: '/api/v1/runs', headers, payload })));
    expect(results.map(r => r.statusCode).sort()).toEqual([200, 201]);
    expect(new Set(results.map(r => r.json().runId)).size).toBe(1);
    const replay = await app.inject({ method: 'POST', url: '/api/v1/runs', headers, payload });
    expect(replay.statusCode).toBe(200);
    expect(replay.json().replayed).toBe(true);
  });

  it('otra instancia HTTP reanuda y otro usuario no accede', async () => {
    const expected = await app.inject({ url: '/api/v1/runs/' + runId, headers });
    expect(expected.statusCode).toBe(200);
    const secondDatabase = createDatabase(config.databaseUrl);
    const second = createApp({ config, database: secondDatabase });
    try {
      expect((await second.inject({ url: '/api/v1/runs/' + runId, headers })).json()).toEqual(expected.json());
    } finally { await second.close(); await secondDatabase.pool.end(); }
    for (const id of [runId, randomUUID(), 'invalid']) {
      const response = await app.inject({ url: '/api/v1/runs/' + id, headers: { cookie: 'meridiano_session=' + other.token } });
      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe('NOT_FOUND');
    }
  });

  it('inicios v1/v2/v3/v4/v5 siguen legibles sin reescritura; progreso v1 se conserva y falla cerrado', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/v1/runs', headers, payload: { caseId, idempotencyKey: randomUUID() } });
    expect(response.statusCode).toBe(201);
    const id = response.json().runId;
    const stored = await owner.pool.query<{ engine_state: Record<string, unknown>; engine_version: number }>('SELECT engine_state,engine_version FROM runs WHERE id=$1', [id]);
    const row = stored.rows[0];
    if (!row) throw new Error('Missing synthetic run');
    expect(row.engine_version).toBe(6);
    expect(row.engine_state.eventOrdinal).toBe(0);
    for (const version of [2, 3, 4, 5]) {
      const previous = { ...row.engine_state, engineVersion: version };
      await owner.pool.query('UPDATE runs SET engine_version=$1,engine_state=$2::jsonb WHERE id=$3', [version, JSON.stringify(previous), id]);
      expect((await app.inject({ url: '/api/v1/runs/' + id, headers })).statusCode).toBe(200);
      const preserved = await owner.pool.query('SELECT engine_version,engine_state FROM runs WHERE id=$1', [id]);
      expect(preserved.rows[0]).toEqual({ engine_version: version, engine_state: previous });
      const progressedPrevious = { ...previous, minute: 1 };
      await owner.pool.query('UPDATE runs SET engine_state=$1::jsonb WHERE id=$2', [JSON.stringify(progressedPrevious), id]);
      expect((await app.inject({ url: '/api/v1/runs/' + id, headers })).statusCode).toBe(503);
      const untouched = await owner.pool.query('SELECT engine_state FROM runs WHERE id=$1', [id]);
      expect(untouched.rows[0].engine_state).toEqual(progressedPrevious);
    }
    const legacy: Record<string, unknown> = { ...row.engine_state, engineVersion: 1 };
    delete legacy.eventOrdinal;
    await owner.pool.query('UPDATE runs SET engine_version=1,engine_state=$1::jsonb WHERE id=$2', [JSON.stringify(legacy), id]);
    expect((await app.inject({ url: '/api/v1/runs/' + id, headers })).statusCode).toBe(200);
    const after = await owner.pool.query('SELECT engine_version,engine_state FROM runs WHERE id=$1', [id]);
    expect(after.rows[0]).toEqual({ engine_version: 1, engine_state: legacy });
    const progressed = { ...legacy, minute: 1 };
    await owner.pool.query('UPDATE runs SET engine_state=$1::jsonb WHERE id=$2', [JSON.stringify(progressed), id]);
    expect((await app.inject({ url: '/api/v1/runs/' + id, headers })).statusCode).toBe(503);
    const preserved = await owner.pool.query('SELECT engine_state FROM runs WHERE id=$1', [id]);
    expect(preserved.rows[0].engine_state).toEqual(progressed);
  });

  it('estado no proyectable falla sin revelar datos ni reconstruir un progreso ficticio', async () => {
    await owner.pool.query("UPDATE runs SET engine_state=jsonb_set(engine_state,'{privateMarker}',to_jsonb($1::text)) WHERE id=$2", ['SYNTHETIC_PRIVATE_MARKER', runId]);
    const response = await app.inject({ url: '/api/v1/runs/' + runId, headers });
    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe('DEPENDENCY_UNAVAILABLE');
    expect(response.body).not.toContain('SYNTHETIC_PRIVATE_MARKER');
  });

  it('BOR-005: revocar mientras la creación espera impide la escritura con autoridad antigua', async () => {
    const holder = await owner.pool.connect();
    const intent = randomUUID();
    let pending: Promise<{ statusCode: number }> | undefined;
    try {
      await holder.query('BEGIN');
      await holder.query('SELECT token_hash FROM sessions WHERE token_hash=$1 FOR UPDATE', [tokenDigest(other.token)]);
      pending = app.inject({ method: 'POST', url: '/api/v1/runs',
        headers: { cookie: 'meridiano_session=' + other.token, origin: config.origin, 'x-csrf-token': other.csrf },
        payload: { caseId, idempotencyKey: intent } }).then(response => response);
      // Barrera real: el SELECT FOR SHARE de la mutación está esperando el lock.
      await vi.waitFor(async () => {
        const blocked = await owner.pool.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE 'SELECT profile_id FROM sessions%'");
        expect(blocked.rows[0].n).toBeGreaterThan(0);
      }, { timeout: 1200, interval: 20 });
      await holder.query('UPDATE sessions SET revoked_at=now() WHERE token_hash=$1', [tokenDigest(other.token)]);
      await holder.query('COMMIT');
      expect((await pending).statusCode).toBe(401);
      const effects = await owner.pool.query('SELECT count(*)::int AS n FROM run_creations WHERE owner_id=$1 AND idempotency_key=$2', [other.id, intent]);
      expect(effects.rows[0].n).toBe(0);
    } finally {
      await holder.query('ROLLBACK'); holder.release();
      if (pending) await pending;
    }
  });

  it('BOR-081/082 parciales: logs HTTP excluyen datos privados y un sink caído no bloquea lecturas', async () => {
    const logs = lines.join('');
    for (const p of players) {
      expect(logs).not.toContain(p.token);
      expect(logs).not.toContain(p.csrf);
      expect(logs).not.toContain(p.id);
    }
    for (const marker of [runId, 'SYNTHETIC_PRIVATE_MARKER', '/api/v1/', 'SELECT ', 'engineState']) expect(logs).not.toContain(marker);
    expect(lines.length).toBeGreaterThan(0);
    sink.emit('error', new Error('SYNTHETIC_SINK_PRIVATE'));
    expect((await app.inject({ url: '/api/v1/cases', headers })).statusCode).toBe(200);
    expect(telemetry.snapshot().exporterFailures).toBe(1);
    expect(telemetry.snapshot().dropped).toBeGreaterThan(0);
    expect(lines.join('')).not.toContain('SYNTHETIC_SINK_PRIVATE');
  });

  it('la revocación bloquea el catálogo y las partidas', async () => {
    await owner.pool.query('UPDATE sessions SET revoked_at=now() WHERE token_hash=$1', [tokenDigest(player.token)]);
    expect((await app.inject({ url: '/api/v1/cases', headers })).statusCode).toBe(401);
    expect((await app.inject({ url: '/api/v1/runs/' + runId, headers })).statusCode).toBe(401);
  });
});
