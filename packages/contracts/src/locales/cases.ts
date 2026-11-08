// Traducciones del contenido de los casos (fase de traducción i18n).
//
// El español de cada caso vive en su definición (el fijo en el código, los
// generados en la BD): NO se duplica aquí. Estos módulos solo guardan la
// traducción a otros idiomas, por caso y por campo (`cases.<caso>.<campo>`).
// `caseText` resuelve un campo en el idioma pedido y devuelve undefined
// cuando no hay traducción, para que quien llama use el español de la
// definición como fallback (nunca se enseña una clave cruda).
import type { Language } from '../preferences.js';
import { CASE_EN } from './cases-en.js';
import { CASE_FR } from './cases-fr.js';

const CASE_TABLES: Record<Exclude<Language, 'es'>, Record<string, Record<string, string>>> = {
  en: CASE_EN,
  fr: CASE_FR,
};

/** Traducción de un campo de un caso (`texts.evidence.EV-01`,
 * `briefing.p0`, `location.MAD-SALA.description`…), o undefined si el
 * idioma no lo traduce (entonces manda el español de la definición). */
export function caseText(caseId: string, key: string, language: Language): string | undefined {
  if (language === 'es') return undefined;
  return CASE_TABLES[language]?.[caseId]?.[key];
}

/** Traducción de un campo de un caso con fallback al español de la
 * definición: nunca devuelve undefined. */
export function caseTextOr(caseId: string, key: string, language: Language, spanish: string): string {
  return caseText(caseId, key, language) ?? spanish;
}
