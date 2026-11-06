// Límites anti-abuso de la generación (T4-08). Generar cuesta varias
// llamadas al modelo del administrador; sin límites, un usuario podría
// agotar la cuota o saturar el worker. Los valores son conservadores a
// propósito: generar un caso es una acción ocasional, no una partida.
export const GENERATION_LIMITS = {
  /** Un solo job activo (en cola o en curso) por usuario. */
  maxActiveJobsPerUser: 1,
  /** Máximo de jobs creados por usuario y día (UTC). */
  maxJobsPerDayPerUser: 3,
  /** Un solo job en curso en toda la instalación (el worker es único). */
  maxConcurrentJobs: 1,
  /** Máximo de llamadas al LLM por job (el pipeline usa 5 como mucho). */
  maxLlmCallsPerJob: 8,
  /** Pared máxima de un job: pasado este tiempo, el worker lo da por fallido. */
  jobWallClockMinutes: 30,
  /** Reintentos por etapa antes de rechazar el borrador. */
  maxAttemptsPerStage: 3,
  /** Duración del lease con el que el worker reclama un job. */
  leaseMinutes: 10,
  /** Cada cuánto mira el worker si hay trabajo pendiente. */
  pollIntervalMs: 5000,
} as const;
