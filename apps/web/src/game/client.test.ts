import { initialView } from '../archive/initial-fixture';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { gameApi, GameError } from './client';
import type { ActionResponseDto, SaveLoadResponseDto, SessionDto } from '@meridiano/contracts';

const id = '11111111-1111-4111-8111-111111111111';
const saveId = '44444444-4444-4444-8444-444444444444';
const key = '55555555-5555-4555-8555-555555555555';
const session: SessionDto = { profile: { id, displayName: 'Detective sintético', role: 'player', emailVerified: false }, csrfToken: 's'.repeat(43) };
const action = { type: 'inspect', params: { targetId: 'synthetic-room' } } as const;
const actionResponse: ActionResponseDto = { ...initialView, outcome: 'applied',
  events: [{ id: 'e1', sequence: 1, minute: 10, type: 'inspect', summary: 'La sala queda inspeccionada.' }] };
const loadResponse: SaveLoadResponseDto = { ...initialView, operationId: key, newBranchId: '66666666-6666-4666-8666-666666666666' };
const saveList = { items: [{ saveId, name: 'Punto sintético', createdAt: '2026-01-01T00:00:00.000Z',
  sourceRevision: 2, metadataVersion: 1, runId: initialView.runId, cityName: 'Ciudad sintética', minute: 10, status: 'active', canLoad: true }],
  manualLimit: 10, manualCount: 1, nextCursor: null };
const signal = () => new AbortController().signal;
function respond(body: unknown, status = 200) {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));
  vi.stubGlobal('fetch', fetcher); return fetcher;
}
afterEach(() => { vi.unstubAllGlobals(); });

/** Cabeceras de la petición capturada, como objeto plano (el cliente las envía como Headers). */
function headersOf(init: RequestInit | undefined): Record<string, string> {
  const raw = init?.headers;
  return raw instanceof Headers ? Object.fromEntries(raw.entries()) : { ...(raw as Record<string, string> | undefined) };
}

describe('T3: frontera HTTP de la pantalla de juego', () => {
  it('vista GET del ID elegido con las garantías del transporte', async () => {
    const fetcher = respond(initialView);
    expect(await gameApi.view(initialView.runId, signal())).toEqual(initialView);
    expect(fetcher.mock.calls[0]?.[0]).toBe('/api/v1/runs/' + initialView.runId);
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ credentials: 'same-origin', cache: 'no-store', redirect: 'error' });
    expect(fetcher.mock.calls[0]?.[1]?.method).toBeUndefined();
  });
  it('vista rechaza identificadores inválidos sin petición HTTP y respuestas de otra partida', async () => {
    const fetcher = respond(initialView);
    await expect(gameApi.view('../me', signal())).rejects.toEqual(new GameError('invalid'));
    expect(fetcher).not.toHaveBeenCalled();
    respond({ ...initialView, runId: id });
    await expect(gameApi.view(initialView.runId, signal())).rejects.toEqual(new GameError('invalid'));
  });
  it('vista traduce 404 y 503 sin inventar progreso', async () => {
    respond({}, 404); await expect(gameApi.view(initialView.runId, signal())).rejects.toEqual(new GameError('not_found'));
    respond({}, 503); await expect(gameApi.view(initialView.runId, signal())).rejects.toEqual(new GameError('unavailable'));
  });
  it('catálogo lista casos y rechaza reglas privadas', async () => {
    const caseItem = { caseId: 'synthetic', title: 'Caso sintético', contentMode: 'fixed', crimeType: 'robo', contentRating: 'familiar', difficulty: 'normal',
      explorationMode: 'guided', deadlineMinutes: 480, contentVersion: 14, canStart: true, hasMultipleRoutes: true, ownedByMe: false } as const;
    const fetcher = respond({ items: [caseItem], nextCursor: null });
    expect(await gameApi.catalog(signal())).toEqual([caseItem]);
    expect(fetcher.mock.calls[0]?.[0]).toBe('/api/v1/cases');
    respond({ items: [{ ...caseItem, solution: 'SYNTHETIC_PRIVATE' }], nextCursor: null });
    await expect(gameApi.catalog(signal())).rejects.toEqual(new GameError('invalid'));
  });
  it('carrera lista el perfil y rechaza rangos inventados', async () => {
    const emptyCareer = {
      rank: 'Aspirante', points: 0, prestige: 0, integrity: 0, trust: 0,
      prestigeLabel: 'Discreta', integrityLabel: 'Discreta', trustLabel: 'Discreta',
      totalCases: 0, completedCases: 0, medals: [], countries: [], places: [],
      sanctions: [], results: [],
    };
    const fetcher = respond(emptyCareer);
    expect(await gameApi.career(signal())).toEqual(emptyCareer);
    expect(fetcher.mock.calls[0]?.[0]).toBe('/api/v1/career');
    respond({ ...emptyCareer, rank: 'Superinspector' });
    await expect(gameApi.career(signal())).rejects.toEqual(new GameError('invalid'));
  });
  it('preview envía confirm:false con CSRF e identidad, sin versión ni clave', async () => {
    const fetcher = respond({ ...actionResponse, outcome: 'confirmation_required', requiresConfirmation: true });
    expect(await gameApi.preview(initialView.runId, action, session, signal())).toMatchObject({ outcome: 'confirmation_required' });
    expect(fetcher.mock.calls[0]?.[0]).toBe('/api/v1/runs/' + initialView.runId + '/action');
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ method: 'POST',
      body: JSON.stringify({ action, confirm: false }) });
    expect(headersOf(fetcher.mock.calls[0]?.[1])).toEqual({ 'content-type': 'application/json', 'x-csrf-token': session.csrfToken, 'x-expected-profile-id': id, 'x-meridiano-language': 'es' });
  });
  it('commit envía confirm:true con versión y clave, y traduce el conflicto de versión', async () => {
    const fetcher = respond(actionResponse);
    expect(await gameApi.commit(initialView.runId, action, 1, key, session, signal())).toEqual(actionResponse);
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ method: 'POST',
      body: JSON.stringify({ action, confirm: true, expectedVersion: 1, idempotencyKey: key }) });
    respond({ error: { code: 'VERSION_CONFLICT' } }, 409);
    await expect(gameApi.commit(initialView.runId, action, 1, key, session, signal())).rejects.toEqual(new GameError('version_conflict'));
  });
  it('commit rechaza clave de idempotencia no UUID sin petición HTTP', async () => {
    const fetcher = respond(actionResponse);
    await expect(gameApi.commit(initialView.runId, action, 1, 'no-uuid', session, signal())).rejects.toEqual(new GameError('invalid'));
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('guardados se listan y se rechaza un límite distinto de 10', async () => {
    const fetcher = respond(saveList);
    expect(await gameApi.saves(initialView.runId, signal())).toEqual(saveList);
    expect(fetcher.mock.calls[0]?.[0]).toBe('/api/v1/runs/' + initialView.runId + '/saves');
    respond({ ...saveList, manualLimit: 5 });
    await expect(gameApi.saves(initialView.runId, signal())).rejects.toEqual(new GameError('invalid'));
  });
  it('crear guardado envía nombre, versión y clave; con reemplazo añade replaceSaveId', async () => {
    const fetcher = respond(saveList.items[0], 201);
    expect(await gameApi.createSave(initialView.runId, 'Punto sintético', 1, key, null, session, signal())).toEqual(saveList.items[0]);
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ method: 'POST',
      body: JSON.stringify({ name: 'Punto sintético', expectedVersion: 1, idempotencyKey: key }) });
    const fetcher2 = respond(saveList.items[0], 201);
    await gameApi.createSave(initialView.runId, 'Punto sintético', 1, key, saveId, session, signal());
    expect(fetcher2.mock.calls[0]?.[1]).toMatchObject({ body: JSON.stringify({ name: 'Punto sintético', expectedVersion: 1, idempotencyKey: key, replaceSaveId: saveId }) });
    respond({ error: { code: 'SAVE_LIMIT_REACHED' } }, 409);
    await expect(gameApi.createSave(initialView.runId, 'Otro', 1, key, null, session, signal())).rejects.toEqual(new GameError('save_limit'));
  });
  it('crear guardado rechaza nombre vacío sin petición HTTP', async () => {
    const fetcher = respond(saveList.items[0], 201);
    await expect(gameApi.createSave(initialView.runId, '   ', 1, key, null, session, signal())).rejects.toEqual(new GameError('invalid'));
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('cargar guardado envía versión y clave, y traduce guardado incompatible', async () => {
    const fetcher = respond(loadResponse);
    expect(await gameApi.loadSave(initialView.runId, saveId, 2, key, session, signal())).toEqual(loadResponse);
    expect(fetcher.mock.calls[0]?.[0]).toBe(`/api/v1/runs/${initialView.runId}/saves/${saveId}/load`);
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ method: 'POST',
      body: JSON.stringify({ expectedVersion: 2, idempotencyKey: key }) });
    respond({ error: { code: 'SAVE_INCOMPATIBLE' } }, 422);
    await expect(gameApi.loadSave(initialView.runId, saveId, 2, key, session, signal())).rejects.toEqual(new GameError('save_incompatible'));
  });
  it('borrar guardado exige 204 y traduce partida cerrada leyendo el error antes', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 })); vi.stubGlobal('fetch', fetcher);
    await gameApi.deleteSave(initialView.runId, saveId, 1, key, session, signal());
    expect(fetcher.mock.calls[0]?.[0]).toBe(`/api/v1/runs/${initialView.runId}/saves/${saveId}`);
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ method: 'DELETE',
      body: JSON.stringify({ expectedSaveVersion: 1, idempotencyKey: key }) });
    expect(headersOf(fetcher.mock.calls[0]?.[1])).toEqual({ 'content-type': 'application/json', 'x-csrf-token': session.csrfToken, 'x-expected-profile-id': id, 'x-meridiano-language': 'es' });
    respond({ error: { code: 'RUN_CLOSED' } }, 409);
    await expect(gameApi.deleteSave(initialView.runId, saveId, 1, key, session, signal())).rejects.toEqual(new GameError('run_closed'));
  });
  it('stream de respuesta excesivo se cancela antes de parsear', async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(131073)); }, cancel });
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response(stream)));
    await expect(gameApi.view(initialView.runId, signal())).rejects.toEqual(new GameError('invalid')); expect(cancel).toHaveBeenCalled();
  });
});
