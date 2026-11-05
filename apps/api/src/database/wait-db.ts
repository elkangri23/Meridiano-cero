// Espera a PostgreSQL antes de migrar (Fase B).
//
// El compose de producción no puede usar `depends_on: condition:
// service_healthy` (docker-compose v1 del VPS no lo admite en archivos v3),
// así que el entrypoint de la API espera aquí hasta 60 s. No toca el
// esquema: solo abre y cierra conexiones hasta que una funciona.

import pg from 'pg';

const connectionString = process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  console.error('WAIT_DB_NO_URL');
  process.exitCode = 1;
} else {
  const deadline = Date.now() + 60_000;
  let connected = false;
  while (!connected && Date.now() < deadline) {
    const client = new pg.Client({ connectionString, connectionTimeoutMillis: 2000 });
    try {
      await client.connect();
      await client.query('SELECT 1');
      connected = true;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 2000));
    } finally {
      await client.end().catch(() => undefined);
    }
  }
  if (!connected) {
    console.error('WAIT_DB_TIMEOUT');
    process.exitCode = 1;
  } else {
    console.log('PostgreSQL disponible.');
  }
}
