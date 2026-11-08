import { useCallback, useEffect, useState } from 'react';
import { createPreferenceStore, normalizePreferences } from '@meridiano/contracts';
import type { PaletteMode, PresentationPreferences } from '@meridiano/contracts';

/** Preferencias persistentes (§15): la librería de case-schema guarda en
 * localStorage ('meridiano-cero-preferences-v1') y normaliza; aquí solo se
 * cablea a React y se aplica en el DOM. La paleta se aplica como clase en
 * <html> (las reglas viven en style.css y anulan las variables del juego y
 * del archivo); la escala, como font-size en <main> como ya hacía la
 * pantalla de juego; el alto contraste, como clase en <html> (la regla
 * .game-high-contrast ya existe en game.css); el movimiento reducido, la
 * fuente legible y el foco discreto, también como clases en <html> (§15). */
const store = createPreferenceStore();

export function applyPreferences(preferences: PresentationPreferences): void {
  const root = document.documentElement;
  root.classList.toggle('game-high-contrast', preferences.highContrast);
  for (const mode of ['protanopia', 'deuteranopia', 'tritanopia'] as const) {
    root.classList.toggle('palette-' + mode, preferences.palette === mode);
  }
  // Accesibilidad (§15): el movimiento reducido desactiva animaciones y
  // transiciones del juego (game.css), la fuente legible cambia la familia
  // tipográfica (style.css) y el foco discreto adelgaza el contorno sin
  // quitarlo nunca (WCAG 2.4.11: el foco siempre es visible).
  root.classList.toggle('game-reduced-motion', preferences.accessibility.reducedMotion);
  root.classList.toggle('game-font-accessible', preferences.fontMode === 'accessible');
  root.classList.toggle('game-focus-subtle', !preferences.accessibility.focusVisible);
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
