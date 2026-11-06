

export interface AiInterpretation {
  kind: 'actions' | 'clarification';
  actionIds?: string[];
  message?: string;
  reason?: string;
}

export interface AiNarrative {
  text: string;
  factIds: string[];
  act: string | null;
  source: 'model' | 'fallback';
  reason?: string;
}

export interface AiConverseResult {
  narrative: AiNarrative;
  memory: unknown;
}

export interface AiHealth {
  available: boolean;
  latencyMs?: number;
  error?: string;
}

export interface AiAuth {
  /** CSRF de la sesión en memoria (nunca en storage). Sin él, los POST de IA devuelven 403. */
  csrfToken: string;
}

export interface AiApi {
  interpret(text: string, scene: { location: string; description: string }, offers: Array<{ id: string; label: string }>, signal: AbortSignal, auth?: AiAuth): Promise<AiInterpretation>;
  narrate(facts: Array<{ id: string; text: string }>, signal: AbortSignal, auth?: AiAuth): Promise<AiNarrative>;
  converse(input: { runId: string; text: string; npc: { id: string; name: string; persona: string; knownFactIds: string[]; revealableFactIds: string[] }; facts: Array<{ id: string; text: string }>; memory: unknown; allowedActs: string[] }, signal: AbortSignal, auth?: AiAuth): Promise<AiConverseResult>;
  health(signal: AbortSignal): Promise<AiHealth>;
}

export class AiError extends Error {
  constructor(readonly kind: 'unavailable' | 'invalid' | 'budget_exceeded' | 'timeout' | 'cancelled') { super(kind); }
}

async function boundedJson(response: Response): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new AiError('invalid');
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let bytes = 0; let text = '';
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 131072) throw new AiError('invalid');
      text += decoder.decode(chunk.value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } catch {
    try { await reader.cancel(); } catch { throw new AiError('invalid'); }
    throw new AiError('invalid');
  } finally { reader.releaseLock(); }
}

interface RequestOptions {
  retries?: number;
  baseDelayMs?: number;
  timeoutMs?: number;
  shouldRetry?: (error: AiError) => boolean;
}

/** Plazos por operación: el modelo tarda segundos en responder (conversar
 * hasta ~35 s en el peor caso medido) y el servidor admite 60 s. El plazo
 * único de 8 s abortaba cada intento antes de que el servidor contestara:
 * preguntar a Inés fallaba siempre que el modelo tardaba más de 8 s, con
 * «La IA no responde», aunque el servidor acababa respondiendo. */
const AI_TIMEOUTS = { interpret: 15000, narrate: 45000, converse: 75000 } as const;

async function requestWithRetry(
  path: string,
  signal: AbortSignal,
  init: RequestInit = {},
  options: RequestOptions = {}
): Promise<Response> {
  const { retries = 2, baseDelayMs = 500, timeoutMs = 8000, shouldRetry = () => false } = options;
  let attempt = 0;
  let lastError: AiError | undefined;

  while (attempt <= retries) {
    try {
      const response = await fetch(path, {
        ...init,
        credentials: 'same-origin',
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)])
      });
      return response;
    } catch (error) {
      if (signal.aborted || error instanceof AiError && error.kind === 'cancelled') {
        throw new AiError('cancelled');
      }
      lastError = error instanceof AiError ? error : new AiError('unavailable');
      if (attempt < retries && shouldRetry(lastError)) {
        const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 100;
        await new Promise(resolve => setTimeout(resolve, delay));
        attempt++;
        continue;
      }
      throw lastError;
    }
  }
  throw lastError ?? new AiError('unavailable');
}

async function request(path: string, signal: AbortSignal, init: RequestInit = {}, options: { timeoutMs?: number; retries?: number } = {}): Promise<Response> {
  return requestWithRetry(path, signal, init, {
    retries: options.retries ?? 2,
    baseDelayMs: 500,
    timeoutMs: options.timeoutMs ?? 8000,
    shouldRetry: (error) => error.kind === 'unavailable' || error.kind === 'timeout'
  });
}

function isValidBody(body: unknown): body is Record<string, unknown> {
  return typeof body === 'object' && body !== null && !Array.isArray(body);
}

async function read(response: Response): Promise<Record<string, unknown>> {
  if (!response.ok) { await response.body?.cancel(); throw new AiError('unavailable'); }
  const body = await boundedJson(response);
  if (!isValidBody(body)) throw new AiError('invalid');
  return body;
}

export const aiApi: AiApi = {
  async interpret(text: string, scene: { location: string; description: string }, offers: Array<{ id: string; label: string }>, signal: AbortSignal, auth?: AiAuth): Promise<AiInterpretation> {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (auth) headers['x-csrf-token'] = auth.csrfToken;
    const response = await request('/api/v1/ai/interpret', signal, { method: 'POST', headers, body: JSON.stringify({ text, scene, offers, requestId: crypto.randomUUID() }) }, { timeoutMs: AI_TIMEOUTS.interpret });
    const body = await read(response);
    const interpretation = body.interpretation;
    if (!interpretation || typeof interpretation !== 'object' || !('kind' in interpretation)) throw new AiError('invalid');
    return interpretation as AiInterpretation;
  },

  async narrate(facts: Array<{ id: string; text: string }>, signal: AbortSignal, auth?: AiAuth): Promise<AiNarrative> {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (auth) headers['x-csrf-token'] = auth.csrfToken;
    const response = await request('/api/v1/ai/narrate', signal, { method: 'POST', headers, body: JSON.stringify({ facts, requestId: crypto.randomUUID() }) }, { timeoutMs: AI_TIMEOUTS.narrate, retries: 1 });
    const body = await read(response);
    const narrative = body.narrative;
    if (!narrative || typeof narrative !== 'object' || !('text' in narrative)) throw new AiError('invalid');
    return narrative as AiNarrative;
  },

  async converse(input: { runId: string; text: string; npc: { id: string; name: string; persona: string; knownFactIds: string[]; revealableFactIds: string[] }; facts: Array<{ id: string; text: string }>; memory: unknown; allowedActs: string[] }, signal: AbortSignal, auth?: AiAuth): Promise<AiConverseResult> {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (auth) headers['x-csrf-token'] = auth.csrfToken;
    const response = await request('/api/v1/ai/converse', signal, { method: 'POST', headers, body: JSON.stringify({ ...input, requestId: crypto.randomUUID() }) }, { timeoutMs: AI_TIMEOUTS.converse, retries: 1 });
    const body = await read(response);
    if (!body.narrative || !body.memory) throw new AiError('invalid');
    return { narrative: body.narrative as AiNarrative, memory: body.memory };
  },

  async health(signal: AbortSignal): Promise<AiHealth> {
    const response = await request('/api/v1/ai/health', signal);
    const body = await read(response);
    const ai = body.ai;
    if (!ai || typeof ai !== 'object') throw new AiError('invalid');
    return ai as AiHealth;
  },
};