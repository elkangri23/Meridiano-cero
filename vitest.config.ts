import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['apps/api/src/**/*.test.ts', 'packages/engine/src/**/*.test.ts'], maxWorkers: 2 } });
