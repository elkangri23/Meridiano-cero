import { randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.ts';
import { readAppConfig, readDatabaseUrl } from '../config.ts';
import { createDatabase } from '../database/connection.ts';
import { migrate } from '../database/migrations.ts';
import { tokenDigest } from '../auth/store.ts';

/**
 * Fase A: la acción confirmada y la carga de guardado persisten en la misma
 * transacción que su registro de operación, con control de revisión e
 * idempotencia. Datos sintéticos; BD de integración (15433).
 */
describe('persistencia de acciones y guardados (Fase A)', () => {
  const config = readAppConfig(process.env);
  const database = createDatabase(config.databaseUrl);
  const owner = createDatabase(readDatabaseUrl(process.env.DATABASE_MIGRATION_URL));
  const app = createApp({ config, database });
  const player = { id: randomUUID(), token: randomBytes(32).toString('base64url'), csrf: randomBytes(32).toString('base64url') };
  const headers = { cookie: 'meridiano_session=' + player.token, origin: config.origin, 'x-csrf-token': player.csrf };
  const caseId = 'astrolabio-tres-ciudades';
  const inspectSala = { type: 'inspect', params: { targetId: 'MAD-SALA' } };
  const inspectCerradura = { type: 'inspect', params: { targetId: 'MAD-SALA', elementId: 'cerradura' } };
  const collectUnknown = { type: 'collect', params: { evidenceId: 'EV-99' } };

  beforeAll(async () => {
    await migrate(readDatabaseUrl(process.env.DATABASE_MIGRATION_URL));
    await owner.pool.query('INSERT INTO profiles(id,local_key,display_name) VALUES ($1,$2,$3)', [player.id, 'http-synthetic-' + player.id, 'Detective sintético']);
    await owner.pool.query("INSERT INTO sessions(token_hash,profile_id,csrf_token,expires_at) VALUES ($1,$2,$3,now()+interval '8 hours')", [tokenDigest(player.token), player.id, player.csrf]);
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
    await owner.pool.query('DELETE FROM operation_records WHERE owner_id=$1', [player.id]);
    await owner.pool.query('DELETE FROM manual_saves WHERE owner_id=$1', [player.id]);
    await owner.pool.query('DELETE FROM run_creations WHERE owner_id=$1', [player.id]);
    await owner.pool.query('DELETE FROM runs WHERE owner_id=$1', [player.id]);
    await owner.pool.query('DELETE FROM sessions WHERE profile_id=$1', [player.id]);
    await owner.pool.query('DELETE FROM profiles WHERE id=$1', [player.id]);
    await database.pool.end(); await owner.pool.end();
  });

  async function createRun(): Promise<string> {
    const response = await app.inject({ method: 'POST', url: '/api/v1/runs', headers, payload: { caseId, idempotencyKey: randomUUID() } });
    expect(response.statusCode).toBe(201);
    return response.json().runId as string;
  }
  async function act(runId: string, body: Record<string, unknown>) {
    return app.inject({ method: 'POST', url: `/api/v1/runs/${runId}/action`, headers, payload: body });
  }
  async function view(runId: string) {
    const response = await app.inject({ url: '/api/v1/runs/' + runId, headers });
    expect(response.statusCode).toBe(200);
    return response.json() as Record<string, unknown>;
  }
  async function storedRun(runId: string) {
    const rows = await owner.pool.query<{ revision: number; branch_id: string; engine_state: Record<string, unknown> }>(
      'SELECT revision, branch_id, engine_state FROM runs WHERE id=$1', [runId]);
    const row = rows.rows[0];
    if (!row) throw new Error('Expected stored run');
    return row;
  }
  async function operationCount(runId: string, kind?: string) {
    const rows = await owner.pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM operation_records WHERE run_id=$1${kind ? ` AND kind='${kind}'` : ''}`, [runId]);
    const row = rows.rows[0];
    if (!row) throw new Error('Expected operation count');
    return row.n;
  }
  async function createSave(runId: string, name: string, expectedVersion: number) {
    const response = await app.inject({ method: 'POST', url: `/api/v1/runs/${runId}/saves`, headers,
      payload: { name, expectedVersion, idempotencyKey: randomUUID() } });
    expect(response.statusCode).toBe(201);
    return response.json() as { saveId: string };
  }

  it('la preview no persiste ni registra operación', async () => {
    const runId = await createRun();
    const preview = await act(runId, { action: inspectSala, confirm: false });
    expect(preview.statusCode).toBe(200);
    expect(preview.json().outcome).toBe('confirmation_required');
    expect(preview.json().requiresConfirmation).toBe(true);
    const current = await view(runId);
    expect(current.version).toBe(1);
    expect((current.clock as Record<string, unknown>).minute).toBe(0);
    expect((await storedRun(runId)).revision).toBe(1);
    expect(await operationCount(runId)).toBe(0);
  });

  it('confirmar una acción persiste y avanza la revisión exactamente una vez', async () => {
    const runId = await createRun();
    const confirmed = await act(runId, { action: inspectSala, confirm: true, expectedVersion: 1, idempotencyKey: randomUUID() });
    expect(confirmed.statusCode).toBe(200);
    const body = confirmed.json() as Record<string, unknown>;
    expect(body.outcome).toBe('applied');
    expect(body.operationId).toMatch(/^[a-f0-9-]{36}$/);
    expect((body.clock as Record<string, unknown>).minute).toBe(10);
    expect(body.version).toBe(2);
    const current = await view(runId);
    expect(current.version).toBe(2);
    expect((current.clock as Record<string, unknown>).minute).toBe(10);
    const stored = await storedRun(runId);
    expect(stored.revision).toBe(2);
    expect(stored.engine_state.minute).toBe(10);
    expect(await operationCount(runId, 'action')).toBe(1);
  });

  it('reintentar una acción con la misma clave devuelve el resultado guardado sin duplicar', async () => {
    const runId = await createRun();
    const key = randomUUID();
    const first = await act(runId, { action: inspectSala, confirm: true, expectedVersion: 1, idempotencyKey: key });
    expect(first.statusCode).toBe(200);
    const firstBody = first.json() as Record<string, unknown>;
    const second = await act(runId, { action: inspectSala, confirm: true, expectedVersion: 1, idempotencyKey: key });
    expect(second.statusCode).toBe(200);
    const secondBody = second.json() as Record<string, unknown>;
    expect(secondBody.replayed).toBe(true);
    expect(secondBody.operationId).toBe(firstBody.operationId);
    expect(secondBody.outcome).toBe('applied');
    expect((await storedRun(runId)).revision).toBe(2);
    expect(await operationCount(runId, 'action')).toBe(1);
  });

  it('una acción imposible no persiste ni avanza revisión', async () => {
    const runId = await createRun();
    const response = await act(runId, { action: collectUnknown, confirm: true, idempotencyKey: randomUUID() });
    expect(response.statusCode).toBe(200);
    expect(response.json().outcome).toBe('impossible');
    const current = await view(runId);
    expect(current.version).toBe(1);
    expect((await storedRun(runId)).revision).toBe(1);
    expect(await operationCount(runId)).toBe(0);
  });

  it('expectedVersion incorrecto devuelve 409 VERSION_CONFLICT sin efectos', async () => {
    const runId = await createRun();
    const response = await act(runId, { action: inspectSala, confirm: true, expectedVersion: 99, idempotencyKey: randomUUID() });
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('VERSION_CONFLICT');
    expect((await storedRun(runId)).revision).toBe(1);
    expect(await operationCount(runId)).toBe(0);
  });

  it('guardar y cargar restaura el estado como nueva revisión con nueva rama', async () => {
    const runId = await createRun();
    const before = await storedRun(runId);
    await act(runId, { action: inspectSala, confirm: true, expectedVersion: 1, idempotencyKey: randomUUID() });
    const save = await createSave(runId, 'Punto medio', 2);
    await act(runId, { action: inspectCerradura, confirm: true, expectedVersion: 2, idempotencyKey: randomUUID() });
    expect((await view(runId)).clock).toEqual({ minute: 30, deadlineMinutes: 2880 });
    expect((await storedRun(runId)).revision).toBe(3);

    const loadKey = randomUUID();
    const loaded = await app.inject({ method: 'POST', url: `/api/v1/runs/${runId}/saves/${save.saveId}/load`, headers,
      payload: { expectedVersion: 3, idempotencyKey: loadKey } });
    expect(loaded.statusCode).toBe(200);
    const loadedBody = loaded.json() as Record<string, unknown>;
    expect(loadedBody.operationId).toMatch(/^[a-f0-9-]{36}$/);
    expect(loadedBody.newBranchId).toMatch(/^[a-f0-9-]{36}$/);
    expect(loadedBody.newBranchId).not.toBe(before.branch_id);
    expect((loadedBody.clock as Record<string, unknown>).minute).toBe(10);
    expect(loadedBody.version).toBe(4); // revisión HTTP; la versión interna del motor (2) no se expone en el DTO
    const current = await view(runId);
    expect((current.clock as Record<string, unknown>).minute).toBe(10);
    expect(current.version).toBe(4);
    const stored = await storedRun(runId);
    expect(stored.revision).toBe(4);
    expect(stored.branch_id).toBe(loadedBody.newBranchId);
    expect(stored.engine_state.minute).toBe(10);
    expect(stored.engine_state.version).toBe(2); // versión interna del motor, la del guardado
    expect(await operationCount(runId, 'load')).toBe(1);

    // Reintento: mismo operationId y misma rama, sin avanzar la revisión.
    const replay = await app.inject({ method: 'POST', url: `/api/v1/runs/${runId}/saves/${save.saveId}/load`, headers,
      payload: { expectedVersion: 3, idempotencyKey: loadKey } });
    expect(replay.statusCode).toBe(200);
    expect(replay.json().operationId).toBe(loadedBody.operationId);
    expect(replay.json().newBranchId).toBe(loadedBody.newBranchId);
    expect((await storedRun(runId)).revision).toBe(4);
    expect(await operationCount(runId, 'load')).toBe(1);
  });

  it('cargar con expectedVersion incorrecto devuelve 409 sin efectos', async () => {
    const runId = await createRun();
    const save = await createSave(runId, 'Inicio', 1);
    const response = await app.inject({ method: 'POST', url: `/api/v1/runs/${runId}/saves/${save.saveId}/load`, headers,
      payload: { expectedVersion: 99, idempotencyKey: randomUUID() } });
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('VERSION_CONFLICT');
    expect((await storedRun(runId)).revision).toBe(1);
  });

  it('cargar un guardado incompatible devuelve 422 SAVE_INCOMPATIBLE sin efectos', async () => {
    const runId = await createRun();
    const save = await createSave(runId, 'Inicio', 1);
    const updated = await owner.pool.query("UPDATE manual_saves SET snapshot=jsonb_set(snapshot,'{engineVersion}','999'::jsonb) WHERE id=$1", [save.saveId]);
    expect(updated.rowCount).toBe(1);
    const response = await app.inject({ method: 'POST', url: `/api/v1/runs/${runId}/saves/${save.saveId}/load`, headers,
      payload: { expectedVersion: 1, idempotencyKey: randomUUID() } });
    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe('SAVE_INCOMPATIBLE');
    expect((await storedRun(runId)).revision).toBe(1);
    expect(await operationCount(runId, 'load')).toBe(0);
  });

  it('una partida cerrada rechaza acciones y cargas con 409 RUN_CLOSED', async () => {
    const runId = await createRun();
    const save = await createSave(runId, 'Inicio', 1);
    // Estado cerrado sintético con la forma que el propio motor produciría.
    await owner.pool.query("UPDATE runs SET engine_state=jsonb_set(engine_state,'{status}','\"closed\"'::jsonb) WHERE id=$1", [runId]);
    const closed = await view(runId);
    expect(closed.status).toBe('closed');
    const action = await act(runId, { action: inspectSala, confirm: true, idempotencyKey: randomUUID() });
    expect(action.statusCode).toBe(409);
    expect(action.json().error.code).toBe('RUN_CLOSED');
    const load = await app.inject({ method: 'POST', url: `/api/v1/runs/${runId}/saves/${save.saveId}/load`, headers,
      payload: { expectedVersion: 1, idempotencyKey: randomUUID() } });
    expect(load.statusCode).toBe(409);
    expect(load.json().error.code).toBe('RUN_CLOSED');
    expect((await storedRun(runId)).revision).toBe(1);
  });
});
