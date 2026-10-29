import { createShutdown } from './lifecycle.ts';
import { createTelemetry } from './telemetry.ts';
import { createApp } from './app.ts';
import { readAppConfig } from './config.ts';
import { createDatabase } from './database/connection.ts';

async function start(): Promise<void> {
  const config = readAppConfig(process.env);
  const database = createDatabase(config.databaseUrl);
  const state = { draining: false };
  const app = createApp({ config, database, state, telemetry: createTelemetry(process.stdout) });
  app.addHook('onClose', async () => { await database.pool.end(); });
  const shutdown = createShutdown({
    state, close: () => app.close(),
    failed: () => { console.error('API_SHUTDOWN_FAILED'); process.exitCode = 1; },
    force: () => { console.error('API_SHUTDOWN_FORCED'); process.exit(1); },
  });
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => { void shutdown(); });
  }
  try { await app.listen({ host: config.host, port: config.port }); }
  catch (error) { await shutdown(); throw error; }
  console.log('API local iniciada; consultar /api/v1/ready para DB y esquema.');
}
start().catch((error: unknown) => {
  const code = error instanceof Error && /^CONFIG_[A-Z_]+$/.test(error.message) ? error.message : 'API_START_FAILED';
  console.error(code);
  process.exitCode = 1;
});
