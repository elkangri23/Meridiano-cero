// Tests para worker/cola PostgreSQL (T4-04)

import { describe, it, expect } from 'vitest';
import { createJobQueue } from './worker.js';

describe('JobQueue', () => {
  it('enqueue and dequeue job', async () => {
    const queue = createJobQueue();
    await queue.enqueue('draft-1');
    await queue.enqueue('draft-2', 10);

    const dequeued = await queue.dequeue('worker-1');
    expect(dequeued).not.toBeNull();
    expect(dequeued?.status).toBe('running');
    expect(dequeued?.workerId).toBe('worker-1');
  });

  it('prevent duplicate enqueue for same draft', async () => {
    const queue = createJobQueue();
    const first = await queue.enqueue('draft-1');
    const second = await queue.enqueue('draft-1');
    expect(second.id).toBe(first.id);
    expect(second.status).toBe('pending');
  });

  it('complete job', async () => {
    const queue = createJobQueue();
    await queue.enqueue('draft-1');
    const dequeued = await queue.dequeue('worker-1');
    if (!dequeued) throw new Error('Expected job to be dequeued');

    await queue.complete(dequeued.id, { success: true });

    const completed = await queue.getJob(dequeued.id);
    expect(completed?.status).toBe('completed');
    expect(completed?.result).toEqual({ success: true });
  });

  it('fail job with retry limit', async () => {
    const queue = createJobQueue();
    await queue.enqueue('draft-1');
    const dequeued = await queue.dequeue('worker-1');
    if (!dequeued) throw new Error('Expected job to be dequeued');

    await queue.fail(dequeued.id, 'Error test');

    const failed = await queue.getJob(dequeued.id);
    expect(failed?.status).toBe('pending');
    expect(failed?.retryCount).toBe(1);
    expect(failed?.error).toBe('Error test');
  });

  it('cancel job', async () => {
    const queue = createJobQueue();
    await queue.enqueue('draft-1');
    const dequeued = await queue.dequeue('worker-1');
    if (!dequeued) throw new Error('Expected job to be dequeued');

    await queue.cancel(dequeued.id);

    const cancelled = await queue.getJob(dequeued.id);
    expect(cancelled?.status).toBe('cancelled');
  });

  it('recover stale jobs', async () => {
    const queue = createJobQueue();
    await queue.enqueue('draft-1');
    const dequeued = await queue.dequeue('worker-1', 100);
    if (!dequeued) throw new Error('Expected job to be dequeued');

    // Simular expiración del lease
    const stale = dequeued as any;
    stale.leaseUntil = new Date(Date.now() - 1000).toISOString();

    const recovered = await queue.recoverStale(0);
    expect(recovered).toBe(1);
    expect((await queue.getJob(dequeued.id))?.status).toBe('pending');
  });

  it('list jobs by status', async () => {
    const queue = createJobQueue();
    await queue.enqueue('draft-1');
    await queue.enqueue('draft-2');
    await queue.dequeue('worker-1');
    await queue.enqueue('draft-3');

    const pending = await queue.listJobs('pending');
    const all = await queue.listJobs();
    expect(pending.length).toBe(2);
    expect(all.length).toBe(3);
  });
});