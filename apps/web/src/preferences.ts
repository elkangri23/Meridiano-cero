import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { createPreferenceStore, createTranslator, normalizePreferences } from '@meridiano/contracts';
import type { LocaleKey, PaletteMode, PresentationPreferences, TranslateVars } from '@meridiano/contracts';

/** Preferencias persistentes (§15): la librería de contracts guarda en
 * localStorage ('meridiano-cero-preferences-v1') y normaliza; aquí solo se
 * cablea a React y se aplica en el DOM. La paleta se aplica como clase en
 * <html> (las reglas viven en style.css y anulan las variables del juego y
 * del archivo); la escala, como font-size en <main> como ya hacía la
 * pantalla de juego; el alto contraste, como clase en <html> (la regla
 * .game-high-contrast ya existe en game.css); el movimiento reducido, la
 * fuente legible y el foco discreto, también como clases en <html> (§15).
 *
 * El estado es COMPARTIDO entre todas las instancias del hook: el
 * proveedor de idiomas de `main.tsx` y la pantalla de juego leen el mismo
 * valor en memoria, así cambiar el idioma en Ajustes re-renderiza toda la
 * app sin recargar. Sin esto, cada `usePreferences()` tendría su propia
 * copia y el idioma no se aplicaría hasta la siguiente recarga. */
const store = createPreferenceStore();
let current = store.load();
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Preferencias actuales en memoria (la única fuente de verdad del hook). */
export function getPreferences(): PresentationPreferences {
  return current;
}

function setPreferences(next: PresentationPreferences): void {
  current = normalizePreferences(next);
  store.save(current);
  emit();
}

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
  const preferences = useSyncExternalStore(subscribe, () => current);
  useEffect(() => { applyPreferences(preferences); }, [preferences]);
  const updatePreferences = useCallback((patch: Partial<PresentationPreferences>) => {
    setPreferences({ ...current, ...patch });
  }, []);
  return { preferences, updatePreferences };
}

/** Traduce con el idioma actual de las preferencias (para el código que
 * no es un componente React: avisos del modelo del archivo). Resuelve en
 * español cuando el idioma elegido no traduce la clave. */
export function translateUi(key: LocaleKey, vars?: TranslateVars): string {
  return createTranslator(current.language).t(key, vars);
}

/** Claves de las etiquetas de las paletas en el selector de Ajustes (los
 * textos viven en los locales; antes eran literales en español aquí y se
 * veían en español con la interfaz en inglés o francés). */
export const paletteLabelKeys: Record<PaletteMode, LocaleKey> = {
  default: 'labels.palette.default',
  protanopia: 'labels.palette.protanopia',
  deuteranopia: 'labels.palette.deuteranopia',
  tritanopia: 'labels.palette.tritanopia',
  'high-contrast': 'labels.palette.highContrast',
};
