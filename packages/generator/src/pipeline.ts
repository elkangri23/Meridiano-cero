// Pipeline de generación de casos (T4-08, SPEC-007)
// Estados: draft → validating → validated | rejected
//
// Antes (T4-01) era un esqueleto: executeStage devolvía salidas simuladas y
// runPipeline siempre rechazaba al final. Ahora cada etapa hace su trabajo
// de verdad: 6 llamadas LLM como máximo (premisa, NPC, red de pistas en dos
// llamadas —mundo y reglas—, revisión semántica y una reparación opcional
// de la red de pistas) y el resto determinista (geografía, ensamblaje,
// validación v1.5, simulación por el motor real, publicación). La puerta es
// dura: un borrador que no valida o no se juega se repara una vez y, si
// sigue sin pasar, se rechaza con motivo. Ningún expediente entra en el
// catálogo sin pasar la puerta.

import { createValidationReport, validateCaseDefinition, validateGeneratedContent, arrestTypeForCaseId } from '@meridiano/case-schema';
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
  validateStagePart,
  type ResolvedChoice,
  type SelectedGeography,
} from './stages.js';
import { validateGenerationParams } from './validator.js';
export { validateGenerationParams };
import { analyzeWarrantRoutes, simulateCase, type GoldenPathAction, type SimulationResult } from './simulator.js';
// Tipos compartidos del trabajo (parámetros, etapas, validación): viven
// en `job-types.ts` para no cerrar un ciclo entre pipeline, etapas y
// validador. La superficie pública no cambia: se re-exportan aquí.
import type { GenerationParams, GenerationStage, ValidationResult } from './job-types.js';
export type { CrimeType, Region, SurpriseMode, GenerationParams, GenerationStage, ValidationResult, ValidationError } from './job-types.js';

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
  /** Ruta alternativa declarada por el generador (etapa 4, GDD §4/§18):
   * otra cadena de evidencias que resuelve el caso sin compartir la
   * orden con la dorada. */
  alternativePath?: GoldenPathAction[];
  /** Introducción del caso, sin spoilers (etapa 1). */
  briefing?: { speaker: string; title: string; paragraphs: string[] };
  /** Resultado de la simulación (etapa 8). */
  simulation?: SimulationResult;
  /** Una sola reparación de la etapa 4 por borrador. */
  repairUsed?: boolean;
  repairFeedback?: string[];
  /** Mundo válido de la etapa 4a reutilizado entre reintentos: si solo
   * fallan las reglas (4b), no se regenera el mundo entero. */
  stage4World?: Record<string, unknown>;
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

export const STAGE_NAMES: Record<GenerationStage, string> = {
  1: 'fijar_delito_objetivos_verdad_motivaciones',
  2: 'seleccionar_geografia_catalogo',
  3: 'definir_npc_conocimiento_relaciones_cronologia',
  4: 'construir_lugares_grafo_pistas',
  5: 'ensamblar_definicion',
  6: 'validar_estructura_referencias_contenido',
  7: 'revision_semantica_independiente',
  8: 'simular_rutas_motor',
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

/** Salida de etapa inválida: lleva la salida consigo para que el borrador
 * rechazado conserve la última tentativa y se pueda diagnosticar qué
 * nombre de campo o referencia inventó el modelo. */
export class StageOutputError extends Error {
  readonly invalidOutput: unknown;
  constructor(message: string, invalidOutput: unknown) {
    super(message);
    this.invalidOutput = invalidOutput;
  }
}

/** Id del expediente que se está generando: el que fija la API para que
 * sea único, o el derivado del delito y la semilla. Del id depende el
 * tipo de detención del caso (GDD §12), así que es el mismo en el
 * contexto de la etapa 4b, en la validación de la ruta dorada y en el
 * ensamblaje: tres sitios distintos no pueden derivarlo por separado. */
export function draftCaseId(draft: CaseDraft, choice: ResolvedChoice, config: PipelineConfig): string {
  return config.caseId ?? `generado-${choice.crimeType}-${draft.params.seed ?? 0}`;
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

function knowledgeIds(draft: CaseDraft): string[] {
  const npcs = stageOutput(draft, 3) as Record<string, unknown> | undefined;
  if (!npcs || !Array.isArray(npcs.npcs)) return [];
  const ids: string[] = [];
  for (const npc of npcs.npcs as Array<Record<string, unknown>>) {
    if (Array.isArray(npc.knowledge)) {
      for (const id of npc.knowledge) if (typeof id === 'string' && !ids.includes(id)) ids.push(id);
    }
  }
  return ids;
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
  part?: 'a' | 'b',
): Promise<unknown> {
  const llm = requireLlm(config);
  const caseId = draftCaseId(draft, choice, config);
  const stageContext = buildStageContext(stage, choice, draft.params, geography, prior, feedback, part, caseId);
  const output = await withStageTimeout(config.stageTimeoutMs, signal => llm.generate({ stage, context: stageContext, schema: stageOutputSchema(stage, part), signal }));
  const validation = part
    ? validateStagePart(part, output, { geography, castIds: castIds(draft), knowledgeIds: knowledgeIds(draft), world: prior.world, arrestType: arrestTypeForCaseId(caseId) })
    : validateStageOutput(stage, output, { geography, castIds: castIds(draft), knowledgeIds: knowledgeIds(draft), arrestType: arrestTypeForCaseId(caseId) });
  if (!validation.valid) throw new StageOutputError(`Etapa ${stage} inválida: ${validation.errors.join('; ')}`, output);
  return output;
}

// La etapa 4 es la salida más grande del pipeline (3 lugares, 11
// evidencias, mecánica completa, textos y ruta dorada) y el modelo fallaba
// cada vez en un detalle distinto sin que los reintentos convergieran.
// Se genera en dos llamadas: 4a (mundo: lugares, evidencias y textos) y
// 4b (reglas: mecánica y ruta dorada, con los ids exactos de 4a en el
// contexto). Sigue siendo una sola etapa (9 en total) para el job y la UI.
//
// Un reintento NO regenera el mundo entero: si la mitad 4a ya es válida,
// se reutiliza y solo se rehace 4b con el feedback. Regenerar ambas en
// cada intento era un sorteo nuevo que introducía fallos distintos
// (textos incompletos, otra ruta con errores de ciudad) y agotaba los 3
// intentos sin converger. Solo cuando el fallo es del mundo (o mixto)
// se descarta y se regenera entero.
function isStage4bError(error: string): boolean {
  return error.startsWith('mechanics.') || error.startsWith('goldenPath') || error.startsWith('alternativePath')
    || error.includes('no se puede obtener') || error.includes('ruta dorada') || error.includes('ruta alternativa');
}

async function runSplitStage4(
  draft: CaseDraft,
  choice: ResolvedChoice,
  geography: SelectedGeography,
  config: PipelineConfig,
  feedback?: string[],
): Promise<Record<string, unknown>> {
  const prior = { premise: stageOutput(draft, 1), npcs: stageOutput(draft, 3) };
  const world = draft.stage4World
    ?? await runLlmStage(4, draft, choice, geography, config, prior, feedback, 'a');
  draft.stage4World = world as Record<string, unknown>;
  const rules = await runLlmStage(4, draft, choice, geography, config, { ...prior, world }, feedback, 'b');
  const merged = { ...(world as Record<string, unknown>), ...(rules as Record<string, unknown>) };
  const validation = validateStageOutput(4, merged, { geography, castIds: castIds(draft), knowledgeIds: knowledgeIds(draft),
    arrestType: arrestTypeForCaseId(draftCaseId(draft, choice, config)) });
  if (!validation.valid) {
    // El mundo sigue siendo válido: el reintento solo rehace 4b.
    if (!validation.errors.every(isStage4bError)) delete draft.stage4World;
    throw new StageOutputError(`Etapa 4 inválida: ${validation.errors.join('; ')}`, merged);
  }
  // La jugabilidad es de 4b: el mundo se conserva para el reintento.
  checkGoldenPathPlayable(merged, prior, draft, choice, geography, config);
  delete draft.stage4World;
  return merged;
}

// Las dos rutas no solo deben tener buena forma: deben JUGARSE por el
// motor real (cada acción aplicable en orden, con sus requisitos obtenidos
// antes). Comprobarlo aquí, dentro de la etapa 4, da al modelo el error
// exacto del motor como feedback de reintento (3 intentos) en vez de quemar
// la única reparación de la puerta cuando la revisión o la simulación lo
// detectan.
function checkGoldenPathPlayable(
  clues: Record<string, unknown>,
  prior: Record<string, unknown>,
  draft: CaseDraft,
  choice: ResolvedChoice,
  geography: SelectedGeography,
  config: PipelineConfig,
): void {
  const premise = prior.premise as Record<string, unknown> | undefined;
  const npcs = prior.npcs as Record<string, unknown> | undefined;
  const goldenPath = clues.goldenPath as GoldenPathAction[] | undefined;
  const alternativePath = clues.alternativePath as GoldenPathAction[] | undefined;
  if (!premise || !npcs || !Array.isArray(goldenPath)) throw new StageOutputError('Etapa 4 inválida: falta la premisa, los NPC o la ruta dorada.', clues);
  if (!Array.isArray(alternativePath)) throw new StageOutputError('Etapa 4 inválida: falta la ruta alternativa (GDD §4/§18: el caso debe resolverse por dos vías distintas).', clues);
  const definition = assembleDefinitionOrFail(clues, premise, npcs, draft, choice, geography, config);
  const budgetMinutes = Math.floor(DEADLINE_BY_DURATION[draft.params.duration] / 2);
  const simulation = simulateCase(definition, goldenPath, budgetMinutes, alternativePath);
  if (!simulation.playable) throw new StageOutputError(`Etapa 4 inválida: las rutas no se pueden jugar: ${simulation.errors.join('; ')}${simulation.diagnosis ? ` Diagnóstico: ${simulation.diagnosis}` : ''}`, clues);
}

function assembleDefinitionOrFail(
  clues: Record<string, unknown>,
  premise: Record<string, unknown>,
  npcs: Record<string, unknown>,
  draft: CaseDraft,
  choice: ResolvedChoice,
  geography: SelectedGeography,
  config: PipelineConfig,
): ReturnType<typeof assembleDefinition> {
  try {
    return assembleDefinition({
      caseId: draftCaseId(draft, choice, config),
      choice,
      params: draft.params,
      geography,
      premise,
      npcs,
      clues,
    });
  } catch (error) {
    throw new StageOutputError(`Etapa 4 inválida: no se puede ensamblar la definición: ${error instanceof Error ? error.message : String(error)}`, clues);
  }
}

/** Etapa 5: ensambla la definición desde las salidas 1, 3 y 4. */
function assembleStage(draft: CaseDraft, choice: ResolvedChoice, geography: SelectedGeography, config: PipelineConfig): { assembled: boolean; caseId: string } {
  const premise = stageOutput(draft, 1) as Record<string, unknown>;
  const npcs = stageOutput(draft, 3) as Record<string, unknown>;
  const clues = stageOutput(draft, 4) as Record<string, unknown>;
  if (!premise || !npcs || !clues) throw new Error('Faltan salidas de etapa para ensamblar.');
  const definition = assembleDefinition({
    caseId: draftCaseId(draft, choice, config),
    choice,
    params: draft.params,
    geography,
    premise,
    npcs,
    clues,
  });
  draft.definition = definition;
  draft.goldenPath = (clues.goldenPath as GoldenPathAction[]);
  draft.alternativePath = (clues.alternativePath as GoldenPathAction[]);
  draft.briefing = premiseBriefing(premise);
  return { assembled: true, caseId: definition.id };
}

/** Etapa 6 (puerta): validador v1.5 + contenido + dos rutas (GDD §4/§18).
 * La precondición estructural no vive en el validador compartido: ese
 * validador lo usa también el catálogo en producción (`canStart`) y un
 * error duro dejaría sin jugar los 11 casos generados antes de esta
 * puerta, que tienen una sola vía. Aquí, en la puerta de generación, sí
 * se exige: el sospechoso solución debe admitir dos combinaciones
 * disjuntas e independientes. */
function validateStage(draft: CaseDraft, choice: ResolvedChoice): { validated: boolean } {
  const definition = draft.definition;
  if (!definition) throw new Error('Sin definición que validar.');
  const structural = validateCaseDefinition(definition);
  const contentErrors: string[] = [];
  validateGeneratedContent(definition as unknown as Record<string, unknown>, choice.contentRating, contentErrors);
  const routeAnalysis = analyzeWarrantRoutes(definition);
  const routeErrors = routeAnalysis.independentPairs.length === 0
    ? [`Varias rutas (GDD §4/§18): ${routeAnalysis.reasons.join(' ')}`]
    : [];
  const errors = [...structural.errors, ...contentErrors, ...routeErrors];
  if (errors.length > 0) throw new StageGateError(errors);
  definition.validationReport = createValidationReport([]);
  draft.validationReport = {
    validatorVersion: '1.5.0',
    timestamp: new Date().toISOString(),
    stages: [{ stage: 6, name: STAGE_NAMES[6], passed: true, checks: ['estructura', 'referencias', 'mecánica', 'textos', 'contenido', 'rutas'], errors: [], warnings: [] }],
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
  const output = await runLlmStage(7, draft, choice, geography, config, { definition, goldenPath: draft.goldenPath, alternativePath: draft.alternativePath, budgetMinutes });
  const review = output as { coherent: boolean; issues: string[] };
  if (!review.coherent) throw new StageGateError(review.issues);
  return { coherent: true };
}

/** Etapa 8 (puerta): simulación de las dos rutas por el motor real.
 * Sin ruta alternativa no hay caso: la puerta rechaza el borrador con
 * el diagnóstico de qué falta (evidencia, ubicación o tiempo). */
function simulateStage(draft: CaseDraft, config: PipelineConfig): { playable: boolean; minute: number; budgetMinutes: number } {
  if (!config.enableSimulation) return { playable: true, minute: 0, budgetMinutes: 0 };
  const definition = draft.definition;
  if (!definition || !draft.goldenPath) throw new Error('Sin definición que simular.');
  if (!draft.alternativePath) throw new Error('Sin ruta alternativa que simular (GDD §4/§18).');
  const budgetMinutes = Math.floor(DEADLINE_BY_DURATION[draft.params.duration] / 2);
  const simulation = simulateCase(definition, draft.goldenPath, budgetMinutes, draft.alternativePath);
  draft.simulation = simulation;
  if (!simulation.playable) throw new StageGateError(simulation.diagnosis ? [...simulation.errors, `Diagnóstico: ${simulation.diagnosis}`] : simulation.errors);
  return { playable: true, minute: simulation.minute, budgetMinutes };
}

async function executeLlmStage(stage: 1 | 3 | 4, draft: CaseDraft, choice: ResolvedChoice, geography: SelectedGeography, config: PipelineConfig, feedback?: string[]): Promise<unknown> {
  switch (stage) {
    case 1:
      return runLlmStage(1, draft, choice, geography, config, {}, feedback);
    case 3:
      return runLlmStage(3, draft, choice, geography, config, { premise: stageOutput(draft, 1) }, feedback);
    case 4:
      return runSplitStage4(draft, choice, geography, config, [...(draft.repairFeedback ?? []), ...(feedback ?? [])]);
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
  delete draft.alternativePath;
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

/** Mensaje de error con su causa, cuando la trae (el adaptador de IA
 * aplasta los errores del proveedor a 'unavailable'; sin la causa el job
 * no dice si fue un timeout, un 500 o un corte de conexión). */
function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const cause = (error as { cause?: unknown }).cause;
  if (cause instanceof Error && cause.message && cause.message !== error.message) {
    return `${error.message} (${cause.message})`;
  }
  return error.message;
}

/** Un fallo que no es de puerta: reintenta la etapa hasta el tope y, al
 * agotarlo, rechaza el borrador. Devuelve el rechazo o null si se reintenta. */
async function retryOrRejectStage(currentDraft: CaseDraft, checkpoint: CaseDraft['stages'][number], stageNum: number, config: PipelineConfig, error: unknown): Promise<GenerationResult | null> {
  checkpoint.retryCount++;
  const err = errorMessage(error);
  // La última tentativa inválida queda en el checkpoint: sin ella no se
  // puede saber qué inventó el modelo cuando la etapa falla tras 3 intentos.
  if (error instanceof StageOutputError) checkpoint.output = error.invalidOutput;
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
  const feedback = [errorMessage(error)];
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
