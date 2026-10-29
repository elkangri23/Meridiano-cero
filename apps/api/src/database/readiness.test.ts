import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDatabase } from './connection.ts';
import { createReadiness } from './readiness.ts';
import { migrationFiles } from './migrations.ts';

afterEach(() => { vi.useRealTimers(); });
describe('watchdog de readiness sin duplicar trabajo', () => {
  it('deadline no libera single-flight hasta que termina el trabajo SQL', async () => {
    const files = await migrationFiles();
    const database = createDatabase('postgresql://synthetic:synthetic@127.0.0.1:1/synthetic');
    let resolve: (value: unknown) => void = () => {};
    const pending = new Promise<unknown>(done => { resolve = done; });
    let begin: () => void = () => {};
    const entered = new Promise<void>(done => { begin = done; });
    const query = vi.fn(() => { begin(); return pending; });
    // Doble unitario: no acredita cancelación física de PostgreSQL.
    database.pool.query = query as typeof database.pool.query;
    vi.useFakeTimers();
    const ready = createReadiness(database, 10);
    const first = ready();
    await entered;
    await vi.advanceTimersByTimeAsync(10);
    expect(await first).toBe(false);
    for (let index = 0; index < 100; index++) expect(await ready()).toBe(false);
    expect(query).toHaveBeenCalledTimes(1);
    resolve({ rows: files.map(file => ({ name: file.name, hash: file.hash })) });
    await vi.advanceTimersByTimeAsync(0);
    expect(await ready()).toBe(true);
    expect(query).toHaveBeenCalledTimes(2);
    await database.pool.end();
  });
});
