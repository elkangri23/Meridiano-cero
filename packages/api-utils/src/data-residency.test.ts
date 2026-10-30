import { describe, it, expect } from 'vitest';
import { DEFAULT_RESIDENCY, DEFAULT_RETENTION, DEFAULT_KEY_ROTATION, DATA_INVENTORY, getRetentionDays, isExpired, calculateRetentionExpiry, generateDataInventoryReport, generateRetentionReport } from './data-residency.js';

describe('data-residency', () => {
  it('DEFAULT_RESIDENCY tiene configuración EU por defecto', () => {
    expect(DEFAULT_RESIDENCY.region).toBe('eu-west');
    expect(DEFAULT_RESIDENCY.jurisdiction).toBe('EU');
    expect(DEFAULT_RESIDENCY.storageLocation).toContain('Frankfurt');
    expect(DEFAULT_RESIDENCY.backupLocation).toContain('Dublin');
    expect(DEFAULT_RESIDENCY.aiProviderRegion).toBe('EU');
  });

  it('DEFAULT_RETENTION tiene 7 políticas', () => {
    expect(DEFAULT_RETENTION).toHaveLength(7);
    const types = DEFAULT_RETENTION.map(p => p.dataType);
    expect(types).toContain('account');
    expect(types).toContain('session');
    expect(types).toContain('run');
    expect(types).toContain('conversation');
    expect(types).toContain('usage');
    expect(types).toContain('log');
    expect(types).toContain('backup');
  });

  it('DEFAULT_RETENTION actions son válidas', () => {
    const validActions = ['delete', 'anonymize', 'archive', 'retain'];
    for (const policy of DEFAULT_RETENTION) {
      expect(validActions).toContain(policy.action);
    }
  });

  it('DEFAULT_KEY_ROTATION tiene valores esperados', () => {
    expect(DEFAULT_KEY_ROTATION.masterKeyRotationDays).toBe(90);
    expect(DEFAULT_KEY_ROTATION.sessionTokenRotationDays).toBe(30);
    expect(DEFAULT_KEY_ROTATION.csrfTokenRotationHours).toBe(8);
    expect(DEFAULT_KEY_ROTATION.recoveryTokenExpirationHours).toBe(1);
    expect(DEFAULT_KEY_ROTATION.apiKeyRotationDays).toBe(180);
  });

  it('DATA_INVENTORY tiene 8 categorías', () => {
    expect(DATA_INVENTORY).toHaveLength(8);
    const categories = DATA_INVENTORY.map(i => i.category);
    expect(categories).toContain('Cuenta');
    expect(categories).toContain('Sesión');
    expect(categories).toContain('Partida');
    expect(categories).toContain('Conversación');
    expect(categories).toContain('Uso IA');
    expect(categories).toContain('Logs');
    expect(categories).toContain('Credenciales IA');
    expect(categories).toContain('Backup');
  });

  it('DATA_INVENTORY todos tienen campos requeridos', () => {
    for (const item of DATA_INVENTORY) {
      expect(item.category).toBeDefined();
      expect(item.dataType).toBeDefined();
      expect(item.storageLocation).toBeDefined();
      expect(typeof item.containsPII).toBe('boolean');
      expect(typeof item.encrypted).toBe('boolean');
      expect(typeof item.retentionDays).toBe('number');
      expect(typeof item.backupIncluded).toBe('boolean');
      expect(item.provider).toBeDefined();
    }
  });

  it('getRetentionDays devuelve días correctos', () => {
    expect(getRetentionDays('account')).toBe(1095);
    expect(getRetentionDays('session')).toBe(30);
    expect(getRetentionDays('run')).toBe(730);
    expect(getRetentionDays('conversation')).toBe(90);
    expect(getRetentionDays('usage')).toBe(365);
    expect(getRetentionDays('log')).toBe(90);
    expect(getRetentionDays('backup')).toBe(30);
    expect(getRetentionDays('unknown')).toBe(365); // default
  });

  it('isExpired devuelve true para datos antiguos', () => {
    const oldDate = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000); // 40 días atrás
    expect(isExpired('session', oldDate)).toBe(true); // session retención 30 días
  });

  it('isExpired devuelve false para datos recientes', () => {
    const recentDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 días atrás
    expect(isExpired('session', recentDate)).toBe(false);
  });

  it('calculateRetentionExpiry calcula fecha correcta', () => {
    const createdAt = new Date('2024-01-01');
    const expiry = calculateRetentionExpiry('session', createdAt);
    const expected = new Date(createdAt.getTime() + 30 * 24 * 60 * 60 * 1000);
    expect(expiry.getTime()).toBe(expected.getTime());
  });

  it('generateDataInventoryReport produce tabla markdown', () => {
    const report = generateDataInventoryReport();
    expect(report).toContain('# Inventario de Datos por Proveedor');
    expect(report).toContain('| Categoría | Tipo de dato |');
    expect(report).toContain('Cuenta');
    expect(report).toContain('Sesión');
    expect(report).toContain('Partida');
  });

  it('generateRetentionReport produce tabla markdown', () => {
    const report = generateRetentionReport();
    expect(report).toContain('# Política de Retención de Datos');
    expect(report).toContain('| Tipo de dato | Retención (días) | Acción |');
    expect(report).toContain('account');
    expect(report).toContain('session');
    expect(report).toContain('run');
  });
});