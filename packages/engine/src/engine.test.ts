import { describe, it, expect } from 'vitest';
import { createInitialRun, resolveAction, confirmAction, hashDefinition, projectToPlayerView } from './index.js';
import type { CaseDefinition } from '@meridiano/case-schema';

const def: CaseDefinition = {
  id: 'case-1',
  schemaVersion: 1,
  engineCompatibility: 1,
  contentVersion: 1,
  seed: 42,
  contentMode: 'fixed',
  difficulty: 'normal',
  explorationMode: 'guided',
  catalogVersion: '1.0',
  deadlineMinutes: 120,
  solution: 'suspect-a',
  objectives: [{ id: 'obj-1', description: 'Find suspect', achieved: false }],
  cities: [{ id: 'city-1', name: 'Madrid', country: 'ES' }],
  locations: [{ id: 'loc-1', cityId: 'city-1', name: 'Scene', description: 'Crime scene', accessible: true }],
  npcs: [{ id: 'npc-1', name: 'Witness', cityId: 'city-1', knowledge: ['fact-1'], cooperation: 5 }],
  facts: ['fact-1'],
  evidence: [{ id: 'ev-1', type: 'object', origin: 'loc-1', minute: 0, admissible: true, relations: [] }],
  rules: [],
  travelDurations: [{ fromCityId: 'city-1', toCityId: 'city-2', minutes: 30 }],
  scheduledResults: [],
  validationReport: { validatorVersion: '1.0.0', scenarios: [], errors: [], status: 'validated' },
};

describe('engine', () => {
  it('creates initial run at minute 0', () => {
    const run = createInitialRun(def, 'owner-1', 'run-1');
    expect(run.minute).toBe(0);
    expect(run.status).toBe('active');
    expect(run.version).toBe(1);
  });

  it('inspect reveals location', () => {
    const run = createInitialRun(def, 'owner-1', 'run-1');
    const result = resolveAction(def, run, { type: 'inspect', params: { targetId: 'loc-1' } });
    expect(result.status).toBe('applied');
    if (result.status === 'applied') {
      expect(result.run.discoveries).toContain('loc-1');
    }
  });

  it('collect adds to inventory', () => {
    const run = createInitialRun(def, 'owner-1', 'run-1');
    const result = resolveAction(def, run, { type: 'collect', params: { evidenceId: 'ev-1' } });
    expect(result.status).toBe('applied');
    if (result.status === 'applied') {
      expect(result.run.inventory).toContain('ev-1');
    }
  });

  it('travel requires confirmation', () => {
    const run = createInitialRun(def, 'owner-1', 'run-1');
    const result = resolveAction(def, run, { type: 'travel', params: { toCityId: 'city-2' } });
    expect(result.status).toBe('confirmation_required');
  });

  it('confirm travel advances minute', () => {
    const run = createInitialRun(def, 'owner-1', 'run-1');
    const result = confirmAction(def, run, { type: 'travel', params: { toCityId: 'city-2' } });
    expect(result.status).toBe('applied');
    if (result.status === 'applied') {
      expect(result.run.minute).toBeGreaterThanOrEqual(30);
      expect(result.run.position.cityId).toBe('city-2');
    }
  });

  it('finish closes case', () => {
    const run = createInitialRun(def, 'owner-1', 'run-1');
    const result = resolveAction(def, run, { type: 'finish', params: { confirmed: true } });
    expect(result.status).toBe('case_closed');
    if (result.status === 'case_closed') {
      expect(result.run.status).toBe('closed');
      expect(result.report.result).toBe('unresolved');
    }
  });

  it('hash is deterministic', () => {
    const h1 = hashDefinition(def);
    const h2 = hashDefinition(def);
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(64);
  });

  it('projectToPlayerView hides solution', () => {
    const run = createInitialRun(def, 'owner-1', 'run-1');
    const view = projectToPlayerView(def, run);
    expect(view).not.toHaveProperty('solution');
    expect(view.runId).toBe('run-1');
  });
});