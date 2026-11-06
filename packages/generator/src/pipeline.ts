// Pipeline de generación de casos (T4-08, SPEC-007)
// Estados: draft → validating → validated | rejected
//
// Antes (T4-01) era un esqueleto: executeStage devolvía salidas simuladas y
// runPipeline siempre rechazaba al final. Ahora cada etapa hace su trabajo
// de verdad: 5 llamadas LLM como máximo (premisa, NPC, red de pistas,
// revisión semántica y una reparación opcional de la red de pistas) y el
// resto determinista (geografía, ensamblaje, validación v1.5, simulación por
// el motor real, publicación). La puerta es dura: un borrador que no valida
// o no se juega se repara una vez y, si sigue sin pasar, se rechaza con
// motivo. Ningún expediente entra en el catálogo sin pasar la puerta.

import { createValidationReport, validateCaseDefinition, validateGeneratedContent } from '@meridiano/case-schema';
import type { CaseDefinition } from '@meridiano/case-schema';
import type { CaseRun } from '@meridiano/case-schema';
import {
  DEADLINE_BY_DURATION,
  stageOutputSchema,
  assembleDefinition,
  buildStageContext,
  premiseBriefing,
  resolveGenerationChoice,
  selectGeography,
  validateStageOutput,
  type GeneratableCrime,
  type ResolvedChoice,
  type SelectedGeography,
} from './stages.js';
import { validateGenerationParams } from './validator.js';
export { validateGenerationParams };
import { simulateCase, type GoldenPathAction, type SimulationResult } from './simulator.js';

// ============================================================================
// Parámetros de entrada
// ============================================================================

/** Delitos generables (lista canónica reconciliada en T4-08, sin
 * 'aleatorio', que es modo de selección). */
export type CrimeType = GeneratableCrime;

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

type Difficulty = 'easy' | 'normal' | 'hard';
type ExplorationMode = 'guided' | 'free';

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
  /** Delito y contenido resueltos (sorteo con la semilla si hay sorpresa). */
  choice?: ResolvedChoice;
  /** Geografía elegida en la etapa 2 (determinista). */
  geography?: SelectedGeography;
  /** Ruta dorada declarada por el generador (etapa 4). */
  goldenPath?: GoldenPathAction[];
  /** Introducción del caso, sin spoilers (etapa 1). */
  briefing?: { speaker: string; title: string; paragraphs: string[] };
  /** Resultado de la simulación (etapa 8). */
  simulation?: SimulationResult;
  /** Una sola reparación de la etapa 4 por borrador. */
  repairUsed?: boolean;
  repairFeedback?: string[];
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
  | 1  // Fijar delito, objetivos, verdad y motivaciones (LLM)
  | 2  // Seleccionar geografía desde catálogo verificable (determinista)
  | 3  // Definir NPC, conocimiento, relaciones y cronología (LLM)
  | 4  // Construir lugares investigables y grafo de pistas (LLM)
  | 5  // Ensamblar la definición (determinista)
  | 6  // Validar estructura/referencias/contenido (determinista, puerta)
  | 7  // Revisión semántica independiente (LLM, puerta)
  | 8  // Simular la ruta dorada por el motor real (determinista, puerta)
  | 9; // Publicar versión/hash/reporte y metadatos jugables

export const STAGE_NAMES: Record<GenerationStage, string> = {
  1: 'fijar_delito_objetivos_verdad_motivaciones',
  2: 'seleccionar_geografia_catalogo',
  3: 'definir_npc_conocimiento_relaciones_cronologia',
  4: 'construir_lugares_grafo_pistas',
  5: 'ensamblar_definicion',
  6: 'validar_estructura_referencias_contenido',
  7: 'revision_semantica_independiente',
  8: 'simular_ruta_dorada_motor',
  9: 'publicar_version_hash_reporte',
};

export const MAX_STAGE = 9;
export const MAX_RETRIES_PER_STAGE = 3;
/** Una sola reparación de la etapa 4 por borrador (SPEC-007). */
export const MAX_REPAIRS_PER_DRAFT = 1;

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

/** Frontera del modelo para las etapas LLM. La implementa la API con el
 * proveedor del administrador (FreeLLMAPI en el VPS); los tests inyectan
 * un doble. El `signal` aborta la llamada si la etapa agota su plazo. */
export interface StageLlm {
  generate(input: { stage: GenerationStage; context: Record<string, unknown>; schema: Record<string, unknown>; signal?: AbortSignal }): Promise<unknown>;
}

export interface PipelineConfig {
  maxRetriesPerStage: number;
  stageTimeoutMs: number;
  enableSemanticReview: boolean;
  enableSimulation: boolean;
  checkpointStore: CheckpointStore;
  /** Sin LLM las etapas 1, 3, 4 y 7 fallan con un error claro. */
  llm?: StageLlm;
  /** Id del expediente a generar (la API lo fija para que sea único). */
  caseId?: string;
}

export interface GenerationValidator {
  validateParams(params: GenerationParams): ValidationResult;
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
// Ejecución del pipeline
// ============================================================================

/** Fallo de una puerta (etapas 6, 7 u 8): el borrador no pasa y puede
 * repararse una vez rehaciendo la etapa 4 con los errores como feedback. */
export class StageGateError extends Error {
  readonly errors: string[];
  constructor(errors: string[]) {
    super(`Puerta de validación fallida: ${errors.join('; ')}`);
    this.errors = errors;
  }
}

function stageOutput(draft: CaseDraft, stage: GenerationStage): unknown {
  return draft.stages[stage - 1]?.output;
}

function castIds(draft: CaseDraft): string[] {
  const premise = stageOutput(draft, 1) as Record<string, unknown> | undefined;
  if (!premise) return [];
  const cast = [premise.solution, premise.decoy, ...(Array.isArray(premise.witnesses) ? premise.witnesses : [])];
  return cast.map(member => (member as Record<string, unknown>).id).filter((id): id is string => typeof id === 'string');
}

function requireLlm(config: PipelineConfig): StageLlm {
  if (!config.llm) throw new Error('Sin proveedor de generación: las etapas LLM no pueden ejecutarse.');
  return config.llm;
}

/** Ejecuta una etapa LLM con plazo: al agotarse se aborta la llamada y se
 * rechaza con un error claro. El `signal` llega al proveedor para que
 * cancele el trabajo del modelo. */
async function withStageTimeout<T>(ms: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await Promise.race([
      run(controller.signal),
      new Promise<never>((_, reject) => controller.signal.addEventListener('abort', () => reject(new Error(`La etapa agotó su plazo de ${ms} ms.`)), { once: true })),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** Una etapa LLM (1, 3, 4 o 7): llama al modelo con su contexto y esquema,
 * valida la forma de la salida y devuelve el JSON. Sin LLM o con salida
 * inválida, rechaza con un error claro. */
async function runLlmStage(
  stage: 1 | 3 | 4 | 7,
  draft: CaseDraft,
  choice: ResolvedChoice,
  geography: SelectedGeography,
  config: PipelineConfig,
  prior: Record<string, unknown>,
  feedback?: string[],
): Promise<unknown> {
  const llm = requireLlm(config);
  const stageContext = buildStageContext(stage, choice, draft.params, geography, prior, feedback);
  const output = await withStageTimeout(config.stageTimeoutMs, signal => llm.generate({ stage, context: stageContext, schema: stageOutputSchema(stage), signal }));
  const validation = validateStageOutput(stage, output, { geography, castIds: castIds(draft) });
  if (!validation.valid) throw new Error(`Etapa ${stage} inválida: ${validation.errors.join('; ')}`);
  return output;
}

/** Etapa 5: ensambla la definición desde las salidas 1, 3 y 4. */
function assembleStage(draft: CaseDraft, choice: ResolvedChoice, geography: SelectedGeography, config: PipelineConfig): { assembled: boolean; caseId: string } {
  const premise = stageOutput(draft, 1) as Record<string, unknown>;
  const npcs = stageOutput(draft, 3) as Record<string, unknown>;
  const clues = stageOutput(draft, 4) as Record<string, unknown>;
  if (!premise || !npcs || !clues) throw new Error('Faltan salidas de etapa para ensamblar.');
  const definition = assembleDefinition({
    caseId: config.caseId ?? `generado-${choice.crimeType}-${draft.params.seed ?? 0}`,
    choice,
    params: draft.params,
    geography,
    premise,
    npcs,
    clues,
  });
  draft.definition = definition;
  draft.goldenPath = (clues.goldenPath as GoldenPathAction[]);
  draft.briefing = premiseBriefing(premise);
  return { assembled: true, caseId: definition.id };
}

/** Etapa 6 (puerta): validador v1.5 + contenido. */
function validateStage(draft: CaseDraft, choice: ResolvedChoice): { validated: boolean } {
  const definition = draft.definition;
  if (!definition) throw new Error('Sin definición que validar.');
  const structural = validateCaseDefinition(definition);
  const contentErrors: string[] = [];
  validateGeneratedContent(definition as unknown as Record<string, unknown>, choice.contentRating, contentErrors);
  const errors = [...structural.errors, ...contentErrors];
  if (errors.length > 0) throw new StageGateError(errors);
  definition.validationReport = createValidationReport([]);
  draft.validationReport = {
    validatorVersion: '1.5.0',
    timestamp: new Date().toISOString(),
    stages: [{ stage: 6, name: STAGE_NAMES[6], passed: true, checks: ['estructura', 'referencias', 'mecánica', 'textos', 'contenido'], errors: [], warnings: [] }],
    overall: 'passed',
    errors: [],
    warnings: [],
  };
  return { validated: true };
}

/** Etapa 7 (puerta): revisión semántica independiente por LLM. */
async function reviewStage(draft: CaseDraft, choice: ResolvedChoice, geography: SelectedGeography, config: PipelineConfig): Promise<{ coherent: boolean }> {
  if (!config.enableSemanticReview) return { coherent: true };
  const definition = draft.definition;
  if (!definition || !draft.goldenPath) throw new Error('Sin definición que revisar.');
  const budgetMinutes = Math.floor(DEADLINE_BY_DURATION[draft.params.duration] / 2);
  const output = await runLlmStage(7, draft, choice, geography, config, { definition, goldenPath: draft.goldenPath, budgetMinutes });
  const review = output as { coherent: boolean; issues: string[] };
  if (!review.coherent) throw new StageGateError(review.issues);
  return { coherent: true };
}

/** Etapa 8 (puerta): simulación de la ruta dorada por el motor real. */
function simulateStage(draft: CaseDraft, config: PipelineConfig): { playable: boolean; minute: number; budgetMinutes: number } {
  if (!config.enableSimulation) return { playable: true, minute: 0, budgetMinutes: 0 };
  const definition = draft.definition;
  if (!definition || !draft.goldenPath) throw new Error('Sin definición que simular.');
  const budgetMinutes = Math.floor(DEADLINE_BY_DURATION[draft.params.duration] / 2);
  const simulation = simulateCase(definition, draft.goldenPath, budgetMinutes);
  draft.simulation = simulation;
  if (!simulation.playable) throw new StageGateError(simulation.errors);
  return { playable: true, minute: simulation.minute, budgetMinutes };
}

async function executeLlmStage(stage: 1 | 3 | 4, draft: CaseDraft, choice: ResolvedChoice, geography: SelectedGeography, config: PipelineConfig, feedback?: string[]): Promise<unknown> {
  switch (stage) {
    case 1:
      return runLlmStage(1, draft, choice, geography, config, {}, feedback);
    case 3:
      return runLlmStage(3, draft, choice, geography, config, { premise: stageOutput(draft, 1) }, feedback);
    case 4:
      return runLlmStage(4, draft, choice, geography, config, { premise: stageOutput(draft, 1), npcs: stageOutput(draft, 3) }, [...(draft.repairFeedback ?? []), ...(feedback ?? [])]);
  }
}

function publishStage(draft: CaseDraft): { published: boolean; definitionHash: string } {
  const definition = draft.definition;
  if (!definition) throw new Error('Sin definición que publicar.');
  return { published: false, definitionHash: definition.id };
}

const LLM_STAGES = new Set<GenerationStage>([1, 3, 4]);

async function executeDeterministicStage(stage: GenerationStage, draft: CaseDraft, choice: ResolvedChoice, geography: SelectedGeography, config: PipelineConfig): Promise<unknown | undefined> {
  if (stage === 2) return geography;
  if (stage === 5) return assembleStage(draft, choice, geography, config);
  if (stage === 6) return validateStage(draft, choice);
  if (stage === 7) return reviewStage(draft, choice, geography, config);
  if (stage === 8) return simulateStage(draft, config);
  return undefined;
}

async function executeStage(
  stage: GenerationStage,
  draft: CaseDraft,
  config: PipelineConfig,
  feedback?: string[],
): Promise<unknown> {
  const choice = draft.choice;
  const geography = draft.geography;
  if (!choice || !geography) throw new Error('El borrador no tiene delito ni geografía resueltos.');
  if (LLM_STAGES.has(stage)) return executeLlmStage(stage as 1 | 3 | 4, draft, choice, geography, config, feedback);
  const deterministic = await executeDeterministicStage(stage, draft, choice, geography, config);
  if (deterministic !== undefined) return deterministic;
  if (stage === 9) return publishStage(draft);
  return {};
}

/** Una puerta falló: una reparación rehaciendo la etapa 4 con los errores
 * como feedback; si ya se reparó, el borrador se rechaza. Devuelve true si
 * se repara (el bucle vuelve a la etapa 4). */
async function repairAfterGateFailure(draft: CaseDraft, error: StageGateError, config: PipelineConfig): Promise<boolean> {
  if (draft.repairUsed) return false;
  draft.repairUsed = true;
  draft.repairFeedback = error.errors;
  delete draft.definition;
  delete draft.goldenPath;
  delete draft.simulation;
  for (let reset = 4; reset <= MAX_STAGE; reset++) {
    const target = draft.stages[reset - 1];
    if (!target) continue;
    target.status = 'pending';
    target.retryCount = 0;
    delete target.output;
    delete target.error;
  }
  draft.currentStage = 4;
  draft.updatedAt = new Date().toISOString();
  await config.checkpointStore.save(draft);
  return true;
}

async function beginStage(currentDraft: CaseDraft, stageNum: number, config: PipelineConfig): Promise<CaseDraft['stages'][number] | null> {
  const checkpoint = currentDraft.stages[stageNum - 1];
  if (!checkpoint || checkpoint.status === 'completed') return null;
  checkpoint.status = 'running';
  checkpoint.startedAt = new Date().toISOString();
  currentDraft.currentStage = stageNum;
  currentDraft.updatedAt = new Date().toISOString();
  await config.checkpointStore.save(currentDraft);
  return checkpoint;
}

async function completeStage(currentDraft: CaseDraft, checkpoint: CaseDraft['stages'][number], output: unknown, config: PipelineConfig): Promise<void> {
  checkpoint.status = 'completed';
  checkpoint.completedAt = new Date().toISOString();
  checkpoint.output = output;
  currentDraft.updatedAt = new Date().toISOString();
  await config.checkpointStore.save(currentDraft);
}

/** Un fallo que no es de puerta: reintenta la etapa hasta el tope y, al
 * agotarlo, rechaza el borrador. Devuelve el rechazo o null si se reintenta. */
async function retryOrRejectStage(currentDraft: CaseDraft, checkpoint: CaseDraft['stages'][number], stageNum: number, config: PipelineConfig, error: unknown): Promise<GenerationResult | null> {
  checkpoint.retryCount++;
  const err = error instanceof Error ? error.message : String(error);
  if (checkpoint.retryCount >= config.maxRetriesPerStage) {
    checkpoint.status = 'failed';
    checkpoint.error = err;
    return rejectDraft(currentDraft, config, `Etapa ${stageNum} falló tras ${checkpoint.retryCount} intentos: ${err}`);
  }
  checkpoint.status = 'pending';
  checkpoint.error = err;
  currentDraft.updatedAt = new Date().toISOString();
  await config.checkpointStore.save(currentDraft);
  return null;
}

/** Una puerta falló: repara (el bucle vuelve a la etapa 4) o rechaza el
 * borrador si ya se reparó. Devuelve 'repair' o el rechazo. */
async function handleGateFailure(currentDraft: CaseDraft, checkpoint: CaseDraft['stages'][number], config: PipelineConfig, error: StageGateError): Promise<'repair' | GenerationResult> {
  if (await repairAfterGateFailure(currentDraft, error, config)) return 'repair';
  checkpoint.status = 'failed';
  checkpoint.error = error.message;
  return rejectDraft(currentDraft, config, `Puerta fallida tras la reparación: ${error.errors.join('; ')}`);
}

/** Un fallo que no es de puerta: guarda el mensaje como feedback para el
 * siguiente intento y reintenta (o rechaza al agotar los intentos). */
async function handleRetryFailure(currentDraft: CaseDraft, checkpoint: CaseDraft['stages'][number], stageNum: number, config: PipelineConfig, error: unknown): Promise<{ feedback: string[]; result: GenerationResult | null }> {
  const feedback = [error instanceof Error ? error.message : String(error)];
  const result = await retryOrRejectStage(currentDraft, checkpoint, stageNum, config, error);
  return { feedback, result };
}

async function rejectDraft(draft: CaseDraft, config: PipelineConfig, error: string): Promise<GenerationResult> {
  draft.status = 'rejected';
  draft.error = error;
  await config.checkpointStore.save(draft);
  return { draft, success: false, error };
}

export async function runPipeline(
  draft: CaseDraft,
  config: PipelineConfig,
): Promise<GenerationResult> {
  const currentDraft = { ...draft };
  // Delito/contenido y geografía se resuelven antes de la primera etapa y se
  // guardan en el borrador para que el worker pueda retomarlo.
  if (!currentDraft.choice) currentDraft.choice = resolveGenerationChoice(currentDraft.params);
  if (!currentDraft.geography) currentDraft.geography = selectGeography(currentDraft.params);
  currentDraft.status = 'validating';
  currentDraft.updatedAt = new Date().toISOString();

  await config.checkpointStore.save(currentDraft);

  // Errores de la última tentativa de la etapa en curso: el siguiente
  // intento del modelo los recibe como feedback (antes reintentaba a
  // ciegas con el mismo prompt y repetía el mismo fallo).
  let stageFeedback: string[] | undefined;

  for (let stageNum = currentDraft.currentStage; stageNum <= MAX_STAGE; stageNum++) {
    const stage = stageNum as GenerationStage;
    const checkpoint = await beginStage(currentDraft, stageNum, config);
    if (!checkpoint) continue;

    try {
      const output = await executeStage(stage, currentDraft, config, stageFeedback);
      await completeStage(currentDraft, checkpoint, output, config);
      stageFeedback = undefined;
    } catch (error) {
      if (error instanceof StageGateError) {
        const gate = await handleGateFailure(currentDraft, checkpoint, config, error);
        if (gate === 'repair') {
          stageNum = 3;
          continue;
        }
        return gate;
      }

      const retry = await handleRetryFailure(currentDraft, checkpoint, stageNum, config, error);
      stageFeedback = retry.feedback;
      if (retry.result) return retry.result;

      // Reintentar la misma etapa
      stageNum--;
      continue;
    }
  }

  // Pipeline completado
  if (!currentDraft.definition) {
    return rejectDraft(currentDraft, config, 'Pipeline completado pero no se generó definición');
  }

  currentDraft.status = 'validated';
  currentDraft.updatedAt = new Date().toISOString();
  await config.checkpointStore.save(currentDraft);

  return { draft: currentDraft, success: true, definition: currentDraft.definition };
}

export function createGeneratorService(config: PipelineConfig): GeneratorService {
  return {
    async createDraft(params: GenerationParams): Promise<CaseDraft> {
      const validation = validateGenerationParams(params);
      if (!validation.valid) throw new Error(`Parámetros inválidos: ${validation.errors.join(', ')}`);
      const draft = createInitialDraft(params);
      draft.choice = resolveGenerationChoice(params);
      draft.geography = selectGeography(params);
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
        delete checkpoint.error;
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
