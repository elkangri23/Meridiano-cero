// Texto de la aclaración cuando el texto libre pide una orden o una
// detención bloqueada (lote intérprete de texto libre): dice qué falta
// para poder hacerla, en el idioma del jugador, sin inventar otra acción.
// El servidor devuelve el bloqueo estructurado (`locked`); la web lo
// compone desde claves de locales (`game.interpret.*`).
import type { TranslateFn } from '@meridiano/contracts';
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
