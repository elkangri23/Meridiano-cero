import { AiError, record } from './provider.ts';
import type { FastifyInstance } from 'fastify';
import type { FastifyRequest } from 'fastify';
import type { AppConfig } from '../config.ts';
import type { Database } from '../database/connection.ts';
import { describeLockedActions } from '@meridiano/engine';
import type { LockedAction } from '@meridiano/engine';
import { cookieToken } from '../auth/session-security.ts';
import { tokenDigest } from '../auth/store.ts';
import { definitionForRun } from '../game/catalog.ts';
import { createAuthorizer } from './authorize.ts';
import { createDirector } from './director.ts';
import { interpretationSchema, factualSchema, converseSchema } from './schemas.ts';
import type { AiRequest } from './provider.ts';
import { RunStoreError, readFullRun } from '../game/runs.ts';
import type { PublicFact, PublicScene, NpcContext, ConversationMemory, SpeechAct, ActionOffer } from './context.ts';
import { speechActs } from './context.ts';
import { checkQuota, recordUsage, estimateTokens } from './ai-quota.ts';
import { resolveRequestProvider, type ResolvedProvider } from './provider-factory.ts';

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

export function registerAiRoutes(app: FastifyInstance, config: AppConfig, database: Database): void {
  const authorize = createAuthorizer(config, database);

  // Resolución por petición: conexión personal del usuario > defecto del
  // administrador > mock. El director se crea por petición con ese proveedor.
  async function resolveFor(ownerId: string): Promise<ResolvedProvider & { director: ReturnType<typeof createDirector> }> {
    const resolved = await resolveRequestProvider(database, ownerId, config);
    return { ...resolved, director: createDirector(resolved.provider) };
  }

  function interpretRequestFields(body: unknown): { text: string; scene: Record<string, unknown>; offers: Array<Record<string, unknown>>; requestId: string; runId?: string } {
    if (!isRecord(body)) throw new RunStoreError('INVALID_REQUEST');
    const { text, scene, offers, requestId, runId } = body;
    if (typeof text !== 'string' || !isRecord(scene) || !Array.isArray(offers) || typeof requestId !== 'string') {
      throw new RunStoreError('INVALID_REQUEST');
    }
    if (runId !== undefined && typeof runId !== 'string') throw new RunStoreError('INVALID_REQUEST');
    return { text, scene, offers, requestId,
      ...(typeof runId === 'string' && runId.length > 0 ? { runId } : {}) };
  }

  function toInterpretRequest(body: unknown): { request: AiRequest; runId?: string } {
    const { text, scene, offers, requestId, runId } = interpretRequestFields(body);
    if (text.length > 4000 || offers.length > 64) {
      throw new AiError('budget_exceeded');
    }
    return {
      request: {
        operation: 'interpretAction',
        requestId,
        schema: interpretationSchema,
        context: { text, scene: { location: scene.location, description: scene.description },
          offers: offers.map(o => ({ id: o.id, label: o.label })) },
        signal: new AbortController().signal,
      },
      ...(runId ? { runId } : {}),
    };
  }

  /** Acciones de orden/detención bloqueadas en esta partida, para que el
   * intérprete explique qué falta en vez de inventar otra acción. Sin
   * partida (prototipo) o si la carga falla, no hay bloqueos: el
   * comportamiento es el de siempre. */
  async function lockedActionsForRun(database: Database, request: FastifyRequest, runId: string): Promise<LockedAction[]> {
    try {
      const token = cookieToken(request.headers.cookie);
      if (!token) return [];
      const run = await readFullRun(database, tokenDigest(token), runId);
      const definition = await definitionForRun(database.orm, run.definitionId, run.difficulty, run.deadlineMinutes, run.explorationMode);
      return describeLockedActions(definition, run);
    } catch {
      return [];
    }
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

  function stringList(value: unknown): string[] {
    return Array.isArray(value) && value.every(item => typeof item === 'string') ? [...value] : [];
  }

  /** Contexto del NPC tal como lo envía el cliente: solo puede declarar
   * hechos que conoce y que puede revelar; sin esas listas el director
   * rompería al filtrar (knownFactIds.includes sobre undefined). */
  function converseNpc(npc: unknown): NpcContext {
    const source = isRecord(npc) ? npc : {};
    const refusal = typeof source.refusal === 'string' && source.refusal.length > 0 && source.refusal.length <= 200
      ? source.refusal : undefined;
    return {
      id: typeof source.id === 'string' ? source.id : '',
      name: typeof source.name === 'string' ? source.name : '',
      persona: typeof source.persona === 'string' ? source.persona : '',
      knownFactIds: stringList(source.knownFactIds),
      revealableFactIds: stringList(source.revealableFactIds),
      ...(refusal ? { refusal } : {}),
    };
  }

  function converseFields(body: unknown): { runId: string; text: string; npc: unknown; facts: PublicFact[]; memory: unknown; allowedActs: string[]; requestId: string } {
    if (!isRecord(body)) throw new RunStoreError('INVALID_REQUEST');
    const { runId, text, npc, facts, memory, allowedActs, requestId } = body;
    if (typeof runId !== 'string' || typeof text !== 'string' || typeof requestId !== 'string') {
      throw new RunStoreError('INVALID_REQUEST');
    }
    if (!isRecord(npc) || !Array.isArray(facts) || !isRecord(memory) || !Array.isArray(allowedActs)) {
      throw new RunStoreError('INVALID_REQUEST');
    }
    return { runId, text, npc, facts, memory, allowedActs, requestId };
  }

  function toConverseRequest(body: unknown): AiRequest {
    const fields = converseFields(body);
    const { runId, text, facts, memory, allowedActs, requestId } = fields;
    if (text.length > 4000) throw new AiError('budget_exceeded');
    if (!allowedActs.length || allowedActs.some(a => !speechActs.includes(a as SpeechAct))) {
      throw new RunStoreError('INVALID_REQUEST');
    }
    const npc = converseNpc(fields.npc);
    return {
      operation: 'converse',
      requestId,
      schema: converseSchema,
      context: {
        runId,
        text,
        npc,
        facts: facts.map((f: PublicFact) => ({ id: f.id, text: f.text })),
        allowedActs,
        memory: restoreMemory(memory, runId, npc.id),
      },
      signal: new AbortController().signal,
    };
  }

  // POST /api/v1/ai/interpret
  app.post('/api/v1/ai/interpret', { onRequest: async (request) => { await authorize(request); } }, async (request, reply) => {
    const ownerId = await authorize(request);
    const { provider: aiProvider, director } = await resolveFor(ownerId);
    const { request: aiRequest, runId } = toInterpretRequest(request.body);
    const locked = runId ? await lockedActionsForRun(database, request, runId) : [];

    // Estimar tokens
    const estimatedTokens = estimateTokens(JSON.stringify(aiRequest.context));

    // Verificar cuota
    const quotaCheck = await checkQuota(database, {
      ownerId,
      function: 'interpretAction',
      providerId: aiProvider.providerId,
      model: aiProvider.model,
      estimatedTokens,
    });
    if (!quotaCheck.allowed) {
      return reply.code(429).send({ error: { code: 'QUOTA_EXCEEDED', message: quotaCheck.reason, retryAfter: quotaCheck.retryAfter } });
    }

    const callOptions: { requestId: string; signal?: AbortSignal } = { requestId: aiRequest.requestId };
    if (aiRequest.signal) callOptions.signal = aiRequest.signal;

    const startTime = performance.now();
    try {
      const result = await director.interpretAction(aiRequest.context.text as string, aiRequest.context.scene as PublicScene, aiRequest.context.offers as ActionOffer[], callOptions, locked);

      // Registrar uso exitoso
      await recordUsage(database, {
        ownerId,
        function: 'interpretAction',
        providerId: aiProvider.providerId,
        model: aiProvider.model,
        promptTokens: 0, // Se actualizaría con datos reales del provider
        completionTokens: 0,
        totalTokens: 0,
        latencyMs: Math.round(performance.now() - startTime),
        status: 'success',
        requestId: aiRequest.requestId,
      });

      return reply.send({ interpretation: result });
    } catch (error) {
      // Registrar error
      const errorCode = error instanceof AiError ? error.code : '';
      await recordUsage(database, {
        ownerId,
        function: 'interpretAction',
        providerId: aiProvider.providerId,
        model: aiProvider.model,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        latencyMs: Math.round(performance.now() - startTime),
        status: error instanceof AiError ? (error.code === 'timeout' ? 'timeout' : error.code === 'cancelled' ? 'cancelled' : 'error') : 'error',
        errorCode,
        requestId: aiRequest.requestId,
      });
      throw error;
    }
  });

  // POST /api/v1/ai/narrate
  app.post('/api/v1/ai/narrate', { onRequest: async (request) => { await authorize(request); } }, async (request, reply) => {
    const ownerId = await authorize(request);
    const { provider: aiProvider, director } = await resolveFor(ownerId);
    const aiRequest = toNarrateRequest(request.body);
    const facts = aiRequest.context.facts as PublicFact[];

    const estimatedTokens = estimateTokens(JSON.stringify(aiRequest.context));

    const quotaCheck = await checkQuota(database, {
      ownerId,
      function: 'narrateResult',
      providerId: aiProvider.providerId,
      model: aiProvider.model,
      estimatedTokens,
    });
    if (!quotaCheck.allowed) {
      return reply.code(429).send({ error: { code: 'QUOTA_EXCEEDED', message: quotaCheck.reason, retryAfter: quotaCheck.retryAfter } });
    }

    const callOptions: { requestId: string; signal?: AbortSignal } = { requestId: aiRequest.requestId };
    if (aiRequest.signal) callOptions.signal = aiRequest.signal;

    const startTime = performance.now();
    try {
      const result = await director.narrateResult(facts, callOptions);

      await recordUsage(database, {
        ownerId,
        function: 'narrateResult',
        providerId: aiProvider.providerId,
        model: aiProvider.model,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        latencyMs: Math.round(performance.now() - startTime),
        status: 'success',
        requestId: aiRequest.requestId,
      });

      return reply.send({ narrative: result });
    } catch (error) {
      const errorCode = error instanceof AiError ? error.code : undefined;
      await recordUsage(database, {
        ownerId,
        function: 'narrateResult',
        providerId: aiProvider.providerId,
        model: aiProvider.model,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        latencyMs: Math.round(performance.now() - startTime),
        status: error instanceof AiError ? (error.code === 'timeout' ? 'timeout' : error.code === 'cancelled' ? 'cancelled' : 'error') : 'error',
        ...(errorCode ? { errorCode } : {}),
        requestId: aiRequest.requestId,
      });
      throw error;
    }
  });

  // POST /api/v1/ai/converse
  app.post('/api/v1/ai/converse', { onRequest: async (request) => { await authorize(request); } }, async (request, reply) => {
    const ownerId = await authorize(request);
    const { provider: aiProvider, director } = await resolveFor(ownerId);
    const aiRequest = toConverseRequest(request.body);
    const facts = aiRequest.context.facts as PublicFact[];
    const memory = aiRequest.context.memory as ConversationMemory;

    const estimatedTokens = estimateTokens(JSON.stringify(aiRequest.context));

    const quotaCheck = await checkQuota(database, {
      ownerId,
      function: 'converse',
      providerId: aiProvider.providerId,
      model: aiProvider.model,
      estimatedTokens,
    });
    if (!quotaCheck.allowed) {
      return reply.code(429).send({ error: { code: 'QUOTA_EXCEEDED', message: quotaCheck.reason, retryAfter: quotaCheck.retryAfter } });
    }

    const callOptions: { requestId: string; signal?: AbortSignal } = { requestId: aiRequest.requestId };
    if (aiRequest.signal) callOptions.signal = aiRequest.signal;

    const startTime = performance.now();
    try {
      const result = await director.converse(
        { runId: aiRequest.context.runId as string, text: aiRequest.context.text as string, npc: aiRequest.context.npc as NpcContext, facts, memory, allowedActs: aiRequest.context.allowedActs as SpeechAct[] },
        callOptions
      );

      await recordUsage(database, {
        ownerId,
        function: 'converse',
        providerId: aiProvider.providerId,
        model: aiProvider.model,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        latencyMs: Math.round(performance.now() - startTime),
        status: 'success',
        requestId: aiRequest.requestId,
      });

      return reply.send({ narrative: result.narrative, memory: result.memory });
    } catch (error) {
      const errorCode = error instanceof AiError ? error.code : undefined;
      await recordUsage(database, {
        ownerId,
        function: 'converse',
        providerId: aiProvider.providerId,
        model: aiProvider.model,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        latencyMs: Math.round(performance.now() - startTime),
        status: error instanceof AiError ? (error.code === 'timeout' ? 'timeout' : error.code === 'cancelled' ? 'cancelled' : 'error') : 'error',
        ...(errorCode ? { errorCode } : {}),
        requestId: aiRequest.requestId,
      });
      throw error;
    }
  });

  // GET /api/v1/ai/health - health check del proveedor IA
  app.get('/api/v1/ai/health', { onRequest: async (request) => { await authorize(request); } }, async (request, reply) => {
    const ownerId = await authorize(request);
    const { provider: aiProvider } = await resolveFor(ownerId);
    const health = await aiProvider.healthCheck?.();
    return reply.send({ ai: health ?? { available: false, error: 'healthCheck no implementado' } });
  });
}
