// Rutas de generación de casos (T4-08): crear job, ver estado/progreso,
// cancelar. La generación es asíncrona: el POST crea el job en cola y el
// worker del proceso de la API lo ejecuta (proveedor del administrador);
// el cliente consulta el estado. El expediente solo aparece en el catálogo
// si pasa la validación v1.5 y la simulación de jugabilidad.
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { GENERATABLE_CRIMES } from '@meridiano/generator';
import { crimeAllowedForRating } from '@meridiano/case-schema';
import type { ContentRating, CrimeType, GenerationJobDto } from '@meridiano/contracts';
import type { AppConfig } from '../config.ts';
import type { Database } from '../database/connection.ts';
import { createSessionStore } from '../auth/store.ts';
import { cookieToken, matches } from '../auth/session-security.ts';
import { RunStoreError } from '../game/runs.ts';
import { GENERATION_LIMITS } from './limits.ts';
import { cancelJob, countJobsToday, createJob, getJob, hasActiveJob, listJobs, type GenerationJobRow } from './store.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toDto(row: GenerationJobRow): GenerationJobDto {
  return {
    jobId: row.id,
    status: row.status as GenerationJobDto['status'],
    stage: row.stage,
    crimeType: row.crimeType as CrimeType,
    contentRating: row.contentRating as ContentRating,
    duration: row.duration as GenerationJobDto['duration'],
    caseId: row.caseId,
    error: row.error,
    progress: (row.progress as Record<string, unknown>) ?? {},
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    startedAt: row.startedAt?.toISOString() ?? null,
    finishedAt: row.finishedAt?.toISOString() ?? null,
  };
}

function parseCrime(value: unknown): CrimeType {
  if (value === undefined) return 'aleatorio';
  if (typeof value !== 'string' || !(GENERATABLE_CRIMES as readonly string[]).includes(value)) {
    throw new RunStoreError('VALIDATION_ERROR', 'Delito no generable.');
  }
  return value as CrimeType;
}

function parseGenerationRating(value: unknown, crimeType: CrimeType): ContentRating {
  const contentRating = value === undefined ? 'familiar' : value;
  if (contentRating !== 'familiar' && contentRating !== 'general') throw new RunStoreError('VALIDATION_ERROR', 'Contenido no válido.');
  if (!crimeAllowedForRating(crimeType, contentRating as ContentRating)) {
    throw new RunStoreError('VALIDATION_ERROR', 'Ese delito solo se puede generar en General.');
  }
  return contentRating as ContentRating;
}

function parseDuration(value: unknown): 'short' | 'medium' | 'long' {
  const duration = value === undefined ? 'medium' : value;
  if (duration !== 'short' && duration !== 'medium' && duration !== 'long') throw new RunStoreError('VALIDATION_ERROR', 'Duración no válida.');
  return duration;
}

function parseSeed(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || (value as number) < 0) throw new RunStoreError('VALIDATION_ERROR', 'Semilla no válida.');
  return value as number;
}

function createBody(value: unknown): { crimeType: CrimeType; contentRating: ContentRating; duration: 'short' | 'medium' | 'long'; seed?: number } {
  if (!isRecord(value)) throw new RunStoreError('INVALID_REQUEST');
  const allowed = new Set(['crimeType', 'contentRating', 'duration', 'seed']);
  if (!Object.keys(value).every(key => allowed.has(key))) throw new RunStoreError('INVALID_REQUEST');
  const crimeType = parseCrime(value.crimeType);
  const contentRating = parseGenerationRating(value.contentRating, crimeType);
  const duration = parseDuration(value.duration);
  const seed = parseSeed(value.seed);
  return {
    // Sin delito elegido, el pipeline sortea entre los 12 (SORPRÉNDEME).
    crimeType,
    contentRating,
    duration,
    ...(seed !== undefined ? { seed } : {}),
  };
}

export function registerGenerationRoutes(app: FastifyInstance, config: AppConfig, database: Database, ready: () => Promise<boolean>): void {
  const store = createSessionStore(database);
  async function authorize(request: FastifyRequest): Promise<{ profileId: string }> {
    if (!await ready()) throw new RunStoreError('DEPENDENCY_UNAVAILABLE');
    const session = await store.find(cookieToken(request.headers.cookie));
    if (!session) throw new RunStoreError('SESSION_REQUIRED');
    if (request.method === 'POST') {
      if (request.headers.origin !== config.origin) throw new RunStoreError('ORIGIN_REJECTED');
      if (!matches(request.headers['x-csrf-token'], session.csrfToken)) throw new RunStoreError('CSRF_REJECTED');
    }
    return { profileId: session.profile.id };
  }

  app.post('/api/v1/generation/jobs', { onRequest: authorize }, async (request, reply) => {
    const owner = await authorize(request);
    const body = createBody(request.body);
    // Límites anti-abuso: un activo por usuario y tres al día. El índice
    // parcial de la migración 0008 refuerza el primero contra carreras.
    if (await hasActiveJob(database.orm, owner.profileId)) {
      throw new RunStoreError('GENERATION_LIMIT', 'Ya tienes una generación en curso. Espera a que termine o cancélala.');
    }
    if ((await countJobsToday(database.orm, owner.profileId)) >= GENERATION_LIMITS.maxJobsPerDayPerUser) {
      throw new RunStoreError('GENERATION_LIMIT', 'Has llegado al límite de 3 generaciones por día.');
    }
    const job = await createJob(database.orm, owner.profileId, body);
    return reply.code(201).send(toDto(job));
  });

  app.get('/api/v1/generation/jobs', { onRequest: authorize }, async request => {
    const owner = await authorize(request);
    const jobs = await listJobs(database.orm, owner.profileId);
    return { items: jobs.map(toDto) };
  });

  app.get<{ Params: { jobId: string } }>('/api/v1/generation/jobs/:jobId', { onRequest: authorize }, async request => {
    const owner = await authorize(request);
    const job = await getJob(database.orm, owner.profileId, request.params.jobId);
    if (!job) throw new RunStoreError('NOT_FOUND');
    return toDto(job);
  });

  app.post<{ Params: { jobId: string } }>('/api/v1/generation/jobs/:jobId/cancel', { onRequest: authorize }, async request => {
    const owner = await authorize(request);
    const result = await cancelJob(database.orm, owner.profileId, request.params.jobId);
    if (result === 'not_found') throw new RunStoreError('NOT_FOUND');
    if (result === 'terminal') throw new RunStoreError('VERSION_CONFLICT');
    const job = await getJob(database.orm, owner.profileId, request.params.jobId);
    if (!job) throw new RunStoreError('NOT_FOUND');
    return toDto(job);
  });
}
