// Límites de catálogo y carrera (T5-07)
// Bordes funcionales: lo que el motor debe rechazar o limitar sin fijar equilibrio.

import { validateCatalogParams, getBudgetForParams, type CatalogParams } from './catalog.js';
import { calculateCaseOutcome, applyOutcome, createInitialCareer, getRank, type CaseResult } from './career.js';

export interface CatalogBoundaryResult {
  valid: boolean;
  reason?: string;
}

export function validateCatalogBoundary(params: CatalogParams): CatalogBoundaryResult {
  const v = validateCatalogParams(params);
  if (!v.valid) return { valid: false, reason: v.errors.join('; ') };
  const budget = getBudgetForParams(params);

  if (budget <= 0) return { valid: false, reason: 'presupuesto no positivo' };
  // duration is a string (short/medium/long), skip numeric check
  return { valid: true };
}

export interface CareerBoundaryResult {
  valid: boolean;
  reason?: string;
}

export function validateCareerBoundary(result: CaseResult, careerState: ReturnType<typeof createInitialCareer>): CareerBoundaryResult {
  if (!['complete', 'partial', 'unresolved', 'incorrect'].includes(result)) {
    return { valid: false, reason: 'resultado no válido' };
  }
  const outcome = calculateCaseOutcome(result);
  const next = applyOutcome(careerState, outcome);
  // Prestigio, integridad y confianza no pueden ser negativos
  if (next.prestige < 0 || next.integrity < 0 || next.trust < 0) {
    return { valid: false, reason: 'dimensión negativa' };
  }
  // Rango debe ser uno de los conocidos
  if (!['Aspirante', 'Detective', 'Sargento', 'Inspector'].includes(getRank(next))) {
    return { valid: false, reason: 'rango desconocido' };
  }
  return { valid: true };
}
