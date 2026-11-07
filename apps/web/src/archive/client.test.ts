import { initialView } from './initial-fixture';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { archiveApi, ArchiveError } from './client';
import type { RunListDto, SessionDto } from '@meridiano/contracts';

const id = '11111111-1111-4111-8111-111111111111';
const session: SessionDto = { profile: { id, displayName: 'Detective sintético', role: 'player', emailVerified: false }, csrfToken: 's'.repeat(43) };
const page: RunListDto = { profileId: id, items: [{ runId: id, caseId: 'synthetic', caseTitle: 'Caso sintético', status: 'active', difficulty: 'normal', version: 1, minute: 0, createdAt: '2026-01-01T00:00:00.000Z' }], nextCursor: null };
const signal = () => new AbortController().signal;
function respond(body: unknown, status = 200) {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));
  vi.stubGlobal('fetch', fetcher); return fetcher;
}
afterEach(() => { vi.unstubAllGlobals(); });

describe('T3: frontera HTTP del archivo', () => {
  it('lista válida mantiene mismo origen, no-store y URL de filtro controlada', async () => {
    const fetcher = respond(page);
    expect(await archiveApi.list('active', null, signal())).toEqual(page);
    expect(fetcher.mock.calls[0]?.[0]).toBe('/api/v1/runs?limit=25&status=active');
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ cache: 'no-store', credentials: 'same-origin', redirect: 'error' });
  });
  it('401 en me es sesión ausente; no crea otra sesión', async () => {
    const fetcher = respond({ error: 'synthetic' }, 401);
    expect(await archiveApi.me(signal())).toBeNull(); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('entrada local explícita usa cuerpo vacío y conserva CSRF solo en respuesta validada', async () => {
    const fetcher = respond(session);
    expect(await archiveApi.connect(signal())).toEqual(session);
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ method: 'POST', body: '{}', headers: { 'content-type': 'application/json' } });
  });
  it.each([
    { ...session, token: null }, { ...session, csrfToken: '' },
    { ...session, profile: { ...session.profile, secret: null } },
  ])('rechaza respuesta de sesión inválida sin reflejar payload', async body => {
    respond(body); await expect(archiveApi.me(signal())).rejects.toEqual(new ArchiveError('invalid'));
  });
  it.each([
    { ...page, items: [{ ...page.items[0], engineState: 'SYNTHETIC_PRIVATE' }] },
    { ...page, items: [{ ...page.items[0], status: 'SYNTHETIC_PRIVATE' }] },
    { ...page, items: [page.items[0], page.items[0]] }, { ...page, nextCursor: 'https://invalid.example' },
    { ...page, items: [{ ...page.items[0], createdAt: 'invalid' }] },
  ])('rechaza página fuera de contrato antes de mostrar datos', async body => {
    respond(body); await expect(archiveApi.list('all', null, signal())).rejects.toEqual(new ArchiveError('invalid'));
  });
  it('stream de respuesta excesivo se cancela antes de parsear', async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(131073)); }, cancel });
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response(stream)));
    await expect(archiveApi.list('all', null, signal())).rejects.toEqual(new ArchiveError('invalid')); expect(cancel).toHaveBeenCalled();
  });
  it('cierre exige 204 y transmite CSRF por cabecera, nunca URL', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 })); vi.stubGlobal('fetch', fetcher);
    await archiveApi.logout(session.csrfToken, signal());
    expect(fetcher.mock.calls[0]?.[0]).toBe('/api/v1/auth/logout');
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ method: 'POST', headers: { 'x-csrf-token': session.csrfToken } });
    respond({}, 503); await expect(archiveApi.logout(session.csrfToken, signal())).rejects.toEqual(new ArchiveError('unavailable'));
  });
  it('envío de creación usa identidad/CSRF y cuerpo mínimo, sin leer la proyección como progreso', async () => {
    const fetcher = respond({ syntheticIgnored: true }, 201);
    await archiveApi.create('synthetic', 'synthetic-original-key', session, signal());
    expect(fetcher.mock.calls[0]?.[0]).toBe('/api/v1/runs');
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ method: 'POST', headers: { 'x-expected-profile-id': id, 'x-csrf-token': session.csrfToken }, body: JSON.stringify({ caseId: 'synthetic', idempotencyKey: 'synthetic-original-key' }) });
  });
  it('creación con dificultad la envía en el cuerpo; sin ella no se inventa ninguna', async () => {
    const fetcher = respond({ syntheticIgnored: true }, 201);
    await archiveApi.create('synthetic', 'synthetic-key-easy', session, signal(), { difficulty: 'easy' });
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ body: JSON.stringify({ caseId: 'synthetic', idempotencyKey: 'synthetic-key-easy', difficulty: 'easy' }) });
  });
  it('error de creación conserva el motivo del servidor en lugar del genérico', async () => {
    respond({ error: { code: 'VALIDATION_ERROR', message: 'dificultad no admitida' } }, 400);
    await expect(archiveApi.create('synthetic', 'synthetic-key-bad', session, signal(), { difficulty: 'easy' }))
      .rejects.toEqual(new ArchiveError('unavailable', 'dificultad no admitida'));
  });
  it('borrado de partida exige confirmación; 204 y 404 la dan por borrada', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 })); vi.stubGlobal('fetch', fetcher);
    await archiveApi.deleteRun(id, session, signal());
    expect(fetcher.mock.calls[0]?.[0]).toBe('/api/v1/runs/' + id);
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ method: 'DELETE', headers: { 'x-expected-profile-id': id, 'x-csrf-token': session.csrfToken }, body: JSON.stringify({ confirm: true }) });
    respond(null, 404);
    await expect(archiveApi.deleteRun(id, session, signal())).resolves.toBeUndefined();
    respond({}, 503);
    await expect(archiveApi.deleteRun(id, session, signal())).rejects.toEqual(new ArchiveError('unavailable'));
  });
  it('lookup con 404 es ausencia provisional; clave nunca se coloca en URL', async () => {
    const fetcher = respond({}, 404);
    expect(await archiveApi.lookup('synthetic-original-key', session, signal())).toBeNull();
    expect(fetcher.mock.calls[0]?.[0]).toBe('/api/v1/run-creations/lookup');
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ method: 'POST', body: JSON.stringify({ idempotencyKey: 'synthetic-original-key' }) });
  });
  it('rechaza catálogo con reglas privadas o un lookup que incluya estado interno', async () => {
    respond({ items: [{ caseId: 'synthetic', solution: 'SYNTHETIC_PRIVATE' }], nextCursor: null });
    await expect(archiveApi.cases(signal())).rejects.toEqual(new ArchiveError('invalid'));
    respond({ schemaVersion: 1, kind: 'create_run', status: 'committed', runId: id, engineState: 'SYNTHETIC_PRIVATE' });
    await expect(archiveApi.lookup('synthetic-original-key', session, signal())).rejects.toEqual(new ArchiveError('invalid'));
  });

});

describe('T4-08: frontera HTTP de generación', () => {
  const job = { jobId: id, status: 'queued', stage: 0, crimeType: 'fraude', contentRating: 'familiar', duration: 'short', caseId: null, error: null, progress: {}, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', startedAt: null, finishedAt: null };
  it('lista de jobs valida el contrato y no acepta estado interno', async () => {
    const fetcher = respond({ items: [job] });
    expect(await archiveApi.generationJobs(signal())).toEqual({ items: [job] });
    expect(fetcher.mock.calls[0]?.[0]).toBe('/api/v1/generation/jobs');
    respond({ items: [{ ...job, draft: 'SYNTHETIC_PRIVATE' }] });
    await expect(archiveApi.generationJobs(signal())).rejects.toEqual(new ArchiveError('invalid'));
  });
  it('crear job envía cuerpo mínimo con CSRF y devuelve 201', async () => {
    const fetcher = respond(job, 201);
    expect(await archiveApi.createGenerationJob({ crimeType: 'fraude', contentRating: 'familiar', duration: 'short' }, session, signal())).toEqual(job);
    expect(fetcher.mock.calls[0]?.[0]).toBe('/api/v1/generation/jobs');
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ method: 'POST', headers: { 'x-expected-profile-id': id, 'x-csrf-token': session.csrfToken }, body: JSON.stringify({ crimeType: 'fraude', contentRating: 'familiar', duration: 'short' }) });
  });
  it('crear job sin delito no inventa ninguno (el servidor sortea)', async () => {
    const fetcher = respond(job, 201);
    await archiveApi.createGenerationJob({ contentRating: 'familiar', duration: 'medium' }, session, signal());
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ body: JSON.stringify({ contentRating: 'familiar', duration: 'medium' }) });
  });
  it('el límite 429 conserva el motivo del servidor', async () => {
    respond({ error: { code: 'GENERATION_LIMIT', message: 'Ya tienes una generación en curso.' } }, 429);
    await expect(archiveApi.createGenerationJob({ crimeType: 'fraude' }, session, signal()))
      .rejects.toEqual(new ArchiveError('unavailable', 'Ya tienes una generación en curso.'));
  });
  it('cancelar job usa el id en la ruta y devuelve el job actualizado', async () => {
    const cancelled = { ...job, status: 'cancelled', finishedAt: '2026-01-01T00:01:00.000Z' };
    const fetcher = respond(cancelled);
    expect(await archiveApi.cancelGenerationJob(id, session, signal())).toEqual(cancelled);
    expect(fetcher.mock.calls[0]?.[0]).toBe('/api/v1/generation/jobs/' + id + '/cancel');
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ method: 'POST', headers: { 'x-csrf-token': session.csrfToken } });
  });
});

describe('T4-05: frontera HTTP de intercambio de expedientes', () => {
  const imported = { caseId: 'importado-1a2b3c4d', title: 'Caso importado', canStart: true, warnings: [], alreadyExisted: false };
  it('exportar descarga el fichero del expediente propio con GET', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('{"version":"1.0.0"}', { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetcher);
    const blob = await archiveApi.exportCase('generado-1', session, signal());
    expect(await blob.text()).toBe('{"version":"1.0.0"}');
    expect(fetcher.mock.calls[0]?.[0]).toBe('/api/v1/cases/generado-1/export');
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ credentials: 'same-origin', cache: 'no-store', redirect: 'error' });
    expect(fetcher.mock.calls[0]?.[1]?.method).toBeUndefined();
  });
  it('exportar un expediente ajeno conserva el motivo 403 del servidor', async () => {
    respond({ error: { code: 'FORBIDDEN', message: 'Este expediente no es tuyo: solo su dueño puede descargarlo.' } }, 403);
    await expect(archiveApi.exportCase('generado-1', session, signal()))
      .rejects.toEqual(new ArchiveError('unavailable', 'Este expediente no es tuyo: solo su dueño puede descargarlo.'));
  });
  it('exportar rechaza identificadores que intenten modificar la ruta', async () => {
    const fetcher = respond('{}');
    await expect(archiveApi.exportCase('../me', session, signal())).rejects.toEqual(new ArchiveError('invalid'));
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('importar envía el fichero tal cual y devuelve el resultado validado', async () => {
    const fetcher = respond(imported, 201);
    expect(await archiveApi.importCase('{"version":"1.0.0"}', session, signal())).toEqual(imported);
    expect(fetcher.mock.calls[0]?.[0]).toBe('/api/v1/cases/import');
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ method: 'POST', headers: { 'x-expected-profile-id': id, 'x-csrf-token': session.csrfToken }, body: '{"version":"1.0.0"}' });
  });
  it('importar un fichero inválido conserva el motivo 400 del servidor', async () => {
    respond({ error: { code: 'VALIDATION_ERROR', message: 'Checksum no coincide: posible corrupción de datos' } }, 400);
    await expect(archiveApi.importCase('{"version":"1.0.0"}', session, signal()))
      .rejects.toEqual(new ArchiveError('unavailable', 'Checksum no coincide: posible corrupción de datos'));
  });
  it('importar rechaza un resultado fuera de contrato antes de mostrarlo', async () => {
    respond({ ...imported, solution: 'SYNTHETIC_PRIVATE' }, 201);
    await expect(archiveApi.importCase('{"version":"1.0.0"}', session, signal())).rejects.toEqual(new ArchiveError('invalid'));
  });
});

describe('T3: lectura de partida sin aceptar replay ni contrato ajeno', () => {
  it('consulta GET del ID elegido y conserva las garantías del transporte', async () => {
    const fetcher = respond(initialView);
    expect(await archiveApi.initial(initialView.runId, signal())).toEqual(initialView);
    expect(fetcher.mock.calls[0]?.[0]).toBe('/api/v1/runs/' + initialView.runId);
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ credentials: 'same-origin', cache: 'no-store', redirect: 'error' });
    expect(fetcher.mock.calls[0]?.[1]?.method).toBeUndefined();
  });
  it.each([
    { ...initialView, engineState: 'SYNTHETIC_PRIVATE' },
    { ...initialView, replayed: true },
    { ...initialView, pendingRequests: [{ payload: 'SYNTHETIC_PRIVATE' }] },
    { ...initialView, finalReport: { result: 'complete' } },
    { ...initialView, cities: [] },
    { ...initialView, locations: [] },
    { ...initialView, position: { ...initialView.position, city: { ...initialView.position.city, secret: true } } },
  ])('rechaza contrato ajeno a la partida antes de exponerlo', async body => {
    respond(body); await expect(archiveApi.initial(initialView.runId, signal())).rejects.toEqual(new ArchiveError('invalid'));
  });
  it('no acepta respuesta de otra partida ni fabrica inicio cuando falla la API', async () => {
    respond({ ...initialView, runId: id });
    await expect(archiveApi.initial(initialView.runId, signal())).rejects.toEqual(new ArchiveError('invalid'));
    respond({}, 503); await expect(archiveApi.initial(initialView.runId, signal())).rejects.toEqual(new ArchiveError('unavailable'));
  });
  it('rechaza identificadores que intenten modificar la ruta sin petición HTTP', async () => {
    const fetcher = respond(initialView);
    await expect(archiveApi.initial('../me', signal())).rejects.toEqual(new ArchiveError('invalid'));
    expect(fetcher).not.toHaveBeenCalled();
  });
});
