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
  /** Interruptores propios de música y efectos (GDD §15): el volumen 0 ya
   * los silencia, pero el bucle de música necesita un arranque/parada
   * explícito y no debe intentar sonar solo al cargar la página. */
  musicEnabled: boolean;
  effectsEnabled: boolean;
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
  /** Alto contraste como interruptor propio (la paleta 'high-contrast' del
   * catálogo también lo activa al normalizar): la web lo enseñaba como
   * `useState` local sin persistir, y la librería no lo cubría. */
  highContrast: boolean;
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
  highContrast: false,
  language: 'es',
  audio: { musicVolume: 60, effectsVolume: 70, narrationVolume: 80, muted: false, musicEnabled: true, effectsEnabled: true },
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

/** Alto contraste de unas preferencias en bruto: el interruptor propio o la
 * paleta 'high-contrast' del catálogo. */
function resolveHighContrast(input: Partial<PresentationPreferences>): boolean {
  return input.highContrast === true || input.palette === 'high-contrast';
}

const PALETTE_MODES: readonly PaletteMode[] = ['default', 'protanopia', 'deuteranopia', 'tritanopia', 'high-contrast'];
const LANGUAGES: readonly Language[] = ['es', 'en', 'fr'];

/** Valor de una lista cerrada, o el respaldo si no es un valor válido. */
function pickFromList<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) return value as T;
  return fallback;
}

function normalizeAudio(input: Partial<PresentationPreferences>, base: PresentationPreferences): AudioSettings {
  return {
    musicVolume: clampVolume(input.audio?.musicVolume ?? base.audio.musicVolume),
    effectsVolume: clampVolume(input.audio?.effectsVolume ?? base.audio.effectsVolume),
    narrationVolume: clampVolume(input.audio?.narrationVolume ?? base.audio.narrationVolume),
    muted: Boolean(input.audio?.muted),
    // Las preferencias guardadas antes de este lote no traen los
    // interruptores: se encienden por defecto (la música sigue sin sonar
    // hasta el primer gesto del usuario, por la política de autoplay).
    musicEnabled: input.audio?.musicEnabled !== false,
    effectsEnabled: input.audio?.effectsEnabled !== false,
  };
}

function normalizeTts(input: Partial<PresentationPreferences>, base: PresentationPreferences): TTSSettings {
  return {
    enabled: Boolean(input.tts?.enabled),
    voice: typeof input.tts?.voice === 'string' ? input.tts.voice : 'auto',
    rate: clampRate(input.tts?.rate ?? base.tts.rate),
    autoRead: Boolean(input.tts?.autoRead),
  };
}

function normalizeAccessibility(input: Partial<PresentationPreferences>): AccessibilitySettings {
  return {
    reducedMotion: Boolean(input.accessibility?.reducedMotion),
    focusVisible: input.accessibility?.focusVisible !== false,
    skipNav: input.accessibility?.skipNav !== false,
    announceNarration: Boolean(input.accessibility?.announceNarration),
  };
}

export function normalizePreferences(input: Partial<PresentationPreferences> | null | undefined): PresentationPreferences {
  const base = createDefaultPreferences();
  if (!input || typeof input !== 'object') return base;
  return {
    version: 1,
    fontMode: input.fontMode === 'accessible' ? 'accessible' : 'retro',
    textScale: clampScale(input.textScale ?? base.textScale),
    palette: pickFromList(input.palette, PALETTE_MODES, 'default'),
    highContrast: resolveHighContrast(input),
    language: pickFromList(input.language, LANGUAGES, 'es'),
    audio: normalizeAudio(input, base),
    tts: normalizeTts(input, base),
    accessibility: normalizeAccessibility(input),
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
