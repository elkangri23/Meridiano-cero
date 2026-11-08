import { describe, it, expect } from 'vitest';
import {
  calculateCaseOutcome, outcomeFromReport, createInitialCareer, applyOutcome, applySanction, resolveSanction,
  getActiveSanctions, getRank, rankForTotals, reputationLabel, deriveCareerProfile,
  type SanctionRecord, type CareerResultEntry,
} from './career.js';
import type { FinalReport } from '@meridiano/contracts';

/** Informe final mínimo para derivar la recompensa: solo importan el
 * resultado, las detenciones y los actos irregulares. */
function report(overrides: Partial<FinalReport>): FinalReport {
  return {
    result: 'complete',
    objectivesAchieved: ['obj-detener', 'obj-recuperar'],
    reason: 'finished',
    minute: 470,
    truth: { culpritId: 'ines-valera', culpritName: 'Inés Valera', objectId: 'astrolabio-original', objectLabel: 'el astrolabio original', keyEvidence: [] },
    timeline: [],
    evidenceFound: [],
    evidenceMissed: [],
    detentions: [{ suspectId: 'ines', suspectName: 'Inés Valera', correct: true, withWarrant: true }],
    irregularActs: [],
    score: { total: 87, max: 100, breakdown: [] },
    ...overrides,
  };
}

function entry(overrides: Partial<CareerResultEntry>): CareerResultEntry {
  return {
    caseId: 'astrolabio-tres-ciudades',
    caseTitle: 'El astrolabio de las tres ciudades',
    contentHash: 'a'.repeat(64),
    result: 'complete',
    reason: 'finished',
    minute: 470,
    points: 100,
    medal: 'medalla-oro',
    prestigeDelta: 15,
    integrityDelta: 3,
    trustDelta: 2,
    irregularActs: 0,
    countries: ['España', 'Francia'],
    places: ['Sala de embalaje'],
    createdAt: '2026-11-08T01:00:00.000Z',
    ...overrides,
  };
}

describe('career', () => {
  it('calculateCaseOutcome devuelve puntos base correctos', () => {
    const complete = calculateCaseOutcome('complete');
    expect(complete.points).toBe(100);
    expect(complete.medal).toBe('medalla-oro');
    expect(complete.prestigeDelta).toBe(10);

    const partial = calculateCaseOutcome('partial');
    expect(partial.points).toBe(40);
    expect(partial.medal).toBe('medalla-plata');

    const unresolved = calculateCaseOutcome('unresolved');
    expect(unresolved.points).toBe(0);
    expect(unresolved.medal).toBeUndefined();

    const incorrect = calculateCaseOutcome('incorrect');
    expect(incorrect.points).toBe(0);
    expect(incorrect.medal).toBeUndefined();
  });

  it('detención errónea afecta confianza e integridad', () => {
    const outcome = calculateCaseOutcome('incorrect', { wrongfulDetention: true });
    expect(outcome.trustDelta).toBeLessThan(-10);
    expect(outcome.integrityDelta).toBeLessThan(-5);
  });

  it('conducta irregular afecta integridad y prestigio', () => {
    const outcome = calculateCaseOutcome('complete', { irregularConduct: true });
    expect(outcome.integrityDelta).toBeLessThan(2);
    expect(outcome.prestigeDelta).toBeLessThan(10);
  });

  it('recuperación y legalidad contribuyen a prestigio', () => {
    const outcome = calculateCaseOutcome('partial', { recovered: true, legal: true });
    expect(outcome.prestigeDelta).toBeGreaterThan(4);
  });

  it('createInitialCareer crea perfil con ceros', () => {
    const career = createInitialCareer('user-1');
    expect(career.prestige).toBe(0);
    expect(career.integrity).toBe(0);
    expect(career.trust).toBe(0);
    expect(career.totalCases).toBe(0);
    expect(career.medals).toEqual([]);
    expect(career.sanctions).toEqual([]);
  });

  it('applyOutcome suma deltas correctamente', () => {
    let career = createInitialCareer('user-1');
    const outcome = calculateCaseOutcome('complete');
    career = applyOutcome(career, outcome);
    expect(career.prestige).toBe(10);
    expect(career.integrity).toBe(2);
    expect(career.trust).toBe(2);
    expect(career.totalCases).toBe(1);
    expect(career.completedCases).toBe(1);
    expect(career.medals).toEqual(['medalla-oro']);
  });

  it('applyOutcome es determinista para la misma entrada', () => {
    const outcome = calculateCaseOutcome('complete');
    const career1 = applyOutcome(createInitialCareer('u'), outcome);
    const career2 = applyOutcome(createInitialCareer('u'), outcome);
    expect(career1).toEqual(career2);
  });

  it('applyOutcome no suma medalla dos veces', () => {
    let career = createInitialCareer('user-1');
    const outcome = calculateCaseOutcome('complete');
    career = applyOutcome(career, outcome);
    career = applyOutcome(career, outcome);
    expect(career.medals).toHaveLength(1);
  });

  it('applySanction añade sanción', () => {
    let career = createInitialCareer('user-1');
    const sanction: SanctionRecord = {
      id: 's1', caseId: 'case-1', reason: 'irregular', severity: 'warning',
      imposedAt: 100,
    };
    career = applySanction(career, sanction);
    expect(career.sanctions).toHaveLength(1);
    const addedSanction = career.sanctions[0];
    expect(addedSanction).toBeDefined();
    expect(addedSanction?.id).toBe('s1');
  });

  it('resolveSanction marca sanción como resuelta', () => {
    let career = createInitialCareer('user-1');
    const sanction: SanctionRecord = {
      id: 's1', caseId: 'case-1', reason: 'irregular', severity: 'warning',
      imposedAt: 100,
    };
    career = applySanction(career, sanction);
    career = resolveSanction(career, 's1', 200);
    const resolvedSanction = career.sanctions[0];
    expect(resolvedSanction).toBeDefined();
    expect(resolvedSanction?.resolvedAt).toBe(200);
  });

  it('getActiveSanctions filtra sanciones activas', () => {
    let career = createInitialCareer('user-1');
    career = applySanction(career, { id: 's1', caseId: 'c1', reason: 'a', severity: 'warning', imposedAt: 100 });
    career = applySanction(career, { id: 's2', caseId: 'c2', reason: 'b', severity: 'suspension', imposedAt: 150 });
    career = resolveSanction(career, 's1', 200);
    // En el minuto 250, s1 está resuelta (resolvedAt=200 <= 250) y s2 no lo está
    const active = getActiveSanctions(career, 250);
    expect(active).toHaveLength(1);
    const activeSanction = active[0];
    expect(activeSanction).toBeDefined();
    expect(activeSanction?.id).toBe('s2');
  });

  it('getRank devuelve rango correcto', () => {
    expect(getRank(createInitialCareer('u'))).toBe('Aspirante');
    let career = createInitialCareer('u');
    for (let i = 0; i < 10; i++) {
      career = applyOutcome(career, calculateCaseOutcome('complete'));
    }
    expect(getRank(career)).toBe('Inspector');
  });

  it('rankForTotals usa los mismos umbrales que getRank', () => {
    expect(rankForTotals(0, 0, 0)).toBe('Aspirante');
    expect(rankForTotals(10, 5, 5)).toBe('Detective');
    expect(rankForTotals(30, 10, 10)).toBe('Sargento');
    expect(rankForTotals(80, 10, 10)).toBe('Inspector');
  });

  it('reputationLabel presenta cada dimensión con etiqueta cualitativa', () => {
    expect(reputationLabel(20)).toBe('Ejemplar');
    expect(reputationLabel(10)).toBe('Sólida');
    expect(reputationLabel(0)).toBe('Discreta');
    expect(reputationLabel(-3)).toBe('Dudosa');
    expect(reputationLabel(-10)).toBe('Dañada');
  });

  it('outcomeFromReport deriva la recompensa del informe, sin detención errónea ni irregularidad', () => {
    const outcome = outcomeFromReport(report({}), { recovered: true });
    expect(outcome.result).toBe('complete');
    expect(outcome.points).toBe(100);
    expect(outcome.medal).toBe('medalla-oro');
    // complete limpio y legal, con recuperación: 10 + 3 + 2 de prestigio, 2 + 1 de integridad.
    expect(outcome.prestigeDelta).toBe(15);
    expect(outcome.integrityDelta).toBe(3);
    expect(outcome.trustDelta).toBe(2);
  });

  it('outcomeFromReport penaliza la detención errónea y la conducta irregular', () => {
    const outcome = outcomeFromReport(report({
      result: 'incorrect',
      detentions: [{ suspectId: 'tomas', suspectName: 'Tomás Ríos', correct: false, withWarrant: true }],
      irregularActs: [{ kind: 'bribe', targetName: 'Lucía', minute: 30, seen: true }],
    }));
    expect(outcome.points).toBe(0);
    expect(outcome.medal).toBeUndefined();
    // incorrect: confianza −10 −5 (errónea), integridad −5 −2 (errónea) −5 (irregular), prestigio −2 −2 (irregular).
    expect(outcome.trustDelta).toBe(-15);
    expect(outcome.integrityDelta).toBe(-12);
    expect(outcome.prestigeDelta).toBe(-4);
  });

  it('outcomeFromReport no da bonus de legalidad con detención sin orden', () => {
    const outcome = outcomeFromReport(report({
      detentions: [{ suspectId: 'ines', suspectName: 'Inés Valera', correct: true, withWarrant: false }],
    }), { recovered: true });
    expect(outcome.prestigeDelta).toBe(13); // 10 + 3 recuperación, sin +2 de legalidad
    expect(outcome.integrityDelta).toBe(2);
  });

  it('deriveCareerProfile suma deltas, medallas únicas y lugares en orden', () => {
    const profile = deriveCareerProfile([
      entry({}),
      entry({ caseId: 'generado-1', caseTitle: 'Caso generado', contentHash: 'b'.repeat(64), result: 'partial', points: 40, medal: 'medalla-plata', prestigeDelta: 4, integrityDelta: 1, trustDelta: 0, countries: ['Portugal'], places: ['Almacén'], createdAt: '2026-11-08T02:00:00.000Z' }),
      entry({ caseId: 'generado-2', caseTitle: 'Otro caso', contentHash: 'c'.repeat(64), result: 'complete', points: 100, medal: 'medalla-oro', prestigeDelta: 10, integrityDelta: 2, trustDelta: 2, countries: ['España'], places: ['Sala de embalaje', 'Puerto'], createdAt: '2026-11-08T03:00:00.000Z' }),
    ]);
    expect(profile.totalCases).toBe(3);
    expect(profile.completedCases).toBe(2);
    expect(profile.points).toBe(240);
    expect(profile.prestige).toBe(29);
    expect(profile.rank).toBe('Detective');
    expect(profile.medals).toEqual(['medalla-oro', 'medalla-plata']);
    expect(profile.countries).toEqual(['España', 'Francia', 'Portugal']);
    expect(profile.places).toEqual(['Sala de embalaje', 'Almacén', 'Puerto']);
    expect(profile.sanctions).toEqual([]);
  });

  it('deriveCareerProfile crea suspensión por retirada y la resuelve con el primer caso limpio posterior', () => {
    const profile = deriveCareerProfile([
      entry({ reason: 'withdrawn', result: 'unresolved', points: 0, medal: undefined, prestigeDelta: -2, integrityDelta: -5, trustDelta: 0, irregularActs: 3, createdAt: '2026-11-08T01:00:00.000Z', minute: 90 }),
      entry({ caseId: 'generado-1', contentHash: 'b'.repeat(64), result: 'unresolved', points: 0, medal: undefined, prestigeDelta: 0, integrityDelta: 0, trustDelta: 0, irregularActs: 1, createdAt: '2026-11-08T02:00:00.000Z', minute: 60 }),
      entry({ caseId: 'generado-2', contentHash: 'c'.repeat(64), result: 'complete', points: 100, medal: 'medalla-oro', prestigeDelta: 10, integrityDelta: 2, trustDelta: 2, irregularActs: 0, createdAt: '2026-11-08T03:00:00.000Z', minute: 300 }),
    ]);
    expect(profile.sanctions).toHaveLength(1);
    const sanction = profile.sanctions[0];
    expect(sanction?.severity).toBe('suspension');
    expect(sanction?.imposedAt).toBe(90);
    // El caso con irregularidad no resuelve; el limpio sí (minuto de su cierre).
    expect(sanction?.resolvedAt).toBe(300);
  });

  it('deriveCareerProfile deja activa la suspensión sin caso limpio posterior', () => {
    const profile = deriveCareerProfile([
      entry({ reason: 'withdrawn', result: 'unresolved', points: 0, medal: undefined, prestigeDelta: -2, integrityDelta: -5, trustDelta: 0, irregularActs: 3, minute: 90 }),
    ]);
    expect(profile.sanctions).toHaveLength(1);
    expect(profile.sanctions[0]?.resolvedAt).toBeUndefined();
  });
});
