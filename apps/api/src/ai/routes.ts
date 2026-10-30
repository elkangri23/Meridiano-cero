import { AiError, record } from './provider.ts';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AppConfig } from '../config.ts';
import type { Database } from '../database/connection.ts';
import { createSessionStore } from '../auth/store.ts';
import { cookieToken, matches } from '../auth/session-security.ts';
import { createCompatibleOllamaProvider } from './ollama-adapter.ts';
import { createDirector } from './director.ts';
import { interpretationSchema, factualSchema } from './schemas.ts';
import type { AiRequest, AiProvider } from './provider.ts';
import { RunStoreError } from '../game/runs.ts';
import type { PublicFact, PublicScene, NpcContext, ConversationMemory, SpeechAct, ActionOffer } from './context.ts';
import { speechActs } from './context.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function restoreMemory(value: unknown, runId: string, npcId: string): ConversationMemory {
  if (!record(value) || !value.schemaVersion || !value.runId || !value.npcId || !value.treatment || !Array.isArray(value.turns)) {
    throw new RunStoreError('INVALID_REQUEST');
  }
  if (value.runId !== runId || value.npcId !== npcId) throw new RunStoreError('INVALID_REQUEST');
  return value as unknown as ConversationMemory;
}

function getAiProvider(config: AppConfig): AiProvider {
  if (config.aiProvider === 'ollama') {
    const baseUrl = config.aiBaseUrl ?? 'http://127.0.0.1:11434';
    const model = config.aiModel ?? 'llama3.1:8b';
    const timeoutMs = config.aiTimeoutMs ?? 60000;
    return createCompatibleOllamaProvider({ model, origin: baseUrl, timeoutMs });
  }
  // Default: mock provider for tests/development
  return createCompatibleOllamaProvider({ model: 'deterministic-ci' });
}

export function registerAiRoutes(app: FastifyInstance, config: AppConfig, database: Database): void {
  const store = createSessionStore(database);
  const aiProvider = getAiProvider(config);
  const director = createDirector(aiProvider);

  async function authorize(request: FastifyRequest): Promise<string> {
    const session = await store.find(cookieToken(request.headers.cookie));
    if (!session) throw new RunStoreError('SESSION_REQUIRED');
    if (request.method === 'POST') {
      if (request.headers.origin !== config.origin) throw new RunStoreError('ORIGIN_REJECTED');
      if (!matches(request.headers['x-csrf-token'], session.csrfToken)) throw new RunStoreError('CSRF_REJECTED');
    }
    return session.profile.id;
  }

  function toInterpretRequest(body: unknown): AiRequest {
    if (!isRecord(body)) throw new RunStoreError('INVALID_REQUEST');
    const { text, scene, offers, requestId } = body;
    if (typeof text !== 'string' || !isRecord(scene) || !Array.isArray(offers) || typeof requestId !== 'string') {
      throw new RunStoreError('INVALID_REQUEST');
    }
    if (text.length > 4000 || offers.length > 64) {
      throw new AiError('budget_exceeded');
    }
    return {
      operation: 'interpretAction',
      requestId,
      schema: interpretationSchema,
      context: { text, scene: { location: scene.location, description: scene.description },
        offers: offers.map(o => ({ id: o.id, label: o.label })) },
      signal: new AbortController().signal,
    };
  }

  function toNarrateRequest(body: unknown): AiRequest {
    if (!isRecord(body)) throw new RunStoreError('INVALID_REQUEST');
    const { facts, requestId } = body;
    if (!Array.isArray(facts) || typeof requestId !== 'string') {
      throw new RunStoreError('INVALID_REQUEST');
    }
    return {
      operation: 'narrateResult',
      requestId,
      schema: factualSchema,
      context: { facts: facts.map((f: PublicFact) => ({ id: f.id, text: f.text })) },
      signal: new AbortController().signal,
    };
  }

  function toConverseRequest(body: unknown): AiRequest {
    if (!isRecord(body)) throw new RunStoreError('INVALID_REQUEST');
    const { runId, text, npc, facts, memory, allowedActs, requestId } = body;
    if (typeof runId !== 'string' || typeof text !== 'string' || !isRecord(npc) || !Array.isArray(facts) ||
        !isRecord(memory) || !Array.isArray(allowedActs) || typeof requestId !== 'string') {
      throw new RunStoreError('INVALID_REQUEST');
    }
    if (text.length > 4000) throw new AiError('budget_exceeded');
    if (!allowedActs.length || allowedActs.some(a => !speechActs.includes(a as SpeechAct))) {
      throw new RunStoreError('INVALID_REQUEST');
    }
    const npcId = typeof npc.id === 'string' ? npc.id : '';
    return {
      operation: 'converse',
      requestId,
      schema: factualSchema,
      context: {
        text,
        npc: { id: npcId, name: typeof npc.name === 'string' ? npc.name : '', persona: typeof npc.persona === 'string' ? npc.persona : '' },
        facts: facts.map((f: PublicFact) => ({ id: f.id, text: f.text })),
        allowedActs,
        memory: restoreMemory(memory, runId, npcId),
      },
      signal: new AbortController().signal,
    };
  }

  // POST /api/v1/ai/interpret
  app.post('/api/v1/ai/interpret', { onRequest: async (request) => { await authorize(request); } }, async (_request, reply) => {
    await authorize(_request);
    const aiRequest = toInterpretRequest(_request.body);
    const callOptions: { requestId: string; signal?: AbortSignal } = { requestId: aiRequest.requestId };
    if (aiRequest.signal) callOptions.signal = aiRequest.signal;
    const result = await director.interpretAction(aiRequest.context.text as string, aiRequest.context.scene as PublicScene, aiRequest.context.offers as ActionOffer[], callOptions);
    return reply.send({ interpretation: result });
  });

  // POST /api/v1/ai/narrate
  app.post('/api/v1/ai/narrate', { onRequest: async (request) => { await authorize(request); } }, async (_request, reply) => {
    await authorize(_request);
    const aiRequest = toNarrateRequest(_request.body);
    const facts = aiRequest.context.facts as PublicFact[];
    const callOptions: { requestId: string; signal?: AbortSignal } = { requestId: aiRequest.requestId };
    if (aiRequest.signal) callOptions.signal = aiRequest.signal;
    const result = await director.narrateResult(facts, callOptions);
    return reply.send({ narrative: result });
  });

  // POST /api/v1/ai/converse
  app.post('/api/v1/ai/converse', { onRequest: async (request) => { await authorize(request); } }, async (_request, reply) => {
    await authorize(_request);
    const aiRequest = toConverseRequest(_request.body);
    const facts = aiRequest.context.facts as PublicFact[];
    const memory = aiRequest.context.memory as ConversationMemory;
    const callOptions: { requestId: string; signal?: AbortSignal } = { requestId: aiRequest.requestId };
    if (aiRequest.signal) callOptions.signal = aiRequest.signal;
    const result = await director.converse(
      { runId: '', text: aiRequest.context.text as string, npc: aiRequest.context.npc as NpcContext, facts, memory, allowedActs: aiRequest.context.allowedActs as SpeechAct[] },
      callOptions
    );
    return reply.send({ narrative: result.narrative, memory: result.memory });
  });

  // GET /api/v1/ai/health - health check del proveedor IA
  app.get('/api/v1/ai/health', { onRequest: async (request) => { await authorize(request); } }, async (_request, reply) => {
    const health = await (aiProvider as any).healthCheck?.();
    return reply.send({ ai: health ?? { available: false, error: 'healthCheck no implementado' } });
  });
}