import { describe, it, expect } from 'vitest';
import { ES_MESSAGES, EN_MESSAGES, FR_MESSAGES } from '@meridiano/contracts';
import {
  ASSETS,
  DIRECT_DEPENDENCIES,
  FILE_LEVEL_COPYLEFT_LICENSES,
  KNOWN_LICENSES,
  PERMISSIVE_LICENSES,
} from './creditos.js';

describe('créditos y licencias', () => {
  it('toda dependencia directa usa una licencia conocida y compatible', () => {
    expect(DIRECT_DEPENDENCIES.length).toBeGreaterThan(0);
    const names = new Set<string>();
    for (const dep of DIRECT_DEPENDENCIES) {
      expect(names.has(dep.name), `dependencia duplicada: ${dep.name}`).toBe(false);
      names.add(dep.name);
      expect(KNOWN_LICENSES).toContain(dep.license);
      expect(ES_MESSAGES[dep.useKey]).toBeTruthy();
    }
    // Solo lightningcss (compilación) usa copyleft a nivel de archivo; el
    // resto de directas son permisivas.
    const copyleft = DIRECT_DEPENDENCIES.filter(dep => (FILE_LEVEL_COPYLEFT_LICENSES as readonly string[]).includes(dep.license));
    expect(copyleft.map(dep => dep.name)).toEqual(['lightningcss']);
    expect(PERMISSIVE_LICENSES.length).toBeGreaterThan(0);
  });

  it('cada asset tiene nombre, descripción y licencia con texto en los 3 idiomas', () => {
    expect(ASSETS.length).toBeGreaterThan(0);
    for (const asset of ASSETS) {
      expect(ES_MESSAGES[asset.nameKey]).toBeTruthy();
      expect(ES_MESSAGES[asset.descriptionKey]).toBeTruthy();
      expect(ES_MESSAGES[asset.licenseKey]).toBeTruthy();
      expect(EN_MESSAGES[asset.nameKey]).toBeTruthy();
      expect(FR_MESSAGES[asset.nameKey]).toBeTruthy();
    }
  });

  it('todas las claves de créditos existen en español, inglés y francés', () => {
    const keys = Object.keys(ES_MESSAGES).filter(key => key.startsWith('credits.') || key === 'archive.credits');
    expect(keys.length).toBeGreaterThan(20);
    for (const key of keys) {
      expect(EN_MESSAGES[key as keyof typeof EN_MESSAGES], `falta en inglés: ${key}`).toBeTruthy();
      expect(FR_MESSAGES[key as keyof typeof FR_MESSAGES], `falta en francés: ${key}`).toBeTruthy();
    }
  });
});
