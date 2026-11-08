import { describe, it, expect, vi } from 'vitest';
import { runInitialSetup, runHealthChecks, getAdminPanelConfig, type SetupConfig } from './setup-admin.js';
import { hashPassword } from './auth-utils.js';

/** Filas del mock: tipos literales para que sean asignables a Record<string, unknown>. */
type MockUserRow = { id: string; email: string; name: string; role: string };
type MockInstanceRow = { id: string; name: string; allow_registration: boolean; default_ai_provider: string };
type MockMigrationRow = { name: string; hash: string };
type MockRows = Array<Record<string, unknown>>;

interface MockDbState {
  users: MockUserRow[];
  instances: MockInstanceRow[];
  baseMigrations: MockMigrationRow[];
}

type MockHandler = (sqlLower: string, params: unknown[]) => { rows: MockRows } | null;

/** Despacho de consultas del mock, en el mismo orden que la versión anterior. */
function mockHandlers(state: MockDbState): MockHandler[] {
  return [
    (sqlLower, params) => sqlLower.includes('from users where role')
      ? { rows: state.users.filter(u => u.role === params[0]) }
      : null,
    (sqlLower, params) => {
      if (!sqlLower.includes('insert into users')) return null;
      const row: MockUserRow = { id: 'user-1', email: String(params[0] ?? ''), name: String(params[2] ?? ''), role: 'admin' };
      state.users.push(row);
      return { rows: [row] };
    },
    (sqlLower) => sqlLower.includes('insert into detective_profiles')
      ? { rows: [{ id: 'dp-1' }] }
      : null,
    (sqlLower, params) => {
      if (!sqlLower.includes('insert into instances')) return null;
      const row: MockInstanceRow = {
        id: 'inst-1',
        name: String(params[0] ?? ''),
        allow_registration: params[1] === true,
        default_ai_provider: String(params[2] ?? ''),
      };
      state.instances.push(row);
      return { rows: [row] };
    },
    (sqlLower) => sqlLower.includes('select 1') ? { rows: [{ '?': 1 }] } : null,
    (sqlLower) => sqlLower.includes('select count(*) as count from base_migrations')
      ? { rows: [{ count: String(state.baseMigrations.length) }] }
      : null,
    (sqlLower) => sqlLower.includes('from base_migrations') ? { rows: state.baseMigrations } : null,
    (sqlLower) => sqlLower.includes('select pg_database_size') ? { rows: [{ size: 1024 * 1024 * 10 }] } : null,
    (sqlLower) => sqlLower.includes('select count(*) as count from users')
      ? { rows: [{ count: String(state.users.length) }] }
      : null,
    (sqlLower) => sqlLower.includes('select count(*) as count from case_runs') ? { rows: [{ count: '0' }] } : null,
    (sqlLower) => sqlLower.includes('from instances order by created_at desc') ? { rows: state.instances.slice(-1) } : null,
  ];
}

function createMockDb() {
  const state: MockDbState = {
    users: [],
    instances: [],
    baseMigrations: [{ name: '0000_base', hash: 'abc' }],
  };
  return {
    query: vi.fn().mockImplementation((sql: string, params: unknown[] = []) => {
      const sqlLower = sql.toLowerCase();
      for (const handler of mockHandlers(state)) {
        const result = handler(sqlLower, params);
        if (result !== null) return Promise.resolve(result);
      }
      return Promise.resolve({ rows: [] });
    }),
  };
}

describe('setup-admin', () => {
  const validConfig: SetupConfig = {
    adminEmail: 'admin@meridiano.test',
    adminPassword: 'contraseña_segura_123456',
    adminName: 'Admin',
    instanceName: 'Meridiano Test',
    allowRegistration: true,
    defaultAiProvider: 'disabled',
  };

  it('runInitialSetup crea administrador e instance', async () => {
    const db = createMockDb();
    const result = await runInitialSetup(validConfig, db);
    expect(result.success).toBe(true);
    expect(result.adminUserId).toBe('user-1');
    expect(result.instanceId).toBe('inst-1');
    expect(db.query).toHaveBeenCalled();
  });

  it('runInitialSetup rechaza email inválido', async () => {
    const db = createMockDb();
    const result = await runInitialSetup({ ...validConfig, adminEmail: 'no-email' }, db);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Email');
  });

  it('runInitialSetup rechaza contraseña corta', async () => {
    const db = createMockDb();
    const result = await runInitialSetup({ ...validConfig, adminPassword: 'corta' }, db);
    expect(result.success).toBe(false);
    expect(result.error?.toLowerCase()).toContain('contraseña');
  });

  it('runInitialSetup rechaza setup duplicado', async () => {
    const db = createMockDb();
    await runInitialSetup(validConfig, db);
    const second = await runInitialSetup(validConfig, db);
    expect(second.success).toBe(false);
    expect(second.error?.toLowerCase()).toContain('ya completado');
  });

  it('runHealthChecks reporta healthy sin IA', async () => {
    const db = createMockDb();
    const health = await runHealthChecks(db, undefined);
    expect(health.status).toBe('healthy');
    expect(health.checks.database?.status).toBe('pass');
    expect(health.checks.migrations?.status).toBe('pass');
    expect(health.checks.ai_provider?.status).toBe('pass');
    expect(health.timestamp).toBeDefined();
  });

  it('runHealthChecks reporta warn cuando IA no responde', async () => {
    const db = createMockDb();
    const health = await runHealthChecks(db, {
      type: 'ollama',
      baseUrl: 'http://no-resuelve.invalid:9999',
      timeoutMs: 100,
    });
    expect(health.status).toBe('degraded');
    expect(health.checks.ai_provider?.status).toBe('warn');
  });

  it('getAdminPanelConfig devuelve configuración', async () => {
    const db = createMockDb();
    // Pre-insertar instance para el test
    await runInitialSetup(validConfig, db);
    const config = await getAdminPanelConfig(db);
    expect(config.instanceName).toBe('Meridiano Test');
    expect(config.allowRegistration).toBe(true);
    expect(config.totalUsers).toBe(1);
    expect(config.aiProvider).toBe('disabled');
  });

  it('hashPassword/verifyPassword funcionan', async () => {
    const hash = await hashPassword('contraseña_segura_123456');
    expect(hash).toMatch(/^\$100000\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
  });
});
