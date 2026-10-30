// Worker/cola PostgreSQL para generación (T4-04)
// Jobs persistentes con leases, deduplicación, cancelación y recuperación

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface GenerationJob {
  id: string;
  draftId: string;
  status: JobStatus;
  priority: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  leaseUntil?: string;
  workerId?: string;
  retryCount: number;
  error?: string;
  result?: unknown;
}

export interface JobQueue {
  enqueue(draftId: string, priority?: number): Promise<GenerationJob>;
  dequeue(workerId: string, leaseMs?: number): Promise<GenerationJob | null>;
  complete(jobId: string, result: unknown): Promise<void>;
  fail(jobId: string, error: string): Promise<void>;
  cancel(jobId: string): Promise<void>;
  getJob(jobId: string): Promise<GenerationJob | null>;
  listJobs(status?: JobStatus): Promise<GenerationJob[]>;
  recoverStale(leaseMs: number): Promise<number>;
}

export interface WorkerConfig {
  workerId: string | undefined;
  leaseMs: number;
  maxRetries: number;
  pollIntervalMs: number;
}

export const DEFAULT_WORKER_CONFIG: WorkerConfig = {
  workerId: `worker-${Date.now()}`,
  leaseMs: 30000,
  maxRetries: 3,
  pollIntervalMs: 1000,
};

export class InMemoryJobQueue implements JobQueue {
  private jobs: Map<string, GenerationJob> = new Map();
  private draftToJob: Map<string, string> = new Map();

  async enqueue(draftId: string, priority: number = 0): Promise<GenerationJob> {
    // Deduplicación: si ya existe un job para este draft, devolverlo
    const existingJobId = this.draftToJob.get(draftId);
    if (existingJobId) {
      const existing = this.jobs.get(existingJobId);
      if (existing && existing.status !== 'completed' && existing.status !== 'failed' && existing.status !== 'cancelled') {
        return existing;
      }
    }

    const job: GenerationJob = {
      id: `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      draftId,
      status: 'pending',
      priority,
      createdAt: new Date().toISOString(),
      retryCount: 0,
    };

    this.jobs.set(job.id, job);
    this.draftToJob.set(draftId, job.id);
    return job;
  }

  async dequeue(workerId: string, leaseMs: number = 30000): Promise<GenerationJob | null> {
    // Encontrar el job pendiente de mayor prioridad
    let candidate: GenerationJob | null = null;
    for (const job of this.jobs.values()) {
      if (job.status === 'pending') {
        if (!candidate || job.priority > candidate.priority) {
          candidate = job;
        }
      }
    }

    if (!candidate) return null;

    // Adquirir lease
    candidate.status = 'running';
    candidate.workerId = workerId;
    candidate.startedAt = new Date().toISOString();
    candidate.leaseUntil = new Date(Date.now() + leaseMs).toISOString();

    return candidate;
  }

  async complete(jobId: string, result: unknown): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error(`Job no encontrado: ${jobId}`);
    if (job.status !== 'running') throw new Error(`Job no está running: ${jobId}`);

    job.status = 'completed';
    job.completedAt = new Date().toISOString();
    job.result = result;
    delete job.leaseUntil;
  }

  async fail(jobId: string, error: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error(`Job no encontrado: ${jobId}`);

    job.retryCount++;
    if (job.retryCount >= 3) {
      job.status = 'failed';
      job.error = error;
      job.completedAt = new Date().toISOString();
    } else {
      job.status = 'pending';
      job.error = error;
      delete job.workerId;
      delete job.leaseUntil;
    }
  }

  async cancel(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error(`Job no encontrado: ${jobId}`);
    if (job.status === 'completed') throw new Error(`No se puede cancelar job completado: ${jobId}`);

    job.status = 'cancelled';
    job.completedAt = new Date().toISOString();
    delete job.leaseUntil;
  }

  async getJob(jobId: string): Promise<GenerationJob | null> {
    return this.jobs.get(jobId) || null;
  }

  async listJobs(status?: JobStatus): Promise<GenerationJob[]> {
    const jobs = Array.from(this.jobs.values());
    if (status) return jobs.filter(j => j.status === status);
    return jobs;
  }

  async recoverStale(_leaseMs: number): Promise<number> {
    const now = Date.now();
    let recovered = 0;

    for (const job of this.jobs.values()) {
      if (job.status === 'running' && job.leaseUntil) {
        const leaseTime = new Date(job.leaseUntil).getTime();
        if (now > leaseTime) {
          job.status = 'pending';
          delete job.workerId;
          delete job.leaseUntil;
          recovered++;
        }
      }
    }

    return recovered;
  }
}

export function createJobQueue(): JobQueue {
  return new InMemoryJobQueue();
}
