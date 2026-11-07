// Intercambio de expedientes (T4-05 expuesto): exportar solo el dueño
// autorizado (DEC-011) e importar con validación v1.5 antes de jugarse.
// La definición de prueba es un expediente generado real (generado-21d02570,
// volcado de producción tras la vuelta 3; contenido real en conocimientos),
// guardada como fixture en ./fixtures/import-export-case.json: valida con
// v1.5 y no depende del generador ni de ningún LLM.
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.ts';
import { readAppConfig, readDatabaseUrl } from '../config.ts';
import { createDatabase } from '../database/connection.ts';
import { migrate } from '../database/migrations.ts';
import { tokenDigest } from '../auth/store.ts';
import { createTelemetry } from '../telemetry.ts';
import { hashDefinition } from '@meridiano/case-schema/server';
import { computeChecksum, createExport, validateImport } from '@meridiano/generator';
import { astrolabioDefinition } from '@meridiano/engine';
import { Writable } from 'node:stream';

const fixtureDefinition = JSON.parse(readFileSync(new URL('./fixtures/import-export-case.json', import.meta.url), 'utf-8')) as Record<string, unknown>;

function clonedDefinition(caseId: string): Record<string, unknown> {
  const def = structuredClone(fixtureDefinition);
  def.id = caseId;
  return def;
}

describe('Intercambio de expedientes (T4-05 expuesto)', () => {
  const config = readAppConfig(process.env);
  const database = createDatabase(config.databaseUrl);
  const owner = createDatabase(readDatabaseUrl(process.env.DATABASE_MIGRATION_URL));
  const lines: string[] = [];
  const sink = new Writable({ write(chunk, _encoding, done) { lines.push(String(chunk)); done(); } });
  const app = createApp({ config, database, telemetry: createTelemetry(sink) });
  const player = { id: randomUUID(), token: randomBytes(32).toString('base64url'), csrf: randomBytes(32).toString('base64url') };
  const other = { id: randomUUID(), token: randomBytes(32).toString('base64url'), csrf: randomBytes(32).toString('base64url') };
  const limited = { id: randomUUID(), token: randomBytes(32).toString('base64url'), csrf: randomBytes(32).toString('base64url') };
  const headersFor = (user: typeof player) => ({ cookie: 'meridiano_session=' + user.token, origin: config.origin, 'x-csrf-token': user.csrf });
  const seedCaseId = 'generado-21d02570';
  const seedDefinition = clonedDefinition(seedCaseId);
  const seedExport = createExport(seedDefinition, { difficulty: 'normal', duration: 'medium', region: 'europa', seed: seedDefinition.seed as number, catalogVersion: seedDefinition.catalogVersion as string });
  if (!seedExport.success || !seedExport.export) throw new Error('No se pudo construir el fichero de prueba: ' + seedExport.errors.join(' '));
  const seedFile = JSON.stringify(seedExport.export);
  const jsonHeadersFor = (user: typeof player) => ({ ...headersFor(user), 'content-type': 'application/json' });

  async function seedCase(caseId: string, ownerId: string, definition: Record<string, unknown>, title?: string) {
    await owner.pool.query(
      `INSERT INTO generated_cases(case_id,title,crime_type,content_rating,duration,definition,definition_hash,job_id,created_by)
       VALUES ($1,$2,'robo','familiar','medium',$3,$4,NULL,$5)`,
      [caseId, title ?? caseId, JSON.stringify(definition), hashDefinition(definition as never), ownerId]);
  }

  beforeAll(async () => {
    await migrate(readDatabaseUrl(process.env.DATABASE_MIGRATION_URL));
    for (const user of [player, other, limited]) {
      await owner.pool.query('INSERT INTO profiles(id,local_key,display_name) VALUES ($1,$2,$3)', [user.id, 'exchange-synthetic-' + user.id, 'Detective sintético']);
      await owner.pool.query("INSERT INTO sessions(token_hash,profile_id,csrf_token,expires_at) VALUES ($1,$2,$3,now()+interval '8 hours')", [tokenDigest(user.token), user.id, user.csrf]);
    }
    await seedCase(seedCaseId, player.id, seedDefinition);
    for (let i = 0; i < 10; i++) {
      await seedCase(`generado-limit-${i}`, limited.id, clonedDefinition(`generado-limit-${i}`));
    }
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
    for (const user of [player, other, limited]) {
      await owner.pool.query('DELETE FROM operation_records WHERE owner_id=$1', [user.id]);
      await owner.pool.query('DELETE FROM run_creations WHERE owner_id=$1', [user.id]);
      await owner.pool.query('DELETE FROM runs WHERE owner_id=$1', [user.id]);
      await owner.pool.query('DELETE FROM generated_cases WHERE created_by=$1', [user.id]);
      await owner.pool.query('DELETE FROM sessions WHERE profile_id=$1', [user.id]);
      await owner.pool.query('DELETE FROM profiles WHERE id=$1', [user.id]);
    }
    await database.pool.end(); await owner.pool.end();
  });

  it('el catálogo marca ownedByMe solo para el dueño', async () => {
    const mine = await app.inject({ method: 'GET', url: '/api/v1/cases', headers: headersFor(player) });
    expect(mine.statusCode).toBe(200);
    const mineSeed = mine.json().items.find((item: { caseId: string }) => item.caseId === seedCaseId);
    expect(mineSeed.ownedByMe).toBe(true);
    expect(mine.json().items.find((item: { caseId: string }) => item.caseId === astrolabioDefinition.id).ownedByMe).toBe(false);
    const theirs = await app.inject({ method: 'GET', url: '/api/v1/cases', headers: headersFor(other) });
    expect(theirs.json().items.find((item: { caseId: string }) => item.caseId === seedCaseId).ownedByMe).toBe(false);
  });

  it('exportar el expediente propio descarga un fichero válido', async () => {
    const response = await app.inject({ method: 'GET', url: `/api/v1/cases/${seedCaseId}/export`, headers: headersFor(player) });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-disposition']).toContain('attachment;');
    expect(response.headers['content-disposition']).toContain(`meridiano-caso-${seedCaseId}.json`);
    const parsed = JSON.parse(response.body);
    expect(parsed.version).toBe('1.0.0');
    expect(parsed.caseId).toBe(seedCaseId);
    expect(parsed.definition.id).toBe(seedCaseId);
    expect(validateImport(parsed).success).toBe(true);
  });

  it('exportar el expediente ajeno o el fijo es 403 FORBIDDEN', async () => {
    const theirs = await app.inject({ method: 'GET', url: `/api/v1/cases/${seedCaseId}/export`, headers: headersFor(other) });
    expect(theirs.statusCode).toBe(403);
    expect(theirs.json().error.code).toBe('FORBIDDEN');
    const fixed = await app.inject({ method: 'GET', url: `/api/v1/cases/${astrolabioDefinition.id}/export`, headers: headersFor(player) });
    expect(fixed.statusCode).toBe(403);
    expect(fixed.json().error.code).toBe('FORBIDDEN');
    const missing = await app.inject({ method: 'GET', url: '/api/v1/cases/generado-no-existe/export', headers: headersFor(player) });
    expect(missing.statusCode).toBe(404);
  });

  it('exportar sin sesión es 401', async () => {
    const response = await app.inject({ method: 'GET', url: `/api/v1/cases/${seedCaseId}/export` });
    expect(response.statusCode).toBe(401);
  });

  let importedCaseId = '';
  it('importar el fichero crea una copia propia jugable (el id ya existe)', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/v1/cases/import', headers: jsonHeadersFor(other), payload: seedFile });
    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.canStart).toBe(true);
    expect(body.alreadyExisted).toBe(false);
    expect(body.caseId).toMatch(/^importado-[a-f0-9]{8}$/);
    expect(body.warnings.join(' ')).toContain(seedCaseId);
    importedCaseId = body.caseId;
    const summary = await app.inject({ method: 'GET', url: `/api/v1/cases/${importedCaseId}`, headers: headersFor(other) });
    expect(summary.statusCode).toBe(200);
    expect(summary.json().canStart).toBe(true);
    expect(summary.json().ownedByMe).toBe(true);
  });

  it('crear una partida sobre el caso importado funciona', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/v1/runs', headers: headersFor(other),
      payload: { caseId: importedCaseId, idempotencyKey: 'import-export-test-run-1', difficulty: 'normal' } });
    expect(response.statusCode).toBe(201);
    expect(response.json().runId).toBeTruthy();
  });

  it('reimportar el propio fichero exportado no duplica', async () => {
    const exported = await app.inject({ method: 'GET', url: `/api/v1/cases/${importedCaseId}/export`, headers: headersFor(other) });
    expect(exported.statusCode).toBe(200);
    const again = await app.inject({ method: 'POST', url: '/api/v1/cases/import', headers: jsonHeadersFor(other), payload: exported.body });
    expect(again.statusCode).toBe(200);
    expect(again.json().alreadyExisted).toBe(true);
    expect(again.json().caseId).toBe(importedCaseId);
  });

  it('reimportar la copia con título distinto tampoco duplica', async () => {
    // El fichero con el título cambiado y el id ya existente se guarda
    // como importado-<hex>. Volver a importarlo debe devolver esa misma
    // copia, no crear otra.
    const modified = structuredClone(seedExport.export) as unknown as Record<string, unknown>;
    const definition = modified.definition as Record<string, unknown>;
    const briefing = definition.briefing as Record<string, unknown>;
    briefing.title = 'Caso importado de prueba';
    modified.checksum = computeChecksum(definition);
    const first = await app.inject({ method: 'POST', url: '/api/v1/cases/import', headers: jsonHeadersFor(other), payload: JSON.stringify(modified) });
    expect(first.statusCode).toBe(201);
    expect(first.json().caseId).toMatch(/^importado-[a-f0-9]{8}$/);
    expect(first.json().caseId).not.toBe(importedCaseId);
    const again = await app.inject({ method: 'POST', url: '/api/v1/cases/import', headers: jsonHeadersFor(other), payload: JSON.stringify(modified) });
    expect(again.statusCode).toBe(200);
    expect(again.json().alreadyExisted).toBe(true);
    expect(again.json().caseId).toBe(first.json().caseId);
  });

  it('importar con checksum roto o JSON inválido es 400 sin registrar nada', async () => {
    const before = await owner.pool.query('SELECT count(*)::text AS n FROM generated_cases WHERE created_by=$1 AND case_id LIKE $2', [other.id, 'importado-%']);
    const tampered = structuredClone(seedExport.export) as unknown as Record<string, unknown>;
    (tampered.definition as Record<string, unknown>).solution = 'solución manipulada';
    const badChecksum = await app.inject({ method: 'POST', url: '/api/v1/cases/import', headers: jsonHeadersFor(other), payload: JSON.stringify(tampered) });
    expect(badChecksum.statusCode).toBe(400);
    expect(badChecksum.json().error.code).toBe('VALIDATION_ERROR');
    const badJson = await app.inject({ method: 'POST', url: '/api/v1/cases/import',
      headers: { ...headersFor(other), 'content-type': 'application/json' }, payload: '{no-es-json' });
    expect(badJson.statusCode).toBe(400);
    const after = await owner.pool.query('SELECT count(*)::text AS n FROM generated_cases WHERE created_by=$1 AND case_id LIKE $2', [other.id, 'importado-%']);
    expect(Number(after.rows[0]?.n ?? 0)).toBe(Number(before.rows[0]?.n ?? 0));
  });

  it('importar un expediente que no pasa v1.5 o sin catalogMeta es 400', async () => {
    const rejected = structuredClone(seedExport.export) as unknown as Record<string, unknown>;
    ((rejected.definition as Record<string, unknown>).validationReport as Record<string, unknown>).status = 'rejected';
    const fixed = JSON.stringify({ ...rejected, checksum: computeChecksum(rejected.definition) });
    const invalid = await app.inject({ method: 'POST', url: '/api/v1/cases/import', headers: jsonHeadersFor(other), payload: fixed });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json().error.code).toBe('VALIDATION_ERROR');
    const noMeta = structuredClone(seedExport.export) as unknown as Record<string, unknown>;
    delete (noMeta.definition as Record<string, unknown>).catalogMeta;
    const noMetaFile = JSON.stringify({ ...noMeta, checksum: computeChecksum(noMeta.definition) });
    const noMetaResponse = await app.inject({ method: 'POST', url: '/api/v1/cases/import', headers: jsonHeadersFor(other), payload: noMetaFile });
    expect(noMetaResponse.statusCode).toBe(400);
    expect(noMetaResponse.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('importar un fichero de más de 2 MiB es 413', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/v1/cases/import',
      headers: { ...headersFor(other), 'content-type': 'application/json' }, payload: 'x'.repeat(2_200_000) });
    expect(response.statusCode).toBe(413);
    expect(response.json().error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('importar sin CSRF es 403 y con 10 importaciones al día es 429', async () => {
    const noCsrf = await app.inject({ method: 'POST', url: '/api/v1/cases/import',
      headers: { cookie: headersFor(other).cookie, origin: config.origin }, payload: seedFile });
    expect(noCsrf.statusCode).toBe(403);
    expect(noCsrf.json().error.code).toBe('CSRF_REJECTED');
    // El fichero sin modificar ya lo tiene `limited` (sus 10 filas semilla
    // son clones del mismo expediente salvo el id): reimportarlo sería
    // deduplicación, no una importación nueva. La cuota se prueba con un
    // contenido que no tenga.
    const fresh = structuredClone(seedExport.export) as unknown as Record<string, unknown>;
    const freshDefinition = fresh.definition as Record<string, unknown>;
    (freshDefinition.briefing as Record<string, unknown>).title = 'Expediente nuevo para la cuota';
    fresh.checksum = computeChecksum(freshDefinition);
    const limitedResponse = await app.inject({ method: 'POST', url: '/api/v1/cases/import', headers: jsonHeadersFor(limited), payload: JSON.stringify(fresh) });
    expect(limitedResponse.statusCode).toBe(429);
    expect(limitedResponse.json().error.code).toBe('GENERATION_LIMIT');
  });
});
