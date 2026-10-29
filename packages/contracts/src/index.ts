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
  version: number;
  createdAt: string;
}
export interface RunListDto { profileId: string; items: RunSummaryDto[]; nextCursor: string | null }

export interface SessionDto {
  profile: { id: string; displayName: string; role: 'player' };
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
  return dtoRecord(value, 'displayName,id,role') && uuid(value.id) && shortText(value.displayName) && value.role === 'player';
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
  if (!dtoRecord(value, 'caseId,caseTitle,createdAt,runId,status,version')) return false;
  if (!uuid(value.runId) || typeof value.caseId !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(value.caseId)) return false;
  if (value.caseTitle !== null && !shortText(value.caseTitle)) return false;
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
    (value.explorationMode === 'guided' || value.explorationMode === 'free');
}
function caseItem(value: unknown): value is CaseSummary {
  if (!dtoRecord(value, 'canStart,caseId,contentMode,contentVersion,deadlineMinutes,difficulty,explorationMode,title')) return false;
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
/** Solo GET inicial: no acepta replay de creación, progreso o campos privados adicionales. */
export function isInitialPlayerViewDto(value: unknown): value is InitialPlayerViewDto {
  if (!dtoRecord(value, 'batch,branchId,cities,clock,conversation,detentions,dossier,finalReport,locations,objects,officialResult,pendingRequests,position,recovery,runId,saveCapabilities,schemaVersion,status,version,warrants')) return false;
  if (value.schemaVersion !== 1 || !uuid(value.runId) || !uuid(value.branchId) || value.version !== 1 || value.status !== 'active') return false;
  return initialClock(value.clock) && initialCapabilities(value) && initialEmptyCollections(value) && initialGeography(value);
}
