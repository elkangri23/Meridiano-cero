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
  CheckpointStore,
} from './pipeline.js';

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
  RouteSimulator,
  createRouteSimulator,
} from './simulator.js';

export type {
  SimulationConfig,
  RouteSimulationResult,
  SimulationSuiteResult,
} from './simulator.js';