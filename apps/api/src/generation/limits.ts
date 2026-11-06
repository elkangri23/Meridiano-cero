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
  /** Plazo por llamada al modelo en una etapa de generación. La etapa 4
   * (red de pistas) devuelve el JSON más grande del pipeline y el modelo
   * del administrador tarda más de 60 s en generarlo; 240 s cubre esa
   * salida sin tocar la cadena de plazos de juego (60/65/70/75 s), que
   * solo se aplica a las peticiones HTTP de partida. El job sigue acotado
   * por la pared de 30 min y por los 3 intentos por etapa. */
  stageTimeoutMs: 240_000,
} as const;
