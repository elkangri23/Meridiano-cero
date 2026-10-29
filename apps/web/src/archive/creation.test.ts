import { describe, expect, it, vi } from 'vitest';
import type { SessionDto } from '@meridiano/contracts';
import { createRunCoordinator, CreationBlocked } from './creation';
import type { IntentStorage } from './creation';
import type { ArchiveApi } from './client';

const profileId = '11111111-1111-4111-8111-111111111111';
const runId = '22222222-2222-4222-8222-222222222222';
const identity: SessionDto = { profile: { id: profileId, displayName: 'Persona sintética', role: 'player' }, csrfToken: 's'.repeat(43) };
const signal = () => new AbortController().signal;
const found = { schemaVersion: 1 as const, kind: 'create_run' as const, status: 'committed' as const, runId };
function storage() {
  const data = new Map<string, string>();
  return { data, getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } };
}
function api() {
  return { initial: vi.fn<ArchiveApi['initial']>(), me: vi.fn<ArchiveApi['me']>(), connect: vi.fn<ArchiveApi['connect']>(), list: vi.fn<ArchiveApi['list']>(), cases: vi.fn<ArchiveApi['cases']>(), logout: vi.fn<ArchiveApi['logout']>(),
    create: vi.fn<ArchiveApi['create']>().mockResolvedValue(), lookup: vi.fn<ArchiveApi['lookup']>().mockResolvedValue(null) };
}

describe('T3: creación durable en pestaña sin otra intención', () => {
  it('conserva referencia antes del POST, confirma por ledger y borra solo tras confirmación', async () => {
    const memory = storage(); const transport = api();
    transport.create.mockImplementation(async () => {
      expect(memory.data.size).toBe(1);
      const raw = [...memory.data.values()][0]; expect(raw).toBeDefined();
      expect(raw).not.toContain(identity.csrfToken);
    });
    transport.lookup.mockResolvedValue(found);
    const coordinator = createRunCoordinator(transport, memory);
    expect(await coordinator.start('synthetic-case', identity, signal())).toEqual({ phase: 'created', runId });
    expect(memory.data.size).toBe(0); expect(transport.create).toHaveBeenCalledTimes(1);
    expect(transport.lookup.mock.calls[0]?.[0]).toBe(transport.create.mock.calls[0]?.[1]);
  });
  it('respuesta POST perdida no equivale a rollback cuando ledger confirma', async () => {
    const memory = storage(); const transport = api(); transport.create.mockRejectedValue(new Error('synthetic-lost-response')); transport.lookup.mockResolvedValue(found);
    expect(await createRunCoordinator(transport, memory).start('synthetic-case', identity, signal())).toEqual({ phase: 'created', runId });
    expect(transport.create).toHaveBeenCalledTimes(1); expect(memory.data.size).toBe(0);
  });
  it('404 y recarga mantienen clave/caso; comprobar no envía y reintento explícito usa misma intención', async () => {
    const memory = storage(); const transport = api(); const first = createRunCoordinator(transport, memory);
    expect(await first.start('synthetic-case', identity, signal())).toEqual({ phase: 'uncertain' });
    const original = [...memory.data.values()][0]; const originalKey = transport.create.mock.calls[0]?.[1];
    const restored = createRunCoordinator(transport, memory);
    expect(restored.view(profileId)).toEqual({ phase: 'uncertain', caseId: 'synthetic-case', runId: null });
    await restored.recover(identity, false, signal()); expect(transport.create).toHaveBeenCalledTimes(1);
    expect([...memory.data.values()][0]).toBe(original);
    transport.lookup.mockResolvedValueOnce(null).mockResolvedValueOnce(found);
    expect(await restored.recover(identity, true, signal())).toEqual({ phase: 'created', runId });
    expect(transport.create).toHaveBeenCalledTimes(2); expect(transport.create.mock.calls[1]?.slice(0, 2)).toEqual(['synthetic-case', originalKey]);
  });
  it('otra elección no sobrescribe intención incierta', async () => {
    const memory = storage(); const transport = api(); const coordinator = createRunCoordinator(transport, memory);
    await coordinator.start('synthetic-case', identity, signal()); const before = [...memory.data.values()];
    await expect(coordinator.start('different', identity, signal())).rejects.toBeInstanceOf(CreationBlocked);
    expect([...memory.data.values()]).toEqual(before); expect(transport.create).toHaveBeenCalledTimes(1);
  });
  it.each(['read', 'write'])('almacenamiento %s bloqueado impide enviar una intención nueva', async mode => {
    const transport = api();
    const broken: IntentStorage = { getItem: () => { if (mode === 'read') throw new Error('synthetic'); return null; }, setItem: () => {}, removeItem: () => {} };
    await expect(createRunCoordinator(transport, broken).start('synthetic-case', identity, signal())).rejects.toBeInstanceOf(CreationBlocked);
    expect(transport.create).not.toHaveBeenCalled();
  });
  it('localizador malformado no se descarta generando automáticamente otra clave', async () => {
    const memory = storage(); const transport = api(); memory.setItem('meridiano:create-run:v1:' + profileId, '{invalid');
    const coordinator = createRunCoordinator(transport, memory);
    expect(coordinator.view(profileId).phase).toBe('blocked');
    await expect(coordinator.start('synthetic-case', identity, signal())).rejects.toBeInstanceOf(CreationBlocked);
    expect(transport.create).not.toHaveBeenCalled();
  });
  it('otra cuenta no restaura ni elimina referencia ajena o almacenamiento de otro proyecto', async () => {
    const memory = storage(); const transport = api(); const coordinator = createRunCoordinator(transport, memory);
    await coordinator.start('synthetic-case', identity, signal()); memory.setItem('other-project', 'synthetic');
    expect(coordinator.view(runId).phase).toBe('idle'); coordinator.forget(runId);
    expect(coordinator.view(profileId).phase).toBe('uncertain'); expect(memory.getItem('other-project')).toBe('synthetic');
    coordinator.forget(profileId); expect(memory.data.size).toBe(1);
  });
  it('cancelación no elimina referencia ni transforma respuesta tardía en éxito', async () => {
    const memory = storage(); const transport = api(); const controller = new AbortController();
    let finish: (value: typeof found) => void = () => { throw new Error('Not ready'); };
    transport.lookup.mockImplementation(() => new Promise(done => { finish = done; }));
    const coordinator = createRunCoordinator(transport, memory); const operation = coordinator.start('synthetic-case', identity, controller.signal);
    await vi.waitFor(() => { expect(transport.lookup).toHaveBeenCalledTimes(1); });
    controller.abort(); finish(found); await expect(operation).rejects.toBeDefined();
    expect(coordinator.view(profileId).phase).toBe('uncertain'); expect(memory.data.size).toBe(1);
  });
  it('si no puede borrar referencia confirmada, la conserva sin preparar otra intención', async () => {
    const memory = storage(); const transport = api(); transport.lookup.mockResolvedValue(found);
    const blocked: IntentStorage = { ...memory, removeItem: () => { throw new Error('synthetic'); } };
    const coordinator = createRunCoordinator(transport, blocked);
    expect(await coordinator.start('synthetic-case', identity, signal())).toEqual({ phase: 'uncertain' });
    expect(coordinator.view(profileId).phase).toBe('uncertain'); expect(transport.create).toHaveBeenCalledTimes(1);
  });
});
