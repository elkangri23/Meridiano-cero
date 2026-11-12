// Explicaciones del desglose de puntos y resolución de la línea de tiempo
// del informe-recorrido (rediseño Norte, fase 4): todo se frasea con
// cifras reales del informe, sin inventar nada.
import { describe, expect, it } from 'vitest';
import type { FinalReport, FinalReportScoreEntry } from '@meridiano/contracts';
import type { TranslateFn } from '@meridiano/contracts';
import {
  clampTimelineIndex,
  routeCities,
  scoreExplanation,
  timelineEvidence,
  type ScoreExplanationContext,
} from './report-journey';

/** Traductor de pruebas: devuelve la clave y sus variables, para comprobar
 * qué frase se elige y con qué cifras, sin depender del texto final. */
function stubT(key: string, vars?: Record<string, string | number>): string {
  if (!vars) return key;
  return `${key}(${Object.entries(vars).map(([k, v]) => `${k}=${v}`).join(',')})`;
}

const context: ScoreExplanationContext = {
  objectivesAchieved: 2,
  objectivesTotal: 2,
  evidenceFound: 6,
  evidenceTotal: 11,
  correctDetentions: 1,
  wrongDetentions: 0,
  irregularActs: 0,
  minute: 470,
  deadlineMinutes: 2880,
  reason: 'finished',
};

function entry(id: FinalReportScoreEntry['id'], points: number, max: number): FinalReportScoreEntry {
  return { id, label: id, points, max };
}

describe('explicación del desglose de puntos', () => {
  it('objetivos y pruebas se explican con sus cifras reales', () => {
    expect(scoreExplanation(entry('objectives', 50, 50), context, stubT as TranslateFn))
      .toBe('game.reportJourney.scoreExplain.objectives(achieved=2,total=2,points=50,max=50)');
    expect(scoreExplanation(entry('evidence', 14, 25), context, stubT as TranslateFn))
      .toBe('game.reportJourney.scoreExplain.evidence(found=6,total=11,points=14,max=25)');
  });

  it('la detención correcta suma y la errónea resta por cada una', () => {
    expect(scoreExplanation(entry('detention', 15, 15), context, stubT as TranslateFn))
      .toBe('game.reportJourney.scoreExplain.detentionYes(points=15,max=15)');
    expect(scoreExplanation(entry('detention', 0, 15), { ...context, correctDetentions: 0 }, stubT as TranslateFn))
      .toBe('game.reportJourney.scoreExplain.detentionNo');
    expect(scoreExplanation(entry('wrongDetentions', 0, 0), context, stubT as TranslateFn))
      .toBe('game.reportJourney.scoreExplain.wrongNone');
    expect(scoreExplanation(entry('wrongDetentions', -20, 0), { ...context, wrongDetentions: 1 }, stubT as TranslateFn))
      .toBe('game.reportJourney.scoreExplain.wrongOne(points=-20)');
    expect(scoreExplanation(entry('wrongDetentions', -40, 0), { ...context, wrongDetentions: 2 }, stubT as TranslateFn))
      .toBe('game.reportJourney.scoreExplain.wrongMany(count=2,points=-40)');
  });

  it('las irregulares restan por cada una y el tiempo solo suma al cerrar por decisión propia', () => {
    expect(scoreExplanation(entry('irregular', 0, 0), context, stubT as TranslateFn))
      .toBe('game.reportJourney.scoreExplain.irregularNone');
    expect(scoreExplanation(entry('irregular', -10, 0), { ...context, irregularActs: 1 }, stubT as TranslateFn))
      .toBe('game.reportJourney.scoreExplain.irregularOne(points=-10)');
    expect(scoreExplanation(entry('time', 8, 10), context, stubT as TranslateFn))
      .toBe('game.reportJourney.scoreExplain.timeFinished(minute=470,deadline=2880,remaining=2410,points=8,max=10)');
    expect(scoreExplanation(entry('time', 0, 10), { ...context, reason: 'deadline' }, stubT as TranslateFn))
      .toBe('game.reportJourney.scoreExplain.timeOther');
  });
});

describe('línea de tiempo andable', () => {
  it('el índice se queda dentro de sus extremos', () => {
    expect(clampTimelineIndex(0, 5)).toBe(0);
    expect(clampTimelineIndex(4, 5)).toBe(4);
    expect(clampTimelineIndex(5, 5)).toBe(4);
    expect(clampTimelineIndex(-1, 5)).toBe(0);
    expect(clampTimelineIndex(0, 0)).toBe(0);
  });

  it('las pruebas de un hito se resuelven a sus entradas y los ids sin entrada se omiten', () => {
    const report = {
      evidenceFound: [
        { id: 'EV-01', text: 'La caja está a la vista.', origin: 'MAD-SALA', minute: 10 },
        { id: 'EV-02', text: 'La cerradura tiene residuo.', origin: 'MAD-SALA', minute: 30 },
      ],
    } as FinalReport;
    expect(timelineEvidence(report, ['EV-01', 'EV-99', 'EV-02']).map(item => item.id)).toEqual(['EV-01', 'EV-02']);
    expect(timelineEvidence(report, undefined)).toEqual([]);
    expect(timelineEvidence(report, [])).toEqual([]);
  });
});

describe('ruta del informe', () => {
  it('sin ruta guardada, la lista es vacía', () => {
    expect(routeCities({} as FinalReport)).toEqual([]);
    expect(routeCities({ route: [] } as unknown as FinalReport)).toEqual([]);
  });
});
