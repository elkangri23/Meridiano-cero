// Sistema de carrera, reputación e irregularidades (T5-04)
// SPEC-008: equilibrio, recompensas idempotentes y sanciones recuperables
import type { FinalReport } from '@meridiano/contracts';
import { resolveMessage } from '@meridiano/contracts';
import type { Language } from '@meridiano/contracts';

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
  const points = BASE_POINTS[result];
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

export function getRank(career: CareerRecord, language: Language = 'es'): string {
  return rankForTotals(career.prestige, career.integrity, career.trust, language);
}

/** Rango por la suma de las tres dimensiones (SPEC-008, valores
 * iniciales para playtest): ≥100 Inspector, ≥50 Sargento, ≥20 Detective,
 * si no Aspirante. El rango es honorífico: ninguna herramienta se bloquea
 * por rango. */
export function rankForTotals(prestige: number, integrity: number, trust: number, language: Language = 'es'): string {
  const total = prestige + integrity + trust;
  if (total >= 100) return resolveMessage(language, 'career.rank.inspector');
  if (total >= 50) return resolveMessage(language, 'career.rank.sargento');
  if (total >= 20) return resolveMessage(language, 'career.rank.detective');
  return resolveMessage(language, 'career.rank.aspirante');
}

/** Etiqueta cualitativa de una dimensión de reputación (SPEC-008: las
 * dimensiones se presentan con etiquetas, no con barras secretas).
 * Umbrales de presentación iniciales para playtest, no equilibrio: ≥15
 * Ejemplar, ≥8 Sólida, ≥0 Discreta, ≥−5 Dudosa, si no Dañada. */
export function reputationLabel(value: number, language: Language = 'es'): string {
  if (value >= 15) return resolveMessage(language, 'career.reputation.ejemplar');
  if (value >= 8) return resolveMessage(language, 'career.reputation.solida');
  if (value >= 0) return resolveMessage(language, 'career.reputation.discreta');
  if (value >= -5) return resolveMessage(language, 'career.reputation.dudosa');
  return resolveMessage(language, 'career.reputation.danada');
}

/** Recompensa de carrera de un cierre, derivada solo del informe final
 * del motor (objetivos y hechos, nunca una calificación improvisada):
 * detención errónea = alguna detención incorrecta; conducta irregular =
 * al menos un acto irregular; legal = sin actos irregulares y todas las
 * detenciones con orden (o ninguna detención). `recovered` no sale del
 * informe — lo aporta quien llama desde el estado de la partida
 * (`run.recoveredObjects`), porque el informe no guarda qué se recuperó. */
export function outcomeFromReport(report: FinalReport, options: { recovered?: boolean } = {}): CaseOutcome {
  return calculateCaseOutcome(report.result, {
    wrongfulDetention: report.detentions.some(detention => !detention.correct),
    irregularConduct: report.irregularActs.length > 0,
    recovered: options.recovered ?? false,
    legal: report.irregularActs.length === 0 &&
      report.detentions.every(detention => detention.withWarrant),
  });
}

/** Un resultado oficial ya persistido, en orden de creación: la entrada
 * mínima desde la que se deriva el perfil de carrera (sin agregado
 * mutable aparte; la carrera es la suma de sus resultados oficiales). */
export interface CareerResultEntry {
  caseId: string;
  caseTitle: string;
  contentHash: string;
  result: CaseResult;
  reason: 'finished' | 'deadline' | 'withdrawn';
  minute: number;
  points: number;
  medal?: string | undefined;
  prestigeDelta: number;
  integrityDelta: number;
  trustDelta: number;
  /** Actos irregulares del cierre: 0 es un caso limpio. */
  irregularActs: number;
  countries: string[];
  places: string[];
  createdAt: string;
}

export interface DerivedCareerProfile {
  rank: string;
  points: number;
  prestige: number;
  integrity: number;
  trust: number;
  totalCases: number;
  completedCases: number;
  medals: string[];
  countries: string[];
  places: string[];
  sanctions: SanctionRecord[];
}

/** Perfil de carrera derivado de los resultados oficiales, en orden de
 * creación. Las medallas, los países y los lugares son únicos y en orden
 * de primera aparición; los puntos y las dimensiones son la suma de los
 * deltas. Solo la retirada de un caso crea sanción (suspensión): las
 * advertencias quedan en el dossier de su partida y en los deltas, no
 * como sanción de carrera. Una suspensión se resuelve con el primer caso
 * limpio posterior (sin actos irregulares) y no destruye guardados ni
 * bloquea herramientas. `imposedAt`/`resolvedAt` son minutos de cierre
 * de su expediente, no un reloj global. */
export function deriveCareerProfile(entries: CareerResultEntry[], language: Language = 'es'): DerivedCareerProfile {
  const medals: string[] = [];
  const countries: string[] = [];
  const places: string[] = [];
  let points = 0;
  let prestige = 0;
  let integrity = 0;
  let trust = 0;
  let completedCases = 0;
  for (const entry of entries) {
    points += entry.points;
    prestige += entry.prestigeDelta;
    integrity += entry.integrityDelta;
    trust += entry.trustDelta;
    if (entry.result === 'complete') completedCases += 1;
    if (entry.medal && !medals.includes(entry.medal)) medals.push(entry.medal);
    for (const country of entry.countries) if (!countries.includes(country)) countries.push(country);
    for (const place of entry.places) if (!places.includes(place)) places.push(place);
  }
  const sanctions: SanctionRecord[] = [];
  entries.forEach((entry, index) => {
    if (entry.reason !== 'withdrawn') return;
    const resolved = entries.slice(index + 1).find(later => later.irregularActs === 0);
    sanctions.push({
      id: 'suspension-' + entry.contentHash.slice(0, 12),
      caseId: entry.caseId,
      reason: resolveMessage(language, 'career.sanction.withdrawn'),
      severity: 'suspension',
      imposedAt: entry.minute,
      ...(resolved ? { resolvedAt: resolved.minute } : {}),
    });
  });
  return {
    rank: rankForTotals(prestige, integrity, trust, language),
    points, prestige, integrity, trust,
    totalCases: entries.length,
    completedCases,
    medals, countries, places,
    sanctions,
  };
}
