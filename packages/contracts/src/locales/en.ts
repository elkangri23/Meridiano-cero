// English locale: INTENCIONADAMENTE VACÍO (sin traducir).
//
// No hay ninguna cadena en inglés en este lote (decisión del usuario:
// solo la infraestructura). Cada clave que falte aquí se resuelve en
// español (`i18n.ts`): elegir English en Ajustes deja el juego en
// español y persiste la elección. Para traducir: copiar las entradas de
// `es.ts` que se quieran traducir y poner aquí su texto en inglés con la
// MISMA clave; no se toca ningún otro fichero para que aparezcan.
// Ver `docs/TRADUCCIONES.md`.
import type { LocaleKey } from './es.js';

export const EN_MESSAGES: Partial<Record<LocaleKey, string>> = {};
