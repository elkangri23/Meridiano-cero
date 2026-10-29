import { defineConfig } from 'vitest/config';
if (!process.env.DATABASE_URL || !process.env.DATABASE_MIGRATION_URL) throw new Error('Configurar DB sintÃƒÂ©tica antes de integraciÃƒÂ³n.');
const target = new URL(process.env.DATABASE_URL);
if (target.hostname !== '127.0.0.1' || !['15433', '15434'].includes(target.port) || target.pathname !== '/meridiano' || target.username !== 'meridiano_app') throw new Error('Solo DB sintética de integración.');
export default defineConfig({ test: { include: ['apps/api/src/**/*.integration.test.ts'], maxWorkers: 1, testTimeout: 10000, hookTimeout: 30000 } });
