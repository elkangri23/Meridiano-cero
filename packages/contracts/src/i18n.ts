// Sistema de locales (T5-05, i18n; SPEC-006: interfaz preparada para
// traducciones desde el primer hito, español inicial).
//
// Cómo funciona: cada texto de la interfaz tiene una clave en
// `locales/es.ts` (el idioma de referencia). `createTranslator(idioma)`
// devuelve `t(clave, variables)` que busca la clave en el idioma elegido
// y, si falta, cae al español; si no existe en ningún idioma, devuelve la
// propia clave (nunca rompe el juego ni deja un hueco vacío) y la anota
// en `missingKeys()` para que los tests y el desarrollo la detecten.
// La interpolación es `{variable}` (p. ej. `{minutes}`, `{name}`).
//
// El idioma es una preferencia del jugador (`preferences.language`) que
// vive en localStorage; la web lo manda en cada petición de juego en la
// cabecera `x-meridiano-language` y la API lo valida con `parseLanguage`.
// Los textos del motor y del expediente se resuelven en ese idioma
// (`engine.*` y `cases.*` en `es.ts`); sin cabecera o con valor inválido,
// todo sigue en español.
import { ES_MESSAGES, type LocaleKey } from './locales/es.js';
import { EN_MESSAGES } from './locales/en.js';
import { FR_MESSAGES } from './locales/fr.js';
import type { Language } from './preferences.js';

export type { LocaleKey } from './locales/es.js';

/** Variables de interpolación de un mensaje (`{nombre}`). */
export type TranslateVars = Record<string, string | number>;

/** Función de traducción: clave tipada + variables opcionales. */
export type TranslateFn = (key: LocaleKey, vars?: TranslateVars) => string;

export interface Translator {
  readonly locale: Language;
  readonly t: TranslateFn;
  /** Claves que hubo que resolver en español (o que no existen). */
  missingKeys(): string[];
}

/** Idiomas que se ofrecen en el selector de Ajustes, con su nombre
 * nativo: el nombre de cada idioma se escribe en ese idioma, nunca
 * traducido. */
export const SUPPORTED_LANGUAGES: readonly { id: Language; label: string }[] = [
  { id: 'es', label: 'Español' },
  { id: 'en', label: 'English' },
  { id: 'fr', label: 'Français' },
];

/** Idioma de una petición (cabecera `x-meridiano-language`): solo
 * `es`/`en`/`fr` valen; cualquier otro valor (o su ausencia) es español. */
export function parseLanguage(value: unknown): Language {
  return value === 'en' || value === 'fr' ? value : 'es';
}

const MESSAGES: Record<Language, Partial<Record<LocaleKey, string>>> = {
  es: ES_MESSAGES,
  en: EN_MESSAGES,
  fr: FR_MESSAGES,
};

/** Sustituye `{variable}` por su valor; un hueco sin variable se deja
 * tal cual para que el fallo se vea en desarrollo y en los tests. */
export function formatMessage(template: string, vars?: TranslateVars): string {
  if (!vars) return template;
  return template.replace(/\{([A-Za-z0-9_]+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match);
}

/** Resolución pura (para tests): idioma elegido → español → la clave. */
export function resolveMessage(locale: Language, key: string, vars?: TranslateVars): string {
  const direct = MESSAGES[locale]?.[key as LocaleKey];
  if (typeof direct === 'string') return formatMessage(direct, vars);
  const fallback = ES_MESSAGES[key as LocaleKey];
  if (typeof fallback === 'string') return formatMessage(fallback, vars);
  return key;
}

export function createTranslator(locale: Language, onMissing?: (key: string) => void): Translator {
  const missing = new Set<string>();
  const note = (key: string) => {
    if (!missing.has(key)) {
      missing.add(key);
      onMissing?.(key);
    }
  };
  const t: TranslateFn = (key, vars) => {
    const direct = MESSAGES[locale]?.[key];
    if (typeof direct === 'string') return formatMessage(direct, vars);
    const fallback = ES_MESSAGES[key];
    if (typeof fallback === 'string') {
      note(key);
      return formatMessage(fallback, vars);
    }
    note(key);
    return key;
  };
  return { locale, t, missingKeys: () => [...missing] };
}
