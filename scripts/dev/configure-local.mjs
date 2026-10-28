import { randomBytes } from 'node:crypto';
import { mkdir, writeFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';

const testing = process.argv.includes('--test');
const suffix = testing ? 'test-' : '';
const envFile = resolve(testing ? '.env.integration' : '.env');
try { await access(envFile); console.error('La configuración ya existe; no se sobrescribe.'); process.exitCode = 1; }
catch {
  const admin = randomBytes(32).toString('hex');
  const app = randomBytes(32).toString('hex');
  const port = testing ? 15433 : 15432;
  await mkdir('.local-secrets', { recursive: true, mode: 0o700 });
  const adminFile = './.local-secrets/' + suffix + 'admin-password';
  const appFile = './.local-secrets/' + suffix + 'app-password';
  await writeFile(adminFile, admin, { flag: 'wx', mode: 0o444 });
  await writeFile(appFile, app, { flag: 'wx', mode: 0o444 });
  await writeFile(envFile, [
    'APP_MODE=development', 'API_HOST=127.0.0.1', 'API_PORT=3000',
    'PUBLIC_ORIGIN=http://127.0.0.1:5173', 'LOCAL_DEV_AUTH_ENABLED=true', 'REGISTRATION_ENABLED=false',
    'PG_HOST_PORT=' + port, 'DB_ADMIN_SECRET_FILE=' + adminFile, 'DB_APP_SECRET_FILE=' + appFile,
    'DATABASE_URL=postgresql://meridiano_app:' + app + '@127.0.0.1:' + port + '/meridiano',
    'DATABASE_MIGRATION_URL=postgresql://meridiano_owner:' + admin + '@127.0.0.1:' + port + '/meridiano',
    '',
  ].join('\n'), { flag: 'wx', mode: 0o600 });
  console.log('Configuración privada generada sin imprimir credenciales.');
}
