import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import pg from 'pg';

const directory = fileURLToPath(new URL('../../migrations/', import.meta.url));
export async function migrationFiles() {
  const names = (await readdir(directory)).filter(name => /^\d{4}_[a-z_]+\.sql$/.test(name)).sort();
  if (!names.length) throw new Error('MIGRATIONS_MISSING');
  return Promise.all(names.map(async name => {
    const sql = (await readFile(directory + '/' + name, 'utf8')).replaceAll('\r\n', '\n');
    return { name, sql, hash: createHash('sha256').update(sql).digest('hex') };
  }));
}
export async function migrate(connectionString: string): Promise<void> {
  const files = await migrationFiles();
  const client = await connect(connectionString);
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query('SELECT pg_advisory_xact_lock(28012026)');
    await client.query('CREATE TABLE IF NOT EXISTS base_migrations (name text PRIMARY KEY, hash text NOT NULL)');
    const applied = await client.query<{ name: string; hash: string }>('SELECT name, hash FROM base_migrations ORDER BY name');
    for (const row of applied.rows) {
      if (!files.some(file => file.name === row.name && file.hash === row.hash)) throw new Error('SCHEMA_INCOMPATIBLE');
    }
    for (const file of files) {
      if (applied.rows.some(row => row.name === file.name)) continue;
      await client.query(file.sql);
      await client.query('INSERT INTO base_migrations (name, hash) VALUES ($1, $2)', [file.name, file.hash]);
    }
    await client.query('GRANT SELECT ON base_migrations TO meridiano_app');
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => { console.error('MIGRATION_ROLLBACK_FAILED'); });
    throw error;
  } finally { await client.end(); }
}
async function connect(connectionString: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const client = new pg.Client({ connectionString, connectionTimeoutMillis: 2000, query_timeout: 10000 });
    try { await client.connect(); return client; }
    catch {
      await client.end().catch(() => { console.error('MIGRATION_CLEANUP_FAILED'); });
      if (attempt === 2) throw new Error('MIGRATION_CONNECTION_FAILED');
      await delay((attempt + 1) * 1000);
    }
  }
  throw new Error('MIGRATION_CONNECTION_FAILED');
}
