// Preferencias de presentación persistentes (T5-05)
// SPEC-006: audio/TTS, idiomas, accesibilidad y contraste. No almacena estado de partida.

export type FontMode = 'retro' | 'accessible';
export type PaletteMode = 'default' | 'protanopia' | 'deuteranopia' | 'tritanopia' | 'high-contrast';
export type Language = 'es' | 'en' | 'fr';

export interface AudioSettings {
  musicVolume: number; // 0-100
  effectsVolume: number; // 0-100
  narrationVolume: number; // 0-100
  muted: boolean;
}

export interface TTSSettings {
  enabled: boolean;
  voice: string; // nombre de voz o 'auto'
  rate: number; // 0.5 - 2
  autoRead: boolean;
}

export interface AccessibilitySettings {
  reducedMotion: boolean;
  focusVisible: boolean;
  skipNav: boolean;
  announceNarration: boolean;
}

export interface PresentationPreferences {
  version: 1;
  fontMode: FontMode;
  textScale: number; // 100-200
  palette: PaletteMode;
  language: Language;
  audio: AudioSettings;
  tts: TTSSettings;
  accessibility: AccessibilitySettings;
}

const STORAGE_KEY = 'meridiano-cero-preferences-v1';

const DEFAULTS: PresentationPreferences = {
  version: 1,
  fontMode: 'retro',
  textScale: 100,
  palette: 'default',
  language: 'es',
  audio: { musicVolume: 60, effectsVolume: 70, narrationVolume: 80, muted: false },
  tts: { enabled: false, voice: 'auto', rate: 1, autoRead: false },
  accessibility: { reducedMotion: false, focusVisible: true, skipNav: true, announceNarration: true },
};

export function createDefaultPreferences(): PresentationPreferences {
  return structuredClone(DEFAULTS);
}

export function clampScale(value: number): number {
  if (!Number.isFinite(value)) return 100;
  return Math.min(200, Math.max(100, Math.round(value)));
}

export function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function clampRate(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(2, Math.max(0.5, Math.round(value * 100) / 100));
}

export function normalizePreferences(input: Partial<PresentationPreferences>): PresentationPreferences {
  const base = createDefaultPreferences();
  if (!input || typeof input !== 'object') return base;
  const fontMode: FontMode = input.fontMode === 'accessible' ? 'accessible' : 'retro';
  const palette: PaletteMode = (['default', 'protanopia', 'deuteranopia', 'tritanopia', 'high-contrast'] as const)
    .includes(input.palette as PaletteMode)
    ? (input.palette as PaletteMode)
    : 'default';
  const language: Language = (['es', 'en', 'fr'] as const).includes(input.language as Language)
    ? (input.language as Language)
    : 'es';
  return {
    version: 1,
    fontMode,
    textScale: clampScale(input.textScale),
    palette,
    language,
    audio: {
      musicVolume: clampVolume(input.audio?.musicVolume ?? base.audio.musicVolume),
      effectsVolume: clampVolume(input.audio?.effectsVolume ?? base.audio.effectsVolume),
      narrationVolume: clampVolume(input.audio?.narrationVolume ?? base.audio.narrationVolume),
      muted: Boolean(input.audio?.muted),
    },
    tts: {
      enabled: Boolean(input.tts?.enabled),
      voice: typeof input.tts?.voice === 'string' ? input.tts.voice : 'auto',
      rate: clampRate(input.tts?.rate ?? base.tts.rate),
      autoRead: Boolean(input.tts?.autoRead),
    },
    accessibility: {
      reducedMotion: Boolean(input.accessibility?.reducedMotion),
      focusVisible: input.accessibility?.focusVisible !== false,
      skipNav: input.accessibility?.skipNav !== false,
      announceNarration: Boolean(input.accessibility?.announceNarration),
    },
  };
}

export interface PreferenceStore {
  load(): PresentationPreferences;
  save(prefs: PresentationPreferences): boolean;
  clear(): boolean;
}

export function createPreferenceStore(storage: StorageLike = defaultStorage()): PreferenceStore {
  return {
    load() {
      try {
        const raw = storage.getItem(STORAGE_KEY);
        if (!raw) return createDefaultPreferences();
        const parsed = JSON.parse(raw) as Partial<PresentationPreferences>;
        return normalizePreferences(parsed);
      } catch {
        return createDefaultPreferences();
      }
    },
    save(prefs) {
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(normalizePreferences(prefs)));
        return true;
      } catch {
        return false;
      }
    },
    clear() {
      try {
        storage.removeItem(STORAGE_KEY);
        return true;
      } catch {
        return false;
      }
    },
  };
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function defaultStorage(): StorageLike {
  if (typeof localStorage !== 'undefined') return localStorage;
  const store = new Map<string, string>();
  return {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => { store.set(k, v); },
    removeItem: (k) => { store.delete(k); },
  };
}