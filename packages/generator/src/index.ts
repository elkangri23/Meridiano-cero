// Generador de casos (T4-01)
// Pipeline por etapas con checkpoint y esquema de expediente

export {
  GenerationParams,
  GenerationState,
  CaseDraft,
  GenerationStage,
  GenerationResult,
  StageCheckpoint,
  PipelineConfig,
  GeneratorService,
  runPipeline,
  createGeneratorService,
} from './pipeline.js';

export {
  CheckpointStore,
  createCheckpointStore,
  saveCheckpoint,
  loadCheckpoint,
  listCheckpoints,
  deleteCheckpoint,
} from './checkpoint.js';

export {
  validateGenerationParams,
  validateCaseDraft,
  validateStageOutput,
  ValidationResult,
  ValidationError,
} from './validator.js';