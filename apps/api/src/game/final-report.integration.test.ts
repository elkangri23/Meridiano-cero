// Informe final completo (GDD §12): al cerrar, la vista trae verdad,
// cronología, pruebas halladas y omitidas, detenciones y puntuación; la
// cronología se reconstruye desde los registros de operaciones de la rama
// actual y se ve igual en la respuesta de cierre que al recargar la vista.
// Datos sintéticos; BD de integración (15433).
import { randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isActionResponseDto, isPlayerViewDto } from '@meridiano/contracts';
import { createApp } from '../app.ts';
import { readAppConfig, readDatabaseUrl } from '../config.ts';
import { createDatabase } from '../database/connection.ts';
import { migrate } from '../database/migrations.ts';
import { tokenDigest } from '../auth/store.ts';
import { loadRunTimeline } from './timeline.ts';

describe('informe final completo por HTTP (GDD §12)', () => {
  const config = readAppConfig(process.env);
  const database = createDatabase(config.databaseUrl);
  const owner = createDatabase(readDatabaseUrl(process.env.DATABASE_MIGRATION_URL));
  const app = createApp({ config, database });
  const player = { id: randomUUID(), token: randomBytes(32).toString('base64url'), csrf: randomBytes(32).toString('base64url') };
  const headers = { cookie: 'meridiano_session=' + player.token, origin: config.origin, 'x-csrf-token': player.csrf };
  const caseId = 'astrolabio-tres-ciudades';

  beforeAll(async () => {
    await migrate(readDatabaseUrl(process.env.DATABASE_MIGRATION_URL));
    await owner.pool.query('INSERT INTO profiles(id,local_key,display_name) VALUES ($1,$2,$3)', [player.id, 'http-synthetic-' + player.id, 'Detective sintético']);
    await owner.pool.query("INSERT INTO sessions(token_hash,profile_id,csrf_token,expires_at) VALUES ($1,$2,$3,now()+interval '8 hours')", [tokenDigest(player.token), player.id, player.csrf]);
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
    // Los cierres crean filas en official_results (GDD §13, FK a profiles):
    // borrarlas antes que el perfil o la limpieza viola la FK.
    await owner.pool.query('DELETE FROM official_results WHERE owner_id=$1', [player.id]);
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
  async function act(runId: string, action: Record<string, unknown>): Promise<Record<string, unknown>> {
    const response = await app.inject({ method: 'POST', url: `/api/v1/runs/${runId}/action`, headers,
      payload: { action, confirm: true, idempotencyKey: randomUUID() } });
    expect(response.statusCode).toBe(200);
    return response.json() as Record<string, unknown>;
  }
  async function view(runId: string): Promise<Record<string, unknown>> {
    const response = await app.inject({ url: '/api/v1/runs/' + runId, headers });
    expect(response.statusCode).toBe(200);
    return response.json() as Record<string, unknown>;
  }

  // Ruta A del juego (470 min): la misma que el E2E, por API. La detención
  // es automática (GDD §12): 30 min de coordinación con las autoridades.
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

  it('al cerrar la ruta A, la respuesta trae el informe completo con cronología', async () => {
    const runId = await createRun();
    const closed = await playRouteA(runId);
    expect(closed.outcome).toBe('case_closed');
    expect(closed.status).toBe('closed');
    // La respuesta de cierre debe pasar el mismo validador que usa el
    // cliente web (isActionResponseDto valida la vista y el informe): si
    // la cronología trajera el id opaco del evento, el cliente la
    // descartaría y la partida parecería seguir activa.
    expect(isActionResponseDto(closed)).toBe(true);
    const report = closed.finalReport as Record<string, unknown>;
    expect(report.result).toBe('complete');
    expect(report.reason).toBe('finished');
    expect(report.minute).toBe(470);
    const truth = report.truth as Record<string, unknown>;
    expect(truth.culpritId).toBe('ines-valera');
    expect(truth.culpritName).toBe('Inés Valera');
    expect(truth.objectId).toBe('astrolabio-original');
    expect(truth.objectLabel).toBe('el astrolabio original');
    expect((truth.keyEvidence as Array<Record<string, unknown>>).map(entry => entry.id))
      .toEqual(['EV-04', 'EV-05', 'EV-07', 'EV-08']);
    expect((report.evidenceFound as Array<Record<string, unknown>>).map(entry => entry.id))
      .toEqual(['EV-01', 'EV-02', 'EV-03', 'EV-04', 'EV-05', 'EV-11']);
    expect((report.evidenceMissed as Array<Record<string, unknown>>).map(entry => entry.id))
      .toEqual(['EV-06', 'EV-09', 'EV-10']);
    // Las decisivas ya se enseñan en «Decisive evidence»: no se repiten
    // en «omitidas» (lote pequeños del catálogo 2026-11-10).
    const decisive = new Set((truth.keyEvidence as Array<Record<string, unknown>>).map(entry => entry.id));
    expect((report.evidenceMissed as Array<Record<string, unknown>>).some(entry => decisive.has(entry.id))).toBe(false);
    expect(report.detentions).toEqual([
      { suspectId: 'ines', suspectName: 'Inés Valera', correct: true, withWarrant: true },
    ]);
    expect(report.score).toEqual({
      total: 87, max: 100,
      breakdown: [
        { label: 'Objetivos logrados', points: 50 },
        { label: 'Pruebas halladas', points: 14 },
        { label: 'Detención correcta', points: 15 },
        { label: 'Detenciones erróneas', points: 0 },
        { label: 'Conducta irregular', points: 0 },
        { label: 'Tiempo restante', points: 8 },
      ],
    });
    // La respuesta de cierre trae el mismo informe que la vista.
    expect(closed.report).toEqual(report);
    // Cronología: una entrada por acción confirmada, con minuto y resumen.
    const timeline = report.timeline as Array<Record<string, unknown>>;
    expect(timeline.length).toBeGreaterThan(10);
    // La entrada del informe es FinalReportTimelineEntry: sin el id opaco
    // del evento público (el validador del cliente lo rechazaría).
    expect(Object.keys(timeline[0] as Record<string, unknown>).sort()).toEqual(['minute', 'sequence', 'summary', 'type']);
    expect(timeline[0]).toMatchObject({ sequence: 1, minute: 10, type: 'inspect', summary: 'Inspección en Sala de embalaje.' });
    expect(timeline[timeline.length - 1]).toMatchObject({ minute: 470, type: 'finish', summary: 'La investigación ha concluido.' });
    expect(timeline.map(entry => entry.sequence as number))
      .toEqual([...timeline.map(entry => entry.sequence as number)].sort((a, b) => a - b));
  });

  it('al recargar la vista de una partida cerrada, el informe sigue completo', async () => {
    const runId = await createRun();
    await playRouteA(runId);
    const reloaded = await view(runId);
    expect(isPlayerViewDto(reloaded)).toBe(true);
    const report = reloaded.finalReport as Record<string, unknown>;
    expect(report.result).toBe('complete');
    expect((report.truth as Record<string, unknown>).culpritName).toBe('Inés Valera');
    expect((report.timeline as Array<unknown>).length).toBeGreaterThan(10);
    expect((report.score as Record<string, unknown>).total).toBe(87);
  });

  it('la cronología solo recoge la rama actual, no otras ramas ni otros tipos', async () => {
    const runId = await createRun();
    await act(runId, { type: 'inspect', params: { targetId: 'MAD-SALA' } });
    const stored = await owner.pool.query<{ branch_id: string }>('SELECT branch_id FROM runs WHERE id=$1', [runId]);
    const storedRow = stored.rows[0];
    if (!storedRow) throw new Error('partida sin rama');
    const branchId = storedRow.branch_id;
    const query = (sql: string, params: unknown[]) =>
      owner.pool.query(sql, params) as Promise<{ rows: Array<{ result_public: unknown }> }>;
    const own = await loadRunTimeline(query, runId, branchId);
    expect(own).toHaveLength(1);
    expect(own[0]).toMatchObject({ sequence: 1, minute: 10, type: 'inspect' });
    // Otra rama y otro tipo de registro no aportan nada.
    expect(await loadRunTimeline(query, runId, randomUUID())).toEqual([]);
    await owner.pool.query(
      `INSERT INTO operation_records(id, run_id, owner_id, idempotency_key, kind, request_digest, result_public, branch_id, revision)
       VALUES ($1,$2,$3,$4,'save',$5,$6::jsonb,$7,99)`,
      [randomUUID(), runId, player.id, randomUUID(), 'a'.repeat(64), JSON.stringify({ events: [{ id: 'evt-x', sequence: 99, minute: 99, type: 'inspect', summary: 'Falso.' }] }), branchId]);
    const afterSave = await loadRunTimeline(query, runId, branchId);
    expect(afterSave).toHaveLength(1);
    await owner.pool.query('DELETE FROM operation_records WHERE run_id=$1 AND kind=$2', [runId, 'save']);
  });
});
