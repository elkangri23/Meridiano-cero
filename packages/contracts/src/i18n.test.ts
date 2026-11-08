// Sistema de locales: fallback, interpolación y claves inexistentes.
import { describe, expect, it, vi } from 'vitest';
import { createTranslator, formatMessage, resolveMessage, SUPPORTED_LANGUAGES } from './i18n.js';
import { ES_MESSAGES } from './locales/es.js';

describe('formatMessage', () => {
  it('sustituye las variables {nombre}', () => {
    expect(formatMessage('Hola {name}, llevas {minutes} min.', { name: 'Lucía', minutes: 10 }))
      .toBe('Hola Lucía, llevas 10 min.');
  });
  it('deja el hueco tal cual si falta la variable', () => {
    expect(formatMessage('Hola {name}.', {})).toBe('Hola {name}.');
  });
  it('sin variables devuelve la plantilla intacta', () => {
    expect(formatMessage('Sin variables.')).toBe('Sin variables.');
  });
});

describe('createTranslator', () => {
  it('resuelve en español por defecto', () => {
    const { t } = createTranslator('es');
    expect(t('common.confirm')).toBe('Confirmar');
    expect(t('common.minutes', { count: 10 })).toBe('10 min');
  });
  it('en inglés cae al español porque en.json está vacío (sin traducir)', () => {
    const { t, missingKeys } = createTranslator('en');
    expect(t('common.confirm')).toBe('Confirmar');
    expect(t('settings.language')).toBe('Idioma');
    expect(missingKeys()).toContain('common.confirm');
  });
  it('en francés también cae al español', () => {
    const { t } = createTranslator('fr');
    expect(t('common.cancel')).toBe('Cancelar');
  });
  it('una clave inexistente devuelve la clave y avisa una sola vez', () => {
    const onMissing = vi.fn();
    const translator = createTranslator('es', onMissing);
    const key = 'no.existe' as never;
    expect(translator.t(key)).toBe('no.existe');
    expect(translator.t(key)).toBe('no.existe');
    expect(onMissing).toHaveBeenCalledTimes(1);
    expect(onMissing).toHaveBeenCalledWith('no.existe');
    expect(translator.missingKeys()).toEqual(['no.existe']);
  });
  it('el español no marca como ausentes sus propias claves', () => {
    const { missingKeys } = createTranslator('es');
    expect(missingKeys()).toEqual([]);
  });
});

describe('resolveMessage', () => {
  it('resuelve en el idioma elegido cuando existe, si no en español', () => {
    expect(resolveMessage('es', 'common.cancel')).toBe('Cancelar');
    expect(resolveMessage('en', 'common.cancel')).toBe('Cancelar');
    expect(resolveMessage('fr', 'common.cancel')).toBe('Cancelar');
    expect(resolveMessage('en', 'no.existe')).toBe('no.existe');
  });
});

describe('locales', () => {
  it('todas las claves de es.json tienen texto no vacío', () => {
    for (const [key, value] of Object.entries(ES_MESSAGES)) {
      expect(typeof value, key).toBe('string');
      expect(value.length, key).toBeGreaterThan(0);
    }
  });
  it('el selector ofrece español e inglés con su nombre nativo', () => {
    expect(SUPPORTED_LANGUAGES).toEqual([
      { id: 'es', label: 'Español' },
      { id: 'en', label: 'English' },
    ]);
  });
});
