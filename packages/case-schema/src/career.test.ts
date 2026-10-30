import { describe, it, expect } from 'vitest';
import {
  calculateCaseOutcome, createInitialCareer, applyOutcome, applySanction, resolveSanction,
  getActiveSanctions, getRank, type SanctionRecord,
} from './career.js';

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
    const addedSanction = career.sanctions[0]!;
    expect(addedSanction).toBeDefined();
    expect(addedSanction.id).toBe('s1');
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
    expect(resolvedSanction!.resolvedAt).toBe(200);
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
    expect(activeSanction!.id).toBe('s2');
  });

  it('getRank devuelve rango correcto', () => {
    expect(getRank(createInitialCareer('u'))).toBe('Aspirante');
    let career = createInitialCareer('u');
    for (let i = 0; i < 10; i++) {
      career = applyOutcome(career, calculateCaseOutcome('complete'));
    }
    expect(getRank(career)).toBe('Inspector');
  });
});