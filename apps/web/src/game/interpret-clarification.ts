// Texto de la aclaración cuando el texto libre pide una orden o una
// detención bloqueada (lote intérprete de texto libre): dice qué falta
// para poder hacerla, en el idioma del jugador, sin inventar otra acción.
// El servidor devuelve el bloqueo estructurado (`locked`); la web lo
// compone desde claves de locales (`game.interpret.*`).
import type { LocaleKey, TranslateFn } from '@meridiano/contracts';
import type { LockedMissing } from '../ai/client';

export type { LockedMissing };

export interface LockedClarification {
  type: 'warrant' | 'detain';
  suspectName: string | null;
  missing: LockedMissing[];
}

/** La aclaración completa: introducción (con nombre o genérica) más una
 * frase por cada motivo que falta. */
export function lockedClarificationText(t: TranslateFn, locked: LockedClarification): string {
  const intro = locked.type === 'warrant'
    ? (locked.suspectName
      ? t('game.interpret.lockedWarrant', { name: locked.suspectName })
      : t('game.interpret.lockedWarrantGeneric'))
    : (locked.suspectName
      ? t('game.interpret.lockedDetain', { name: locked.suspectName })
      : t('game.interpret.lockedDetainGeneric'));
  return [intro, ...locked.missing.map(code => t(`game.interpret.missing.${code}`))].join(' ');
}

/** Motivo del servidor → clave localizada (lote pequeños del catálogo
 * 2026-11-10): los literales españoles del director se resuelven aquí,
 * en el idioma del jugador, sin tocar el servidor. `unavailable` cubre
 * también `timeout` y `cancelled`, que en el servidor comparten el mismo
 * mensaje; un motivo desconocido cae al mensaje del servidor o a la
 * ambigua genérica. */
const interpretClarificationKeys: Record<string, LocaleKey> = {
  ambiguous: 'game.notice.interpretClarification.ambiguous',
  budget_exceeded: 'game.notice.interpretClarification.budget_exceeded',
  invalid_response: 'game.notice.interpretClarification.invalid_response',
  unavailable: 'game.notice.interpretClarification.unavailable',
  timeout: 'game.notice.interpretClarification.unavailable',
  cancelled: 'game.notice.interpretClarification.unavailable',
};

export function interpretClarificationText(
  t: TranslateFn,
  result: { locked?: LockedClarification; message?: string; reason?: string },
): string {
  if (result.locked) return lockedClarificationText(t, result.locked);
  const key = result.reason ? interpretClarificationKeys[result.reason] : undefined;
  if (key) return t(key);
  return result.message ?? t('game.notice.ambiguousOrder');
}
