export type EngineStateErrorCode = 'ENGINE_VERSION_UNSUPPORTED' | 'EVENT_SEQUENCE_INVALID' | 'EVENT_SEQUENCE_EXHAUSTED' | 'REQUEST_STATE_INVALID' | 'REQUEST_CAPACITY_EXCEEDED' | 'BATCH_STATE_INVALID' | 'DEFINITION_HASH_INVALID' | 'RUN_VERSION_INVALID';

/** Fallo operativo: conservar el estado y resolver compatibilidad, no narrarlo. */
export class EngineStateError extends Error {
  readonly code: EngineStateErrorCode;
  constructor(code: EngineStateErrorCode) { super(code); this.code = code; }
}
