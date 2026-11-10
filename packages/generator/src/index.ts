// Generador de casos (T4-08)
// Pipeline por etapas con LLM real, checkpoint y puerta de validación

export {
  runPipeline,
  createGeneratorService,
  StageGateError,
  StageOutputError,
  MAX_REPAIRS_PER_DRAFT,
} from './pipeline.js';

export type {
  GenerationParams,
  CrimeType,
  Region,
  SurpriseMode,
  DraftStatus,
  CaseDraft,
  StageCheckpoint,
  ValidationReport,
  StageValidation,
  GenerationStage,
  GenerationResult,
  PipelineConfig,
  StageLlm,
  GenerationValidator,
  GeneratorService,
  CheckpointStore,
} from './pipeline.js';

export {
  GENERATABLE_CRIMES,
  DEADLINE_BY_DURATION,
  STAGE_OUTPUT_SCHEMAS,
  EVIDENCE_SLOT_TYPES,
  resolveGenerationChoice,
  selectGeography,
  travelMinutes,
  seededRandom,
  buildStageContext,
  validateStageOutput as validateStageOutputShape,
  assembleDefinition,
  premiseBriefing,
} from './stages.js';

export type {
  GeneratableCrime,
  ResolvedChoice,
  SelectedGeography,
  StageContext,
} from './stages.js';

export {
  createInMemoryCheckpointStore,
  createLocalStorageCheckpointStore,
  createCheckpointStoreFromStorage,
  createLeasedCheckpointStore,
  createCheckpointStore,
} from './checkpoint.js';

export type {
  CheckpointStorage,
  LeaseConfig,
  LeasedCheckpoint,
} from './checkpoint.js';

export {
  validateGenerationParams,
  validateCaseDraft,
  validateStageOutput,
  validateCatalogParams,
  createGenerationValidator,
} from './validator.js';

export {
  createJobQueue,
  InMemoryJobQueue,
} from './worker.js';

export type {
  GenerationJob,
  JobStatus,
  JobQueue,
  WorkerConfig,
} from './worker.js';

export {
  createExport,
  validateImport,
  serializeExport,
  deserializeImport,
  computeChecksum,
  MAX_IMPORT_SIZE_BYTES,
} from './import-export.js';

export type {
  CaseExport,
  ImportResult,
  ExportResult,
} from './import-export.js';

export {
  createFencingManager,
  FencingManager,
} from './fencing.js';

export type {
  FencingToken,
  Reservation,
  TerminalState,
} from './fencing.js';

export type {
  ValidationResult,
  ValidationError,
} from './validator.js';

export {
  simulateCase,
  analyzeWarrantRoutes,
  hasMultipleRoutes,
} from './simulator.js';

export type {
  GoldenPathAction,
  SimulationCheck,
  SimulationResult,
  WarrantRouteAnalysis,
} from './simulator.js';
