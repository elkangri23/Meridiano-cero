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

/** Delito de un expediente (GDD §3). Tres cosas distintas que no hay que
 * mezclar: `crimeType` es el delito (robo, desaparición, fraude…);
 * `contentRating` es el nivel de contenido (Familiar/General, GDD §14); y
 * `contentMode` (fixed/generated) es el origen del expediente, no su tono.
 * «Robo Familiar» no es un delito: es delito=robo + contenido=Familiar. */
export type CrimeType = 'robo' | 'desaparicion' | 'fraude' | 'espionaje' | 'sabotaje' | 'misterio-historico' | 'aleatorio';
export type ContentRating = 'familiar' | 'general';

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
  /** Delito del expediente (GDD §3) y nivel de contenido (GDD §14). */
  crimeType: CrimeType;
  contentRating: ContentRating;
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
  /** Delito y contenido del expediente (GDD §3/§14). */
  caseMeta: { crimeType: CrimeType; contentRating: ContentRating };
  saveCapabilities: { manualLimit: 10; manualCount: 0; canSave: false; canLoad: false };
  recovery: { retryCreationWithSameKey: true; creationLookup: true; operationLookup: false };
}

/** Localizador durable propio, sin clave, estado privado ni proyección histórica. */
export interface RunCreationLookupDto {
  schemaVersion: 1;
  kind: 'create_run';
  status: 'committed';
  runId: string;
}

export function isIdempotencyKey(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9._:-]{16,128}$/.test(value);
}

/** Metadatos propios; no implica compatibilidad de la proyección del progreso. */
export interface RunSummaryDto {
  runId: string;
  caseTitle: string | null;
  caseId: string;
  status: 'active' | 'closed';
  /** Dificultad elegida al crear la partida (determina su plazo interno). */
  difficulty: 'easy' | 'normal' | 'hard';
  version: number;
  minute: number;
  createdAt: string;
}
export interface RunListDto { profileId: string; items: RunSummaryDto[]; nextCursor: string | null }

export interface SessionDto {
  profile: { id: string; displayName: string; role: 'player'; emailVerified: boolean };
  csrfToken: string;
}

function dtoRecord(value: unknown, keys: string): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return Object.keys(value).sort().join(',') === keys;
}
function uuid(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);
}
function shortText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 160;
}
function profile(value: unknown): value is SessionDto['profile'] {
  return dtoRecord(value, 'displayName,emailVerified,id,role') && uuid(value.id) && shortText(value.displayName) && value.role === 'player' && typeof value.emailVerified === 'boolean';
}
export function isSessionDto(value: unknown): value is SessionDto {
  return dtoRecord(value, 'csrfToken,profile') && profile(value.profile) &&
    typeof value.csrfToken === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value.csrfToken);
}
function isoDate(value: unknown): boolean {
  if (typeof value !== 'string' || value.length !== 24) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value;
}
function summaryState(value: Record<string, unknown>): boolean {
  return (value.status === 'active' || value.status === 'closed') &&
    typeof value.version === 'number' && Number.isSafeInteger(value.version) && value.version > 0 && isoDate(value.createdAt);
}
function runSummary(value: unknown): value is RunSummaryDto {
  if (!dtoRecord(value, 'caseId,caseTitle,createdAt,difficulty,minute,runId,status,version')) return false;
  if (!uuid(value.runId) || typeof value.caseId !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(value.caseId)) return false;
  if (value.caseTitle !== null && !shortText(value.caseTitle)) return false;
  if (typeof value.difficulty !== 'string' || !['easy', 'normal', 'hard'].includes(value.difficulty)) return false;
  if (typeof value.minute !== 'number' || !Number.isSafeInteger(value.minute) || value.minute < 0) return false;
  return summaryState(value);
}
function pageCursor(value: unknown): boolean {
  return value === null || typeof value === 'string' && /^v1\.(all|active|closed)\.[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value);
}
export function isRunListDto(value: unknown): value is RunListDto {
  if (!dtoRecord(value, 'items,nextCursor,profileId') || !uuid(value.profileId)) return false;
  if (!Array.isArray(value.items) || value.items.length > 100 || !value.items.every(runSummary)) return false;
  return new Set(value.items.map(item => item.runId)).size === value.items.length && pageCursor(value.nextCursor);
}

export interface CaseListDto { items: CaseSummary[]; nextCursor: null }
function positiveInteger(value: unknown): boolean { return typeof value === 'number' && Number.isSafeInteger(value) && value > 0; }
function caseModes(value: Record<string, unknown>): boolean {
  return (value.contentMode === 'fixed' || value.contentMode === 'generated') &&
    typeof value.difficulty === 'string' && ['easy', 'normal', 'hard'].includes(value.difficulty) &&
    (value.explorationMode === 'guided' || value.explorationMode === 'free') &&
    typeof value.crimeType === 'string' && ['robo', 'desaparicion', 'fraude', 'espionaje', 'sabotaje', 'misterio-historico', 'aleatorio'].includes(value.crimeType) &&
    (value.contentRating === 'familiar' || value.contentRating === 'general');
}
function caseItem(value: unknown): value is CaseSummary {
  if (!dtoRecord(value, 'canStart,caseId,contentMode,contentRating,contentVersion,crimeType,deadlineMinutes,difficulty,explorationMode,title')) return false;
  if (typeof value.caseId !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(value.caseId) || !shortText(value.title)) return false;
  return caseModes(value) && positiveInteger(value.deadlineMinutes) && positiveInteger(value.contentVersion) && typeof value.canStart === 'boolean';
}
export function isCaseListDto(value: unknown): value is CaseListDto {
  if (!dtoRecord(value, 'items,nextCursor') || value.nextCursor !== null || !Array.isArray(value.items) || value.items.length > 100) return false;
  return value.items.every(caseItem) && new Set(value.items.map(item => item.caseId)).size === value.items.length;
}
export function isRunCreationLookupDto(value: unknown): value is RunCreationLookupDto {
  return dtoRecord(value, 'kind,runId,schemaVersion,status') && value.schemaVersion === 1 &&
    value.kind === 'create_run' && value.status === 'committed' && uuid(value.runId);
}


function publicId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(value);
}
function publicCity(value: unknown): value is InitialPlayerViewDto['position']['city'] {
  return dtoRecord(value, 'country,id,name') && publicId(value.id) && shortText(value.name) && shortText(value.country);
}
function publicLocation(value: unknown): value is InitialPlayerViewDto['position']['location'] {
  return dtoRecord(value, 'description,id,name') && publicId(value.id) && shortText(value.name) &&
    typeof value.description === 'string' && value.description.length <= 16000;
}
function initialClock(value: unknown): boolean {
  return dtoRecord(value, 'deadlineMinutes,minute') && value.minute === 0 && positiveInteger(value.deadlineMinutes);
}
function initialCapabilities(value: Record<string, unknown>): boolean {
  const saves = value.saveCapabilities; const recovery = value.recovery;
  return dtoRecord(saves, 'canLoad,canSave,manualCount,manualLimit') &&
    saves.canLoad === false && saves.canSave === false && saves.manualCount === 0 && saves.manualLimit === 10 &&
    dtoRecord(recovery, 'creationLookup,operationLookup,retryCreationWithSameKey') &&
    recovery.creationLookup === true && recovery.operationLookup === false && recovery.retryCreationWithSameKey === true;
}
function initialEmptyCollections(value: Record<string, unknown>): boolean {
  return ['objects', 'dossier', 'conversation', 'pendingRequests', 'warrants', 'detentions'].every(key =>
    Array.isArray(value[key]) && value[key].length === 0) &&
    ['batch', 'finalReport', 'officialResult'].every(key => value[key] === null);
}
function publicCities(value: unknown): value is InitialPlayerViewDto['cities'] {
  return Array.isArray(value) && value.length <= 100 && value.every(publicCity) && new Set(value.map(item => item.id)).size === value.length;
}
function publicLocations(value: unknown): value is InitialPlayerViewDto['locations'] {
  return Array.isArray(value) && value.length <= 100 && value.every(publicLocation) && new Set(value.map(item => item.id)).size === value.length;
}
function initialGeography(value: Record<string, unknown>): boolean {
  const position = value.position;
  if (!dtoRecord(position, 'city,location') || !publicCity(position.city) || !publicLocation(position.location)) return false;
  const cities = value.cities; const locations = value.locations;
  if (!publicCities(cities) || !publicLocations(locations)) return false;
  const city = position.city; const location = position.location;
  return cities.some(item => item.id === city.id && item.name === city.name && item.country === city.country) &&
    locations.some(item => item.id === location.id && item.name === location.name && item.description === location.description);
}
function initialHeader(value: Record<string, unknown>): boolean {
  return value.schemaVersion === 1 && uuid(value.runId) && uuid(value.branchId) && value.version === 1 && value.status === 'active';
}
/** Solo GET inicial: no acepta replay de creación, progreso o campos privados adicionales. */
export function isInitialPlayerViewDto(value: unknown): value is InitialPlayerViewDto {
  if (!dtoRecord(value, 'batch,branchId,caseMeta,cities,clock,conversation,detentions,dossier,finalReport,locations,objects,officialResult,pendingRequests,position,recovery,runId,saveCapabilities,schemaVersion,status,version,warrants')) return false;
  if (!initialHeader(value) || !publicCaseMeta(value.caseMeta)) return false;
  return initialClock(value.clock) && initialCapabilities(value) && initialEmptyCollections(value) && initialGeography(value);
}

/** Vista general del jugador (Fase A): proyección completa de una partida en
 * cualquier revisión. La vista inicial es un caso particular de esta forma
 * (minute 0, colecciones vacías). Difiere de PlayerView (motor) en que incluye
 * nombres públicos, revisión/rama, capacidades de guardado y recuperación, y
 * nunca expone payloads internos (p. ej. pendingRequests.payload). */
export interface PlayerViewDto {
  schemaVersion: 1;
  runId: string;
  branchId: string;
  version: number;
  status: 'active' | 'closed';
  caseId: string;
  clock: { minute: number; deadlineMinutes: number };
  position: {
    city: { id: string; name: string; country: string };
    location: { id: string; name: string; description: string };
  };
  cities: Array<{ id: string; name: string; country: string }>;
  locations: Array<{ id: string; name: string; description: string }>;
  objects: Array<{ id: string; type: string; origin: string; minute: number; admissible: boolean }>;
  dossier: string[];
  conversation: string[];
  pendingRequests: Array<{ id: string; type: 'analysis' | 'query' | 'request'; dueMinute: number }>;
  warrants: string[];
  detentions: string[];
  batch: null | {
    steps: Array<{
      ordinal: number;
      dependsOn: number[];
      action: { type: string; params: Record<string, unknown> };
      status: 'pending' | 'applied' | 'impossible' | 'skipped';
      reason?: string;
    }>;
  };
  finalReport: FinalReport | null;
  officialResult: null;
  /** Acciones intentables desde el estado actual (motor). La UI las ofrece como
   * botones y las envía a interpret; el motor valida cada una al confirmarla. */
  offers: PublicActionOffer[];
  /** Introducción del caso (GDD §3): quién te pone en situación antes de
   * empezar. La presenta Margaret Sullivan; es breve, omisible y siempre
   * recuperable en el dossier. Null si el expediente no trae introducción. */
  briefing: { speaker: string; title: string; paragraphs: string[] } | null;
  /** Delito y contenido del expediente (GDD §3/§14): se muestran siempre
   * juntos («Robo internacional · Familiar»), nunca mezclados en un solo
   * nombre. */
  caseMeta: { crimeType: CrimeType; contentRating: ContentRating };
  saveCapabilities: { manualLimit: 10; manualCount: number; canSave: boolean; canLoad: boolean };
  recovery: { retryCreationWithSameKey: true; creationLookup: true; operationLookup: false };
}

/** Oferta de acción pública: id estable, etiqueta legible y acción completa. */
export interface PublicActionOffer {
  id: string;
  label: string;
  detail?: string;
  action: { type: string; params: Record<string, unknown> };
}

/** Evento público de una acción: solo id opaco, secuencia estable, minuto,
 * tipo y resumen factual autorizado. Nunca se serializa EngineEvent.payload. */
export interface PublicEvent {
  id: string;
  sequence: number;
  minute: number;
  type: string;
  summary: string;
}

export interface PublicActionPreview {
  actionType: string;
  estimatedMinutes: number;
  estimatedEndTime: number;
  description: string;
}

/** Respuesta de POST /runs/:runId/action: vista completa + resultado. */
export interface ActionResponseDto extends PlayerViewDto {
  outcome: 'applied' | 'impossible' | 'clarification_required' | 'confirmation_required' | 'batch_paused' | 'case_closed';
  events: PublicEvent[];
  preview?: PublicActionPreview;
  report?: FinalReport;
  operationId?: string;
  replayed?: boolean;
  /** Solo en preview (confirm=false): true si la acción exige confirmación. */
  requiresConfirmation?: boolean;
  question?: string;
  reason?: string;
  pausedAt?: number;
}

/** Respuesta de POST /runs/:runId/saves/:saveId/load: vista restaurada. */
export interface SaveLoadResponseDto extends PlayerViewDto {
  operationId: string;
  newBranchId: string;
}

function nonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
function publicObject(value: unknown): value is PlayerViewDto['objects'][number] {
  if (!dtoRecord(value, 'admissible,id,minute,origin,type')) return false;
  return publicId(value.id) && typeof value.type === 'string' &&
    ['observation', 'analysis', 'record', 'testimony', 'object'].includes(value.type) &&
    publicId(value.origin) && nonNegativeInteger(value.minute) && typeof value.admissible === 'boolean';
}
function publicObjects(value: unknown): value is PlayerViewDto['objects'] {
  return Array.isArray(value) && value.length <= 1000 && value.every(publicObject) &&
    new Set(value.map(item => item.id)).size === value.length;
}
function publicRequest(value: unknown): value is PlayerViewDto['pendingRequests'][number] {
  if (!dtoRecord(value, 'dueMinute,id,type')) return false;
  return publicId(value.id) && typeof value.type === 'string' &&
    ['analysis', 'query', 'request'].includes(value.type) &&
    nonNegativeInteger(value.dueMinute);
}
function publicRequests(value: unknown): value is PlayerViewDto['pendingRequests'] {
  return Array.isArray(value) && value.length <= 100 && value.every(publicRequest) &&
    new Set(value.map(item => item.id)).size === value.length;
}
function stringList(value: unknown, maxItems: number, maxLength: number): value is string[] {
  return Array.isArray(value) && value.length <= maxItems &&
    value.every(item => typeof item === 'string' && item.length <= maxLength);
}
function isBatchStepStatus(value: unknown): boolean {
  return value === 'pending' || value === 'applied' || value === 'impossible' || value === 'skipped';
}
function batchStepShape(record: Record<string, unknown>): boolean {
  const keys = Object.keys(record).sort().join(',');
  if (keys !== 'action,dependsOn,ordinal,status' && keys !== 'action,dependsOn,ordinal,reason,status') return false;
  if (!nonNegativeInteger(record.ordinal)) return false;
  if (!Array.isArray(record.dependsOn) || !record.dependsOn.every(nonNegativeInteger)) return false;
  if (!isBatchStepStatus(record.status)) return false;
  return record.reason === undefined || typeof record.reason === 'string';
}
function batchStepAction(record: Record<string, unknown>): boolean {
  const action = record.action;
  if (typeof action !== 'object' || action === null || Array.isArray(action)) return false;
  const actionRecord = action as Record<string, unknown>;
  if (Object.keys(actionRecord).sort().join(',') !== 'params,type') return false;
  return typeof actionRecord.type === 'string' && actionRecord.type.length > 0 &&
    typeof actionRecord.params === 'object' && actionRecord.params !== null && !Array.isArray(actionRecord.params);
}
export function isPublicBatchStep(value: unknown): value is NonNullable<PlayerViewDto['batch']>['steps'][number] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return batchStepShape(record) && batchStepAction(record);
}
function publicBatch(value: unknown): value is PlayerViewDto['batch'] {
  if (value === null) return true;
  if (!dtoRecord(value, 'steps') || !Array.isArray(value.steps) || value.steps.length > 8) return false;
  return value.steps.every(isPublicBatchStep);
}
function publicFinalReport(value: unknown): value is FinalReport {
  if (!dtoRecord(value, 'minute,objectivesAchieved,reason,result')) return false;
  return ['complete', 'partial', 'incorrect', 'unresolved'].includes(value.result as string) &&
    ['finished', 'deadline'].includes(value.reason as string) && nonNegativeInteger(value.minute) &&
    stringList(value.objectivesAchieved, 100, 128);
}
function generalClock(value: unknown): boolean {
  return dtoRecord(value, 'deadlineMinutes,minute') && nonNegativeInteger(value.minute) &&
    positiveInteger(value.deadlineMinutes);
}
function generalCapabilities(value: Record<string, unknown>): boolean {
  const saves = value.saveCapabilities; const recovery = value.recovery;
  return dtoRecord(saves, 'canLoad,canSave,manualCount,manualLimit') &&
    typeof saves.canLoad === 'boolean' && typeof saves.canSave === 'boolean' &&
    nonNegativeInteger(saves.manualCount) && (saves.manualCount as number) <= 10 && saves.manualLimit === 10 &&
    dtoRecord(recovery, 'creationLookup,operationLookup,retryCreationWithSameKey') &&
    recovery.creationLookup === true && recovery.operationLookup === false && recovery.retryCreationWithSameKey === true;
}
function publicActionParam(value: unknown): boolean {
  if (typeof value === 'string') return value.length <= 4000;
  if (typeof value === 'number') return Number.isSafeInteger(value);
  if (typeof value === 'boolean') return true;
  return Array.isArray(value) && value.length <= 16 && value.every(item => typeof item === 'string' && item.length <= 128);
}
function boundedString(value: unknown, max: number): boolean {
  return typeof value === 'string' && value.length > 0 && value.length <= max;
}
function optionalBoundedString(value: unknown, max: number): boolean {
  return value === undefined || (typeof value === 'string' && value.length <= max);
}
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function offerIdentity(record: Record<string, unknown>): boolean {
  const keys = Object.keys(record).sort().join(',');
  if (keys !== 'action,id,label' && keys !== 'action,detail,id,label') return false;
  if (!boundedString(record.id, 128)) return false;
  if (!boundedString(record.label, 200)) return false;
  return optionalBoundedString(record.detail, 200);
}
function offerAction(record: Record<string, unknown>): boolean {
  if (!isPlainRecord(record.action)) return false;
  const actionRecord = record.action;
  if (Object.keys(actionRecord).sort().join(',') !== 'params,type') return false;
  if (!boundedString(actionRecord.type, 64)) return false;
  if (!isPlainRecord(actionRecord.params)) return false;
  return Object.values(actionRecord.params).every(publicActionParam);
}
export function isPublicActionOffer(value: unknown): value is PublicActionOffer {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return offerIdentity(record) && offerAction(record);
}
function publicOffers(value: unknown): value is PublicActionOffer[] {
  return Array.isArray(value) && value.length <= 64 && value.every(isPublicActionOffer) &&
    new Set(value.map(item => item.id)).size === value.length;
}
function generalCollections(value: Record<string, unknown>): boolean {
  if (!publicObjects(value.objects) || !publicRequests(value.pendingRequests)) return false;
  if (!stringList(value.dossier, 1000, 128) || !stringList(value.conversation, 1000, 16000)) return false;
  if (!stringList(value.warrants, 100, 128) || !stringList(value.detentions, 100, 128)) return false;
  return publicOffers(value.offers);
}
function generalReports(value: Record<string, unknown>): boolean {
  if (!publicBatch(value.batch)) return false;
  if (value.finalReport !== null && !publicFinalReport(value.finalReport)) return false;
  return value.officialResult === null;
}
function playerViewIdentity(value: Record<string, unknown>): boolean {
  if (value.schemaVersion !== 1 || !uuid(value.runId) || !uuid(value.branchId)) return false;
  if (!positiveInteger(value.version)) return false;
  if (typeof value.caseId !== 'string' || value.caseId.length === 0 || value.caseId.length > 128) return false;
  return value.status === 'active' || value.status === 'closed';
}
function validBriefingParagraphs(value: unknown): value is string[] {
  return Array.isArray(value) && value.length >= 1 && value.length <= 8 &&
    value.every(item => typeof item === 'string' && item.trim().length > 0 && item.length <= 2000);
}
function publicCaseMeta(value: unknown): value is { crimeType: CrimeType; contentRating: ContentRating } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).sort().join(',') !== 'contentRating,crimeType') return false;
  return typeof record.crimeType === 'string' &&
    ['robo', 'desaparicion', 'fraude', 'espionaje', 'sabotaje', 'misterio-historico', 'aleatorio'].includes(record.crimeType) &&
    (record.contentRating === 'familiar' || record.contentRating === 'general');
}
function publicBriefing(value: unknown): value is PlayerViewDto['briefing'] {
  if (value === null) return true;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).sort().join(',') !== 'paragraphs,speaker,title') return false;
  if (!shortText(record.speaker) || !shortText(record.title)) return false;
  return validBriefingParagraphs(record.paragraphs);
}
const playerViewKeys = 'batch,branchId,briefing,caseId,caseMeta,cities,clock,conversation,detentions,dossier,finalReport,locations,objects,offers,officialResult,pendingRequests,position,recovery,runId,saveCapabilities,schemaVersion,status,version,warrants';
/** Vista general: acepta también la forma inicial (es un caso particular). */
export function isPlayerViewDto(value: unknown): value is PlayerViewDto {
  if (!dtoRecord(value, playerViewKeys)) return false;
  if (!playerViewIdentity(value)) return false;
  if (!publicBriefing(value.briefing)) return false;
  if (!publicCaseMeta(value.caseMeta)) return false;
  if (!generalClock(value.clock) || !generalCapabilities(value) || !initialGeography(value)) return false;
  return generalCollections(value) && generalReports(value);
}

function publicEventId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(value);
}
function publicEvent(value: unknown): value is PublicEvent {
  if (!dtoRecord(value, 'id,minute,sequence,summary,type')) return false;
  if (!publicEventId(value.id) || !nonNegativeInteger(value.sequence) || !nonNegativeInteger(value.minute)) return false;
  if (typeof value.type !== 'string' || value.type.length === 0 || value.type.length > 128) return false;
  return typeof value.summary === 'string' && value.summary.length > 0 && value.summary.length <= 2000;
}
function publicPreview(value: unknown): value is PublicActionPreview {
  if (!dtoRecord(value, 'actionType,description,estimatedEndTime,estimatedMinutes')) return false;
  return typeof value.actionType === 'string' && value.actionType.length > 0 &&
    nonNegativeInteger(value.estimatedMinutes) && nonNegativeInteger(value.estimatedEndTime) &&
    typeof value.description === 'string' && value.description.length > 0 && value.description.length <= 2000;
}
function actionOutcome(record: Record<string, unknown>): boolean {
  return ['applied', 'impossible', 'clarification_required', 'confirmation_required', 'batch_paused', 'case_closed']
    .includes(record.outcome as string);
}
function actionOptionalScalars(record: Record<string, unknown>): boolean {
  if (record.preview !== undefined && !publicPreview(record.preview)) return false;
  if (record.report !== undefined && !publicFinalReport(record.report)) return false;
  if (record.operationId !== undefined && !uuid(record.operationId)) return false;
  if (record.replayed !== undefined && typeof record.replayed !== 'boolean') return false;
  return record.requiresConfirmation === undefined || typeof record.requiresConfirmation === 'boolean';
}
function actionOptionalTexts(record: Record<string, unknown>): boolean {
  if (record.question !== undefined && (typeof record.question !== 'string' || record.question.length === 0)) return false;
  if (record.reason !== undefined && (typeof record.reason !== 'string' || record.reason.length === 0)) return false;
  return record.pausedAt === undefined || nonNegativeInteger(record.pausedAt);
}
function actionExtras(record: Record<string, unknown>): boolean {
  return actionOptionalScalars(record) && actionOptionalTexts(record);
}
function actionResponseBase(record: Record<string, unknown>): boolean {
  const base: Record<string, unknown> = {};
  for (const key of playerViewKeys.split(',')) base[key] = record[key];
  if (!isPlayerViewDto(base)) return false;
  const allowed = new Set([...playerViewKeys.split(','), 'outcome', 'events', 'preview', 'report', 'operationId', 'replayed', 'requiresConfirmation', 'question', 'reason', 'pausedAt']);
  return Object.keys(record).every(key => allowed.has(key));
}
export function isActionResponseDto(value: unknown): value is ActionResponseDto {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (!actionResponseBase(record)) return false;
  if (!actionOutcome(record)) return false;
  if (!Array.isArray(record.events) || record.events.length > 100 || !record.events.every(publicEvent)) return false;
  return actionExtras(record);
}
export function isSaveLoadResponseDto(value: unknown): value is SaveLoadResponseDto {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const base: Record<string, unknown> = {};
  for (const key of playerViewKeys.split(',')) base[key] = record[key];
  if (!isPlayerViewDto(base)) return false;
  const allowed = new Set([...playerViewKeys.split(','), 'operationId', 'newBranchId']);
  if (!Object.keys(record).every(key => allowed.has(key))) return false;
  return uuid(record.operationId) && uuid(record.newBranchId);
}
