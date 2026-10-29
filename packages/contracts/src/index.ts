/** Solo estado público de proceso; no acredita DB, sesión ni juego operativo. */
export interface HealthResponse { status: 'ok' }

/** La respuesta HTTP es una frontera no confiable para el navegador. */
export function isHealthResponse(value: unknown): value is HealthResponse {
  return typeof value === 'object' && value !== null && 'status' in value && value.status === 'ok';
}

/** Metadatos autorizados; nunca contiene payload ni resultados futuros. */
export interface PublicPendingRequest {
  id: string;
  dueMinute: number;
}

export interface FinalReport {
  result: 'complete' | 'partial' | 'incorrect' | 'unresolved';
  objectivesAchieved: string[];
  reason: 'finished' | 'deadline';
  minute: number;
}

export interface PlayerView {
  runId: string;
  version: number;
  minute: number;
  deadlineMinutes: number;
  position: { cityId: string; locationId: string };
  visibleCities: string[];
  discoveredLocations: string[];
  discoveredObjects: string[];
  dossier: string[];
  conversation: string[];
  pendingRequests: PublicPendingRequest[];
  warrants: string[];
  detentions: string[];
  finalReport: FinalReport | null;
}
/** Resumen por allowlist; jamás contiene la definición del expediente. */
export interface CaseSummary {
  caseId: string;
  title: string;
  contentMode: 'fixed' | 'generated';
  difficulty: 'easy' | 'normal' | 'hard';
  explorationMode: 'guided' | 'free';
  deadlineMinutes: number;
  contentVersion: number;
  canStart: boolean;
}

/** Primera entrega HTTP: únicamente partidas iniciales sin acciones ejecutadas.
 * El resto del DTO se ampliará junto a sus transiciones y proyecciones. */
export interface InitialPlayerViewDto {
  schemaVersion: 1;
  runId: string;
  branchId: string;
  version: number;
  status: 'active';
  clock: { minute: 0; deadlineMinutes: number };
  position: {
    city: { id: string; name: string; country: string };
    location: { id: string; name: string; description: string };
  };
  cities: Array<{ id: string; name: string; country: string }>;
  locations: Array<{ id: string; name: string; description: string }>;
  objects: never[];
  dossier: never[];
  conversation: never[];
  pendingRequests: never[];
  warrants: never[];
  detentions: never[];
  batch: null;
  finalReport: null;
  officialResult: null;
  saveCapabilities: { manualLimit: 10; manualCount: 0; canSave: false; canLoad: false };
  recovery: { retryCreationWithSameKey: true; operationLookup: false };
}
