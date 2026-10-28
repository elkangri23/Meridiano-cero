import { createApp } from './app.ts';
import { readBootstrapConfig } from './config.ts';

async function start(): Promise<void> {
  const config = readBootstrapConfig(process.env);
  const app = createApp();
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => { void app.close().catch(() => { process.exitCode = 1; }); });
  }
  await app.listen(config);
  console.log(`API de desarrollo en http://${config.host}:${config.port}; sin DB ni sesión.`);
}
start().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'No se pudo iniciar la API.');
  process.exitCode = 1;
});
