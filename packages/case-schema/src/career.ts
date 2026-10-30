// Sistema de carrera, reputación e irregularidades (T5-04)
// SPEC-008: equilibrio, recompensas idempotentes y sanciones recuperables

export type CaseResult = 'complete' | 'partial' | 'unresolved' | 'incorrect';

export interface CareerRecord {
  profileId: string;
  prestige: number;
  integrity: number;
  trust: number;
  totalCases: number;
  completedCases: number;
  medals: string[];
  sanctions: SanctionRecord[];
}

export interface SanctionRecord {
  id: string;
  caseId: string;
  reason: string;
  severity: 'warning' | 'suspension';
  imposedAt: number;
  resolvedAt?: number;
}

export interface CaseOutcome {
  result: CaseResult;
  points: number;
  medal?: string | undefined;
  prestigeDelta: number;
  integrityDelta: number;
  trustDelta: number;
}

// Puntos base por resultado (SPEC-008)
const BASE_POINTS: Record<CaseResult, number> = {
  complete: 100,
  partial: 40,
  unresolved: 0,
  incorrect: 0,
};

// Recompensas por resultado (medallas)
const MEDALS: Record<CaseResult, string | undefined> = {
  complete: 'medalla-oro',
  partial: 'medalla-plata',
  unresolved: undefined,
  incorrect: undefined,
};

// Delta de prestigio por resultado
const PRESTIGE_DELTA: Record<CaseResult, number> = {
  complete: 10,
  partial: 4,
  unresolved: 0,
  incorrect: -2,
};

// Delta de integridad por resultado
const INTEGRITY_DELTA: Record<CaseResult, number> = {
  complete: 2,
  partial: 1,
  unresolved: 0,
  incorrect: -5,
};

// Delta de confianza por resultado
const TRUST_DELTA: Record<CaseResult, number> = {
  complete: 2,
  partial: 0,
  unresolved: 0,
  incorrect: -10,
};

export function calculateCaseOutcome(
  result: CaseResult,
  options: {
    wrongfulDetention?: boolean;
    irregularConduct?: boolean;
    recovered?: boolean;
    legal?: boolean;
  } = {},
): CaseOutcome {
  let points = BASE_POINTS[result];
  let prestigeDelta = PRESTIGE_DELTA[result];
  let integrityDelta = INTEGRITY_DELTA[result];
  let trustDelta = TRUST_DELTA[result];

  // Detención errónea afecta confianza
  if (options.wrongfulDetention) {
    trustDelta -= 5;
    integrityDelta -= 2;
  }

  // Conducta irregular demostrada afecta integridad
  if (options.irregularConduct) {
    integrityDelta -= 5;
    prestigeDelta -= 2;
  }

  // Recuperación/legalidad contribuyen a prestigio
  if (options.recovered) {
    prestigeDelta += 3;
  }
  if (options.legal) {
    prestigeDelta += 2;
    integrityDelta += 1;
  }

  return {
    result,
    points,
    medal: MEDALS[result],
    prestigeDelta,
    integrityDelta,
    trustDelta,
  };
}

export function createInitialCareer(profileId: string): CareerRecord {
  return {
    profileId,
    prestige: 0,
    integrity: 0,
    trust: 0,
    totalCases: 0,
    completedCases: 0,
    medals: [],
    sanctions: [],
  };
}

export function applyOutcome(career: CareerRecord, outcome: CaseOutcome): CareerRecord {
  const newMedals = outcome.medal && !career.medals.includes(outcome.medal)
    ? [...career.medals, outcome.medal]
    : career.medals;
  return {
    ...career,
    prestige: career.prestige + outcome.prestigeDelta,
    integrity: career.integrity + outcome.integrityDelta,
    trust: career.trust + outcome.trustDelta,
    totalCases: career.totalCases + 1,
    completedCases: outcome.result === 'complete' ? career.completedCases + 1 : career.completedCases,
    medals: newMedals,
  };
}

export function applySanction(career: CareerRecord, sanction: SanctionRecord): CareerRecord {
  return {
    ...career,
    sanctions: [...career.sanctions, sanction],
  };
}

export function resolveSanction(career: CareerRecord, sanctionId: string, resolvedAt: number): CareerRecord {
  return {
    ...career,
    sanctions: career.sanctions.map(s =>
      s.id === sanctionId ? { ...s, resolvedAt } : s,
    ),
  };
}

export function getActiveSanctions(career: CareerRecord, currentMinute: number): SanctionRecord[] {
  return career.sanctions.filter(s => s.resolvedAt === undefined || s.resolvedAt > currentMinute);
}

export function getRank(career: CareerRecord): string {
  const total = career.prestige + career.integrity + career.trust;
  if (total >= 100) return 'Inspector';
  if (total >= 50) return 'Sargento';
  if (total >= 20) return 'Detective';
  return 'Aspirante';
}