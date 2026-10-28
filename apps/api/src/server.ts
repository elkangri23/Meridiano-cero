import { createApp } from './app.ts';
import { readBootstrapConfig } from './config.ts';
import { Pool } from 'pg';

async function start(): Promise<void> {
  const config = readBootstrapConfig(process.env);
  const pool = new Pool({ connectionString: config.databaseUrl, max: 5, connectionTimeoutMillis: 2000, idleTimeoutMillis: 30000 });
  const readyCheck = async () => {
    try {
      const client = await pool.connect();
      try {
        await client.query('SELECT 1');
        return { ok: true };
      } finally {
        client.release();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      return { ok: false, detail: message };
    }
  };
  const app = createApp({ readyCheck });
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => { void app.close().catch(() => { process.exitCode = 1; }); void pool.end().catch(() => {}); });
  }
  await app.listen(config);
  console.log(`API de desarrollo en http://${config.host}:${config.port}; DB configurada.`);
}
start().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'No se pudo iniciar la API.');
  process.exitCode = 1;
});
