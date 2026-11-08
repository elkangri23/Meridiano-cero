import { createPreferenceStore, isActionResponseDto, isCareerProfileDto, isCaseListDto, isPlayerViewDto, isSaveLoadResponseDto } from '@meridiano/contracts';
import type { ActionResponseDto, CareerProfileDto, CaseSummary, PlayerViewDto, PublicActionOffer, SaveLoadResponseDto, SessionDto } from '@meridiano/contracts';

export interface GameApi {
  view(runId: string, signal: AbortSignal): Promise<PlayerViewDto>;
  catalog(signal: AbortSignal): Promise<CaseSummary[]>;
  /** Perfil de carrera del detective (GDD §13): lo usa la evaluación de
   * Margaret en la ventana del equipo. */
  career(signal: AbortSignal): Promise<CareerProfileDto>;
  preview(runId: string, action: PublicActionOffer['action'], identity: SessionDto, signal: AbortSignal): Promise<ActionResponseDto>;
  commit(runId: string, action: PublicActionOffer['action'], expectedVersion: number, idempotencyKey: string, identity: SessionDto, signal: AbortSignal): Promise<ActionResponseDto>;
  saves(runId: string, signal: AbortSignal): Promise<SaveListDto>;
  createSave(runId: string, name: string, expectedVersion: number, idempotencyKey: string, replaceSaveId: string | null, identity: SessionDto, signal: AbortSignal): Promise<SaveSummary>;
  loadSave(runId: string, saveId: string, expectedVersion: number, idempotencyKey: string, identity: SessionDto, signal: AbortSignal): Promise<SaveLoadResponseDto>;
  deleteSave(runId: string, saveId: string, expectedSaveVersion: number, idempotencyKey: string, identity: SessionDto, signal: AbortSignal): Promise<void>;
}

export type GameErrorKind = 'unavailable' | 'invalid' | 'session' | 'not_found' | 'version_conflict' | 'run_closed' | 'save_incompatible' | 'save_limit';

export class GameError extends Error {
  constructor(readonly kind: GameErrorKind) { super(kind); }
}

export interface SaveSummary {
  saveId: string; name: string; createdAt: string; sourceRevision: number; metadataVersion: number; replayed?: boolean;
}
export interface SaveListItem extends SaveSummary {
  runId: string; cityName: string; minute: number; status: string; canLoad: boolean;
}
export interface SaveListDto {
  items: SaveListItem[]; manualLimit: number; manualCount: number; nextCursor: string | null;
}

async function boundedJson(response: Response): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new GameError('invalid');
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let bytes = 0; let text = '';
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 131072) throw new GameError('invalid');
      text += decoder.decode(chunk.value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } catch {
    try { await reader.cancel(); } catch { throw new GameError('invalid'); }
    throw new GameError('invalid');
  } finally { reader.releaseLock(); }
}

async function request(path: string, signal: AbortSignal, init: RequestInit = {}): Promise<Response> {
  // El idioma viaja en cada llamada de juego: se lee del almacén en cada
  // petición, para que el cambio en Ajustes aplique sin recargar.
  const headers = new Headers(init.headers);
  headers.set('x-meridiano-language', createPreferenceStore().load().language);
  try {
    return await fetch(path, { ...init, headers, credentials: 'same-origin', cache: 'no-store', redirect: 'error',
      signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]) });
  } catch { throw new GameError('unavailable'); }
}

function isValidBody(body: unknown): body is Record<string, unknown> {
  return typeof body === 'object' && body !== null && !Array.isArray(body);
}

const errorKindsByCode: Record<string, GameErrorKind> = {
  VERSION_CONFLICT: 'version_conflict',
  RUN_CLOSED: 'run_closed',
  SAVE_NOT_ACTIVE: 'save_incompatible',
  SAVE_INCOMPATIBLE: 'save_incompatible',
  SAVE_LIMIT_REACHED: 'save_limit',
  INVALID_REQUEST: 'invalid',
};

function errorFromStatus(response: Response, body: unknown): GameError {
  if (response.status === 401) return new GameError('session');
  if (response.status === 404) return new GameError('not_found');
  const code = isValidBody(body) && isValidBody(body.error) && typeof body.error.code === 'string' ? body.error.code : '';
  const kind = errorKindsByCode[code];
  if (kind) return new GameError(kind);
  return new GameError('unavailable');
}

async function read(response: Response): Promise<Record<string, unknown>> {
  if (!response.ok) {
    const body = await boundedJson(response).catch(() => null);
    throw errorFromStatus(response, body);
  }
  const body = await boundedJson(response);
  if (!isValidBody(body)) throw new GameError('invalid');
  return body;
}

function mutationHeaders(identity: SessionDto) {
  return { 'content-type': 'application/json', 'x-csrf-token': identity.csrfToken, 'x-expected-profile-id': identity.profile.id };
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);
}

function isSaveSummary(value: unknown): value is SaveSummary {
  if (!isValidBody(value)) return false;
  return isUuid(value.saveId) && typeof value.name === 'string' && value.name.length > 0 &&
    typeof value.createdAt === 'string' && Number.isSafeInteger(value.sourceRevision) &&
    Number.isSafeInteger(value.metadataVersion) &&
    (value.replayed === undefined || typeof value.replayed === 'boolean');
}

function isSaveList(value: unknown): value is SaveListDto {
  if (!isValidBody(value) || !Array.isArray(value.items)) return false;
  if (value.manualLimit !== 10 || !Number.isSafeInteger(value.manualCount)) return false;
  if (value.nextCursor !== null && typeof value.nextCursor !== 'string') return false;
  return value.items.every(item => isSaveSummary(item) && isValidBody(item) &&
    typeof item.runId === 'string' && typeof item.cityName === 'string' &&
    Number.isSafeInteger(item.minute) && typeof item.status === 'string' && typeof item.canLoad === 'boolean');
}

export const gameApi: GameApi = {
  async view(runId: string, signal: AbortSignal): Promise<PlayerViewDto> {
    if (!isUuid(runId)) throw new GameError('invalid');
    const body = await read(await request('/api/v1/runs/' + encodeURIComponent(runId), signal));
    if (!isPlayerViewDto(body)) throw new GameError('invalid');
    if (body.runId !== runId) throw new GameError('invalid');
    return body;
  },

  async catalog(signal: AbortSignal): Promise<CaseSummary[]> {
    const body = await read(await request('/api/v1/cases', signal));
    if (!isCaseListDto(body)) throw new GameError('invalid');
    return body.items;
  },

  async career(signal: AbortSignal): Promise<CareerProfileDto> {
    const body = await read(await request('/api/v1/career', signal));
    if (!isCareerProfileDto(body)) throw new GameError('invalid');
    return body;
  },

  async preview(runId: string, action: PublicActionOffer['action'], identity: SessionDto, signal: AbortSignal): Promise<ActionResponseDto> {
    if (!isUuid(runId)) throw new GameError('invalid');
    const body = await read(await request('/api/v1/runs/' + encodeURIComponent(runId) + '/action', signal,
      { method: 'POST', headers: mutationHeaders(identity), body: JSON.stringify({ action, confirm: false }) }));
    if (!isActionResponseDto(body)) throw new GameError('invalid');
    return body;
  },

  async commit(runId: string, action: PublicActionOffer['action'], expectedVersion: number, idempotencyKey: string, identity: SessionDto, signal: AbortSignal): Promise<ActionResponseDto> {
    if (!isUuid(runId) || !isUuid(idempotencyKey)) throw new GameError('invalid');
    const body = await read(await request('/api/v1/runs/' + encodeURIComponent(runId) + '/action', signal,
      { method: 'POST', headers: mutationHeaders(identity),
        body: JSON.stringify({ action, confirm: true, expectedVersion, idempotencyKey }) }));
    if (!isActionResponseDto(body)) throw new GameError('invalid');
    return body;
  },

  async saves(runId: string, signal: AbortSignal): Promise<SaveListDto> {
    if (!isUuid(runId)) throw new GameError('invalid');
    const body = await read(await request('/api/v1/runs/' + encodeURIComponent(runId) + '/saves', signal));
    if (!isSaveList(body)) throw new GameError('invalid');
    return body;
  },

  async createSave(runId: string, name: string, expectedVersion: number, idempotencyKey: string, replaceSaveId: string | null, identity: SessionDto, signal: AbortSignal): Promise<SaveSummary> {
    if (!isUuid(runId) || !isUuid(idempotencyKey) || !name.trim()) throw new GameError('invalid');
    const payload: Record<string, unknown> = { name: name.trim(), expectedVersion, idempotencyKey };
    if (replaceSaveId) payload.replaceSaveId = replaceSaveId;
    const response = await request('/api/v1/runs/' + encodeURIComponent(runId) + '/saves', signal,
      { method: 'POST', headers: mutationHeaders(identity), body: JSON.stringify(payload) });
    const body = await read(response);
    if (!isSaveSummary(body)) throw new GameError('invalid');
    return body;
  },

  async loadSave(runId: string, saveId: string, expectedVersion: number, idempotencyKey: string, identity: SessionDto, signal: AbortSignal): Promise<SaveLoadResponseDto> {
    if (!isUuid(runId) || !isUuid(saveId) || !isUuid(idempotencyKey)) throw new GameError('invalid');
    const body = await read(await request(`/api/v1/runs/${encodeURIComponent(runId)}/saves/${encodeURIComponent(saveId)}/load`, signal,
      { method: 'POST', headers: mutationHeaders(identity), body: JSON.stringify({ expectedVersion, idempotencyKey }) }));
    if (!isSaveLoadResponseDto(body)) throw new GameError('invalid');
    return body;
  },

  async deleteSave(runId: string, saveId: string, expectedSaveVersion: number, idempotencyKey: string, identity: SessionDto, signal: AbortSignal): Promise<void> {
    if (!isUuid(runId) || !isUuid(saveId) || !isUuid(idempotencyKey)) throw new GameError('invalid');
    const response = await request(`/api/v1/runs/${encodeURIComponent(runId)}/saves/${encodeURIComponent(saveId)}`, signal,
      { method: 'DELETE', headers: mutationHeaders(identity), body: JSON.stringify({ expectedSaveVersion, idempotencyKey }) });
    if (response.status === 204) { await response.body?.cancel(); return; }
    const body = await boundedJson(response).catch(() => null);
    throw errorFromStatus(response, body);
  },
};
