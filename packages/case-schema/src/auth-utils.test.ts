import { describe, it, expect, vi } from 'vitest';
import { hashPassword, verifyPassword } from './auth-utils.js';

describe('auth-utils', () => {
  it('hashPassword produce hash válido', async () => {
    const hash = await hashPassword('contraseña_segura_123');
    expect(hash).toMatch(/^\$100000\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
  });

  it('verifyPassword acepta contraseña correcta', async () => {
    const password = 'mi_contraseña_larga_456';
    const hash = await hashPassword(password);
    const ok = await verifyPassword(password, hash);
    expect(ok).toBe(true);
  });

  it('verifyPassword rechaza contraseña incorrecta', async () => {
    const hash = await hashPassword('correcta_123');
    const ok = await verifyPassword('incorrecta_123', hash);
    expect(ok).toBe(false);
  });

  it('verifyPassword rechaza hash malformado', async () => {
    const ok = await verifyPassword('cualquiera', 'hash_invalido');
    expect(ok).toBe(false);
    const ok2 = await verifyPassword('cualquiera', '$100000$salt');
    expect(ok2).toBe(false);
  });

  it('hashPassword genera sal diferente cada vez', async () => {
    const hash1 = await hashPassword('misma_contraseña');
    const hash2 = await hashPassword('misma_contraseña');
    expect(hash1).not.toBe(hash2);
    // Ambos verifican correctamente
    expect(await verifyPassword('misma_contraseña', hash1)).toBe(true);
    expect(await verifyPassword('misma_contraseña', hash2)).toBe(true);
  });

  it('contraseña mínima 12 caracteres en setup', async () => {
    const hash = await hashPassword('123456789012'); // 12 chars
    expect(await verifyPassword('123456789012', hash)).toBe(true);
  });
});