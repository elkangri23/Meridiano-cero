import { isInitialPlayerViewDto, isRunListDto, isSessionDto, isCaseListDto, isRunCreationLookupDto } from '@meridiano/contracts';
import type { InitialPlayerViewDto, RunListDto, SessionDto, CaseListDto, RunCreationLookupDto } from '@meridiano/contracts';

export type Filter = 'all' | 'active' | 'closed';
export interface ArchiveApi {
  initial(runId: string, signal: AbortSignal): Promise<InitialPlayerViewDto>;
  cases(signal: AbortSignal): Promise<CaseListDto>;
  create(caseId: string, key: string, identity: SessionDto, signal: AbortSignal): Promise<void>;
  lookup(key: string, identity: SessionDto, signal: AbortSignal): Promise<RunCreationLookupDto | null>;
  me(signal: AbortSignal): Promise<SessionDto | null>;
  connect(signal: AbortSignal): Promise<SessionDto>;
  list(filter: Filter, cursor: string | null, signal: AbortSignal): Promise<RunListDto>;
  logout(csrf: string, signal: AbortSignal): Promise<void>;
}
export class ArchiveError extends Error {
  constructor(readonly kind: 'unavailable' | 'invalid') { super(kind); }
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
async function read<T>(response: Response, valid: (value: unknown) => value is T): Promise<T> {
  if (!response.ok) { await response.body?.cancel(); throw new ArchiveError('unavailable'); }
  const body = await boundedJson(response);
  if (!valid(body)) throw new ArchiveError('invalid');
  return body;
}
function mutationHeaders(identity: SessionDto) {
  return { 'content-type': 'application/json', 'x-csrf-token': identity.csrfToken, 'x-expected-profile-id': identity.profile.id };
}
export const archiveApi: ArchiveApi = {
  async initial(runId, signal) {
    if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(runId)) throw new ArchiveError('invalid');
    const view = await read(await request('/api/v1/runs/' + encodeURIComponent(runId), signal), isInitialPlayerViewDto);
    if (view.runId !== runId) throw new ArchiveError('invalid');
    return view;
  },
  async cases(signal) { return read(await request('/api/v1/cases', signal), isCaseListDto); },
  async create(caseId, key, identity, signal) {
    const response = await request('/api/v1/runs', signal, { method: 'POST', headers: mutationHeaders(identity), body: JSON.stringify({ caseId, idempotencyKey: key }) });
    await response.body?.cancel();
    if (response.status !== 200 && response.status !== 201) throw new ArchiveError('unavailable');
  },
  async lookup(key, identity, signal) {
    const response = await request('/api/v1/run-creations/lookup', signal, { method: 'POST', headers: mutationHeaders(identity), body: JSON.stringify({ idempotencyKey: key }) });
    if (response.status === 404) { await response.body?.cancel(); return null; }
    return read(response, isRunCreationLookupDto);
  },
  async me(signal) {
    const response = await request('/api/v1/me', signal);
    if (response.status === 401) { await response.body?.cancel(); return null; }
    return read(response, isSessionDto);
  },
  async connect(signal) {
    return read(await request('/api/v1/auth/local-session', signal,
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }), isSessionDto);
  },
  async list(filter, cursor, signal) {
    const query = new URLSearchParams({ limit: '25' });
    if (filter !== 'all') query.set('status', filter);
    if (cursor !== null) query.set('cursor', cursor);
    return read(await request('/api/v1/runs?' + query.toString(), signal), isRunListDto);
  },
  async logout(csrf, signal) {
    const response = await request('/api/v1/auth/logout', signal, { method: 'POST', headers: { 'x-csrf-token': csrf } });
    await response.body?.cancel();
    if (response.status !== 204) throw new ArchiveError('unavailable');
  },
};
