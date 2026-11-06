// Objetivos en vivo (lote 2): el panel de la pantalla de juego enseña los
// objetivos con su estado sin esperar al cierre; la evaluación es la misma
// que usa el informe final (detenciones y objetos recuperados del motor).
import { describe, expect, it } from 'vitest';
import { hashDefinition } from '@meridiano/case-schema/server';
import { astrolabioDefinition } from './fixtures/case-astrolabio.js';
import { createInitialRun, liveObjectives } from './index.js';
import { buildFinalReport } from './final-report.js';

function freshRun() {
  return createInitialRun(astrolabioDefinition, 'owner-1', 'run-1', hashDefinition(astrolabioDefinition));
}

describe('objetivos en vivo', () => {
  it('al empezar, ningún objetivo está logrado', () => {
    expect(liveObjectives(astrolabioDefinition, freshRun())).toEqual([]);
  });

  it('detener a la culpable logra obj-detener, y detener a otro no', () => {
    const detained = { ...freshRun(), detentions: ['ines'] };
    expect(liveObjectives(astrolabioDefinition, detained)).toEqual(['obj-detener']);
    const wrong = { ...freshRun(), detentions: ['tomas'] };
    expect(liveObjectives(astrolabioDefinition, wrong)).toEqual([]);
  });

  it('recuperar el astrolabio logra obj-recuperar', () => {
    const recovered = { ...freshRun(), recoveredObjects: ['astrolabio-original'] };
    expect(liveObjectives(astrolabioDefinition, recovered)).toEqual(['obj-recuperar']);
  });

  it('con los dos logrados, el informe final coincide con la evaluación en vivo', () => {
    const done = { ...freshRun(), detentions: ['ines'], recoveredObjects: ['astrolabio-original'] };
    expect(liveObjectives(astrolabioDefinition, done)).toEqual(['obj-detener', 'obj-recuperar']);
    expect(buildFinalReport(astrolabioDefinition, done, 'finished').objectivesAchieved)
      .toEqual(liveObjectives(astrolabioDefinition, done));
  });
});
