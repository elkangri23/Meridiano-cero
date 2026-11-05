import { randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.ts';
import { readAppConfig, readDatabaseUrl } from '../config.ts';
import { createDatabase } from '../database/connection.ts';
import { migrate } from '../database/migrations.ts';
import { tokenDigest } from '../auth/store.ts';

/**
 * Fase C: conexiones IA personales (CRUD, resolución personal > defecto y
 * aislamiento entre cuentas). Datos sintéticos; BD de integración (15433).
 * La interpretación con una conexión Ollama sin servidor detrás devuelve
 * aclaración (el director aplica el respaldo factual), lo que demuestra que
 * la resolución por petición usa la conexión personal y no el mock.
 */
describe('conexiones IA personales (Fase C)', () => {
  const config = readAppConfig(process.env);
  const database = createDatabase(config.databaseUrl);
  const owner = createDatabase(readDatabaseUrl(process.env.DATABASE_MIGRATION_URL));
  const app = createApp({ config, database });

  type Json = Record<string, unknown>;
  function asJson(value: unknown): Json {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('expected JSON object');
    return value as Json;
  }
  function connectionId(body: Json): string {
    const connection = asJson(body.connection);
    if (typeof connection.id !== 'string') throw new Error('expected connection id');
    return connection.id;
  }

  function sessionFor() {
    const player = { id: randomUUID(), token: randomBytes(32).toString('base64url'), csrf: randomBytes(32).toString('base64url') };
    return { player, headers: { cookie: 'meridiano_session=' + player.token, origin: config.origin, 'x-csrf-token': player.csrf } };
  }
  const userA = sessionFor();
  const userB = sessionFor();
  let ollamaId = '';
  let lmStudioId = '';

  beforeAll(async () => {
    await migrate(readDatabaseUrl(process.env.DATABASE_MIGRATION_URL));
    for (const user of [userA, userB]) {
      await owner.pool.query('INSERT INTO profiles(id,local_key,display_name) VALUES ($1,$2,$3)', [user.player.id, 'http-synthetic-' + user.player.id, 'Detective sintético']);
      await owner.pool.query("INSERT INTO sessions(token_hash,profile_id,csrf_token,expires_at) VALUES ($1,$2,$3,now()+interval '8 hours')", [tokenDigest(user.player.token), user.player.id, user.player.csrf]);
    }
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    for (const user of [userA, userB]) {
      await owner.pool.query('DELETE FROM ai_usage WHERE owner_id=$1', [user.player.id]);
      await owner.pool.query('DELETE FROM ai_connections WHERE owner_id=$1', [user.player.id]);
      await owner.pool.query('DELETE FROM sessions WHERE profile_id=$1', [user.player.id]);
      await owner.pool.query('DELETE FROM profiles WHERE id=$1', [user.player.id]);
    }
    await database.pool.end(); await owner.pool.end();
  });

  it('sin conexiones usa el mock y muestra el catálogo', async () => {
    const response = await app.inject({ url: '/api/v1/ai/connections', headers: userA.headers });
    expect(response.statusCode).toBe(200);
    const body = asJson(response.json());
    expect((body.catalog as Array<{ id: string }>).map(entry => entry.id)).toEqual(
      ['freellmapi', 'openai', 'anthropic', 'google', 'ollama', 'openai-compatible'],
    );
    expect(body.effective).toMatchObject({ source: 'mock', providerId: 'mock' });
    expect(body.connections).toEqual([]);
  });

  it('crea una conexión Ollama sin exponer la credencial', async () => {
    const response = await app.inject({
      method: 'POST', url: '/api/v1/ai/connections', headers: userA.headers,
      payload: { name: 'Mi Ollama', adapterId: 'ollama', baseUrl: 'http://127.0.0.1:11434', model: 'llama3.1:8b', isDefault: true },
    });
    expect(response.statusCode).toBe(201);
    const body = asJson(response.json());
    expect(body.connection).toMatchObject({ name: 'Mi Ollama', adapterId: 'ollama', model: 'llama3.1:8b', isDefault: true });
    expect(JSON.stringify(body)).not.toContain('encryptedCredential');
    expect(JSON.stringify(body)).not.toContain('credential');
    ollamaId = connectionId(body);

    const list = await app.inject({ url: '/api/v1/ai/connections', headers: userA.headers });
    const listed = asJson(list.json());
    expect(listed.effective).toMatchObject({ source: 'personal', providerId: 'ollama', connectionId: ollamaId });
    expect((listed.connections as Array<Record<string, unknown>>).length).toBe(1);
  });

  it('la interpretación usa la conexión personal (Ollama caído → aclaración)', async () => {
    const response = await app.inject({
      method: 'POST', url: '/api/v1/ai/interpret', headers: userA.headers,
      payload: {
        text: 'inspecciona la sala',
        scene: { location: 'Madrid', description: 'Sala de embalaje' },
        offers: [{ id: 'inspect-room', label: 'Inspeccionar la sala' }],
        requestId: randomUUID(),
      },
    });
    expect(response.statusCode).toBe(200);
    const body = asJson(response.json());
    const interpretation = asJson(body.interpretation);
    expect(interpretation.kind).toBe('clarification');
    expect(interpretation.reason).toBe('unavailable');
  });

  it('valida entradas: sin clave, nombre duplicado y URL con credenciales', async () => {
    const noKey = await app.inject({
      method: 'POST', url: '/api/v1/ai/connections', headers: userA.headers,
      payload: { name: 'Claude', adapterId: 'anthropic', model: 'claude-sonnet-4-5' },
    });
    expect(noKey.statusCode).toBe(400);

    const duplicate = await app.inject({
      method: 'POST', url: '/api/v1/ai/connections', headers: userA.headers,
      payload: { name: 'Mi Ollama', adapterId: 'ollama', baseUrl: 'http://127.0.0.1:11434', model: 'llama3.1:8b' },
    });
    expect(duplicate.statusCode).toBe(400);

    const badUrl = await app.inject({
      method: 'POST', url: '/api/v1/ai/connections', headers: userA.headers,
      payload: { name: 'Raro', adapterId: 'openai-compatible', baseUrl: 'http://user:pass@example.com/v1', model: 'local-model' },
    });
    expect(badUrl.statusCode).toBe(400);
  });

  it('crea una conexión LM Studio como predeterminada y la prueba falla sin servidor', async () => {
    const created = await app.inject({
      method: 'POST', url: '/api/v1/ai/connections', headers: userA.headers,
      payload: { name: 'LM Studio', adapterId: 'openai-compatible', baseUrl: 'http://localhost:1234/v1', model: 'local-model', isDefault: true },
    });
    expect(created.statusCode).toBe(201);
    lmStudioId = connectionId(asJson(created.json()));

    const list = await app.inject({ url: '/api/v1/ai/connections', headers: userA.headers });
    expect(asJson(list.json()).effective).toMatchObject({ source: 'personal', providerId: 'openai-compatible', connectionId: lmStudioId });

    const test = await app.inject({ method: 'POST', url: `/api/v1/ai/connections/${ollamaId}/test`, headers: userA.headers, payload: {} });
    expect(test.statusCode).toBe(200);
    expect(asJson(test.json()).available).toBe(false);
  });

  it('desactivar la predeterminada devuelve la anterior; use-default vuelve al mock', async () => {
    const disabled = await app.inject({
      method: 'PATCH', url: `/api/v1/ai/connections/${lmStudioId}`, headers: userA.headers,
      payload: { status: 'disabled' },
    });
    expect(disabled.statusCode).toBe(200);
    expect(asJson(asJson(disabled.json()).connection).status).toBe('disabled');

    const list = await app.inject({ url: '/api/v1/ai/connections', headers: userA.headers });
    expect(asJson(list.json()).effective).toMatchObject({ source: 'personal', providerId: 'ollama' });

    const useDefault = await app.inject({ method: 'POST', url: '/api/v1/ai/connections/use-default', headers: userA.headers, payload: {} });
    expect(useDefault.statusCode).toBe(200);
    expect(asJson(useDefault.json()).effective).toMatchObject({ source: 'mock', providerId: 'mock' });
  });

  it('otro usuario no ve ni toca las conexiones ajenas', async () => {
    const list = await app.inject({ url: '/api/v1/ai/connections', headers: userB.headers });
    expect(asJson(list.json()).connections).toEqual([]);

    const patch = await app.inject({
      method: 'PATCH', url: `/api/v1/ai/connections/${ollamaId}`, headers: userB.headers,
      payload: { model: 'otro-modelo' },
    });
    expect(patch.statusCode).toBe(404);

    const remove = await app.inject({ method: 'DELETE', url: `/api/v1/ai/connections/${ollamaId}`, headers: userB.headers });
    expect(remove.statusCode).toBe(404);
  });

  it('borra las conexiones propias', async () => {
    for (const id of [ollamaId, lmStudioId]) {
      const response = await app.inject({ method: 'DELETE', url: `/api/v1/ai/connections/${id}`, headers: userA.headers });
      expect(response.statusCode).toBe(204);
    }
    const list = await app.inject({ url: '/api/v1/ai/connections', headers: userA.headers });
    expect(asJson(list.json()).connections).toEqual([]);
  });
});
