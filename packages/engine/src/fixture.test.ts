import { hashDefinition } from '@meridiano/case-schema/server';
import { describe, it, expect } from 'vitest';
import { validateCaseDefinition } from '@meridiano/case-schema';
import { astrolabioDefinition, createInitialRun } from './index.js';

describe('astrolabio fixture', () => {
  it('passes validation', () => {
    const result = validateCaseDefinition(astrolabioDefinition);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('has hash and validated report', () => {
    const hash = hashDefinition(astrolabioDefinition);
    expect(hash).toHaveLength(64);
    expect(astrolabioDefinition.validationReport.status).toBe('validated');
  });

  it('contiene las evidencias de ambas rutas; la solvencia se prueba en simulation.test', () => {
    // Route A: EV-02, EV-03, EV-04, EV-05
    // Route B: EV-06, EV-07, EV-08
    const routeA = ['EV-02', 'EV-03', 'EV-04', 'EV-05'];
    const routeB = ['EV-06', 'EV-07', 'EV-08'];
    const allEvidence = astrolabioDefinition.evidence.map((e) => e.id);
    for (const id of [...routeA, ...routeB]) {
      expect(allEvidence).toContain(id);
    }
  });

  it('creates initial run', () => {
    const run = createInitialRun(astrolabioDefinition, 'owner-1', 'run-1', hashDefinition(astrolabioDefinition));
    expect(run.minute).toBe(0);
    expect(run.status).toBe('active');
    expect(run.definitionId).toBe('astrolabio-tres-ciudades');
  });

  it('has deadline of 2880 minutes', () => {
    expect(astrolabioDefinition.deadlineMinutes).toBe(2880);
  });

  it('has 5 NPCs', () => {
    expect(astrolabioDefinition.npcs).toHaveLength(5);
  });

  it('has 3 cities and 3 locations', () => {
    expect(astrolabioDefinition.cities).toHaveLength(3);
    expect(astrolabioDefinition.locations).toHaveLength(3);
  });
});
