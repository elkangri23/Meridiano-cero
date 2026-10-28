import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';

export function createDatabase(connectionString: string) {
  const pool = new pg.Pool({
    connectionString, max: 5, connectionTimeoutMillis: 2000,
    idleTimeoutMillis: 30000, query_timeout: 2000, statement_timeout: 2000,
  });
  // A disconnected idle client must not crash the process or leak its connection URL.
  pool.on('error', () => { console.error('DB_IDLE_CONNECTION_FAILED'); });
  return { pool, orm: drizzle(pool) };
}
export type Database = ReturnType<typeof createDatabase>;
