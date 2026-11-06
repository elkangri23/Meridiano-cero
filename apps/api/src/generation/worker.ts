// Worker de generación (T4-08): vive DENTRO del proceso de la API, no en un
// contenedor aparte. El VPS corre una sola réplica de la API, así que no hace
// falta otro servicio que mantener; el reclamo por lease en PostgreSQL impide
// el doble reclamo si algún día hay dos réplicas, y un job con el lease
// caducado vuelve a la cola desde su último checkpoint (el borrador vive en
// la fila del job). El worker no arranca en los tests: lo arranca el servidor
// al levantar (ver app.ts).
import { randomUUID } from 'node:crypto';
import type { AppConfig } from '../config.ts';
import type { Database } from '../database/connection.ts';
import { buildAdminProvider } from '../ai/provider-factory.ts';
import { createGeneratorService, type CaseDraft, type CheckpointStore, type GenerationParams } from '@meridiano/generator';
import { GENERATION_LIMITS } from './limits.ts';
import { createStageLlm } from './llm.ts';
import { claimJob, finishJob, getJob, publishCase, updateJobProgress } from './store.ts';

export interface GenerationWorker {
  stop(): void;
}

function progressOf(draft: CaseDraft): Record<string, unknown> {
  return {
    stage: draft.currentStage,
    status: draft.status,
    stages: draft.stages.map(stage => ({ stage: stage.stage, name: stage.name, status: stage.status })),
    ...(draft.error ? { error: draft.error } : {}),
  };
}

export function startGenerationWorker(database: Database, config: AppConfig): GenerationWorker {
  const workerId = randomUUID();
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;

  async function runOneJob(): Promise<void> {
    const job = await claimJob(database.orm, workerId);
    if (!job) return;
    const startedAt = Date.now();
    try {
      const store: CheckpointStore = {
        async save(draft: CaseDraft): Promise<void> {
          // Cancelación cooperativa: si el usuario canceló el job mientras
          // el pipeline corría, el checkpoint lo rechaza y el pipeline para.
          const current = await getJob(database.orm, job.ownerId, job.id);
          if (!current || current.status === 'cancelled') throw new Error('JOB_CANCELLED');
          if (Date.now() - startedAt > GENERATION_LIMITS.jobWallClockMinutes * 60 * 1000) throw new Error('JOB_WALL_CLOCK_EXCEEDED');
          await updateJobProgress(database.orm, job.id, draft.currentStage, progressOf(draft), draft as unknown as Record<string, unknown>);
        },
        async load(): Promise<CaseDraft | null> {
          const current = await getJob(database.orm, job.ownerId, job.id);
          return (current?.draft as unknown as CaseDraft) ?? null;
        },
        async list(): Promise<CaseDraft[]> { return []; },
        async delete(): Promise<void> { /* el borrador vive en la fila del job */ },
      };
      const llm = createStageLlm(buildAdminProvider(config));
      const service = createGeneratorService({
        maxRetriesPerStage: GENERATION_LIMITS.maxAttemptsPerStage,
        stageTimeoutMs: GENERATION_LIMITS.stageTimeoutMs,
        enableSemanticReview: true,
        enableSimulation: true,
        checkpointStore: store,
        llm,
        caseId: `generado-${job.id.slice(0, 8)}`,
      });
      const params: GenerationParams = {
        crimeType: job.crimeType as Exclude<GenerationParams['crimeType'], undefined>,
        difficulty: 'normal',
        explorationMode: 'guided',
        duration: job.duration as GenerationParams['duration'],
        region: 'global',
        surpriseMode: job.contentRating as GenerationParams['surpriseMode'],
        ...(job.seed !== null ? { seed: job.seed } : {}),
      };
      const draft = await service.createDraft(params);
      const result = await service.runPipeline(draft.id);
      if (result.success && result.definition) {
        await publishCase(database.orm, job, result.definition);
        await finishJob(database.orm, job.id, 'done', { caseId: result.definition.id });
      } else {
        await finishJob(database.orm, job.id, 'failed', { error: result.error ?? 'La generación no produjo un expediente válido.' });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido.';
      if (message === 'JOB_CANCELLED') {
        // El usuario ya lo canceló: la fila ya está en 'cancelled'.
        return;
      }
      await finishJob(database.orm, job.id, 'failed', { error: message }).catch(() => undefined);
    }
  }

  async function tick(): Promise<void> {
    if (stopped) return;
    try { await runOneJob(); } catch { /* el reclamo fallido se reintenta en el siguiente tick */ }
    if (!stopped) timer = setTimeout(() => { void tick(); }, GENERATION_LIMITS.pollIntervalMs);
  }

  void tick();
  return {
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
  };
}
