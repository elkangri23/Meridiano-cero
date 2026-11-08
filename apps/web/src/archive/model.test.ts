import { initialView } from './initial-fixture';
import { describe, expect, it, vi } from 'vitest';
import type { CaseSummary, RunListDto, SessionDto } from '@meridiano/contracts';
import { createArchiveModel } from './model';
import type { ArchiveApi } from './client';
import { ArchiveError } from './client';

const id = '11111111-1111-4111-8111-111111111111';
const runId = '22222222-2222-4222-8222-222222222222';
const identity: SessionDto = { profile: { id, displayName: 'Detective sintético', role: 'player', emailVerified: false }, csrfToken: 's'.repeat(43) };
const page: RunListDto = { profileId: id, items: [], nextCursor: null };
function api() {
  return { initial: vi.fn<ArchiveApi['initial']>(), cases: vi.fn<ArchiveApi['cases']>().mockResolvedValue({ items: [], nextCursor: null }),
    create: vi.fn<ArchiveApi['create']>().mockResolvedValue(), lookup: vi.fn<ArchiveApi['lookup']>().mockResolvedValue(null),
    deleteRun: vi.fn<ArchiveApi['deleteRun']>().mockResolvedValue(),
    generationJobs: vi.fn<ArchiveApi['generationJobs']>().mockResolvedValue({ items: [] }),
    createGenerationJob: vi.fn<ArchiveApi['createGenerationJob']>(),
    cancelGenerationJob: vi.fn<ArchiveApi['cancelGenerationJob']>(),
    exportCase: vi.fn<ArchiveApi['exportCase']>(),
    importCase: vi.fn<ArchiveApi['importCase']>(),
    career: vi.fn<ArchiveApi['career']>().mockResolvedValue(null),
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
    transport.cases.mockResolvedValue({ items: [{ caseId: 'synthetic', title: 'Caso sintético', contentMode: 'fixed', crimeType: 'robo', contentRating: 'familiar', difficulty: 'normal', explorationMode: 'guided', deadlineMinutes: 100, contentVersion: 1, canStart: true, ownedByMe: false }], nextCursor: null });
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
  it('borrar una partida llama al borrado y recarga el archivo', async () => {
    const transport = api(); const model = createArchiveModel(transport); await model.refresh();
    await model.deleteRun(runId);
    expect(transport.deleteRun).toHaveBeenCalledTimes(1);
    expect(transport.deleteRun.mock.calls[0]?.[0]).toBe(runId);
    expect(model.getSnapshot().notice).toBe('Partida borrada.');
  });
  it('descartar una creación pendiente devuelve el formulario sin enviar nada', async () => {
    const transport = api(); const data = new Map<string, string>();
    const memory = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } };
    data.set('meridiano:create-run:v1:' + id, JSON.stringify({ schemaVersion: 1, profileId: id, caseId: 'synthetic', difficulty: 'easy', idempotencyKey: '12345678-1234-4123-8123-123456789012' }));
    const model = createArchiveModel(transport, memory); await model.refresh();
    expect(model.getSnapshot().creation.phase).toBe('uncertain');
    model.discardCreation();
    expect(model.getSnapshot().creation).toEqual({ phase: 'idle', caseId: null, runId: null });
    expect(transport.create).not.toHaveBeenCalled();
  });

});

describe('T4-08: generación de casos en el archivo', () => {
  const job = { jobId: id, status: 'queued' as const, stage: 0, crimeType: 'fraude' as const, contentRating: 'familiar' as const, duration: 'short' as const, caseId: null, error: null, progress: {}, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', startedAt: null, finishedAt: null };
  it('crear una generación la añade al estado y conserva el motivo del servidor si falla', async () => {
    const transport = api(); const model = createArchiveModel(transport); await model.refresh();
    transport.createGenerationJob.mockResolvedValue(job);
    await model.createGeneration({ crimeType: 'fraude', contentRating: 'familiar', duration: 'short' });
    expect(transport.createGenerationJob).toHaveBeenCalledTimes(1);
    expect(model.getSnapshot().jobs).toEqual([job]);
    expect(model.getSnapshot().notice).toContain('en cola');
    transport.createGenerationJob.mockRejectedValueOnce(new ArchiveError('unavailable', 'Ya tienes una generación en curso.'));
    await model.createGeneration({ crimeType: 'robo' });
    expect(model.getSnapshot().notice).toBe('Ya tienes una generación en curso.');
  });
  it('cancelar una generación actualiza su estado sin recargar el archivo', async () => {
    const transport = api(); const model = createArchiveModel(transport); await model.refresh();
    transport.createGenerationJob.mockResolvedValue(job);
    await model.createGeneration({ crimeType: 'fraude' });
    transport.cancelGenerationJob.mockResolvedValue({ ...job, status: 'cancelled', finishedAt: '2026-01-01T00:01:00.000Z' });
    await model.cancelGeneration(id);
    expect(model.getSnapshot().jobs[0]?.status).toBe('cancelled');
    expect(model.getSnapshot().notice).toBe('Generación cancelada.');
    expect(transport.list).toHaveBeenCalledTimes(1);
  });
  it('refrescar jobs recarga también el catálogo (el expediente nuevo aparece)', async () => {
    const transport = api(); const model = createArchiveModel(transport); await model.refresh();
    const done = { ...job, status: 'done' as const, caseId: 'generado-fraude-1', stage: 9 };
    transport.generationJobs.mockResolvedValue({ items: [done] });
    transport.cases.mockResolvedValue({ items: [{ caseId: 'generado-fraude-1', title: 'Caso sintético generado', contentMode: 'generated', crimeType: 'fraude', contentRating: 'familiar', difficulty: 'normal', explorationMode: 'guided', deadlineMinutes: 2880, contentVersion: 1, canStart: true, ownedByMe: true }], nextCursor: null });
    await model.refreshJobs();
    expect(model.getSnapshot().jobs).toEqual([done]);
    expect(model.getSnapshot().cases.map(item => item.caseId)).toContain('generado-fraude-1');
  });
  it('al terminar un job, el aviso «en cola» se sustituye por el resultado', async () => {
    const transport = api(); const model = createArchiveModel(transport); await model.refresh();
    transport.createGenerationJob.mockResolvedValue(job);
    await model.createGeneration({ crimeType: 'fraude', contentRating: 'familiar', duration: 'short' });
    expect(model.getSnapshot().notice).toContain('en cola');
    const done = { ...job, status: 'done' as const, caseId: 'generado-fraude-1', stage: 9 };
    transport.generationJobs.mockResolvedValue({ items: [done] });
    transport.cases.mockResolvedValue({ items: [{ caseId: 'generado-fraude-1', title: 'Caso sintético generado', contentMode: 'generated', crimeType: 'fraude', contentRating: 'familiar', difficulty: 'normal', explorationMode: 'guided', deadlineMinutes: 2880, contentVersion: 1, canStart: true, ownedByMe: true }], nextCursor: null });
    await model.refreshJobs();
    expect(model.getSnapshot().notice).toContain('Expediente listo: Caso sintético generado');
    expect(model.getSnapshot().notice).not.toContain('en cola');
    // Sin transición (el job ya estaba terminado), el aviso no se toca.
    await model.refreshJobs();
    expect(model.getSnapshot().notice).toContain('Expediente listo');
  });
  it('al fallar un job, el aviso dice el motivo en vez de quedarse en cola', async () => {
    const transport = api(); const model = createArchiveModel(transport); await model.refresh();
    transport.createGenerationJob.mockResolvedValue(job);
    await model.createGeneration({ crimeType: 'fraude', contentRating: 'familiar', duration: 'short' });
    const failed = { ...job, status: 'failed' as const, error: 'Etapa 4 inválida: la ruta dorada no se puede jugar.' };
    transport.generationJobs.mockResolvedValue({ items: [failed] });
    await model.refreshJobs();
    expect(model.getSnapshot().notice).toContain('La generación falló: Etapa 4 inválida');
  });
});

describe('T4-05: intercambio de expedientes en el archivo', () => {
  const importedCase: CaseSummary = { caseId: 'importado-1a2b3c4d', title: 'Caso importado', contentMode: 'generated', crimeType: 'robo', contentRating: 'familiar', difficulty: 'normal', explorationMode: 'guided', deadlineMinutes: 2880, contentVersion: 1, canStart: true, ownedByMe: true };
  it('exportar devuelve el fichero y avisa de que contiene la solución', async () => {
    const transport = api(); const model = createArchiveModel(transport); await model.refresh();
    const blob = new Blob(['{"version":"1.0.0"}'], { type: 'application/json' });
    transport.exportCase.mockResolvedValue(blob);
    const file = await model.exportCase('generado-1');
    expect(file).toEqual({ blob, filename: 'meridiano-caso-generado-1.json' });
    expect(model.getSnapshot().notice).toContain('Contiene la solución');
    transport.exportCase.mockRejectedValueOnce(new ArchiveError('unavailable', 'Este expediente no es tuyo: solo su dueño puede descargarlo.'));
    expect(await model.exportCase('generado-1')).toBeNull();
    expect(model.getSnapshot().notice).toBe('Este expediente no es tuyo: solo su dueño puede descargarlo.');
  });
  it('importar recarga el catálogo y anuncia el expediente nuevo', async () => {
    const transport = api(); const model = createArchiveModel(transport); await model.refresh();
    transport.importCase.mockResolvedValue({ caseId: importedCase.caseId, title: importedCase.title, canStart: true, warnings: [], alreadyExisted: false });
    transport.cases.mockResolvedValue({ items: [importedCase], nextCursor: null });
    await model.importCase('{"version":"1.0.0"}');
    expect(transport.importCase).toHaveBeenCalledWith('{"version":"1.0.0"}', identity, expect.anything());
    expect(model.getSnapshot().cases.map(item => item.caseId)).toContain('importado-1a2b3c4d');
    expect(model.getSnapshot().notice).toContain('Expediente importado: Caso importado');
    expect(model.getSnapshot().notice).toContain('Nueva partida');
  });
  it('importar un expediente ya conocido no lo duplica y conserva el motivo si falla', async () => {
    const transport = api(); const model = createArchiveModel(transport); await model.refresh();
    transport.importCase.mockResolvedValue({ caseId: importedCase.caseId, title: importedCase.title, canStart: true, warnings: ['El identificador ya existe.'], alreadyExisted: true });
    transport.cases.mockResolvedValue({ items: [importedCase], nextCursor: null });
    await model.importCase('{"version":"1.0.0"}');
    expect(model.getSnapshot().notice).toContain('Ya estaba en tu catálogo');
    expect(model.getSnapshot().notice).toContain('El identificador ya existe.');
    transport.importCase.mockRejectedValueOnce(new ArchiveError('unavailable', 'Checksum no coincide: posible corrupción de datos'));
    await model.importCase('{"version":"1.0.0"}');
    expect(model.getSnapshot().notice).toBe('No se pudo importar el expediente: Checksum no coincide: posible corrupción de datos');
  });
});

describe('T3: abrir ficha propia y descartar lecturas tardías', () => {
  async function ready() {
    const transport = api(); transport.initial.mockResolvedValue(initialView);
    transport.list.mockResolvedValue({ ...page, items: [{ runId, caseId: 'synthetic', caseTitle: 'Caso sintético', status: 'active', difficulty: 'normal', version: 1, minute: 0, createdAt: '2026-01-01T00:00:00.000Z' }] });
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
