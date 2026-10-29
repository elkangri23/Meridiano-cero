import { initialView } from './initial-fixture';
import { describe, expect, it, vi } from 'vitest';
import type { RunListDto, SessionDto } from '@meridiano/contracts';
import { createArchiveModel } from './model';
import type { ArchiveApi } from './client';

const id = '11111111-1111-4111-8111-111111111111';
const runId = '22222222-2222-4222-8222-222222222222';
const identity: SessionDto = { profile: { id, displayName: 'Detective sintético', role: 'player' }, csrfToken: 's'.repeat(43) };
const page: RunListDto = { profileId: id, items: [], nextCursor: null };
function api() {
  return { initial: vi.fn<ArchiveApi['initial']>(), cases: vi.fn<ArchiveApi['cases']>().mockResolvedValue({ items: [], nextCursor: null }),
    create: vi.fn<ArchiveApi['create']>().mockResolvedValue(), lookup: vi.fn<ArchiveApi['lookup']>().mockResolvedValue(null),
    me: vi.fn<ArchiveApi['me']>().mockResolvedValue(identity), connect: vi.fn<ArchiveApi['connect']>().mockResolvedValue(identity),
    list: vi.fn<ArchiveApi['list']>().mockResolvedValue(page), logout: vi.fn<ArchiveApi['logout']>().mockResolvedValue() };
}
function deferred<T>() {
  let resolve: (value: T) => void = () => { throw new Error('Not initialized'); };
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

describe('T3: archivo, cuenta y respuestas tardías', () => {
  it('sesión ausente no autentica automáticamente ni lista recursos', async () => {
    const transport = api(); transport.me.mockResolvedValue(null);
    const model = createArchiveModel(transport); await model.refresh();
    expect(model.getSnapshot().phase).toBe('signed_out');
    expect(transport.connect).not.toHaveBeenCalled(); expect(transport.list).not.toHaveBeenCalled();
  });
  it('entrada explícita obtiene archivo propio y nunca expone CSRF en estado visible', async () => {
    const transport = api(); const model = createArchiveModel(transport); await model.connect();
    expect(model.getSnapshot()).toMatchObject({ phase: 'ready', profile: identity.profile, page });
    expect(JSON.stringify(model.getSnapshot())).not.toContain(identity.csrfToken);
    expect(transport.connect).toHaveBeenCalledTimes(1);
  });
  it('cambio de filtro cancela lectura anterior y descarta respuesta incluso si ignora abort', async () => {
    const transport = api(); const model = createArchiveModel(transport); await model.refresh();
    const delayed = deferred<RunListDto>(); transport.list.mockImplementationOnce(() => delayed.promise);
    const first = model.filter('active'); const previousSignal = transport.list.mock.calls.at(-1)?.[2];
    await model.filter('closed');
    delayed.resolve({ ...page, nextCursor: 'v1.active.' + runId }); await first;
    expect(previousSignal?.aborted).toBe(true);
    expect(model.getSnapshot()).toMatchObject({ phase: 'ready', filter: 'closed', page });
  });
  it('respuesta de conexión posterior a cierre no recupera perfil o datos', async () => {
    const transport = api(); const delayed = deferred<SessionDto>(); transport.connect.mockReturnValue(delayed.promise);
    const model = createArchiveModel(transport); const connecting = model.connect();
    await model.logout(); delayed.resolve(identity); await connecting;
    expect(model.getSnapshot()).toMatchObject({ phase: 'signed_out', profile: null, page: null });
    expect(transport.list).not.toHaveBeenCalled();
  });
  it('cierre incierto oculta datos y permite repetir el cierre sin reabrir sesión', async () => {
    const transport = api(); const model = createArchiveModel(transport); await model.refresh();
    transport.logout.mockRejectedValueOnce(new Error('synthetic-network-failure'));
    await model.logout();
    expect(model.getSnapshot()).toMatchObject({ phase: 'logout_failed', profile: null, page: null });
    expect(JSON.stringify(model.getSnapshot())).not.toContain(identity.csrfToken);
    await model.refresh();
    expect(model.getSnapshot().phase).toBe('signed_out'); expect(transport.me).toHaveBeenCalledTimes(1);
    expect(transport.logout).toHaveBeenCalledTimes(2); expect(transport.logout.mock.calls[1]?.[0]).toBe(identity.csrfToken);
  });
  it('página de otra cuenta no se presenta bajo perfil anterior', async () => {
    const transport = api(); transport.list.mockResolvedValue({ ...page, profileId: runId });
    const model = createArchiveModel(transport); await model.refresh();
    expect(model.getSnapshot()).toMatchObject({ phase: 'error', profile: null, page: null });
  });
  it('fallo de autenticación no se reenvía; GET me puede recuperar sesión creada', async () => {
    const transport = api(); transport.connect.mockRejectedValue(new Error('synthetic-lost-response'));
    const model = createArchiveModel(transport); await model.connect(); await model.refresh();
    expect(model.getSnapshot().phase).toBe('ready'); expect(transport.connect).toHaveBeenCalledTimes(1); expect(transport.me).toHaveBeenCalledTimes(1);
  });
  it('anterior/siguiente usan cursores previos y cambiar filtro reinicia recorrido', async () => {
    const transport = api(); transport.list.mockResolvedValueOnce({ ...page, nextCursor: 'v1.all.' + runId });
    const model = createArchiveModel(transport); await model.refresh(); await model.next();
    expect(transport.list.mock.calls.at(-1)?.slice(0, 2)).toEqual(['all', 'v1.all.' + runId]);
    expect(model.getSnapshot().previous).toEqual([null]); await model.back();
    expect(transport.list.mock.calls.at(-1)?.slice(0, 2)).toEqual(['all', null]);
    await model.filter('active'); expect(model.getSnapshot()).toMatchObject({ filter: 'active', cursor: null, previous: [] });
  });
  it('desmontaje invalida lecturas tardías y no inicia otras peticiones', async () => {
    const transport = api(); const delayed = deferred<SessionDto>(); transport.me.mockReturnValue(delayed.promise);
    const model = createArchiveModel(transport); const listener = vi.fn(); model.subscribe(listener);
    const loading = model.refresh(); model.dispose(); const notifications = listener.mock.calls.length;
    delayed.resolve(identity); await loading; await model.refresh();
    expect(listener).toHaveBeenCalledTimes(notifications); expect(transport.me).toHaveBeenCalledTimes(1);
    expect(transport.list).not.toHaveBeenCalled(); expect(model.getSnapshot().profile).toBeNull();
  });
  it('catálogo permite crear una vez; doble activación no envía otro POST y confirmación no expone clave', async () => {
    const transport = api(); const data = new Map<string, string>();
    const memory = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } };
    transport.cases.mockResolvedValue({ items: [{ caseId: 'synthetic', title: 'Caso sintético', contentMode: 'fixed', difficulty: 'normal', explorationMode: 'guided', deadlineMinutes: 100, contentVersion: 1, canStart: true }], nextCursor: null });
    const delayed = deferred<void>(); transport.create.mockReturnValue(delayed.promise);
    transport.lookup.mockResolvedValue({ schemaVersion: 1, kind: 'create_run', status: 'committed', runId });
    const model = createArchiveModel(transport, memory); await model.refresh();
    const sending = model.createCase('synthetic'); await model.createCase('synthetic');
    expect(transport.create).toHaveBeenCalledTimes(1); const key = transport.create.mock.calls[0]?.[1];
    delayed.resolve(); await sending;
    expect(model.getSnapshot().creation).toEqual({ phase: 'created', caseId: 'synthetic', runId });
    expect(JSON.stringify(model.getSnapshot())).not.toContain(key);
    await model.createCase('synthetic'); expect(transport.create).toHaveBeenCalledTimes(1);
  });
  it('catálogo no disponible no ejecuta creación desde un identificador adivinado', async () => {
    const transport = api(); const model = createArchiveModel(transport); await model.refresh();
    await model.createCase('hidden'); expect(transport.create).not.toHaveBeenCalled();
  });

});

describe('T3: abrir ficha propia y descartar lecturas tardías', () => {
  async function ready() {
    const transport = api(); transport.initial.mockResolvedValue(initialView);
    transport.list.mockResolvedValue({ ...page, items: [{ runId, caseId: 'synthetic', caseTitle: 'Caso sintético', status: 'active', version: 1, createdAt: '2026-01-01T00:00:00.000Z' }] });
    const model = createArchiveModel(transport); await model.refresh(); return { transport, model };
  }
  it('abre solo un ID de la página propia, sin crear partida ni avanzar el reloj', async () => {
    const { transport, model } = await ready();
    await model.openRun('hidden'); expect(transport.initial).not.toHaveBeenCalled();
    await model.openRun(runId); expect(model.getSnapshot().opened).toEqual(initialView);
    expect(transport.create).not.toHaveBeenCalled(); expect(model.getSnapshot().opened?.clock.minute).toBe(0);
    model.closeRun(); expect(model.getSnapshot().opened).toBeNull();
  });
  it('cerrar durante lectura aborta y una respuesta tardía no vuelve a abrir la ficha', async () => {
    const { transport, model } = await ready(); const delayed = deferred<typeof initialView>();
    transport.initial.mockReturnValue(delayed.promise); const loading = model.openRun(runId);
    const pendingSignal = transport.initial.mock.calls[0]?.[1]; model.closeRun(); delayed.resolve(initialView); await loading;
    expect(pendingSignal?.aborted).toBe(true); expect(model.getSnapshot()).toMatchObject({ phase: 'ready', opened: null, openingRunId: null });
  });
  it('logout oculta una ficha abierta e ignora la consulta anterior', async () => {
    const { transport, model } = await ready(); const delayed = deferred<typeof initialView>();
    transport.initial.mockReturnValue(delayed.promise); const loading = model.openRun(runId);
    await model.logout(); delayed.resolve(initialView); await loading;
    expect(model.getSnapshot()).toMatchObject({ phase: 'signed_out', profile: null, opened: null });
  });
  it('error de lectura permite seguir en archivo sin simular estado inicial', async () => {
    const { transport, model } = await ready(); transport.initial.mockRejectedValue(new Error('synthetic-unavailable'));
    await model.openRun(runId); expect(model.getSnapshot()).toMatchObject({ phase: 'ready', opened: null, openingRunId: null });
    expect(model.getSnapshot().page?.items).toHaveLength(1);
  });
  it('cambiar filtro oculta la ficha y no acepta una consulta anterior', async () => {
    const { transport, model } = await ready(); const delayed = deferred<typeof initialView>();
    transport.initial.mockReturnValue(delayed.promise); const loading = model.openRun(runId);
    await model.filter('active'); delayed.resolve(initialView); await loading;
    expect(model.getSnapshot()).toMatchObject({ phase: 'ready', filter: 'active', opened: null });
  });
});
