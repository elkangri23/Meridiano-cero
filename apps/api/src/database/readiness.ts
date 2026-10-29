import { setTimeout as delay } from 'node:timers/promises';
import type { Database } from './connection.ts';
import { migrationFiles, matchesMigrationLedger } from './migrations.ts';

export function createReadiness(database: Database, timeoutMs = 5000) {
  const expected = migrationFiles().catch(() => undefined);
  let active: Promise<boolean> | undefined;
  async function check(): Promise<boolean> {
    try {
      const files = await expected;
      if (!files) return false;
      const rows = await database.pool.query<{ name: string; hash: string }>('SELECT name, hash FROM base_migrations ORDER BY name');
      return matchesMigrationLedger(files, rows.rows);
    } catch { return false; }
  }
  return () => {
    if (!active) {
      const timeout = new AbortController();
      const work = check();
      active = Promise.race([work, delay(timeoutMs, false, { signal: timeout.signal })]);
      // Si vence el watchdog, conservar single-flight hasta que termine la query.
      // El timeout de pg/servidor limita SQL; el watchdog no promete cancelarlo.
      void work.finally(() => { timeout.abort(); active = undefined; });
    }
    return active;
  };
}
