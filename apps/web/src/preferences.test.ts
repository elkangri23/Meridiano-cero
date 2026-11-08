// Preferencias persistentes (§15): la paleta se aplica como clase en <html>
// y el alto contraste como clase; el test usa un document mínimo porque la
// suite unitaria corre en node (sin jsdom).
import { describe, expect, it } from 'vitest';
import { applyPreferences, paletteLabels } from './preferences';

/** Preferencias completas sin importar la librería (el doble local evita
 * que el test añada otra violación web-isolation; la forma real la cubre el
 * test de la librería). */
type Palette = 'default' | 'protanopia' | 'deuteranopia' | 'tritanopia' | 'high-contrast';
function prefs(patch: { palette?: Palette; highContrast?: boolean }) {
  return {
    version: 1 as const,
    fontMode: 'retro' as const,
    textScale: 100,
    palette: 'default' as Palette,
    highContrast: false,
    language: 'es' as const,
    audio: { musicVolume: 60, effectsVolume: 70, narrationVolume: 80, muted: false, musicEnabled: true, effectsEnabled: true },
    tts: { enabled: false, voice: 'auto', rate: 1, autoRead: false },
    accessibility: { reducedMotion: false, focusVisible: true, skipNav: true, announceNarration: true },
    ...patch,
  };
}

function stubDocument(): { classes: Set<string> } {
  const classes = new Set<string>();
  const documentElement = {
    classList: {
      toggle(name: string, force?: boolean) {
        if (force) classes.add(name); else classes.delete(name);
      },
    },
  };
  (globalThis as unknown as { document: unknown }).document = { documentElement };
  return { classes };
}

describe('Preferencias persistentes (§15)', () => {
  it('cada paleta de la librería tiene etiqueta en español', () => {
    expect(Object.keys(paletteLabels).sort()).toEqual(['default', 'deuteranopia', 'high-contrast', 'protanopia', 'tritanopia']);
    for (const label of Object.values(paletteLabels)) expect(label.length).toBeGreaterThan(0);
  });

  it('la paleta de daltonismo pone su clase y quita las demás', () => {
    const { classes } = stubDocument();
    applyPreferences(prefs({ palette: 'protanopia', highContrast: false }));
    expect(classes.has('palette-protanopia')).toBe(true);
    expect(classes.has('palette-deuteranopia')).toBe(false);
    applyPreferences(prefs({ palette: 'deuteranopia', highContrast: false }));
    expect(classes.has('palette-protanopia')).toBe(false);
    expect(classes.has('palette-deuteranopia')).toBe(true);
  });

  it('la paleta predeterminada no deja ninguna clase de paleta', () => {
    const { classes } = stubDocument();
    applyPreferences(prefs({ palette: 'tritanopia', highContrast: false }));
    applyPreferences(prefs({ palette: 'default', highContrast: false }));
    expect([...classes].filter(name => name.startsWith('palette-'))).toEqual([]);
  });

  it('el alto contraste pone su clase sin tocar la paleta', () => {
    const { classes } = stubDocument();
    applyPreferences(prefs({ palette: 'protanopia', highContrast: true }));
    expect(classes.has('game-high-contrast')).toBe(true);
    expect(classes.has('palette-protanopia')).toBe(true);
    applyPreferences(prefs({ palette: 'protanopia', highContrast: false }));
    expect(classes.has('game-high-contrast')).toBe(false);
    expect(classes.has('palette-protanopia')).toBe(true);
  });
});
