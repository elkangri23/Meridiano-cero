import { isCareerProfileDto, isPlayerViewDto, isRunListDto, isSessionDto, isCaseListDto, isRunCreationLookupDto, isGenerationJobDto, isGenerationJobListDto, isCaseImportResultDto } from '@meridiano/contracts';
import type { CareerProfileDto, PlayerViewDto, RunListDto, SessionDto, CaseListDto, RunCreationLookupDto, CrimeType, ContentRating, GenerationJobDto, GenerationJobListDto, CaseImportResultDto } from '@meridiano/contracts';

export type Filter = 'all' | 'active' | 'closed';

/** Parámetros de creación que el servidor valida contra el expediente
 * (delito y contenido deben corresponderle; un reintento sin ellos sigue
 * funcionando porque se derivan del expediente). */
export interface CreationParams { difficulty?: 'easy' | 'normal' | 'hard'; crimeType?: CrimeType; contentRating?: ContentRating }

export interface ArchiveApi {
  initial(runId: string, signal: AbortSignal): Promise<PlayerViewDto>;
  cases(signal: AbortSignal): Promise<CaseListDto>;
  create(caseId: string, key: string, identity: SessionDto, signal: AbortSignal, params?: CreationParams): Promise<void>;
  lookup(key: string, identity: SessionDto, signal: AbortSignal): Promise<RunCreationLookupDto | null>;
  deleteRun(runId: string, identity: SessionDto, signal: AbortSignal): Promise<void>;
  me(signal: AbortSignal): Promise<SessionDto | null>;
  connect(signal: AbortSignal): Promise<SessionDto | null>;
  list(filter: Filter, cursor: string | null, signal: AbortSignal): Promise<RunListDto>;
  logout(csrf: string, signal: AbortSignal): Promise<void>;
  generationJobs(signal: AbortSignal): Promise<GenerationJobListDto>;
  createGenerationJob(params: GenerationJobParams, identity: SessionDto, signal: AbortSignal): Promise<GenerationJobDto>;
  cancelGenerationJob(jobId: string, identity: SessionDto, signal: AbortSignal): Promise<GenerationJobDto>;
  /** Descarga el expediente propio (DEC-011: solo el dueño autorizado).
   * Devuelve el fichero; el componente dispara la descarga. */
  exportCase(caseId: string, identity: SessionDto, signal: AbortSignal): Promise<Blob>;
  /** Importa un fichero de expediente: el servidor lo valida (v1.5) antes
   * de registrarlo en el catálogo. */
  importCase(fileText: string, identity: SessionDto, signal: AbortSignal): Promise<CaseImportResultDto>;
  /** Perfil de carrera del detective (GDD §13): rango, puntos,
   * reputación, medallas, casos, países, lugares, sanciones y resultados
   * oficiales. Null sin sesión. */
  career(signal: AbortSignal): Promise<CareerProfileDto | null>;
}

/** Parámetros de generación (T4-08): delito opcional (sin él, el servidor
 * sortea entre los 12), contenido y duración del expediente a generar. */
export interface GenerationJobParams { crimeType?: CrimeType; contentRating?: ContentRating; duration?: 'short' | 'medium' | 'long' }

export class ArchiveError extends Error {
  constructor(readonly kind: 'unavailable' | 'invalid', readonly detail?: string) { super(kind); }
}

async function boundedJson(response: Response): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new ArchiveError('invalid');
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let bytes = 0; let text = '';
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 131072) throw new ArchiveError('invalid');
      text += decoder.decode(chunk.value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } catch {
    try { await reader.cancel(); } catch { throw new ArchiveError('invalid'); }
    throw new ArchiveError('invalid');
  }
  finally { reader.releaseLock(); }
}

async function request(path: string, signal: AbortSignal, init: RequestInit = {}): Promise<Response> {
  try {
    return await fetch(path, { ...init, credentials: 'same-origin', cache: 'no-store', redirect: 'error',
      signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]) });
  } catch { throw new ArchiveError('unavailable'); }
}

function isValidBody(body: unknown): body is Record<string, unknown> {
  return typeof body === 'object' && body !== null && !Array.isArray(body);
}

async function read(response: Response): Promise<Record<string, unknown>> {
  if (!response.ok) { await response.body?.cancel(); throw new ArchiveError('unavailable'); }
  const body = await boundedJson(response);
  if (!isValidBody(body)) throw new ArchiveError('invalid');
  return body;
}

async function readPlayerViewDto(response: Response): Promise<PlayerViewDto> {
  const body = await read(response);
  if (!isPlayerViewDto(body)) throw new ArchiveError('invalid');
  return body;
}

async function readRunListDto(response: Response): Promise<RunListDto> {
  const body = await read(response);
  if (!isRunListDto(body)) throw new ArchiveError('invalid');
  return body;
}

async function readCaseListDto(response: Response): Promise<CaseListDto> {
  const body = await read(response);
  if (!isCaseListDto(body)) throw new ArchiveError('invalid');
  return body;
}

async function readRunCreationLookupDto(response: Response): Promise<RunCreationLookupDto | null> {
  const body = await read(response);
  if (!body) return null;
  if (!isRunCreationLookupDto(body)) throw new ArchiveError('invalid');
  return body;
}



async function readGenerationJobDto(response: Response): Promise<GenerationJobDto> {
  const body = await read(response);
  if (!isGenerationJobDto(body)) throw new ArchiveError('invalid');
  return body;
}

async function readGenerationJobListDto(response: Response): Promise<GenerationJobListDto> {
  const body = await read(response);
  if (!isGenerationJobListDto(body)) throw new ArchiveError('invalid');
  return body;
}

async function readCaseImportResultDto(response: Response): Promise<CaseImportResultDto> {
  const body = await read(response);
  if (!isCaseImportResultDto(body)) throw new ArchiveError('invalid');
  return body;
}

async function readCareerProfileDtoOrNull(response: Response): Promise<CareerProfileDto | null> {
  if (response.status === 401) { await response.body?.cancel(); return null; }
  const body = await read(response);
  if (!isCareerProfileDto(body)) throw new ArchiveError('invalid');
  return body;
}

/** Motivo del servidor cuando lo trae (VALIDATION_ERROR, FORBIDDEN,
 * GENERATION_LIMIT); sin él queda el mensaje genérico. */
async function errorDetail(response: Response): Promise<string | undefined> {
  try {
    const parsed = await boundedJson(response);
    if (isValidBody(parsed) && isValidBody(parsed.error) && typeof parsed.error.message === 'string') return parsed.error.message;
  } catch { /* el detalle es opcional */ }
  return undefined;
}

async function readSessionDtoOrNull(response: Response): Promise<SessionDto | null> {
  const body = await read(response);
  if (!body) return null;
  if (!isSessionDto(body)) throw new ArchiveError('invalid');
  return body;
}

function mutationHeaders(identity: SessionDto) {
  return { 'content-type': 'application/json', 'x-csrf-token': identity.csrfToken, 'x-expected-profile-id': identity.profile.id };
}

function creationBody(caseId: string, key: string, params?: CreationParams): Record<string, string> {
  const body: Record<string, string> = { caseId, idempotencyKey: key };
  if (params?.difficulty) body.difficulty = params.difficulty;
  if (params?.crimeType) body.crimeType = params.crimeType;
  if (params?.contentRating) body.contentRating = params.contentRating;
  return body;
}

export const archiveApi: ArchiveApi = {
  async initial(runId: string, signal: AbortSignal): Promise<PlayerViewDto> {
    if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(runId)) throw new ArchiveError('invalid');
    const response = await request('/api/v1/runs/' + encodeURIComponent(runId), signal);
    const view = await readPlayerViewDto(response);
    if (view.runId !== runId) throw new ArchiveError('invalid');
    return view;
  },

  async cases(signal: AbortSignal): Promise<CaseListDto> {
    const response = await request('/api/v1/cases', signal);
    return readCaseListDto(response);
  },

  async create(caseId: string, key: string, identity: SessionDto, signal: AbortSignal,
    params?: CreationParams): Promise<void> {
    const response = await request('/api/v1/runs', signal, { method: 'POST', headers: mutationHeaders(identity), body: JSON.stringify(creationBody(caseId, key, params)) });
    if (response.status === 200 || response.status === 201) { await response.body?.cancel(); return; }
    // El mensaje de error real llega a la UI: antes se tragaba con el
    // «unavailable» genérico y la creación quedaba como «pendiente de
    // confirmar» sin explicación.
    let detail: string | undefined;
    try {
      const parsed = await boundedJson(response);
      if (isValidBody(parsed) && isValidBody(parsed.error)) {
        if (parsed.error.code === 'IDEMPOTENCY_CONFLICT') detail = 'Ya existe una partida creada con esa clave y otra dificultad.';
        else if (typeof parsed.error.message === 'string') detail = parsed.error.message;
      }
    } catch { /* el detalle es opcional; sin él queda el mensaje genérico */ }
    throw new ArchiveError('unavailable', detail);
  },

  async deleteRun(runId: string, identity: SessionDto, signal: AbortSignal): Promise<void> {
    const response = await request('/api/v1/runs/' + encodeURIComponent(runId), signal,
      { method: 'DELETE', headers: mutationHeaders(identity), body: JSON.stringify({ confirm: true }) });
    await response.body?.cancel();
    // 404 significa que la partida ya no existe o no es del usuario: el
    // resultado para el archivo es el mismo (no está en la lista).
    if (response.status !== 204 && response.status !== 404) throw new ArchiveError('unavailable');
  },

  async lookup(key: string, identity: SessionDto, signal: AbortSignal): Promise<RunCreationLookupDto | null> {
    const response = await request('/api/v1/run-creations/lookup', signal, { method: 'POST', headers: mutationHeaders(identity), body: JSON.stringify({ idempotencyKey: key }) });
    if (response.status === 404) { await response.body?.cancel(); return null; }
    return readRunCreationLookupDto(response);
  },

  async me(signal: AbortSignal): Promise<SessionDto | null> {
    const response = await request('/api/v1/me', signal);
    if (response.status === 401) { await response.body?.cancel(); return null; }
    return readSessionDtoOrNull(response);
  },

  async connect(signal: AbortSignal): Promise<SessionDto | null> {
    return readSessionDtoOrNull(await request('/api/v1/auth/local-session', signal,
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }));
  },

  async list(filter: Filter, cursor: string | null, signal: AbortSignal): Promise<RunListDto> {
    const query = new URLSearchParams({ limit: '25' });
    if (filter !== 'all') query.set('status', filter);
    if (cursor !== null) query.set('cursor', cursor);
    return readRunListDto(await request('/api/v1/runs?' + query.toString(), signal));
  },

  async logout(csrf: string, signal: AbortSignal): Promise<void> {
    const response = await request('/api/v1/auth/logout', signal, { method: 'POST', headers: { 'x-csrf-token': csrf } });
    await response.body?.cancel();
    if (response.status !== 204) throw new ArchiveError('unavailable');
  },

  async generationJobs(signal: AbortSignal): Promise<GenerationJobListDto> {
    const response = await request('/api/v1/generation/jobs', signal);
    return readGenerationJobListDto(response);
  },

  async createGenerationJob(params: GenerationJobParams, identity: SessionDto, signal: AbortSignal): Promise<GenerationJobDto> {
    const body: Record<string, string> = {};
    if (params.crimeType) body.crimeType = params.crimeType;
    if (params.contentRating) body.contentRating = params.contentRating;
    if (params.duration) body.duration = params.duration;
    const response = await request('/api/v1/generation/jobs', signal, { method: 'POST', headers: mutationHeaders(identity), body: JSON.stringify(body) });
    if (response.status === 201) return readGenerationJobDto(response);
    let detail: string | undefined;
    try {
      const parsed = await boundedJson(response);
      if (isValidBody(parsed) && isValidBody(parsed.error) && typeof parsed.error.message === 'string') detail = parsed.error.message;
    } catch { /* el detalle es opcional; sin él queda el mensaje genérico */ }
    throw new ArchiveError('unavailable', detail);
  },

  async cancelGenerationJob(jobId: string, identity: SessionDto, signal: AbortSignal): Promise<GenerationJobDto> {
    if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(jobId)) throw new ArchiveError('invalid');
    const response = await request('/api/v1/generation/jobs/' + encodeURIComponent(jobId) + '/cancel', signal,
      { method: 'POST', headers: mutationHeaders(identity), body: '{}' });
    return readGenerationJobDto(response);
  },

  async exportCase(caseId: string, identity: SessionDto, signal: AbortSignal): Promise<Blob> {
    if (!/^[A-Za-z0-9._:-]{1,128}$/.test(caseId)) throw new ArchiveError('invalid');
    const response = await request('/api/v1/cases/' + encodeURIComponent(caseId) + '/export', signal,
      { headers: { 'x-csrf-token': identity.csrfToken, 'x-expected-profile-id': identity.profile.id } });
    if (response.status === 200) return response.blob();
    throw new ArchiveError('unavailable', await errorDetail(response));
  },

  async importCase(fileText: string, identity: SessionDto, signal: AbortSignal): Promise<CaseImportResultDto> {
    const response = await request('/api/v1/cases/import', signal,
      { method: 'POST', headers: mutationHeaders(identity), body: fileText });
    if (response.status === 200 || response.status === 201) return readCaseImportResultDto(response);
    throw new ArchiveError('unavailable', await errorDetail(response));
  },

  async career(signal: AbortSignal): Promise<CareerProfileDto | null> {
    return readCareerProfileDtoOrNull(await request('/api/v1/career', signal));
  },
};