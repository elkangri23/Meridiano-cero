import { initialView } from './initial-fixture';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { archiveApi, ArchiveError } from './client';
import type { RunListDto, SessionDto } from '@meridiano/contracts';

const id = '11111111-1111-4111-8111-111111111111';
const session: SessionDto = { profile: { id, displayName: 'Detective sintético', role: 'player' }, csrfToken: 's'.repeat(43) };
const page: RunListDto = { profileId: id, items: [{ runId: id, caseId: 'synthetic', caseTitle: 'Caso sintético', status: 'active', version: 1, createdAt: '2026-01-01T00:00:00.000Z' }], nextCursor: null };
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

describe('T3: lectura inicial sin aceptar replay o progreso', () => {
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
    { ...initialView, version: 2 },
    { ...initialView, clock: { minute: 1, deadlineMinutes: 100 } },
    { ...initialView, pendingRequests: [{ payload: 'SYNTHETIC_PRIVATE' }] },
    { ...initialView, finalReport: { result: 'complete' } },
    { ...initialView, saveCapabilities: { ...initialView.saveCapabilities, canSave: true } },
    { ...initialView, cities: [initialView.position.city, initialView.position.city] },
    { ...initialView, locations: [] },
    { ...initialView, position: { ...initialView.position, city: { ...initialView.position.city, secret: true } } },
  ])('rechaza contrato ajeno al inicio antes de exponerlo', async body => {
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
