import { describe, it, expect, vi } from 'vitest';
import { runInitialSetup, runHealthChecks, getAdminPanelConfig, type SetupConfig } from './setup-admin.js';
import { hashPassword } from './auth-utils.js';

function createMockDb() {
  const users: any[] = [];
  const instances: any[] = [];
  const baseMigrations: any[] = [{ name: '0000_base', hash: 'abc' }];
  return {
    query: vi.fn().mockImplementation((sql: string, params: any[] = []) => {
      const sqlLower = sql.toLowerCase();
      if (sqlLower.includes('from users where role')) {
        return Promise.resolve({ rows: users.filter(u => u.role === params[0]) });
      }
      if (sqlLower.includes('insert into users')) {
        const row = { id: 'user-1', email: params[0], name: params[2], role: 'admin' };
        users.push(row);
        return Promise.resolve({ rows: [row] });
      }
      if (sqlLower.includes('insert into detective_profiles')) {
        return Promise.resolve({ rows: [{ id: 'dp-1' }] });
      }
      if (sqlLower.includes('insert into instances')) {
        const row = { id: 'inst-1', name: params[0], allow_registration: params[1], default_ai_provider: params[2] };
        instances.push(row);
        return Promise.resolve({ rows: [row] });
      }
      if (sqlLower.includes('select 1')) return Promise.resolve({ rows: [{ '?': 1 }] });
      if (sqlLower.includes('select count(*) as count from base_migrations')) {
        return Promise.resolve({ rows: [{ count: String(baseMigrations.length) }] });
      }
      if (sqlLower.includes('from base_migrations')) return Promise.resolve({ rows: baseMigrations });
      if (sqlLower.includes('select pg_database_size')) return Promise.resolve({ rows: [{ size: 1024 * 1024 * 10 }] });
      if (sqlLower.includes('select count(*) as count from users')) return Promise.resolve({ rows: [{ count: String(users.length) }] });
      if (sqlLower.includes('select count(*) as count from case_runs')) return Promise.resolve({ rows: [{ count: '0' }] });
      if (sqlLower.includes('from instances order by created_at desc')) return Promise.resolve({ rows: instances.slice(-1) });
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
    const result = await runInitialSetup(validConfig, db as any);
    expect(result.success).toBe(true);
    expect(result.adminUserId).toBe('user-1');
    expect(result.instanceId).toBe('inst-1');
    expect(db.query).toHaveBeenCalled();
  });

  it('runInitialSetup rechaza email inválido', async () => {
    const db = createMockDb();
    const result = await runInitialSetup({ ...validConfig, adminEmail: 'no-email' }, db as any);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Email');
  });

  it('runInitialSetup rechaza contraseña corta', async () => {
    const db = createMockDb();
    const result = await runInitialSetup({ ...validConfig, adminPassword: 'corta' }, db as any);
    expect(result.success).toBe(false);
    expect(result.error?.toLowerCase()).toContain('contraseña');
  });

  it('runInitialSetup rechaza setup duplicado', async () => {
    const db = createMockDb();
    await runInitialSetup(validConfig, db as any);
    const second = await runInitialSetup(validConfig, db as any);
    expect(second.success).toBe(false);
    expect(second.error?.toLowerCase()).toContain('ya completado');
  });

  it('runHealthChecks reporta healthy sin IA', async () => {
    const db = createMockDb();
    const health = await runHealthChecks(db as any, undefined);
    expect(health.status).toBe('healthy');
    expect(health.checks.database?.status).toBe('pass');
    expect(health.checks.migrations?.status).toBe('pass');
    expect(health.checks.ai_provider?.status).toBe('pass');
    expect(health.timestamp).toBeDefined();
  });

  it('runHealthChecks reporta warn cuando IA no responde', async () => {
    const db = createMockDb();
    const health = await runHealthChecks(db as any, {
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
    await runInitialSetup(validConfig, db as any);
    const config = await getAdminPanelConfig(db as any);
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