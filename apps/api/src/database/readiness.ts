import { setTimeout as delay } from 'node:timers/promises';
import type { Database } from './connection.ts';
import { migrationFiles } from './migrations.ts';

export function createReadiness(database: Database) {
  const expected = migrationFiles().catch(() => undefined);
  let active: Promise<boolean> | undefined;
  async function check(): Promise<boolean> {
    try {
      const files = await expected;
      if (!files) return false;
      const rows = await database.pool.query<{ name: string; hash: string }>('SELECT name, hash FROM base_migrations ORDER BY name');
      return files.length === rows.rows.length && files.every((file, index) =>
        rows.rows[index]?.name === file.name && rows.rows[index]?.hash === file.hash);
    } catch { return false; }
  }
  return () => {
    if (!active) {
      const timeout = new AbortController();
      active = Promise.race([check(), delay(5000, false, { signal: timeout.signal })])
        .finally(() => { timeout.abort(); active = undefined; });
    }
    return active;
  };
}
