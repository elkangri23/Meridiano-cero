import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { createTranslator } from '@meridiano/contracts';
import type { Language, TranslateFn } from '@meridiano/contracts';

/** Traducción en React (T5-05, i18n): `useTranslation()` devuelve `t`
 * ligada al idioma de las preferencias. Se monta una sola vez en
 * `main.tsx` (con el idioma del hook compartido de preferencias), así
 * cambiar el idioma en Ajustes re-renderiza toda la app. Fuera del
 * proveedor (tests que montan un componente suelto) `t` resuelve en
 * español, nunca en vacío: la interfaz nunca enseña una clave cruda por
 * falta de proveedor. */
const fallbackTranslator = createTranslator('es');
const TranslationContext = createContext<TranslateFn>(fallbackTranslator.t);

export function I18nProvider({ language, children }: { language: Language; children: ReactNode }) {
  const translator = useMemo(() => createTranslator(language, key => {
    if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
      console.warn(`[i18n] Falta la traducción de "${key}" en "${language}": se usa español.`);
    }
  }), [language]);
  return <TranslationContext.Provider value={translator.t}>{children}</TranslationContext.Provider>;
}

export function useTranslation(): TranslateFn {
  return useContext(TranslationContext);
}
