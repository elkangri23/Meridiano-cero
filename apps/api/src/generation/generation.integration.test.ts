import { randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.ts';
import { readAppConfig, readDatabaseUrl } from '../config.ts';
import { createDatabase } from '../database/connection.ts';
import { migrate } from '../database/migrations.ts';
import { tokenDigest } from '../auth/store.ts';
import { createTelemetry } from '../telemetry.ts';
import { startGenerationWorker, type GenerationWorker } from '../generation/worker.ts';
import { Writable } from 'node:stream';

describe('Generación de casos (T4-08)', () => {
  const config = readAppConfig(process.env);
  const database = createDatabase(config.databaseUrl);
  const owner = createDatabase(readDatabaseUrl(process.env.DATABASE_MIGRATION_URL));
  const lines: string[] = [];
  const sink = new Writable({ write(chunk, _encoding, done) { lines.push(String(chunk)); done(); } });
  const app = createApp({ config, database, telemetry: createTelemetry(sink) });
  const player = { id: randomUUID(), token: randomBytes(32).toString('base64url'), csrf: randomBytes(32).toString('base64url') };
  const headers = { cookie: 'meridiano_session=' + player.token, origin: config.origin, 'x-csrf-token': player.csrf };
  const create = (payload: Record<string, unknown>) => app.inject({ method: 'POST', url: '/api/v1/generation/jobs', headers, payload });
  const getJob = (jobId: string) => app.inject({ method: 'GET', url: `/api/v1/generation/jobs/${jobId}`, headers });
  let worker: GenerationWorker | undefined;

  beforeAll(async () => {
    await migrate(readDatabaseUrl(process.env.DATABASE_MIGRATION_URL));
    await owner.pool.query('INSERT INTO profiles(id,local_key,display_name) VALUES ($1,$2,$3)', [player.id, 'generation-synthetic-' + player.id, 'Detective sintético']);
    await owner.pool.query("INSERT INTO sessions(token_hash,profile_id,csrf_token,expires_at) VALUES ($1,$2,$3,now()+interval '8 hours')", [tokenDigest(player.token), player.id, player.csrf]);
    await app.ready();
  });
  afterAll(async () => {
    worker?.stop();
    await app.close();
    await owner.pool.query('DELETE FROM generated_cases WHERE created_by=$1', [player.id]);
    await owner.pool.query('DELETE FROM generation_jobs WHERE owner_id=$1', [player.id]);
    await owner.pool.query('DELETE FROM sessions WHERE profile_id=$1', [player.id]);
    await owner.pool.query('DELETE FROM profiles WHERE id=$1', [player.id]);
    await database.pool.end(); await owner.pool.end();
  });

  it('crear un job devuelve 201 en cola', async () => {
    const response = await create({ crimeType: 'fraude', contentRating: 'familiar', duration: 'short' });
    expect(response.statusCode).toBe(201);
    const job = response.json();
    expect(job.status).toBe('queued');
    expect(job.stage).toBe(0);
    expect(job.crimeType).toBe('fraude');
    expect(job.contentRating).toBe('familiar');
    expect(job.caseId).toBeNull();
  });

  it('un segundo job activo es 429 GENERATION_LIMIT', async () => {
    const response = await create({ crimeType: 'robo', contentRating: 'familiar', duration: 'short' });
    expect(response.statusCode).toBe(429);
    expect(response.json().error.code).toBe('GENERATION_LIMIT');
  });

  it('listar jobs muestra el creado y cancelar lo deja en cancelled', async () => {
    const list = await app.inject({ method: 'GET', url: '/api/v1/generation/jobs', headers });
    expect(list.statusCode).toBe(200);
    const job = list.json().items[0];
    expect(job.status).toBe('queued');
    const cancelled = await app.inject({ method: 'POST', url: `/api/v1/generation/jobs/${job.jobId}/cancel`, headers, payload: {} });
    expect(cancelled.statusCode).toBe(200);
    expect(cancelled.json().status).toBe('cancelled');
    const again = await app.inject({ method: 'POST', url: `/api/v1/generation/jobs/${job.jobId}/cancel`, headers, payload: {} });
    expect(again.statusCode).toBe(409);
  });

  it('homicidio en Familiar es 400 (solo General) y delito inválido también', async () => {
    const homicide = await create({ crimeType: 'homicidio', contentRating: 'familiar', duration: 'short' });
    expect(homicide.statusCode).toBe(400);
    expect(homicide.json().error.code).toBe('VALIDATION_ERROR');
    const invalid = await create({ crimeType: 'inventado', contentRating: 'familiar', duration: 'short' });
    expect(invalid.statusCode).toBe(400);
  });

  it('tres jobs al día como tope: el cuarto es 429', async () => {
    for (let i = 0; i < 2; i++) {
      const response = await create({ crimeType: 'fraude', contentRating: 'familiar', duration: 'short' });
      expect(response.statusCode).toBe(201);
      const cancel = await app.inject({ method: 'POST', url: `/api/v1/generation/jobs/${response.json().jobId}/cancel`, headers, payload: {} });
      expect(cancel.statusCode).toBe(200);
    }
    const fourth = await create({ crimeType: 'fraude', contentRating: 'familiar', duration: 'short' });
    expect(fourth.statusCode).toBe(429);
    expect(fourth.json().error.code).toBe('GENERATION_LIMIT');
  });

  it('un job desconocido es 404', async () => {
    const response = await getJob(randomUUID());
    expect(response.statusCode).toBe(404);
  });

  it('el worker falla el job con motivo claro cuando el proveedor no genera (mock)', async () => {
    // El límite diario ya está agotado para este jugador; usar otro perfil.
    const player2 = { id: randomUUID(), token: randomBytes(32).toString('base64url'), csrf: randomBytes(32).toString('base64url') };
    const headers2 = { cookie: 'meridiano_session=' + player2.token, origin: config.origin, 'x-csrf-token': player2.csrf };
    await owner.pool.query('INSERT INTO profiles(id,local_key,display_name) VALUES ($1,$2,$3)', [player2.id, 'generation-synthetic-' + player2.id, 'Detective sintético 2']);
    await owner.pool.query("INSERT INTO sessions(token_hash,profile_id,csrf_token,expires_at) VALUES ($1,$2,$3,now()+interval '8 hours')", [tokenDigest(player2.token), player2.id, player2.csrf]);
    const created = await app.inject({ method: 'POST', url: '/api/v1/generation/jobs', headers: headers2, payload: { crimeType: 'fraude', contentRating: 'familiar', duration: 'short' } });
    expect(created.statusCode).toBe(201);
    const jobId = created.json().jobId as string;
    worker = startGenerationWorker(database, config);
    let status = '';
    let error: string | null = null;
    for (let attempt = 0; attempt < 30; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const current = await app.inject({ method: 'GET', url: `/api/v1/generation/jobs/${jobId}`, headers: headers2 });
      status = current.json().status as string;
      error = current.json().error as string | null;
      if (status === 'failed' || status === 'done') break;
    }
    // El mock no implementa generateCase: el job debe fallar con motivo,
    // no quedarse en cola ni en curso para siempre. El motivo debe hablar
    // del proveedor, no de los parámetros: un bug de mapeo del job (fila
    // cruda en snake_case) hizo fallar aquí con «surpriseMode es requerido»
    // aunque el job estuviera bien creado; ese motivo ya no es aceptable.
    expect(status).toBe('failed');
    expect(error).toBeTruthy();
    expect(error).not.toMatch(/surpriseMode|Parámetros inválidos/);
    await owner.pool.query('DELETE FROM generation_jobs WHERE owner_id=$1', [player2.id]);
    await owner.pool.query('DELETE FROM sessions WHERE profile_id=$1', [player2.id]);
    await owner.pool.query('DELETE FROM profiles WHERE id=$1', [player2.id]);
  });
});
