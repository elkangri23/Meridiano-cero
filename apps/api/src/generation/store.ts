// Persistencia de jobs de generación y del catálogo publicado (T4-08).
// El worker reclama con lease: un solo proceso de API corre en el VPS, pero
// el lease impide el doble reclamo si algún día hay dos réplicas, y un job
// con el lease caducado vuelve a la cola desde su último checkpoint.
import { and, desc, eq, sql } from 'drizzle-orm';
import type { CaseDefinition } from '@meridiano/case-schema';
import { hashDefinition } from '@meridiano/case-schema/server';
import type { Database } from '../database/connection.ts';
import { generatedCases, generationJobs } from '../database/schema.ts';
import { GENERATION_LIMITS } from './limits.ts';

type Orm = Database['orm'];
export type GenerationJobRow = typeof generationJobs.$inferSelect;

export type JobStatus = 'queued' | 'running' | 'done' | 'failed' | 'cancelled';

export async function createJob(orm: Orm, ownerId: string, params: { crimeType: string; contentRating: string; duration: string; seed?: number }): Promise<GenerationJobRow> {
  const rows = await orm.insert(generationJobs).values({
    ownerId, status: 'queued', crimeType: params.crimeType, contentRating: params.contentRating,
    duration: params.duration, seed: params.seed ?? null, stage: 0, progress: {},
  }).returning();
  const row = rows[0];
  if (!row) throw new Error('JOB_CREATE_FAILED');
  return row;
}

export async function getJob(orm: Orm, ownerId: string, jobId: string): Promise<GenerationJobRow | null> {
  const rows = await orm.select().from(generationJobs)
    .where(and(eq(generationJobs.id, jobId), eq(generationJobs.ownerId, ownerId))).limit(1);
  return rows[0] ?? null;
}

export async function listJobs(orm: Orm, ownerId: string): Promise<GenerationJobRow[]> {
  return orm.select().from(generationJobs)
    .where(eq(generationJobs.ownerId, ownerId))
    .orderBy(desc(generationJobs.createdAt), desc(generationJobs.id));
}

export async function hasActiveJob(orm: Orm, ownerId: string): Promise<boolean> {
  const rows = await orm.select({ id: generationJobs.id }).from(generationJobs)
    .where(and(eq(generationJobs.ownerId, ownerId), sql`${generationJobs.status} IN ('queued', 'running')`)).limit(1);
  return rows.length > 0;
}

export async function countJobsToday(orm: Orm, ownerId: string): Promise<number> {
  const rows = await orm.select({ n: sql<string>`count(*)::text` }).from(generationJobs)
    .where(and(eq(generationJobs.ownerId, ownerId), sql`date_trunc('day', ${generationJobs.createdAt}) = date_trunc('day', now())`));
  return Number(rows[0]?.n ?? 0);
}

/** `claimJob` usa SQL crudo (`RETURNING *`): las claves vienen en
 * snake_case de la BD, no en camelCase de drizzle. Sin este mapa, el worker
 * leía `job.contentRating` como `undefined` y el pipeline rechazaba los
 * parámetros («surpriseMode es requerido») aunque el job estuviera bien. */
function mapJobRow(row: Record<string, unknown>): GenerationJobRow {
  return {
    id: row.id as string,
    ownerId: row.owner_id as string,
    status: row.status as JobStatus,
    crimeType: row.crime_type as string,
    contentRating: row.content_rating as string,
    duration: row.duration as string,
    seed: row.seed as number | null,
    stage: row.stage as number,
    progress: row.progress as Record<string, unknown>,
    draft: row.draft as Record<string, unknown> | null,
    caseId: row.case_id as string | null,
    error: row.error as string | null,
    leaseOwner: row.lease_owner as string | null,
    leaseExpiresAt: row.lease_expires_at as Date | null,
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
    startedAt: row.started_at as Date | null,
    finishedAt: row.finished_at as Date | null,
  };
}

/** Reclama el job en cola más antiguo (o uno en curso con el lease
 * caducado). Devuelve null si no hay trabajo o si otro worker lo reclamó. */
export async function claimJob(orm: Orm, workerId: string): Promise<GenerationJobRow | null> {
  const rows = await orm.execute(sql`
    UPDATE generation_jobs SET status = 'running', lease_owner = ${workerId},
      lease_expires_at = now() + (${GENERATION_LIMITS.leaseMinutes} || ' minutes')::interval,
      started_at = COALESCE(started_at, now()), updated_at = now()
    WHERE id = (
      SELECT id FROM generation_jobs
      WHERE status = 'queued'
         OR (status = 'running' AND lease_expires_at < now())
      ORDER BY created_at ASC, id ASC LIMIT 1 FOR UPDATE SKIP LOCKED
    ) RETURNING *`);
  const raw = (rows as unknown as { rows: Array<Record<string, unknown>> }).rows?.[0];
  return raw ? mapJobRow(raw) : null;
}

export async function updateJobProgress(orm: Orm, jobId: string, stage: number, progress: Record<string, unknown>, draft?: Record<string, unknown>): Promise<void> {
  await orm.update(generationJobs).set({
    stage, progress, ...(draft !== undefined ? { draft } : {}), updatedAt: new Date(),
  }).where(eq(generationJobs.id, jobId));
}

export async function finishJob(orm: Orm, jobId: string, status: Extract<JobStatus, 'done' | 'failed' | 'cancelled'>, detail?: { caseId?: string; error?: string }): Promise<void> {
  await orm.update(generationJobs).set({
    status, ...(detail?.caseId ? { caseId: detail.caseId } : {}),
    ...(detail?.error ? { error: detail.error } : {}),
    leaseOwner: null, leaseExpiresAt: null, finishedAt: new Date(), updatedAt: new Date(),
  }).where(eq(generationJobs.id, jobId));
}

export async function cancelJob(orm: Orm, ownerId: string, jobId: string): Promise<'cancelled' | 'not_found' | 'terminal'> {
  const job = await getJob(orm, ownerId, jobId);
  if (!job) return 'not_found';
  if (job.status === 'done' || job.status === 'failed' || job.status === 'cancelled') return 'terminal';
  await orm.update(generationJobs).set({
    status: 'cancelled', leaseOwner: null, leaseExpiresAt: null, finishedAt: new Date(), updatedAt: new Date(),
  }).where(eq(generationJobs.id, jobId));
  return 'cancelled';
}

/** Publica el expediente validado en el catálogo. La definición es
 * autocontenida; la fila guarda además el hash y los metadatos de búsqueda. */
export async function publishCase(orm: Orm, job: GenerationJobRow, definition: CaseDefinition): Promise<void> {
  const definitionHash = hashDefinition(definition);
  await orm.insert(generatedCases).values({
    caseId: definition.id,
    title: definition.briefing?.title ?? definition.id,
    crimeType: definition.catalogMeta?.crimeType ?? job.crimeType,
    contentRating: definition.catalogMeta?.contentRating ?? job.contentRating,
    duration: job.duration,
    definition: definition as unknown as Record<string, unknown>,
    definitionHash,
    jobId: job.id,
    createdBy: job.ownerId,
  }).onConflictDoNothing();
}
