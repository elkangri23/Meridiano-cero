import { migrate } from './migrations.ts';
import { readDatabaseUrl } from '../config.ts';

try {
  await migrate(readDatabaseUrl(process.env.DATABASE_MIGRATION_URL));
  console.log('MigraciÃ³n de base completada.');
} catch {
  console.error('MIGRATION_FAILED: revisar conexiÃ³n, privilegios y versiÃ³n de esquema.');
  process.exitCode = 1;
}
