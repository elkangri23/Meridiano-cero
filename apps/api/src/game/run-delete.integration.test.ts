// Borrado de partidas y dificultad al crear (2026-11-05): el usuario no
// podía borrar sus partidas (no existía DELETE) y la creación por UI podía
// quedarse atascada en «pendiente de confirmar». Aquí se verifica el lado
// servidor: crear con dificultad ajusta el plazo persistido, y borrar solo
// lo puede hacer el propietario, eliminando guardados y registro.
import { randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.ts';
import { readAppConfig, readDatabaseUrl } from '../config.ts';
import { createDatabase } from '../database/connection.ts';
import { migrate } from '../database/migrations.ts';
import { tokenDigest } from '../auth/store.ts';

describe('borrado de partidas y dificultad al crear (PostgreSQL/HTTP)', () => {
  const config = readAppConfig(process.env);
  const database = createDatabase(config.databaseUrl);
  const owner = createDatabase(readDatabaseUrl(process.env.DATABASE_MIGRATION_URL));
  const app = createApp({ config, database });
  const players = [0, 1].map(() => ({ id: randomUUID(), token: randomBytes(32).toString('base64url'), csrf: randomBytes(32).toString('base64url') }));
  const player = players[0];
  const other = players[1];
  if (!player || !other) throw new Error('Missing synthetic players');
  const headers = { cookie: 'meridiano_session=' + player.token, origin: config.origin, 'x-csrf-token': player.csrf };
  const otherHeaders = { cookie: 'meridiano_session=' + other.token, origin: config.origin, 'x-csrf-token': other.csrf };
  const caseId = 'astrolabio-tres-ciudades';

  beforeAll(async () => {
    await migrate(readDatabaseUrl(process.env.DATABASE_MIGRATION_URL));
    for (const p of players) {
      await owner.pool.query('INSERT INTO profiles(id,local_key,display_name) VALUES ($1,$2,$3)', [p.id, 'delete-synthetic-' + p.id, 'Detective sintético']);
      await owner.pool.query("INSERT INTO sessions(token_hash,profile_id,csrf_token,expires_at) VALUES ($1,$2,$3,now()+interval '8 hours')", [tokenDigest(p.token), p.id, p.csrf]);
    }
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
    for (const p of players) {
      await owner.pool.query('DELETE FROM operation_records WHERE owner_id=$1', [p.id]);
      await owner.pool.query('DELETE FROM manual_saves WHERE owner_id=$1', [p.id]);
      await owner.pool.query('DELETE FROM run_creations WHERE owner_id=$1', [p.id]);
      await owner.pool.query('DELETE FROM runs WHERE owner_id=$1', [p.id]);
      await owner.pool.query('DELETE FROM sessions WHERE profile_id=$1', [p.id]);
      await owner.pool.query('DELETE FROM profiles WHERE id=$1', [p.id]);
    }
    await database.pool.end(); await owner.pool.end();
  });

  async function createRun(difficulty?: string) {
    const payload: Record<string, unknown> = { caseId, idempotencyKey: randomUUID() };
    if (difficulty !== undefined) payload.difficulty = difficulty;
    return app.inject({ method: 'POST', url: '/api/v1/runs', headers, payload });
  }

  it('crear con dificultad ajusta el plazo persistido y lo muestra en la vista', async () => {
    const easy = await createRun('easy');
    expect(easy.statusCode).toBe(201);
    expect(easy.json().clock).toEqual({ minute: 0, deadlineMinutes: 5760 });
    expect(easy.json().briefing).toMatchObject({ speaker: 'Margaret Sullivan', title: 'El astrolabio de las tres ciudades' });
    expect(easy.json().briefing.paragraphs).toHaveLength(3);
    const hard = await createRun('hard');
    expect(hard.statusCode).toBe(201);
    expect(hard.json().clock).toEqual({ minute: 0, deadlineMinutes: 1440 });
    // El plazo persiste al recargar: no es solo el de la respuesta de creación.
    const reloaded = await app.inject({ url: '/api/v1/runs/' + hard.json().runId, headers });
    expect(reloaded.statusCode).toBe(200);
    expect(reloaded.json().clock.deadlineMinutes).toBe(1440);
    // La lista muestra la dificultad de cada partida.
    const list = await app.inject({ url: '/api/v1/runs?limit=25', headers });
    const byId = new Map(list.json().items.map((item: { runId: string }) => [item.runId, item]));
    expect((byId.get(easy.json().runId) as { difficulty: string }).difficulty).toBe('easy');
    expect((byId.get(hard.json().runId) as { difficulty: string }).difficulty).toBe('hard');
    // Una partida cerrada no bloquea crear otra (el fallo reportado).
    const closed = await app.inject({ method: 'POST', url: '/api/v1/runs/' + easy.json().runId + '/action', headers,
      payload: { action: { type: 'finish', params: {} }, confirm: true, expectedVersion: 1, idempotencyKey: randomUUID() } });
    expect(closed.statusCode).toBe(200);
    expect(closed.json().status).toBe('closed');
    const afterClosed = await createRun('normal');
    expect(afterClosed.statusCode).toBe(201);
    expect(afterClosed.json().clock).toEqual({ minute: 0, deadlineMinutes: 2880 });
  });

  it('dificultad inválida y claves extra no crean partidas', async () => {
    for (const payload of [
      { caseId, idempotencyKey: randomUUID(), difficulty: 'extrema' },
      { caseId, idempotencyKey: randomUUID(), difficulty: 1 },
      { caseId, idempotencyKey: randomUUID(), difficulty: 'normal', theme: 'robo' },
    ]) {
      expect((await app.inject({ method: 'POST', url: '/api/v1/runs', headers, payload })).statusCode).toBe(400);
    }
    const rows = await owner.pool.query('SELECT count(*)::int AS n FROM runs WHERE owner_id=$1', [player.id]);
    expect(rows.rows[0].n).toBe(3);
  });

  it('reintentar la misma clave con otra dificultad es conflicto, no replay', async () => {
    const key = randomUUID();
    const first = await app.inject({ method: 'POST', url: '/api/v1/runs', headers, payload: { caseId, idempotencyKey: key, difficulty: 'easy' } });
    expect(first.statusCode).toBe(201);
    const replay = await app.inject({ method: 'POST', url: '/api/v1/runs', headers, payload: { caseId, idempotencyKey: key, difficulty: 'easy' } });
    expect(replay.statusCode).toBe(200);
    expect(replay.json().runId).toBe(first.json().runId);
    const conflict = await app.inject({ method: 'POST', url: '/api/v1/runs', headers, payload: { caseId, idempotencyKey: key, difficulty: 'hard' } });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json().error.code).toBe('IDEMPOTENCY_CONFLICT');
  });

  it('borrar una partida propia la elimina con guardados y registro; ajena es 404', async () => {
    const created = await createRun('normal');
    expect(created.statusCode).toBe(201);
    const runId = created.json().runId as string;
    // Un guardado manual para comprobar el borrado ordenado.
    const saved = await app.inject({ method: 'POST', url: `/api/v1/runs/${runId}/saves`, headers,
      payload: { name: 'Punto de prueba', expectedVersion: 1, idempotencyKey: randomUUID() } });
    expect(saved.statusCode).toBe(201);
    // Sin confirmación explícita no se borra.
    expect((await app.inject({ method: 'DELETE', url: '/api/v1/runs/' + runId, headers, payload: { confirm: false } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'DELETE', url: '/api/v1/runs/' + runId, headers, payload: {} })).statusCode).toBe(400);
    // Otro usuario no puede borrarla ni distinguir su existencia.
    expect((await app.inject({ method: 'DELETE', url: '/api/v1/runs/' + runId, headers: otherHeaders, payload: { confirm: true } })).statusCode).toBe(404);
    expect((await app.inject({ url: '/api/v1/runs/' + runId, headers: otherHeaders })).statusCode).toBe(404);
    // El propietario la borra: 204, y desaparece de la lista y del detalle.
    expect((await app.inject({ method: 'DELETE', url: '/api/v1/runs/' + runId, headers, payload: { confirm: true } })).statusCode).toBe(204);
    expect((await app.inject({ url: '/api/v1/runs/' + runId, headers })).statusCode).toBe(404);
    const list = await app.inject({ url: '/api/v1/runs?limit=25', headers });
    expect(list.json().items.some((item: { runId: string }) => item.runId === runId)).toBe(false);
    // Borrado ordenado: no quedan filas hijas ni de creación.
    for (const [table, column] of [['operation_records', 'run_id'], ['manual_saves', 'run_id'], ['run_creations', 'run_id'], ['runs', 'id']] as const) {
      const rows = await owner.pool.query(`SELECT count(*)::int AS n FROM ${table} WHERE ${column}=$1`, [runId]);
      expect(rows.rows[0].n).toBe(0);
    }
    // Borrar de nuevo es 404; un id mal formado también.
    expect((await app.inject({ method: 'DELETE', url: '/api/v1/runs/' + runId, headers, payload: { confirm: true } })).statusCode).toBe(404);
    expect((await app.inject({ method: 'DELETE', url: '/api/v1/runs/not-a-uuid', headers, payload: { confirm: true } })).statusCode).toBe(404);
  });
});
