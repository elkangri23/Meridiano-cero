// Validadores para pipeline de generación (T4-08)
// La puerta real es el validador v1.5 + la simulación por el motor; las
// heurísticas simuladas de T4-01/T4-02 (dos rutas por palabras clave,
// presupuesto DIFFICULTY_BUDGET) ya no se usan.

import { validateCaseDefinition, validateGeneratedContent } from '@meridiano/case-schema';
import type { ContentRating } from '@meridiano/case-schema';
import type { GenerationParams, ValidationResult, ValidationError } from './pipeline.js';
import type { CaseDefinition, Difficulty, ContentMode, ExplorationMode } from '@meridiano/case-schema';
import { GENERATABLE_CRIMES } from './stages.js';
import { simulateCase, type GoldenPathAction } from './simulator.js';

import { validateStageOutput } from './stages.js';
export { validateStageOutput };

// ============================================================================
// Constantes de límites (SPEC-007)
// ============================================================================

export const GENERATION_LIMITS = {
  maxCities: 20,
  maxLocations: 100,
  maxNPCs: 100,
  maxEvidence: 1000,
  maxJsonDepth: 32,
  maxTextLength: 16384,
  maxFileSizeBytes: 2 * 1024 * 1024, // 2 MiB
} as const;

// Catálogo de parámetros local (extensión de case-schema CatalogParams)
export interface GeneratorCatalogParams {
  crimeType: string;
  difficulty: Difficulty;
  explorationMode: ExplorationMode;
  duration: 'short' | 'medium' | 'long';
  region: string;
  contentMode: ContentMode;
  surpriseMode: 'familiar' | 'general' | 'sorprende';
  seed: number;
}

// ============================================================================
// Validación de parámetros de entrada
// ============================================================================

function checkEnumParam(params: GenerationParams, key: 'difficulty' | 'explorationMode' | 'duration' | 'surpriseMode', values: readonly string[], errors: string[]): void {
  const value = params[key];
  if (!value) { errors.push(`${key} es requerido`); return; }
  if (!values.includes(value)) errors.push(`${key} debe ser ${values.join(', ')}`);
}

export function validateGenerationParams(params: GenerationParams): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  checkEnumParam(params, 'difficulty', ['easy', 'normal', 'hard'], errors);
  checkEnumParam(params, 'explorationMode', ['guided', 'free'], errors);
  checkEnumParam(params, 'duration', ['short', 'medium', 'long'], errors);
  checkEnumParam(params, 'surpriseMode', ['familiar', 'general', 'sorprende'], errors);

  if (params.crimeType && !GENERATABLE_CRIMES.includes(params.crimeType)) {
    errors.push('crimeType no válido');
  }

  if (params.region && params.region !== 'europa' && params.region !== 'global') {
    errors.push('region sin ciudades verificadas en el catálogo (hoy solo Europa)');
  }

  if (params.seed !== undefined && (!Number.isInteger(params.seed) || params.seed < 0)) {
    errors.push('seed debe ser entero no negativo');
  }

  return { valid: errors.length === 0, errors, warnings };
}

// Validación completa de definición de caso
// ============================================================================

export function validateCaseDraft(draft: { definition?: unknown; goldenPath?: GoldenPathAction[]; contentRating?: ContentRating; budgetMinutes?: number }): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!draft.definition) {
    errors.push('Definición de caso requerida');
    return { valid: false, errors, warnings };
  }

  const def = draft.definition as CaseDefinition;
  const structural = validateCaseDefinition(def);
  errors.push(...structural.errors);
  if (draft.contentRating) {
    validateGeneratedContent(def as unknown as Record<string, unknown>, draft.contentRating, errors);
  }
  if (draft.goldenPath && draft.budgetMinutes !== undefined) {
    const simulation = simulateCase(def, draft.goldenPath, draft.budgetMinutes);
    errors.push(...simulation.errors);
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validateCatalogParams(params: GeneratorCatalogParams): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!['easy', 'normal', 'hard'].includes(params.difficulty)) {
    errors.push('difficulty inválida');
  }
  if (!['guided', 'free'].includes(params.explorationMode)) {
    errors.push('explorationMode inválida');
  }
  if (!['fixed', 'generated'].includes(params.contentMode)) {
    errors.push('contentMode inválida');
  }
  if (!params.seed || !Number.isInteger(params.seed)) {
    errors.push('seed requerida y debe ser entero');
  }

  return { valid: errors.length === 0, errors, warnings };
}

function validateReferences(def: CaseDefinition): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const cityIds = new Set(def.cities.map(c => c.id));
  for (const loc of def.locations) {
    if (!cityIds.has(loc.cityId)) {
      errors.push(`Localización ${loc.id} referencia ciudad inexistente: ${loc.cityId}`);
    }
  }

  for (const npc of def.npcs) {
    if (!cityIds.has(npc.cityId)) {
      errors.push(`NPC ${npc.id} referencia ciudad inexistente: ${npc.cityId}`);
    }
  }

  for (const ev of def.evidence) {
    if (!ev.origin) warnings.push(`Evidencia ${ev.id} sin origen`);
  }

  const factIds = new Set(def.facts.map(f => f));
  for (const ev of def.evidence) {
    for (const rel of ev.relations) {
      if (!factIds.has(rel)) warnings.push(`Evidencia ${ev.id} relaciona hecho no declarado: ${rel}`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validateGeography(def: CaseDefinition, catalog: { cities: Array<{ id: string }> }): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const catalogCityIds = new Set(catalog.cities.map(c => c.id));
  const defCityIds = new Set(def.cities.map(c => c.id));

  for (const cityId of defCityIds) {
    if (!catalogCityIds.has(cityId)) {
      errors.push(`Ciudad ${cityId} no existe en catálogo geográfico`);
    }
  }

  if (def.cities.length > 1) {
    warnings.push('Verificar conectividad entre ciudades en catálogo de rutas');
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function createGenerationValidator() {
  return {
    validateParams: validateGenerationParams,
    validateStageOutput,
    validateDefinition: validateCaseDraft,
    validateCatalogParams,
    validateReferences,
    validateGeography,
  };
}

export type { ValidationResult, ValidationError };