// Pipeline de generación de casos (T4-01)
// Estados: draft → validating → validated | rejected

import type { CaseDefinition, Difficulty, ExplorationMode } from '@meridiano/case-schema';
import type { CaseRun } from '@meridiano/case-schema';

// ============================================================================
// Parámetros de entrada
// ============================================================================

export type CrimeType = 'robo' | 'fraude' | 'homicidio' | 'secuestro' | 'contrabando' | 'corrupcion';

export type Region = 'europa' | 'america' | 'asia' | 'africa' | 'oceania' | 'global';

export type SurpriseMode = 'familiar' | 'general' | 'sorprende';

export interface GenerationParams {
  crimeType?: CrimeType;
  difficulty: Difficulty;
  explorationMode: ExplorationMode;
  duration: 'short' | 'medium' | 'long';
  region?: Region;
  surpriseMode: SurpriseMode;
  seed?: number;
  catalogVersion?: string;
}

export const DEFAULT_GENERATION_PARAMS: Required<GenerationParams> = {
  crimeType: 'robo',
  difficulty: 'normal',
  explorationMode: 'guided',
  duration: 'medium',
  region: 'europa',
  surpriseMode: 'familiar',
  seed: Date.now(),
  catalogVersion: '1.0.0',
};

// ============================================================================
// Estado del borrador
// ============================================================================

export type DraftStatus = 'draft' | 'validating' | 'validated' | 'rejected';

export interface CaseDraft {
  id: string;
  params: GenerationParams;
  status: DraftStatus;
  createdAt: string;
  updatedAt: string;
  currentStage: number;
  stages: StageCheckpoint[];
  definition?: CaseDefinition;
  validationReport?: ValidationReport;
  error?: string;
}

export interface StageCheckpoint {
  stage: number;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: string;
  completedAt?: string;
  output?: unknown;
  error?: string;
  retryCount: number;
}

export interface ValidationReport {
  validatorVersion: string;
  timestamp: string;
  stages: StageValidation[];
  overall: 'passed' | 'failed';
  errors: string[];
  warnings: string[];
}

export interface StageValidation {
  stage: number;
  name: string;
  passed: boolean;
  checks: string[];
  errors: string[];
  warnings: string[];
}

// ============================================================================
// Etapas del pipeline
// ============================================================================

export type GenerationStage =
  | 1  // Fijar delito, objetivos, verdad y motivaciones
  | 2  // Seleccionar geografía desde catálogo verificable
  | 3  // Definir NPC, conocimiento, relaciones y cronología
  | 4  // Construir lugares investigables y grafo de pistas
  | 5  // Fijar pruebas, resultados de laboratorio/registros, tiempos, eventos
  | 6  // Normalizar JSON declarativo y validar estructura/referencias
  | 7  // Ejecutar coherencia determinista y revisión semántica independiente
  | 8  // Simular rutas, errores y presupuestos temporales
  | 9; // Persistir versión/hash/reporte y publicar metadatos jugables

export const STAGE_NAMES: Record<GenerationStage, string> = {
  1: 'fijar_delito_objetivos_verdad_motivaciones',
  2: 'seleccionar_geografia_catalogo',
  3: 'definir_npc_conocimiento_relaciones_cronologia',
  4: 'construir_lugares_grafo_pistas',
  5: 'fijar_pruebas_laboratorio_tiempos_eventos',
  6: 'normalizar_json_validar_estructura_referencias',
  7: 'coherencia_determinista_revision_semantica',
  8: 'simular_rutas_errores_presupuestos',
  9: 'persistir_version_hash_reporte_publicar',
};

export const MAX_STAGE = 9;
export const MAX_RETRIES_PER_STAGE = 3;

// ============================================================================
// Resultado de generación
// ============================================================================

export interface GenerationResult {
  draft: CaseDraft;
  success: boolean;
  definition?: CaseDefinition;
  run?: CaseRun;
  error?: string;
}

// ============================================================================
// Configuración del pipeline
// ============================================================================

export interface PipelineConfig {
  maxRetriesPerStage: number;
  stageTimeoutMs: number;
  enableSemanticReview: boolean;
  enableSimulation: boolean;
  checkpointStore: CheckpointStore;
  validator: GenerationValidator;
}

export interface GenerationValidator {
  validateParams(params: GenerationParams): ValidationResult;
  validateStageOutput(stage: GenerationStage, output: unknown): ValidationResult;
  validateDefinition(definition: CaseDefinition): ValidationResult;
}

export interface CheckpointStore {
  save(draft: CaseDraft): Promise<void>;
  load(id: string): Promise<CaseDraft | null>;
  list(): Promise<CaseDraft[]>;
  delete(id: string): Promise<void>;
}

// ============================================================================
// Servicio generador
// ============================================================================

export interface GeneratorService {
  createDraft(params: GenerationParams): Promise<CaseDraft>;
  runPipeline(draftId: string): Promise<GenerationResult>;
  getDraft(id: string): Promise<CaseDraft | null>;
  listDrafts(): Promise<CaseDraft[]>;
  cancelDraft(id: string): Promise<void>;
  retryStage(draftId: string, stage: GenerationStage): Promise<GenerationResult>;
}

// ============================================================================
// Utilidades
// ============================================================================

export function validateGenerationParams(params: GenerationParams): ValidationResult {
  const errors: string[] = [];

  if (!params.difficulty) errors.push('difficulty es requerido');
  if (!params.explorationMode) errors.push('explorationMode es requerido');
  if (!params.duration) errors.push('duration es requerido');
  if (!params.surpriseMode) errors.push('surpriseMode es requerido');
  if (params.seed !== undefined && (!Number.isInteger(params.seed) || params.seed < 0)) {
    errors.push('seed debe ser entero no negativo');
  }

  return { valid: errors.length === 0, errors, warnings: [] };
}

export function createStageCheckpoint(stage: GenerationStage): StageCheckpoint {
  return {
    stage,
    name: STAGE_NAMES[stage],
    status: 'pending',
    retryCount: 0,
  };
}

export function createInitialDraft(params: GenerationParams): CaseDraft {
  const now = new Date().toISOString();
  return {
    id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    params,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    currentStage: 1,
    stages: Array.from({ length: MAX_STAGE }, (_, i) => createStageCheckpoint((i + 1) as GenerationStage)),
  };
}

// ============================================================================
// Ejecución del pipeline (implementación por defecto)
// ============================================================================

export async function runPipeline(
  draft: CaseDraft,
  config: PipelineConfig
): Promise<GenerationResult> {
  let currentDraft = { ...draft };
  currentDraft.status = 'validating';
  currentDraft.updatedAt = new Date().toISOString();

  await config.checkpointStore.save(currentDraft);

  for (let stage = currentDraft.currentStage; stage <= MAX_STAGE; stage++) {
    const checkpoint = currentDraft.stages[stage - 1];
    if (!checkpoint) continue;
    if (checkpoint.status === 'completed') continue;

    checkpoint.status = 'running';
    checkpoint.startedAt = new Date().toISOString();
    currentDraft.currentStage = stage;
    currentDraft.updatedAt = new Date().toISOString();

    await config.checkpointStore.save(currentDraft);

    try {
      const output = await executeStage(stage, currentDraft, config);
      
      const validation = config.validator.validateStageOutput(stage, output);
      if (!validation.valid) {
        throw new Error(`Validación etapa ${stage} fallida: ${validation.errors.join(', ')}`);
      }

      checkpoint.status = 'completed';
      checkpoint.completedAt = new Date().toISOString();
      checkpoint.output = output;
      currentDraft.updatedAt = new Date().toISOString();
      await config.checkpointStore.save(currentDraft);

    } catch (error) {
      checkpoint.retryCount++;
      const err = error instanceof Error ? error.message : String(error);
      
      if (checkpoint.retryCount >= config.maxRetriesPerStage) {
        checkpoint.status = 'failed';
        checkpoint.error = err;
        currentDraft.status = 'rejected';
        currentDraft.error = `Etapa ${stage} falló tras ${checkpoint.retryCount} intentos: ${err}`;
        await config.checkpointStore.save(currentDraft);
        return { draft: currentDraft, success: false, error: currentDraft.error };
      }

      checkpoint.status = 'pending';
      checkpoint.error = err;
      currentDraft.updatedAt = new Date().toISOString();
      await config.checkpointStore.save(currentDraft);
      
      // Reintentar la misma etapa
      stage--;
      continue;
    }
  }

  // Pipeline completado
  if (!currentDraft.definition) {
    currentDraft.status = 'rejected';
    currentDraft.error = 'Pipeline completado pero no se generó definición';
    await config.checkpointStore.save(currentDraft);
    return { draft: currentDraft, success: false, error: currentDraft.error };
  }

  currentDraft.status = 'validated';
  currentDraft.updatedAt = new Date().toISOString();
  await config.checkpointStore.save(currentDraft);

  return { draft: currentDraft, success: true, definition: currentDraft.definition };
}

async function executeStage(
  stage: GenerationStage,
  _draft: CaseDraft,
  _config: PipelineConfig
): Promise<unknown> {
  // Implementación por defecto - devuelve mock output
  // En implementación real, cada etapa tendría su lógica específica
  switch (stage) {
    case 1:
      return { crimeType: 'robo', objectives: [], truth: '', motivations: '' };
    case 2:
      return { geography: 'selected' };
    case 3:
      return { npcs: [], timeline: [] };
    case 4:
      return { locations: [], clueGraph: {} };
    case 5:
      return { evidence: [], labResults: [], events: [] };
    case 6:
      return { normalized: true };
    case 7:
      return { coherence: true, semanticReview: true };
    case 8:
      return { simulation: true };
    case 9:
      return { persisted: true, definition: undefined };
    default:
      return {};
  }
}

export function createGeneratorService(config: PipelineConfig): GeneratorService {
  return {
    async createDraft(params: GenerationParams): Promise<CaseDraft> {
      const draft = createInitialDraft(params);
      await config.checkpointStore.save(draft);
      return draft;
    },

    async runPipeline(draftId: string): Promise<GenerationResult> {
      const draft = await config.checkpointStore.load(draftId);
      if (!draft) throw new Error(`Borrador no encontrado: ${draftId}`);
      return runPipeline(draft, config);
    },

    async getDraft(id: string): Promise<CaseDraft | null> {
      return config.checkpointStore.load(id);
    },

    async listDrafts(): Promise<CaseDraft[]> {
      return config.checkpointStore.list();
    },

    async cancelDraft(id: string): Promise<void> {
      const draft = await config.checkpointStore.load(id);
      if (draft) {
        draft.status = 'rejected';
        draft.error = 'Cancelado por usuario';
        draft.updatedAt = new Date().toISOString();
        await config.checkpointStore.save(draft);
      }
    },

    async retryStage(draftId: string, stage: GenerationStage): Promise<GenerationResult> {
      const draft = await config.checkpointStore.load(draftId);
      if (!draft) throw new Error(`Borrador no encontrado: ${draftId}`);
      
      const checkpoint = draft.stages[stage - 1];
      if (checkpoint) {
        checkpoint.status = 'pending';
        checkpoint.retryCount = 0;
        checkpoint.error = undefined;
      }
      draft.currentStage = stage;
      draft.status = 'validating';
      draft.updatedAt = new Date().toISOString();
      
      return runPipeline(draft, config);
    },
  };
}

// ============================================================================
// Validación
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ValidationError {
  code: string;
  message: string;
  path?: string;
}

// ============================================================================
// Constantes
// ============================================================================

export const MAX_STAGE = 9;
export const MAX_RETRIES_PER_STAGE = 3;

export const STAGE_NAMES: Record<number, string> = {
  1: 'fijar_delito_objetivos_verdad_motivaciones',
  2: 'seleccionar_geografia_catalogo',
  3: 'definir_npc_conocimiento_relaciones_cronologia',
  4: 'construir_lugares_grafo_pistas',
  5: 'fijar_pruebas_laboratorio_tiempos_eventos',
  6: 'normalizar_json_validar_estructura_referencias',
  7: 'coherencia_determinista_revision_semantica',
  8: 'simular_rutas_errores_presupuestos',
  9: 'persistir_version_hash_reporte_publicar',
};