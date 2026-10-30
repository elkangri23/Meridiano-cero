// Prueba E2E del generador (T4-06)
// Generar → validar → simular → guardar

import { describe, it, expect } from 'vitest';
import { createInitialDraft, validateGenerationParams } from './pipeline.js';
import { createJobQueue } from './worker.js';
import { createExport, validateImport } from './import-export.js';
import { createFencingManager } from './fencing.js';

describe('Generator E2E (T4-06)', () => {
  it('validar parámetros de generación', () => {
    const result = validateGenerationParams({
      difficulty: 'normal',
      explorationMode: 'guided',
      duration: 'medium',
      surpriseMode: 'familiar',
      seed: 42,
    });
    expect(result.valid).toBe(true);
  });

  it('crear borrador inicial', () => {
    const draft = createInitialDraft({
      difficulty: 'normal',
      explorationMode: 'guided',
      duration: 'medium',
      surpriseMode: 'familiar',
      seed: 42,
    });
    expect(draft.id).toBeTruthy();
    expect(draft.status).toBe('draft');
    expect(draft.stages.length).toBe(9);
  });

  it('enqueue y dequeue job', async () => {
    const queue = createJobQueue();
    const job = await queue.enqueue('draft-1');
    expect(job.status).toBe('pending');

    const dequeued = await queue.dequeue('worker-1');
    expect(dequeued?.id).toBe(job.id);
    expect(dequeued?.status).toBe('running');
  });

  it('export e import con checksum', () => {
    const def = { id: 'case-1', schemaVersion: 1 };
    const metadata = { difficulty: 'normal', duration: 'medium', region: 'europa', seed: 42, catalogVersion: '1.0.0' };

    const exportResult = createExport(def, metadata);
    expect(exportResult.success).toBe(true);
    expect(exportResult.export?.checksum).toBeTruthy();

    const importResult = validateImport(exportResult.export);
    expect(importResult.success).toBe(true);
    expect(importResult.caseId).toBe('case-1');
  });

  it('fencing token validation', () => {
    const manager = createFencingManager();
    const token = manager.issueToken('job-1', 'worker-1', 30000);
    expect(manager.validateToken('job-1', token.token)).toBe(true);
    expect(manager.validateToken('job-1', 'invalid-token')).toBe(false);
  });

  it('terminal state marks job as terminal', () => {
    const manager = createFencingManager();
    manager.issueToken('job-1', 'worker-1', 30000);
    const terminal = manager.markTerminal('job-1', 'completed', 'validated');
    expect(terminal.reason).toBe('completed');
    expect(manager.isTerminal('job-1')).toBe(true);
  });
});
