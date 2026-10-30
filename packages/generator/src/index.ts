// Generador de casos (T4-01)
// Pipeline por etapas con checkpoint y esquema de expediente

export {
  runPipeline,
  createGeneratorService,
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
  GenerationValidator,
  GeneratorService,
} from './pipeline.js';

export {
  createInMemoryCheckpointStore,
  createLocalStorageCheckpointStore,
  createCheckpointStoreFromStorage,
  createLeasedCheckpointStore,
  createCheckpointStore,
} from './checkpoint.js';

export type {
  CheckpointStore,
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

export type {
  ValidationResult,
  ValidationError,
} from './validator.js';