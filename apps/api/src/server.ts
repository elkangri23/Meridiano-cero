import { createApp } from './app.ts';
import { readAppConfig } from './config.ts';
import { createDatabase } from './database/connection.ts';

async function start(): Promise<void> {
  const config = readAppConfig(process.env);
  const database = createDatabase(config.databaseUrl);
  const app = createApp({ config, database });
  app.addHook('onClose', async () => { await database.pool.end(); });
  const shutdown = async () => {
    await app.close().catch(() => { process.exitCode = 1; });
    await database.pool.end().catch(() => {});
  };
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => { void shutdown(); });
  }
  try { await app.listen({ host: config.host, port: config.port }); }
  catch (error) { await app.close(); throw error; }
  console.log('API local iniciada; consultar /api/v1/ready para DB y esquema.');
}
start().catch((error: unknown) => {
  const code = error instanceof Error && /^CONFIG_[A-Z_]+$/.test(error.message) ? error.message : 'API_START_FAILED';
  console.error(code);
  process.exitCode = 1;
});
