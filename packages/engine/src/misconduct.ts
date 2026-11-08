// Conducta irregular: datos puros del estado de la partida (GDD §14).
// Este módulo no importa el resto del motor: lo usan tanto el handler de
// acciones irregulares (`irregular.ts`) como el informe final
// (`final-report.ts`), y un ciclo entre ambos rompería `check:imports`.
import type { CaseDefinition, CaseRun, IrregularKind, MisconductRecord } from '@meridiano/case-schema';
import { caseText, type Language } from '@meridiano/case-schema';

/** Veces que te han visto: a la tercera, A.C.M.E. retira el caso (valor
 * inicial para playtest, como el resto de cifras del informe final). */
export const WITNESSED_WITHDRAWAL_COUNT = 3;

/** Penalización en el informe final por cada acción irregular (valor
 * inicial para playtest, en la escala de −20 por detención errónea). */
export const IRREGULAR_SCORE_PENALTY = 10;

/** Acciones irregulares cometidas en la partida, en orden. Las partidas
 * anteriores a esta entrega no traen el campo y se comportan como si
 * estuviera vacío. */
export function misconductOf(run: CaseRun): MisconductRecord[] {
  return [...(run.misconduct ?? [])];
}

/** Veces que te han visto cometer una acción irregular. */
export function witnessedCount(run: CaseRun): number {
  return misconductOf(run).filter(record => record.seenBy.length > 0).length;
}

/** Nombre legible del objetivo de un acto irregular (lugar o personaje).
 * El nombre del lugar sale de la traducción del caso cuando la hay. */
export function irregularTargetName(def: CaseDefinition, kind: IrregularKind, targetId: string, language: Language = 'es'): string {
  if (kind === 'force_entry') {
    const location = def.locations.find(item => item.id === targetId);
    return caseText(def.id, 'location.' + targetId + '.name', language) ?? location?.name ?? targetId;
  }
  return def.npcs.find(npc => npc.id === targetId)?.name ?? targetId;
}

/** Actos irregulares de una partida para el informe final: qué se hizo,
 * contra quién o dónde, cuándo y si te vieron. */
export function irregularActsForReport(def: CaseDefinition, run: CaseRun, language: Language = 'es'): Array<{ kind: IrregularKind; targetName: string; minute: number; seen: boolean }> {
  return misconductOf(run).map(record => ({
    kind: record.kind,
    targetName: irregularTargetName(def, record.kind, record.targetId, language),
    minute: record.minute,
    seen: record.seenBy.length > 0,
  }));
}
