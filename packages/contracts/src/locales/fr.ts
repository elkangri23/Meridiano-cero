// French locale: INTENCIONADAMENTE VACÍO (sin traducir).
//
// Igual que `en.ts`: el tipo de preferencia ya admite 'fr', pero no hay
// ninguna cadena traducida. Todo cae al español hasta que alguien lo
// traduzca copiando las entradas de `es.ts` con la MISMA clave.
// Ver `docs/TRADUCCIONES.md`.
import type { LocaleKey } from './es.js';

export const FR_MESSAGES: Partial<Record<LocaleKey, string>> = {};
