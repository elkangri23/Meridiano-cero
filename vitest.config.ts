import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['apps/api/src/**/*.test.ts'], exclude: ['**/*.integration.test.ts'], maxWorkers: 2 } });
