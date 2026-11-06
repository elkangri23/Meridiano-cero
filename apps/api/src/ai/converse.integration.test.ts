import { randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.ts';
import { readAppConfig, readDatabaseUrl } from '../config.ts';
import { createDatabase } from '../database/connection.ts';
import { migrate } from '../database/migrations.ts';
import { tokenDigest } from '../auth/store.ts';

/**
 * Conversación con NPC por ruta (reproducía el bug del informe de feedback:
 * el handler pasaba runId: '' al director y la memoria se rechazaba con
 * 500 INTERNAL_ERROR). Con el proveedor mock el director aplica el respaldo
 * factual: declara los hechos que se le pasan como conocidos del NPC.
 */
describe('conversación con NPC por ruta', () => {
  const config = readAppConfig(process.env);
  const database = createDatabase(config.databaseUrl);
  const owner = createDatabase(readDatabaseUrl(process.env.DATABASE_MIGRATION_URL));
  const app = createApp({ config, database });

  type Json = Record<string, unknown>;
  function asJson(value: unknown): Json {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('expected JSON object');
    return value as Json;
  }

  const player = { id: randomUUID(), token: randomBytes(32).toString('base64url'), csrf: randomBytes(32).toString('base64url') };
  const headers = { cookie: 'meridiano_session=' + player.token, origin: config.origin, 'x-csrf-token': player.csrf };
  const runId = 'run-sintetico-converse';
  const npc = { id: 'tomas', name: 'Tomás Ríos', persona: 'Transportista del Instituto Horizonte', knownFactIds: ['his-task'], revealableFactIds: ['his-task'] };
  const facts = [{ id: 'his-task', text: 'Yo solo moví la caja vacía de la sala de embalaje, como me tocaba por mi trabajo.' }];
  const emptyMemory = { schemaVersion: 1, runId, npcId: 'tomas', treatment: 'neutral', turns: [] };

  async function converse(memory: unknown) {
    return app.inject({
      method: 'POST',
      url: '/api/v1/ai/converse',
      headers,
      payload: { runId, text: '¿qué hiciste con la caja?', npc, facts, memory, allowedActs: ['state', 'acknowledge', 'decline', 'silence'], requestId: randomUUID() },
    });
  }

  beforeAll(async () => {
    await migrate(readDatabaseUrl(process.env.DATABASE_MIGRATION_URL));
    await owner.pool.query('INSERT INTO profiles(id,local_key,display_name) VALUES ($1,$2,$3)', [player.id, 'http-synthetic-' + player.id, 'Detective sintético']);
    await owner.pool.query("INSERT INTO sessions(token_hash,profile_id,csrf_token,expires_at) VALUES ($1,$2,$3,now()+interval '8 hours')", [tokenDigest(player.token), player.id, player.csrf]);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await owner.pool.query('DELETE FROM ai_usage WHERE owner_id=$1', [player.id]);
    await owner.pool.query('DELETE FROM sessions WHERE profile_id=$1', [player.id]);
    await owner.pool.query('DELETE FROM profiles WHERE id=$1', [player.id]);
    await database.pool.end(); await owner.pool.end();
  });

  it('responde con los hechos del NPC y devuelve la memoria con el runId real', async () => {
    const response = await converse(emptyMemory);
    expect(response.statusCode).toBe(200);
    const body = asJson(response.json());
    const narrative = asJson(body.narrative);
    expect(narrative.text).toContain('caja vacía');
    const memory = asJson(body.memory);
    expect(memory.runId).toBe(runId);
    expect(memory.npcId).toBe('tomas');
    expect(Array.isArray(memory.turns)).toBe(true);

    // Segundo turno con la memoria devuelta: la conversación continúa.
    const second = await converse(memory);
    expect(second.statusCode).toBe(200);
    const secondBody = asJson(second.json());
    expect(asJson(secondBody.narrative).text).toContain('caja vacía');
    expect((asJson(secondBody.memory).turns as unknown[]).length).toBeGreaterThan((memory.turns as unknown[]).length);
  });

  it('rechaza una memoria de otra partida con 400, no con 500', async () => {
    const response = await converse({ ...emptyMemory, runId: 'otra-partida' });
    expect(response.statusCode).toBe(400);
    expect(asJson(response.json()).error).toBeDefined();
  });

  it('un NPC sin listas de hechos no rompe: sin acto válido hay error operativo, no diálogo inventado', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/converse',
      headers,
      payload: { runId, text: '¿qué hiciste con la caja?', npc: { id: 'tomas', name: 'Tomás Ríos', persona: 'Transportista' }, facts, memory: emptyMemory, allowedActs: ['state', 'acknowledge', 'decline', 'silence'], requestId: randomUUID() },
    });
    // El mock devuelve un acto inválido y no hay hechos para declarar: el
    // respaldo de `acknowledge` ya no es la frase fija «He registrado tu
    // consulta.» sino un error operativo (CONVERSACIONES.md).
    expect(response.statusCode).toBe(500);
    expect(asJson(response.json()).error).toBeDefined();
  });

  // Inés Valera (sospechosa, restauradora): su único hecho conocido es
  // `truth` y su saludo avisa de que no declarará sobre el robo. En
  // producción su pregunta fallaba en la UI con «La IA no responde» — la
  // ruta responde bien (el fallo era el plazo de 8 s del cliente web, no
  // Inés): estos tests fijan que conversar con ella funciona por ruta.
  it('conversa con Inés Valera: responde con su hecho y la memoria es suya', async () => {
    const inesNpc = { id: 'ines', name: 'Inés Valera',
      persona: 'Sospechosa. Restauradora contratada para el traslado del astrolabio. Confirma su identidad y su tarea, pero se niega a declarar sobre el robo.',
      knownFactIds: ['truth'], revealableFactIds: ['truth'], refusal: 'No voy a declarar sobre el robo.' };
    const inesFacts = [{ id: 'truth', text: 'Soy Inés Valera, restauradora contratada para el traslado del astrolabio.' }];
    const inesMemory = { schemaVersion: 1, runId, npcId: 'ines', treatment: 'neutral', turns: [] };
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/converse',
      headers,
      payload: { runId, text: 'hola, no quieres decir nada?', npc: inesNpc, facts: inesFacts, memory: inesMemory, allowedActs: ['state', 'acknowledge', 'decline', 'silence'], requestId: randomUUID() },
    });
    expect(response.statusCode).toBe(200);
    const body = asJson(response.json());
    expect(asJson(body.narrative).text).toContain('restauradora');
    const memory = asJson(body.memory);
    expect(memory.runId).toBe(runId);
    expect(memory.npcId).toBe('ines');
    // Segundo turno con la memoria devuelta: la conversación continúa.
    const second = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/converse',
      headers,
      payload: { runId, text: '¿qué hiciste con el astrolabio?', npc: inesNpc, facts: inesFacts, memory, allowedActs: ['state', 'acknowledge', 'decline', 'silence'], requestId: randomUUID() },
    });
    expect(second.statusCode).toBe(200);
    expect(asJson(asJson(second.json()).narrative).text).toContain('restauradora');
  });

  it('Inés sin listas de hechos tampoco rompe: sin acto válido hay error operativo, no diálogo inventado', async () => {
    const inesFacts = [{ id: 'truth', text: 'Soy Inés Valera, restauradora contratada para el traslado del astrolabio.' }];
    const inesMemory = { schemaVersion: 1, runId, npcId: 'ines', treatment: 'neutral', turns: [] };
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/converse',
      headers,
      payload: { runId, text: 'hola, no quieres decir nada?', npc: { id: 'ines', name: 'Inés Valera', persona: 'Sospechosa' }, facts: inesFacts, memory: inesMemory, allowedActs: ['state', 'acknowledge', 'decline', 'silence'], requestId: randomUUID() },
    });
    expect(response.statusCode).toBe(500);
    expect(asJson(response.json()).error).toBeDefined();
  });
});
