import { hashDefinition } from '@meridiano/case-schema/server';
import { describe, expect, it } from 'vitest';
import { astrolabioDefinition, createInitialRun, projectToPlayerView } from './index.js';

function example() {
  return createInitialRun(astrolabioDefinition, 'owner-synthetic', 'run-synthetic', hashDefinition(astrolabioDefinition));
}

describe('proyección pública antes de conectar HTTP', () => {
  it('no serializa resultados futuros, campos adicionales ni datos privados del caso', () => {
    const run = example();
    run.pendingRequests = [{
      id: 'request-public', dueMinute: 300, type: 'SECRET_TYPE',
      payload: { solution: 'SECRET_FUTURE_RESULT' },
    }];
    Object.assign(run.position, { hidden: 'SECRET_POSITION' });
    Object.assign(run, { privateMarker: 'SECRET_RUN' });
    const view = projectToPlayerView(astrolabioDefinition, run);
    expect(view.pendingRequests).toEqual([{ id: 'request-public', dueMinute: 300 }]);
    const serialized = JSON.stringify(view);
    for (const secret of ['SECRET_', astrolabioDefinition.solution, 'npcRelations', 'definitionHash', 'ownerId']) {
      expect(serialized).not.toContain(secret);
    }
  });

  it('no muestra un informe antiguo al restaurar una rama activa', () => {
    const run = example();
    run.finalReport = { result: 'complete', objectivesAchieved: ['secret-objective'], reason: 'finished', minute: 50 };
    expect(projectToPlayerView(astrolabioDefinition, run).finalReport).toBeNull();
  });

  it('no permite modificar la partida mediante referencias a la vista', () => {
    const run = example();
    run.status = 'closed';
    run.pendingRequests = [{ id: 'request-public', dueMinute: 300, type: 'analysis', payload: {} }];
    run.finalReport = { result: 'complete', objectivesAchieved: ['objective-public'], reason: 'finished', minute: 50 };
    Object.assign(run.finalReport, { privateMarker: 'SECRET_REPORT' });
    const before = structuredClone(run);
    const view = projectToPlayerView(astrolabioDefinition, run);
    view.position.cityId = 'changed';
    const request = view.pendingRequests[0];
    if (!request || !view.finalReport) throw new Error('Missing public data');
    request.dueMinute = 0;
    view.dossier.push('changed');
    view.finalReport.objectivesAchieved.push('changed');
    expect(run).toEqual(before);
    expect(JSON.stringify(view)).not.toContain('SECRET_REPORT');
  });
});
