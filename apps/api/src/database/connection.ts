import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';

export function createDatabase(connectionString: string) {
  const pool = new pg.Pool({
    connectionString, max: 5, connectionTimeoutMillis: 2000,
    idleTimeoutMillis: 30000, query_timeout: 2000, statement_timeout: 2000,
  });
  const connect = pool.connect.bind(pool);
  type Callback = Parameters<pg.Pool['connect']>[0];
  function boundedConnect(): Promise<pg.PoolClient>;
  function boundedConnect(callback: Callback): void;
  function boundedConnect(callback?: Callback): Promise<pg.PoolClient> | void {
    if (pool.waitingCount >= 25) {
      const error = new Error('DB_CAPACITY_EXCEEDED');
      if (callback) { queueMicrotask(() => callback(error, undefined, () => {})); return; }
      return Promise.reject(error);
    }
    return callback ? connect(callback) : connect();
  }
  pool.connect = boundedConnect;
  // pg puede emitir error también mientras el cliente está fuera del pool.
  // La query sigue rechazándose; este listener evita una excepción sin manejar.
  pool.on('connect', client => { client.on('error', () => { console.error('DB_CLIENT_CONNECTION_FAILED'); }); });
  // A disconnected idle client must not crash the process or leak its connection URL.
  pool.on('error', () => { console.error('DB_IDLE_CONNECTION_FAILED'); });
  return { pool, orm: drizzle(pool) };
}
export type Database = ReturnType<typeof createDatabase>;
