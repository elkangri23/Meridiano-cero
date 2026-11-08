// Carrera y reputación (GDD §13, DEC-020): el primer cierre definitivo
// persiste el resultado oficial; los cierres posteriores del mismo
// contenido son práctica y no cambian la carrera; cargar un guardado antes
// del primer cierre permite cambiar el resultado; reintentos y cierres
// concurrentes no duplican; la reputación baja con conducta irregular y se
// recupera con casos limpios; la retirada crea una suspensión que un caso
// limpio posterior resuelve; ningún rango bloquea herramientas.
// Datos sintéticos; BD de integración (15433).
import { randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isActionResponseDto, isCareerProfileDto, isPlayerViewDto } from '@meridiano/contracts';
import type { CareerProfileDto } from '@meridiano/contracts';
import { generadoFraudeDefinition } from '@meridiano/engine';
import type { CaseDefinition } from '@meridiano/case-schema';
import { hashDefinition } from '@meridiano/case-schema/server';
import { createApp } from '../app.ts';
import { readAppConfig, readDatabaseUrl } from '../config.ts';
import { createDatabase } from '../database/connection.ts';
import { migrate } from '../database/migrations.ts';
import { tokenDigest } from '../auth/store.ts';

describe('carrera y reputación por HTTP (GDD §13, DEC-020)', () => {
  const config = readAppConfig(process.env);
  const database = createDatabase(config.databaseUrl);
  const owner = createDatabase(readDatabaseUrl(process.env.DATABASE_MIGRATION_URL));
  const app = createApp({ config, database });
  const player = { id: randomUUID(), token: randomBytes(32).toString('base64url'), csrf: randomBytes(32).toString('base64url') };
  const headers = { cookie: 'meridiano_session=' + player.token, origin: config.origin, 'x-csrf-token': player.csrf };
  const caseId = 'astrolabio-tres-ciudades';
  // Clones sintéticos del caso generado de ejemplo (fraude): mismo
  // esqueleto, distinto contenido (título de introducción propio) para que
  // cada uno tenga su propio resultado oficial. El caso fijo NO se puede
  // clonar: sus exenciones de validación dependen de su id legacy, así que
  // un clon del fijo no valida y la creación da 404. El clon añade dos NPC
  // en Madrid (Luis, Ana) para que los sobornos tengan testigos en la
  // misma ciudad (el fraude trae un solo NPC por ciudad).
  const cloneIds = {
    a: 'generado-carrera-a', b: 'generado-carrera-b', c: 'generado-carrera-c',
    d: 'generado-carrera-d', e: 'generado-carrera-e', f: 'generado-carrera-f',
  } as const;

  function cloneTitle(suffix: string): string {
    return 'Clon de carrera ' + suffix.toUpperCase();
  }

  function cloneDefinition(suffix: string): CaseDefinition {
    const clone = structuredClone(generadoFraudeDefinition) as CaseDefinition;
    clone.id = 'generado-carrera-' + suffix;
    clone.catalogMeta = { crimeType: 'fraude', contentRating: 'familiar' };
    clone.briefing = {
      speaker: 'Margaret Sullivan',
      title: cloneTitle(suffix),
      paragraphs: ['Expediente sintético para probar la carrera.'],
    };
    clone.npcs.push(
      { id: 'luis', name: 'Luis', cityId: 'madrid', knowledge: ['jorge-vio-facturas'], cooperation: 6, role: 'Contable', persona: 'Eres Luis, contable de la oficina.' },
      { id: 'ana', name: 'Ana', cityId: 'madrid', knowledge: ['jorge-vio-facturas'], cooperation: 6, role: 'Recepcionista', persona: 'Eres Ana, recepcionista de la oficina.' },
    );
    // Sin saludo en `texts.greetings` el clon no valida (v1.5 exige saludo por NPC).
    if (clone.texts) {
      clone.texts.greetings = {
        ...clone.texts.greetings,
        luis: 'Soy Luis, contable de la oficina. ¿En qué puedo ayudarte?',
        ana: 'Soy Ana, recepcionista de la oficina. ¿En qué puedo ayudarte?',
      };
    }
    return clone;
  }

  beforeAll(async () => {
    await migrate(readDatabaseUrl(process.env.DATABASE_MIGRATION_URL));
    await owner.pool.query('INSERT INTO profiles(id,local_key,display_name) VALUES ($1,$2,$3)', [player.id, 'http-synthetic-' + player.id, 'Detective sintético']);
    await owner.pool.query("INSERT INTO sessions(token_hash,profile_id,csrf_token,expires_at) VALUES ($1,$2,$3,now()+interval '8 hours')", [tokenDigest(player.token), player.id, player.csrf]);
    for (const suffix of ['a', 'b', 'c', 'd', 'e', 'f']) {
      const definition = cloneDefinition(suffix);
      await owner.pool.query(
        `INSERT INTO generated_cases(case_id,title,crime_type,content_rating,duration,definition,definition_hash,created_by)
         VALUES ($1,$2,'fraude','familiar','medium',$3::jsonb,$4,$5)`,
        [definition.id, cloneTitle(suffix), JSON.stringify(definition), hashDefinition(definition), player.id]);
    }
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
    await owner.pool.query('DELETE FROM official_results WHERE owner_id=$1', [player.id]);
    await owner.pool.query('DELETE FROM operation_records WHERE owner_id=$1', [player.id]);
    await owner.pool.query('DELETE FROM manual_saves WHERE owner_id=$1', [player.id]);
    await owner.pool.query('DELETE FROM run_creations WHERE owner_id=$1', [player.id]);
    await owner.pool.query('DELETE FROM runs WHERE owner_id=$1', [player.id]);
    await owner.pool.query('DELETE FROM generated_cases WHERE created_by=$1', [player.id]);
    await owner.pool.query('DELETE FROM sessions WHERE profile_id=$1', [player.id]);
    await owner.pool.query('DELETE FROM profiles WHERE id=$1', [player.id]);
    await database.pool.end(); await owner.pool.end();
  });

  async function createRun(forCaseId: string = caseId): Promise<string> {
    const response = await app.inject({ method: 'POST', url: '/api/v1/runs', headers, payload: { caseId: forCaseId, idempotencyKey: randomUUID() } });
    expect(response.statusCode).toBe(201);
    return response.json().runId as string;
  }
  async function act(runId: string, action: Record<string, unknown>, key: string = randomUUID()): Promise<Record<string, unknown>> {
    const response = await app.inject({ method: 'POST', url: `/api/v1/runs/${runId}/action`, headers,
      payload: { action, confirm: true, idempotencyKey: key } });
    expect(response.statusCode).toBe(200);
    return response.json() as Record<string, unknown>;
  }
  async function view(runId: string): Promise<Record<string, unknown>> {
    const response = await app.inject({ url: '/api/v1/runs/' + runId, headers });
    expect(response.statusCode).toBe(200);
    return response.json() as Record<string, unknown>;
  }
  async function career(): Promise<CareerProfileDto> {
    const response = await app.inject({ url: '/api/v1/career', headers });
    expect(response.statusCode).toBe(200);
    expect(isCareerProfileDto(response.json())).toBe(true);
    return response.json() as CareerProfileDto;
  }
  async function officialCount(): Promise<number> {
    const rows = await owner.pool.query<{ n: number }>('SELECT count(*)::int AS n FROM official_results WHERE owner_id=$1', [player.id]);
    const row = rows.rows[0];
    if (!row) throw new Error('sin filas al contar resultados oficiales');
    return row.n;
  }
  async function createSave(runId: string, expectedVersion: number): Promise<string> {
    const response = await app.inject({ method: 'POST', url: `/api/v1/runs/${runId}/saves`, headers,
      payload: { name: 'Punto sintético', expectedVersion, idempotencyKey: randomUUID() } });
    expect(response.statusCode).toBe(201);
    return (response.json() as { saveId: string }).saveId;
  }
  async function loadSave(runId: string, saveId: string, expectedVersion: number): Promise<Record<string, unknown>> {
    const response = await app.inject({ method: 'POST', url: `/api/v1/runs/${runId}/saves/${saveId}/load`, headers,
      payload: { expectedVersion, idempotencyKey: randomUUID() } });
    expect(response.statusCode).toBe(200);
    return response.json() as Record<string, unknown>;
  }

  // Ruta A del juego (470 min): la misma que el informe final, por API.
  async function playRouteA(runId: string): Promise<Record<string, unknown>> {
    const steps: Array<Record<string, unknown>> = [
      { type: 'inspect', params: { targetId: 'MAD-SALA' } },
      { type: 'inspect', params: { targetId: 'MAD-SALA', elementId: 'cerradura' } },
      { type: 'collect', params: { evidenceId: 'EV-02' } },
      { type: 'analyze', params: { evidenceId: 'EV-02' } },
      { type: 'travel', params: { toCityId: 'paris' } },
      { type: 'query', params: { topicId: 'herramienta-hv17' } },
      { type: 'query', params: { topicId: 'traslado-ines' } },
      { type: 'wait', params: { minutes: 30 } },
      { type: 'request_warrant', params: { suspectId: 'ines', evidenceIds: ['EV-03', 'EV-04', 'EV-05'] } },
      { type: 'wait', params: { minutes: 30 } },
      { type: 'travel', params: { toCityId: 'lisboa' } },
      { type: 'talk', params: { npcId: 'ines', topicId: 'identidad' } },
      { type: 'detain', params: { suspectId: 'ines', mode: 'automatic', locationId: 'LIS-ALM', warrantId: 'warrant:ines' } },
      { type: 'recover', params: { objectId: 'astrolabio-original' } },
      { type: 'finish', params: {} },
    ];
    let last: Record<string, unknown> = {};
    for (const action of steps) {
      last = await act(runId, action);
      expect(last.outcome).toMatch(/^(applied|case_closed)$/);
    }
    return last;
  }

  it('sin cierres, la carrera está vacía (rango Aspirante, cero casos)', async () => {
    const profile = await career();
    expect(profile.rank).toBe('Aspirante');
    expect(profile.points).toBe(0);
    expect(profile.totalCases).toBe(0);
    expect(profile.completedCases).toBe(0);
    expect(profile.medals).toEqual([]);
    expect(profile.results).toEqual([]);
    expect(profile.sanctions).toEqual([]);
    expect(await officialCount()).toBe(0);
  });

  it('el primer cierre persiste el resultado oficial y la vista lo enseña', async () => {
    const runId = await createRun();
    const closed = await act(runId, { type: 'finish', params: {} });
    expect(closed.outcome).toBe('case_closed');
    expect(isActionResponseDto(closed)).toBe(true);
    const official = closed.officialResult as Record<string, unknown>;
    expect(official).toMatchObject({
      caseId, result: 'unresolved', reason: 'finished', minute: 0,
      points: 0, medal: null, isThisRun: true,
      rankBefore: 'Aspirante', rankAfter: 'Aspirante',
    });
    // Cierre limpio sin detenciones: bonus de legalidad (+2 prestigio, +1 integridad).
    expect(official.prestigeDelta).toBe(2);
    expect(official.integrityDelta).toBe(1);
    expect(official.trustDelta).toBe(0);
    expect(official.irregularActs).toBe(0);
    expect(official.countries).toEqual(['España']);
    expect(official.places).toEqual(['Sala de embalaje']);
    expect(await officialCount()).toBe(1);
    const profile = await career();
    expect(profile.totalCases).toBe(1);
    expect(profile.completedCases).toBe(0);
    expect(profile.points).toBe(0);
    expect(profile.results).toHaveLength(1);
    expect(profile.results[0]).toMatchObject({ caseId, result: 'unresolved', points: 0 });
    // Al recargar, la vista sigue enseñando el resultado oficial.
    const reloaded = await view(runId);
    expect(isPlayerViewDto(reloaded)).toBe(true);
    expect((reloaded.officialResult as Record<string, unknown>).isThisRun).toBe(true);
  });

  it('el segundo cierre del mismo contenido es práctica y no cambia la carrera (ACC-030)', async () => {
    const runId = await createRun();
    const closed = await playRouteA(runId);
    expect(closed.outcome).toBe('case_closed');
    expect(isActionResponseDto(closed)).toBe(true);
    // La ruta A resuelve el caso (87/100), pero el resultado oficial sigue
    // siendo el primer cierre (sin resolver, 0 puntos): no se sustituye.
    const official = closed.officialResult as Record<string, unknown>;
    expect(official).toMatchObject({ caseId, result: 'unresolved', points: 0, isThisRun: false });
    expect(await officialCount()).toBe(1);
    const profile = await career();
    expect(profile.totalCases).toBe(1);
    expect(profile.points).toBe(0);
    expect(profile.medals).toEqual([]);
  });

  it('cargar un guardado antes del primer cierre permite cambiar el resultado', async () => {
    const cloneId = cloneIds.a;
    const runId = await createRun(cloneId);
    const saveId = await createSave(runId, 1);
    await act(runId, { type: 'inspect', params: { targetId: 'MAD-OFIC' } });
    const loaded = await loadSave(runId, saveId, 2);
    expect((loaded.clock as Record<string, unknown>).minute).toBe(0);
    const closed = await act(runId, { type: 'finish', params: {} });
    expect(closed.outcome).toBe('case_closed');
    const official = closed.officialResult as Record<string, unknown>;
    // El cierre es el primero de este contenido y refleja el estado
    // cargado (minuto 0), no la inspección deshecha (minuto 10).
    expect(official).toMatchObject({ caseId: cloneId, result: 'unresolved', minute: 0, isThisRun: true });
    expect(await officialCount()).toBe(2);
  });

  it('dos cierres concurrentes del mismo contenido crean un solo resultado oficial', async () => {
    const cloneId = cloneIds.b;
    const first = await createRun(cloneId);
    const second = await createRun(cloneId);
    const [closedFirst, closedSecond] = await Promise.all([
      act(first, { type: 'finish', params: {} }),
      act(second, { type: 'finish', params: {} }),
    ]);
    expect(closedFirst.outcome).toBe('case_closed');
    expect(closedSecond.outcome).toBe('case_closed');
    expect(await officialCount()).toBe(3);
    const flags = [
      (closedFirst.officialResult as Record<string, unknown>).isThisRun,
      (closedSecond.officialResult as Record<string, unknown>).isThisRun,
    ];
    expect(flags.filter(Boolean)).toHaveLength(1);
    const profile = await career();
    expect(profile.totalCases).toBe(3);
    expect(profile.results.filter(result => result.caseId === cloneId)).toHaveLength(1);
  });

  it('reintentar el cierre con la misma clave no duplica el resultado oficial', async () => {
    const cloneId = cloneIds.a;
    const runId = await createRun(cloneId);
    const key = randomUUID();
    const first = await act(runId, { type: 'finish', params: {} }, key);
    expect(first.outcome).toBe('case_closed');
    expect((first.officialResult as Record<string, unknown>).isThisRun).toBe(false);
    // La partida ya está cerrada: el reintento con la misma clave se
    // rechaza (RUN_CLOSED) sin volver a persistir nada.
    const retry = await app.inject({ method: 'POST', url: `/api/v1/runs/${runId}/action`, headers,
      payload: { action: { type: 'finish', params: {} }, confirm: true, idempotencyKey: key } });
    expect(retry.statusCode).toBe(409);
    expect((retry.json() as Record<string, unknown>).error).toMatchObject({ code: 'RUN_CLOSED' });
    expect(await officialCount()).toBe(3);
  });

  it('la reputación baja con conducta irregular y se recupera con casos limpios', async () => {
    const before = await career();
    const dirty = await createRun(cloneIds.c);
    const bribed = await act(dirty, { type: 'irregular', params: { kind: 'bribe', targetId: 'jorge' } });
    expect(bribed.outcome).toBe('applied');
    const closedDirty = await act(dirty, { type: 'finish', params: {} });
    expect(closedDirty.outcome).toBe('case_closed');
    const dirtyOfficial = closedDirty.officialResult as Record<string, unknown>;
    expect(dirtyOfficial.irregularActs).toBe(1);
    expect(dirtyOfficial.integrityDelta).toBe(-5);
    expect(dirtyOfficial.prestigeDelta).toBe(-2);
    const afterDirty = await career();
    expect(afterDirty.integrity).toBe(before.integrity - 5);
    expect(afterDirty.totalCases).toBe(before.totalCases + 1);
    // Un caso limpio posterior sube la integridad (bonus de legalidad).
    const clean = await createRun(cloneIds.d);
    const closedClean = await act(clean, { type: 'finish', params: {} });
    expect(closedClean.outcome).toBe('case_closed');
    expect((closedClean.officialResult as Record<string, unknown>).irregularActs).toBe(0);
    const afterClean = await career();
    expect(afterClean.integrity).toBeGreaterThan(afterDirty.integrity);
    expect(afterClean.totalCases).toBe(before.totalCases + 2);
  });

  it('la retirada crea una suspensión activa sin bloquear herramientas, y un caso limpio la resuelve', async () => {
    const withdrawn = await createRun(cloneIds.e);
    // Tres actos vistos, todos en Madrid: sobornar a Jorge (lo ven Luis
    // y Ana), sobornar a Luis (lo ven Jorge y Ana) y sobornar a Ana (la ven
    // Jorge y Luis). Sin viajar: el fraude trae un solo NPC por ciudad y
    // el clon añade los dos testigos en Madrid.
    const first = await act(withdrawn, { type: 'irregular', params: { kind: 'bribe', targetId: 'jorge' } });
    expect(first.outcome).toBe('applied');
    const second = await act(withdrawn, { type: 'irregular', params: { kind: 'bribe', targetId: 'luis' } });
    expect(second.outcome).toBe('applied');
    const third = await act(withdrawn, { type: 'irregular', params: { kind: 'bribe', targetId: 'ana' } });
    expect(third.outcome).toBe('case_closed');
    const report = third.finalReport as Record<string, unknown>;
    expect(report.reason).toBe('withdrawn');
    const official = third.officialResult as Record<string, unknown>;
    expect(official).toMatchObject({ caseId: cloneIds.e, reason: 'withdrawn', irregularActs: 3, isThisRun: true });
    const suspended = await career();
    expect(suspended.sanctions).toHaveLength(1);
    expect(suspended.sanctions[0]).toMatchObject({ caseId: cloneIds.e, severity: 'suspension', active: true });
    // La suspensión no bloquea herramientas ni destruye guardados: una
    // partida nueva sigue ofreciendo viajar e inspeccionar, y actúa.
    const fresh = await createRun(cloneIds.f);
    const freshView = await view(fresh);
    const offers = (freshView.offers as Array<Record<string, unknown>>).map(offer => offer.id as string);
    expect(offers).toContain('travel:barcelona');
    expect(offers).toContain('inspect:MAD-OFIC');
    const inspected = await act(fresh, { type: 'inspect', params: { targetId: 'MAD-OFIC' } });
    expect(inspected.outcome).toBe('applied');
    // Cerrar ese caso limpio resuelve la suspensión.
    const closedFresh = await act(fresh, { type: 'finish', params: {} });
    expect(closedFresh.outcome).toBe('case_closed');
    const resolved = await career();
    expect(resolved.sanctions).toHaveLength(1);
    const sanction = resolved.sanctions[0];
    if (!sanction) throw new Error('sin sanción en la carrera');
    expect(sanction.active).toBe(false);
    expect(sanction.resolvedAt).toBeDefined();
    expect(resolved.totalCases).toBe(7);
  });
});
