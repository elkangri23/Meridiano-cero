import { hashDefinition } from '@meridiano/case-schema/server';
import { acceptAction as resolveAction } from './test-actions.js';
import { describe, it, expect } from 'vitest';
import { createInitialRun } from './index.js';
import { astrolabioDefinition } from './fixtures/case-astrolabio.js';

describe('inspect/collect/talk', () => {
  it('inspect general reveals location', () => {
    const run = createInitialRun(astrolabioDefinition, 'owner-1', 'run-1', hashDefinition(astrolabioDefinition));
    const result = resolveAction(astrolabioDefinition, run, { type: 'inspect', params: { targetId: 'MAD-SALA' } });
    expect(result.status).toBe('applied');
    if (result.status === 'applied') {
      expect(result.run.discoveries).toContain('MAD-SALA');
    }
  });

  it('inspect specific with elementId', () => {
    const run = createInitialRun(astrolabioDefinition, 'owner-1', 'run-1', hashDefinition(astrolabioDefinition));
    const result = resolveAction(astrolabioDefinition, run, { type: 'inspect', params: { targetId: 'MAD-SALA', elementId: 'cerradura' } });
    expect(result.status).toBe('applied');
  });

  it('collect adds a visible physical evidence with admissibility', () => {
    const initial = createInitialRun(astrolabioDefinition, 'owner-1', 'run-1', hashDefinition(astrolabioDefinition));
    const inspected = resolveAction(astrolabioDefinition, initial, { type: 'inspect', params: { targetId: 'MAD-SALA', elementId: 'cerradura' } });
    const result = resolveAction(astrolabioDefinition, inspected.run, { type: 'collect', params: { evidenceId: 'EV-02' } });
    expect(result.status).toBe('applied');
    expect(result.run.inventory).toContain('EV-02');
    expect(result.run.admissibility['EV-02']).toBe(true);
  });

  it('collect duplicate is impossible without applying anything', () => {
    const initial = createInitialRun(astrolabioDefinition, 'owner-1', 'run-1', hashDefinition(astrolabioDefinition));
    const inspected = resolveAction(astrolabioDefinition, initial, { type: 'inspect', params: { targetId: 'MAD-SALA', elementId: 'cerradura' } });
    const collected = resolveAction(astrolabioDefinition, inspected.run, { type: 'collect', params: { evidenceId: 'EV-02' } });
    expect(collected.status).toBe('applied');
    const duplicate = resolveAction(astrolabioDefinition, collected.run, { type: 'collect', params: { evidenceId: 'EV-02' } });
    expect(duplicate).toMatchObject({ status: 'impossible', run: collected.run, events: [] });
  });

  it('talk records conversation', () => {
    const run = createInitialRun(astrolabioDefinition, 'owner-1', 'run-1', hashDefinition(astrolabioDefinition));
    const result = resolveAction(astrolabioDefinition, run, { type: 'talk', params: { npcId: 'lucia' } });
    expect(result.status).toBe('applied');
    if (result.status === 'applied') {
      expect(result.run.conversationRecords).toHaveLength(1);
      expect(result.run.npcRelations['lucia']).toBe(7);
    }
  });

  it('talk to unknown NPC is impossible', () => {
    const run = createInitialRun(astrolabioDefinition, 'owner-1', 'run-1', hashDefinition(astrolabioDefinition));
    const result = resolveAction(astrolabioDefinition, run, { type: 'talk', params: { npcId: 'unknown' } });
    expect(result.status).toBe('impossible');
  });
});

describe('batch sequences', () => {
  it('batch executes multiple steps', () => {
    const run = createInitialRun(astrolabioDefinition, 'owner-1', 'run-1', hashDefinition(astrolabioDefinition));
    const result = resolveAction(astrolabioDefinition, run, {
      type: 'batch',
      params: {
        steps: [
          { type: 'inspect', params: { targetId: 'MAD-SALA', elementId: 'cerradura' } },
          { type: 'collect', params: { evidenceId: 'EV-02' } },
        ],
      },
    });
    expect(result.status).toBe('applied');
    if (result.status === 'applied') {
      expect(result.run.discoveries).toContain('MAD-SALA');
      expect(result.run.inventory).toContain('EV-02');
    }
  });

  it('batch pauses on impossible step', () => {
    const run = createInitialRun(astrolabioDefinition, 'owner-1', 'run-1', hashDefinition(astrolabioDefinition));
    const result = resolveAction(astrolabioDefinition, run, {
      type: 'batch',
      params: {
        steps: [
          { type: 'inspect', params: { targetId: 'MAD-SALA' } },
          { type: 'collect', params: { evidenceId: 'EV-999' } }, // impossible
          { type: 'talk', params: { npcId: 'lucia' } },
        ],
      },
    });
    expect(result.status).toBe('batch_paused');
    if (result.status === 'batch_paused') {
      expect(result.run.discoveries).toContain('MAD-SALA');
      expect(result.run.pendingBatch).not.toBeNull();
    }
  });

  it('cancel rest of paused batch', () => {
    const run = createInitialRun(astrolabioDefinition, 'owner-1', 'run-1', hashDefinition(astrolabioDefinition));
    const paused = resolveAction(astrolabioDefinition, run, {
      type: 'batch',
      params: {
        steps: [
          { type: 'inspect', params: { targetId: 'MAD-SALA' } },
          { type: 'collect', params: { evidenceId: 'EV-999' } },
        ],
      },
    });
    if (paused.status === 'batch_paused') {
      const cancelled = resolveAction(astrolabioDefinition, paused.run, {
        type: 'batch_decision',
        params: { decision: 'cancel' },
      });
      expect(cancelled.status).toBe('applied');
      if (cancelled.status === 'applied') {
        expect(cancelled.run.pendingBatch).toBeNull();
      }
    }
  });

  it('continue independent steps after pause', () => {
    const run = createInitialRun(astrolabioDefinition, 'owner-1', 'run-1', hashDefinition(astrolabioDefinition));
    const paused = resolveAction(astrolabioDefinition, run, {
      type: 'batch',
      params: {
        steps: [
          { type: 'inspect', params: { targetId: 'MAD-SALA' } },
          { type: 'collect', params: { evidenceId: 'EV-999' } }, // impossible
          { type: 'talk', params: { npcId: 'lucia' } }, // independent, should run
        ],
        dependencies: [[], [], []],
      },
    });
    if (paused.status === 'batch_paused') {
      const continued = resolveAction(astrolabioDefinition, paused.run, {
        type: 'batch_decision',
        params: { decision: 'continue_independent' },
      });
      expect(continued.status).toBe('applied');
      if (continued.status === 'applied') {
        expect(continued.run.conversationRecords).toHaveLength(1);
        expect(continued.run.pendingBatch).toBeNull();
      }
    }
  });

  it('batch with no steps is impossible', () => {
    const run = createInitialRun(astrolabioDefinition, 'owner-1', 'run-1', hashDefinition(astrolabioDefinition));
    const result = resolveAction(astrolabioDefinition, run, {
      type: 'batch',
      params: { steps: [] },
    });
    expect(result.status).toBe('impossible');
  });

  it('batch with nine steps is rejected without executing a prefix', () => {
    const run = createInitialRun(astrolabioDefinition, 'owner-1', 'run-1', hashDefinition(astrolabioDefinition));
    const steps = Array.from({ length: 9 }, () => ({ type: 'inspect', params: { targetId: 'MAD-SALA' } }));
    const result = resolveAction(astrolabioDefinition, run, {
      type: 'batch',
      params: { steps },
    });
    expect(result.status).toBe('impossible');
    expect(result.run).toEqual(run);
    expect(result.events).toEqual([]);
  });

  it('batch decision without pending batch is impossible', () => {
    const run = createInitialRun(astrolabioDefinition, 'owner-1', 'run-1', hashDefinition(astrolabioDefinition));
    const result = resolveAction(astrolabioDefinition, run, {
      type: 'batch_decision',
      params: { decision: 'cancel' },
    });
    expect(result.status).toBe('impossible');
  });
});
