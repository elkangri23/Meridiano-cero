import { describe, it, expect, vi } from 'vitest';
import {
  createDefaultPreferences, normalizePreferences, clampScale, clampVolume, clampRate,
  createPreferenceStore, type PresentationPreferences,
} from './preferences.js';

describe('preferences', () => {
  it('createDefaultPreferences devuelve valores sanos', () => {
    const p = createDefaultPreferences();
    expect(p.version).toBe(1);
    expect(p.fontMode).toBe('retro');
    expect(p.textScale).toBe(100);
    expect(p.palette).toBe('default');
    expect(p.language).toBe('es');
    expect(p.audio.muted).toBe(false);
    expect(p.tts.enabled).toBe(false);
    expect(p.accessibility.focusVisible).toBe(true);
  });

  it('clampScale limita rango 100-200', () => {
    expect(clampScale(50)).toBe(100);
    expect(clampScale(150)).toBe(150);
    expect(clampScale(300)).toBe(200);
    expect(clampScale(NaN)).toBe(100);
  });

  it('clampVolume limita rango 0-100', () => {
    expect(clampVolume(-5)).toBe(0);
    expect(clampVolume(150)).toBe(100);
    expect(clampVolume(NaN)).toBe(0);
  });

  it('clampRate limita rango 0.5-2', () => {
    expect(clampRate(0.1)).toBe(0.5);
    expect(clampRate(3)).toBe(2);
    expect(clampRate(NaN)).toBe(1);
    expect(clampRate(1.234)).toBe(1.23);
  });

  it('normalizePreferences rellene valores invalidos con defaults', () => {
    const p = normalizePreferences({ fontMode: 'bold', textScale: 'alto', palette: 'rojo', language: 'x' } as any);
    expect(p.fontMode).toBe('retro');
    expect(p.textScale).toBe(100);
    expect(p.palette).toBe('default');
    expect(p.language).toBe('es');
  });

  it('normalizePreferences conserva valores validos', () => {
    const p = normalizePreferences({
      fontMode: 'accessible', textScale: 140, palette: 'protanopia', language: 'en',
      audio: { musicVolume: 10, effectsVolume: 20, narrationVolume: 30, muted: true },
      tts: { enabled: true, voice: 'v1', rate: 1.5, autoRead: true },
      accessibility: { reducedMotion: true, focusVisible: false, skipNav: false, announceNarration: false },
    });
    expect(p.fontMode).toBe('accessible');
    expect(p.textScale).toBe(140);
    expect(p.palette).toBe('protanopia');
    expect(p.language).toBe('en');
    expect(p.audio.muted).toBe(true);
    expect(p.tts.rate).toBe(1.5);
    expect(p.accessibility.focusVisible).toBe(false);
  });

  it('normalizePreferences sobre null/undefined devuelve defaults', () => {
    expect(normalizePreferences(undefined)).toEqual(createDefaultPreferences());
    expect(normalizePreferences(null)).toEqual(createDefaultPreferences());
  });

  it('createPreferenceStore guarda y carga preferencias', () => {
    const store = createPreferenceStore();
    const p = createDefaultPreferences();
    p.textScale = 160;
    p.language = 'fr';
    expect(store.save(p)).toBe(true);
    const loaded = store.load();
    expect(loaded.textScale).toBe(160);
    expect(loaded.language).toBe('fr');
  });

  it('createPreferenceStore load devuelve defaults si no hay nada', () => {
    const store = createPreferenceStore();
    expect(store.load()).toEqual(createDefaultPreferences());
  });

  it('createPreferenceStore load es tolerante a JSON corrupto', () => {
    const store = createPreferenceStore();
    store.save({} as any); // guardado directo de JSON invalido
    // Sobrescribimos con JSON basura manualmente
    const raw = '{invalid';
    const map = new Map<string, string>();
    map.set('meridiano-cero-preferences-v1', raw);
    const broken: any = {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => { map.set(k, v); },
      removeItem: (k: string) => { map.delete(k); },
    };
    const store2 = createPreferenceStore(broken);
    expect(store2.load()).toEqual(createDefaultPreferences());
  });

  it('createPreferenceStore clear elimina preferencias', () => {
    const store = createPreferenceStore();
    store.save(createDefaultPreferences());
    expect(store.clear()).toBe(true);
    expect(store.load()).toEqual(createDefaultPreferences());
  });

  it('createPreferenceStore save falla con storage que lanza', () => {
    const throwing: any = {
      getItem: () => { throw new Error('boom'); },
      setItem: () => { throw new Error('boom'); },
      removeItem: () => { throw new Error('boom'); },
    };
    const store = createPreferenceStore(throwing);
    expect(store.save(createDefaultPreferences())).toBe(false);
    expect(store.load()).toEqual(createDefaultPreferences());
    expect(store.clear()).toBe(false);
  });

  it('normalizePreferences aplica prefers-reduced-motion del sistema', () => {
    const p = normalizePreferences({ accessibility: { reducedMotion: true } } as any);
    expect(p.accessibility.reducedMotion).toBe(true);
  });
});
