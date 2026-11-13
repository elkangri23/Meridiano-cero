import type { FinalReport, FinalReportScoreEntry } from '@meridiano/contracts';
import type { TranslateFn } from '@meridiano/contracts';

/** Datos reales con los que se explica cada componente de la puntuación.
 * Todo sale del informe y de la vista: nada se inventa y ningún componente
 * explica lo que el motor no desglosa. */
export interface ScoreExplanationContext {
  objectivesAchieved: number;
  objectivesTotal: number;
  evidenceFound: number;
  evidenceTotal: number;
  correctDetentions: number;
  wrongDetentions: number;
  irregularActs: number;
  minute: number;
  deadlineMinutes: number;
  reason: FinalReport['reason'];
}

/** Explicación de un componente del desglose, con sus cifras reales: por
 * qué se ganó o se perdió cada punto. La regla de puntuación vive en el
 * motor (`scoreForReport`); aquí solo se frasea con los números que el
 * informe ya trae. */
// Claves de explicación de un componente de penalización (detenciones
// erróneas o conducta irregular): sin actos, con uno, con varios.
const PENALTY_KEYS = {
  wrongDetentions: {
    none: 'game.reportJourney.scoreExplain.wrongNone',
    one: 'game.reportJourney.scoreExplain.wrongOne',
    many: 'game.reportJourney.scoreExplain.wrongMany',
  },
  irregular: {
    none: 'game.reportJourney.scoreExplain.irregularNone',
    one: 'game.reportJourney.scoreExplain.irregularOne',
    many: 'game.reportJourney.scoreExplain.irregularMany',
  },
} as const;

/** Explicación de un componente de penalización: cuánto restó y por qué. */
function explainPenalties(kind: 'wrongDetentions' | 'irregular', count: number, points: number, t: TranslateFn): string {
  const keys = PENALTY_KEYS[kind];
  if (count === 0) return t(keys.none);
  if (count === 1) return t(keys.one, { points });
  return t(keys.many, { count, points });
}

/** Explicación del componente de tiempo: solo puntúa con motivo
 * `finished`; con otro motivo no hay tiempo restante que valorar. */
function explainTime(entry: FinalReportScoreEntry, context: ScoreExplanationContext, t: TranslateFn): string {
  if (context.reason !== 'finished') return t('game.reportJourney.scoreExplain.timeOther');
  return t('game.reportJourney.scoreExplain.timeFinished', {
    minute: context.minute,
    deadline: context.deadlineMinutes,
    remaining: Math.max(0, context.deadlineMinutes - context.minute),
    points: entry.points,
    max: entry.max,
  });
}

export function scoreExplanation(
  entry: FinalReportScoreEntry,
  context: ScoreExplanationContext,
  t: TranslateFn,
): string {
  switch (entry.id) {
    case 'objectives':
      return t('game.reportJourney.scoreExplain.objectives', {
        achieved: context.objectivesAchieved,
        total: context.objectivesTotal,
        points: entry.points,
        max: entry.max,
      });
    case 'evidence':
      return t('game.reportJourney.scoreExplain.evidence', {
        found: context.evidenceFound,
        total: context.evidenceTotal,
        points: entry.points,
        max: entry.max,
      });
    case 'detention':
      return context.correctDetentions > 0
        ? t('game.reportJourney.scoreExplain.detentionYes', { points: entry.points, max: entry.max })
        : t('game.reportJourney.scoreExplain.detentionNo');
    case 'wrongDetentions':
      return explainPenalties('wrongDetentions', context.wrongDetentions, entry.points, t);
    case 'irregular':
      return explainPenalties('irregular', context.irregularActs, entry.points, t);
    case 'time':
      return explainTime(entry, context, t);
  }
}

/** Índice de hito dentro de [0, length − 1]; sin hitos, 0. La línea de
 * tiempo se anda con Anterior/Siguiente sin salirse nunca de sus extremos. */
export function clampTimelineIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  if (!Number.isInteger(index)) return 0;
  return Math.min(length - 1, Math.max(0, index));
}

/** Pruebas reveladas en un hito, resueltas a sus entradas del informe
 * (texto y procedencia). Un id sin entrada no se inventa: se omite. */
export function timelineEvidence(
  report: FinalReport,
  evidenceIds: string[] | undefined,
): FinalReport['evidenceFound'] {
  if (!evidenceIds || evidenceIds.length === 0) return [];
  const byId = new Map(report.evidenceFound.map(entry => [entry.id, entry]));
  return evidenceIds.flatMap(id => {
    const entry = byId.get(id);
    return entry ? [entry] : [];
  });
}

/** Ciudades de la ruta del informe, en orden; sin ruta guardada, vacío
 * (partidas cerradas antes de la fase 4 que aún no se han reconstruido). */
export function routeCities(report: FinalReport): NonNullable<FinalReport['route']> {
  return report.route ?? [];
}
