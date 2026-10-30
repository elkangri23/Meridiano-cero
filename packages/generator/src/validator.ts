// Validadores para pipeline de generación (T4-01, T4-02)
// Coherencia, conocimiento, contenido y geografía

import type { GenerationParams, ValidationResult, ValidationError } from './pipeline.js';
import type { CaseDefinition, Difficulty, ContentMode, ExplorationMode } from '@meridiano/case-schema';

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

export function validateGenerationParams(params: GenerationParams): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!params.difficulty) errors.push('difficulty es requerido');
  if (!['easy', 'normal', 'hard'].includes(params.difficulty)) {
    errors.push('difficulty debe ser easy, normal o hard');
  }

  if (!params.explorationMode) errors.push('explorationMode es requerido');
  if (!['guided', 'free'].includes(params.explorationMode)) {
    errors.push('explorationMode debe ser guided o free');
  }

  if (!params.duration) errors.push('duration es requerido');
  if (!['short', 'medium', 'long'].includes(params.duration)) {
    errors.push('duration debe ser short, medium o long');
  }

  if (!params.surpriseMode) errors.push('surpriseMode es requerido');
  if (!['familiar', 'general', 'sorprende'].includes(params.surpriseMode)) {
    errors.push('surpriseMode debe ser familiar, general o sorprende');
  }

  if (params.crimeType && !['robo', 'fraude', 'homicidio', 'secuestro', 'contrabando', 'corrupcion'].includes(params.crimeType)) {
    errors.push('crimeType no válido');
  }

  if (params.region && !['europa', 'america', 'asia', 'africa', 'oceania', 'global'].includes(params.region)) {
    warnings.push('region no reconocida, se usará europa por defecto');
  }

  if (params.seed !== undefined && (!Number.isInteger(params.seed) || params.seed < 0)) {
    errors.push('seed debe ser entero no negativo');
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ============================================================================
// Validación de salida de etapa
// ============================================================================

export function validateStageOutput(stage: number, output: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (output === null || output === undefined) {
    errors.push('Output de etapa no puede ser null/undefined');
    return { valid: false, errors, warnings };
  }

  const out = output as Record<string, unknown>;

  switch (stage) {
    case 1: // Fijar delito, objetivos, verdad y motivaciones
      if (!out.crimeType || typeof out.crimeType !== 'string') {
        errors.push('Etapa 1: crimeType requerido');
      }
      if (!Array.isArray(out.objectives)) {
        errors.push('Etapa 1: objectives debe ser array');
      }
      if (!out.truth || typeof out.truth !== 'string') {
        errors.push('Etapa 1: truth requerido');
      }
      break;

    case 2: // Seleccionar geografía
      if (!out.geography) {
        warnings.push('Etapa 2: geography output vacío');
      }
      break;

    case 3: // NPCs, conocimiento, relaciones, cronología
      if (!Array.isArray(out.npcs)) {
        errors.push('Etapa 3: npcs debe ser array');
      } else if (out.npcs.length > GENERATION_LIMITS.maxNPCs) {
        errors.push(`Etapa 3: máximo ${GENERATION_LIMITS.maxNPCs} NPCs`);
      }
      if (!Array.isArray(out.timeline)) {
        warnings.push('Etapa 3: timeline recomendado');
      }
      break;

    case 4: // Lugares y grafo de pistas
      if (!Array.isArray(out.locations)) {
        errors.push('Etapa 4: locations debe ser array');
      } else if (out.locations.length > GENERATION_LIMITS.maxLocations) {
        errors.push(`Etapa 4: máximo ${GENERATION_LIMITS.maxLocations} localizaciones`);
      }
      if (typeof out.clueGraph !== 'object' || out.clueGraph === null) {
        errors.push('Etapa 4: clueGraph requerido');
      }
      break;

    case 5: // Pruebas, laboratorio, tiempos, eventos
      if (!Array.isArray(out.evidence)) {
        warnings.push('Etapa 5: evidence recomendado');
      } else if (out.evidence.length > GENERATION_LIMITS.maxEvidence) {
        errors.push(`Etapa 5: máximo ${GENERATION_LIMITS.maxEvidence} evidencias`);
      }
      break;

    case 6: // Normalizar JSON
      if (out.normalized !== true) {
        warnings.push('Etapa 6: normalized debería ser true');
      }
      break;

    case 7: // Coherencia y revisión semántica
      if (out.coherence !== true) {
        errors.push('Etapa 7: coherence debe ser true');
      }
      break;

    case 8: // Simulación
      if (out.simulation !== true) {
        errors.push('Etapa 8: simulation debe ser true');
      }
      break;

    case 9: // Persistir
      if (out.persisted !== true) {
        errors.push('Etapa 9: persisted debe ser true');
      }
      break;
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ============================================================================
// Validación completa de definición de caso
// ============================================================================

export function validateCaseDraft(draft: { definition?: unknown }): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!draft.definition) {
    errors.push('Definición de caso requerida');
    return { valid: false, errors, warnings };
  }

  const def = draft.definition as CaseDefinition;

  // Validaciones estructurales básicas
  if (!def.id || typeof def.id !== 'string') errors.push('id requerido');
  if (!def.schemaVersion || typeof def.schemaVersion !== 'number') errors.push('schemaVersion requerido');
  if (!def.solution) warnings.push('solution recomendado');

  // Validar catálogo de parámetros
  const catalogParams = extractCatalogParams(def);
  const catalogValidation = validateCatalogParams(catalogParams);
  errors.push(...catalogValidation.errors);
  warnings.push(...catalogValidation.warnings);

  // Validar referencias
  const refValidation = validateReferences(def);
  errors.push(...refValidation.errors);
  warnings.push(...refValidation.warnings);

  // Validar dos rutas independientes (requisito duro)
  const routesValidation = validateTwoRoutes(def);
  errors.push(...routesValidation.errors);
  warnings.push(...routesValidation.warnings);

  // Validar presupuesto temporal
  const budgetValidation = validateTimeBudget(def);
  errors.push(...budgetValidation.errors);
  warnings.push(...budgetValidation.warnings);

  return { valid: errors.length === 0, errors, warnings };
}

function extractCatalogParams(def: CaseDefinition): GeneratorCatalogParams {
  return {
    crimeType: 'robo',
    difficulty: def.difficulty,
    explorationMode: def.explorationMode,
    duration: 'medium',
    region: 'europa',
    surpriseMode: 'familiar',
    seed: def.seed,
    contentMode: def.contentMode,
  };
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

function validateTwoRoutes(def: CaseDefinition): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (def.objectives.length < 2) {
    errors.push('Se requieren al menos 2 objetivos para dos rutas independientes');
  }

  const decisiveNPCs = def.npcs.filter(npc => 
    npc.knowledge.some(k => k.includes('decisive') || k.includes('clave') || k.includes('truth'))
  ).length;

  if (decisiveNPCs < 2) {
    warnings.push('Se recomiendan al menos 2 NPCs con conocimiento decisivo para rutas independientes');
  }

  const decisiveEvidence = def.evidence.filter(e => e.admissible && e.type === 'analysis').length;
  if (decisiveEvidence < 2) {
    warnings.push('Se recomiendan al menos 2 evidencias admisibles de tipo analysis');
  }

  return { valid: errors.length === 0, errors, warnings };
}

function validateTimeBudget(def: CaseDefinition): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const difficultyBudget: Record<Difficulty, number> = {
    easy: 300,
    normal: 480,
    hard: 600,
  };

  const budget = difficultyBudget[def.difficulty];
  const durationFactor = def.deadlineMinutes < 300 ? 0.7 : def.deadlineMinutes > 600 ? 1.3 : 1;
  const availableTime = Math.round(budget * durationFactor);

  const minTime = def.locations.length * 15 + def.npcs.length * 10 + def.evidence.length * 5 + def.objectives.length * 30;

  if (minTime > availableTime) {
    errors.push(`Presupuesto temporal insuficiente: mínimo ${minTime} min, disponible ${availableTime} min`);
  } else if (minTime > availableTime * 0.8) {
    warnings.push(`Presupuesto ajustado: ${minTime}/${availableTime} min`);
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
    validateTwoRoutes,
    validateTimeBudget,
    validateGeography,
  };
}

export type { ValidationResult, ValidationError };