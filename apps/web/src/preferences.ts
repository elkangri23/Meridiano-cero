import { useCallback, useEffect, useState } from 'react';
import { createPreferenceStore, normalizePreferences } from '@meridiano/case-schema';
import type { PaletteMode, PresentationPreferences } from '@meridiano/case-schema';

/** Preferencias persistentes (§15): la librería de case-schema guarda en
 * localStorage ('meridiano-cero-preferences-v1') y normaliza; aquí solo se
 * cablea a React y se aplica en el DOM. La paleta se aplica como clase en
 * <html> (las reglas viven en style.css y anulan las variables del juego y
 * del archivo); la escala, como font-size en <main> como ya hacía la
 * pantalla de juego; el alto contraste, como clase en <html> (la regla
 * .game-high-contrast ya existe en game.css). */
const store = createPreferenceStore();

export function applyPreferences(preferences: PresentationPreferences): void {
  const root = document.documentElement;
  root.classList.toggle('game-high-contrast', preferences.highContrast);
  for (const mode of ['protanopia', 'deuteranopia', 'tritanopia'] as const) {
    root.classList.toggle('palette-' + mode, preferences.palette === mode);
  }
}

export function usePreferences(): { preferences: PresentationPreferences; updatePreferences: (patch: Partial<PresentationPreferences>) => void } {
  const [preferences, setPreferences] = useState<PresentationPreferences>(() => store.load());
  useEffect(() => { applyPreferences(preferences); }, [preferences]);
  const updatePreferences = useCallback((patch: Partial<PresentationPreferences>) => {
    setPreferences(current => {
      const next = normalizePreferences({ ...current, ...patch });
      store.save(next);
      return next;
    });
  }, []);
  return { preferences, updatePreferences };
}

/** Etiquetas de las paletas en el selector de Ajustes. */
export const paletteLabels: Record<PaletteMode, string> = {
  default: 'Predeterminada',
  protanopia: 'Protanopia (rojo-verde)',
  deuteranopia: 'Deuteranopia (rojo-verde)',
  tritanopia: 'Tritanopia (azul-amarillo)',
  'high-contrast': 'Alto contraste (paleta)',
};
