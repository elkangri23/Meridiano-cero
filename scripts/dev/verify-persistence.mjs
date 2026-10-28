import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createDatabase } from '../../apps/api/src/database/connection.ts';
import { createSessionStore } from '../../apps/api/src/auth/store.ts';
import { createApp } from '../../apps/api/src/app.ts';
import { readAppConfig } from '../../apps/api/src/config.ts';

const config = readAppConfig(process.env);
const target = new URL(config.databaseUrl);
assert.equal(target.hostname, '127.0.0.1');
assert.equal(target.port, '15433', 'Solo DB sintética de integración');
const root = fileURLToPath(new URL('../../', import.meta.url));
function compose(args) {
  execFileSync('docker', ['compose', '--env-file', '.env.integration', '-p', 'meridiano-cero-t1-test', ...args],
    { cwd: root, stdio: 'pipe', timeout: 120000 });
}
let database = createDatabase(config.databaseUrl);
const session = await createSessionStore(database).create(undefined);
await database.pool.end();
try {
  compose(['stop', 'db']);
  database = createDatabase(config.databaseUrl);
  const offline = createApp({ config, database });
  try {
    const started = Date.now();
    assert.equal((await offline.inject('/api/v1/health')).statusCode, 200);
    assert.equal((await offline.inject('/api/v1/ready')).statusCode, 503);
    assert.ok(Date.now() - started < 5000, 'Readiness debe estar acotada');
    console.log('OK: health sigue vivo y ready=503 con DB detenida, sin exponer errores internos.');
  } finally { await offline.close(); await database.pool.end(); }
} finally { compose(['up', '-d', '--force-recreate', '--wait', 'db']); }
database = createDatabase(config.databaseUrl);
const restored = createApp({ config, database });
try {
  assert.equal((await restored.inject('/api/v1/ready')).statusCode, 200);
  const response = await restored.inject({ url: '/api/v1/me', headers: { cookie: 'meridiano_session=' + session.token } });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().profile.id, session.profile.id);
  assert.equal(response.json().csrfToken, session.csrfToken);
  console.log('OK: contenedor recreado y API nueva conservan perfil y sesión en volumen persistente.');
} finally { await restored.close(); await database.pool.end(); }
