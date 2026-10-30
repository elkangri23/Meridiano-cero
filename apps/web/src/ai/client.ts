

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

export interface AiApi {
  interpret(text: string, scene: { location: string; description: string }, offers: Array<{ id: string; label: string }>, signal: AbortSignal): Promise<AiInterpretation>;
  narrate(facts: Array<{ id: string; text: string }>, signal: AbortSignal): Promise<AiNarrative>;
  converse(input: { runId: string; text: string; npc: { id: string; name: string; persona: string }; facts: Array<{ id: string; text: string }>; memory: unknown; allowedActs: string[] }, signal: AbortSignal): Promise<AiConverseResult>;
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

async function request(path: string, signal: AbortSignal, init: RequestInit = {}): Promise<Response> {
  try {
    return await fetch(path, { ...init, credentials: 'same-origin', cache: 'no-store', redirect: 'error',
      signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]) });
  } catch { throw new AiError('unavailable'); }
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
  async interpret(text: string, scene: { location: string; description: string }, offers: Array<{ id: string; label: string }>, signal: AbortSignal): Promise<AiInterpretation> {
    const response = await request('/api/v1/ai/interpret', signal, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text, scene, offers, requestId: crypto.randomUUID() }) });
    const body = await read(response);
    const interpretation = body.interpretation;
    if (!interpretation || typeof interpretation !== 'object' || !('kind' in interpretation)) throw new AiError('invalid');
    return interpretation as AiInterpretation;
  },

  async narrate(facts: Array<{ id: string; text: string }>, signal: AbortSignal): Promise<AiNarrative> {
    const response = await request('/api/v1/ai/narrate', signal, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ facts, requestId: crypto.randomUUID() }) });
    const body = await read(response);
    const narrative = body.narrative;
    if (!narrative || typeof narrative !== 'object' || !('text' in narrative)) throw new AiError('invalid');
    return narrative as AiNarrative;
  },

  async converse(input: { runId: string; text: string; npc: { id: string; name: string; persona: string }; facts: Array<{ id: string; text: string }>; memory: unknown; allowedActs: string[] }, signal: AbortSignal): Promise<AiConverseResult> {
    const response = await request('/api/v1/ai/converse', signal, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...input, requestId: crypto.randomUUID() }) });
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