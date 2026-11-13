// Objetivos en vivo (lote 2): el panel de la pantalla de juego enseña los
// objetivos con su estado sin esperar al cierre; la evaluación es la misma
// que usa el informe final (detenciones y objetos recuperados del motor).
import { describe, expect, it } from 'vitest';
import { hashDefinition } from '@meridiano/case-schema/server';
import { astrolabioDefinition } from './fixtures/case-astrolabio.js';
import { createInitialRun, generadoFraudeDefinition, knownSuspect, liveObjectives } from './index.js';
import { buildFinalReport, completeFinalReport, routeForReport } from './final-report.js';

function freshRun() {
  return createInitialRun(astrolabioDefinition, 'owner-1', 'run-1', hashDefinition(astrolabioDefinition));
}

function freshGeneratedRun() {
  return createInitialRun(generadoFraudeDefinition, 'owner-1', 'run-2', hashDefinition(generadoFraudeDefinition));
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

describe('informe final completo (GDD §12)', () => {
  it('la verdad del astrolabio nombra a Inés y al objeto, con las pruebas que la vinculan', () => {
    const report = buildFinalReport(astrolabioDefinition, freshRun(), 'finished');
    expect(report.truth.culpritId).toBe('ines-valera');
    expect(report.truth.culpritName).toBe('Inés Valera');
    expect(report.truth.objectId).toBe('astrolabio-original');
    expect(report.truth.objectLabel).toBe('el astrolabio original');
    expect(report.truth.keyEvidence.map(entry => entry.id)).toEqual(['EV-04', 'EV-05', 'EV-07', 'EV-08']);
    expect(report.truth.keyEvidence[0]?.text).toBe('El registro firmado asigna la herramienta HV-17 a Inés Valera.');
    expect(report.truth.keyEvidence[3]?.text).toBe('Hay un asiento independiente de recepción del envío por Inés, en el depósito L-7.');
  });

  it('cada prueba decisiva del astrolabio hace conocida a Inés (deriva con knownSuspect)', () => {
    const report = buildFinalReport(astrolabioDefinition, freshRun(), 'finished');
    for (const entry of report.truth.keyEvidence) {
      expect(knownSuspect(astrolabioDefinition, { ...freshRun(), discoveries: [entry.id] }, 'ines')).toBe(true);
    }
  });

  it('la verdad de un caso generado nombra a la responsable y al objeto, con la combinación de orden y la recuperación', () => {
    const report = buildFinalReport(generadoFraudeDefinition, freshGeneratedRun(), 'finished');
    expect(report.truth.culpritId).toBe('carmen');
    expect(report.truth.culpritName).toBe('Carmen');
    expect(report.truth.objectId).toBe('contrato-original');
    expect(report.truth.objectLabel).toBe('Recuperar el contrato original');
    expect(report.truth.keyEvidence.map(entry => entry.id)).toEqual(['EV-03', 'EV-04', 'EV-11']);
    expect(report.truth.keyEvidence[0]?.text).toBe('El análisis confirma que la factura rota pertenece a la serie F-17.');
  });

  it('las pruebas halladas y omitidas cubren todo el expediente sin inventar textos', () => {
    const run = { ...freshRun(), discoveries: ['EV-01', 'EV-02'] };
    const report = buildFinalReport(astrolabioDefinition, run, 'finished');
    expect(report.evidenceFound.map(entry => entry.id)).toEqual(['EV-01', 'EV-02']);
    expect(report.evidenceFound[0]?.text).toBe('La caja está a la vista. Su etiqueta remite al archivo de París.');
    // Las decisivas ya se enseñan en «Decisive evidence»: no se repiten
    // en «omitidas» (lote pequeños del catálogo 2026-11-10).
    expect(report.evidenceMissed.map(entry => entry.id)).toEqual(
      ['EV-03', 'EV-06', 'EV-09', 'EV-10', 'EV-11']);
    expect(report.evidenceMissed[0]?.text).toBe('La huella técnica es compatible con una herramienta de la serie HV-17. No acusa a nadie por sí sola.');
    const decisive = new Set(report.truth.keyEvidence.map(entry => entry.id));
    expect(report.evidenceMissed.some(entry => decisive.has(entry.id))).toBe(false);
  });

  it('en un caso generado las decisivas tampoco se repiten en omitidas', () => {
    const report = buildFinalReport(generadoFraudeDefinition, freshGeneratedRun(), 'finished');
    expect(report.truth.keyEvidence.map(entry => entry.id)).toEqual(['EV-03', 'EV-04', 'EV-11']);
    expect(report.evidenceFound).toEqual([]);
    expect(report.evidenceMissed.map(entry => entry.id)).toEqual(
      ['EV-01', 'EV-02', 'EV-05', 'EV-06', 'EV-07', 'EV-08', 'EV-09', 'EV-10']);
    const decisive = new Set(report.truth.keyEvidence.map(entry => entry.id));
    expect(report.evidenceMissed.some(entry => decisive.has(entry.id))).toBe(false);
  });

  it('las detenciones distinguen correcta y errónea, y si había orden', () => {
    const right = buildFinalReport(astrolabioDefinition,
      { ...freshRun(), detentions: ['ines'], warrants: ['warrant:ines'] }, 'finished');
    expect(right.detentions).toEqual([
      { suspectId: 'ines', suspectName: 'Inés Valera', correct: true, withWarrant: true },
    ]);
    const wrong = buildFinalReport(astrolabioDefinition,
      { ...freshRun(), detentions: ['tomas'], warrants: [] }, 'finished');
    expect(wrong.detentions).toEqual([
      { suspectId: 'tomas', suspectName: 'Tomás Ríos', correct: false, withWarrant: false },
    ]);
    expect(wrong.result).toBe('incorrect');
  });

  it('la puntuación de una partida resuelta suma objetivos, pruebas, detención y tiempo', () => {
    const solved = {
      ...freshRun(),
      minute: 455,
      discoveries: ['EV-01', 'EV-02', 'EV-03', 'EV-04', 'EV-05', 'EV-06', 'EV-07', 'EV-08', 'EV-09', 'EV-10', 'EV-11'],
      detentions: ['ines'],
      recoveredObjects: ['astrolabio-original'],
    };
    const report = buildFinalReport(astrolabioDefinition, solved, 'finished');
    expect(report.result).toBe('complete');
    expect(report.score).toEqual({
      total: 98,
      max: 100,
      breakdown: [
        { id: 'objectives', label: 'Objetivos logrados', points: 50, max: 50 },
        { id: 'evidence', label: 'Pruebas halladas', points: 25, max: 25 },
        { id: 'detention', label: 'Detención correcta', points: 15, max: 15 },
        { id: 'wrongDetentions', label: 'Detenciones erróneas', points: 0, max: 0 },
        { id: 'irregular', label: 'Conducta irregular', points: 0, max: 0 },
        { id: 'time', label: 'Tiempo restante', points: 8, max: 10 },
      ],
    });
  });

  it('una detención errónea resta y una partida sin resolver puntúa 0', () => {
    const wrong = buildFinalReport(astrolabioDefinition,
      { ...freshRun(), minute: 2880, detentions: ['tomas'] }, 'deadline');
    expect(wrong.result).toBe('incorrect');
    expect(wrong.score.total).toBe(0);
    expect(wrong.score.breakdown.find(entry => entry.label === 'Detenciones erróneas')).toEqual({ id: 'wrongDetentions', label: 'Detenciones erróneas', points: -20, max: 0 });
    const unresolved = buildFinalReport(astrolabioDefinition, { ...freshRun(), minute: 2880 }, 'deadline');
    expect(unresolved.result).toBe('unresolved');
    expect(unresolved.score.total).toBe(0);
    expect(unresolved.score.breakdown).toEqual([
      { id: 'objectives', label: 'Objetivos logrados', points: 0, max: 50 },
      { id: 'evidence', label: 'Pruebas halladas', points: 0, max: 25 },
      { id: 'detention', label: 'Detención correcta', points: 0, max: 15 },
      { id: 'wrongDetentions', label: 'Detenciones erróneas', points: 0, max: 0 },
      { id: 'irregular', label: 'Conducta irregular', points: 0, max: 0 },
      { id: 'time', label: 'Tiempo restante', points: 0, max: 10 },
    ]);
  });

  it('completeFinalReport reconstruye un informe antiguo de 4 campos', () => {
    const solved = {
      ...freshRun(),
      minute: 455,
      status: 'closed' as const,
      discoveries: ['EV-01', 'EV-02', 'EV-03', 'EV-04', 'EV-05', 'EV-06', 'EV-07', 'EV-08', 'EV-09', 'EV-10', 'EV-11'],
      detentions: ['ines'],
      recoveredObjects: ['astrolabio-original'],
      finalReport: {
        result: 'complete', objectivesAchieved: ['obj-detener', 'obj-recuperar'], reason: 'finished', minute: 455,
      } as unknown as ReturnType<typeof buildFinalReport>,
    };
    const report = completeFinalReport(astrolabioDefinition, solved);
    expect(report?.truth.culpritName).toBe('Inés Valera');
    expect(report?.score.total).toBe(98);
    expect(report?.evidenceFound).toHaveLength(11);
    expect(report?.evidenceMissed).toEqual([]);
    expect(report?.detentions[0]?.correct).toBe(true);
  });

  it('las pruebas halladas llevan procedencia y minuto; las omitidas, procedencia sin minuto', () => {
    const run = {
      ...freshRun(),
      discoveries: ['EV-01', 'EV-02'],
      evidenceRecords: {
        'EV-01': { revealedMinute: 10, origin: 'MAD-SALA', method: 'inspect' },
        'EV-02': { revealedMinute: 30, origin: 'MAD-SALA', method: 'inspect' },
      },
    };
    const report = buildFinalReport(astrolabioDefinition, run, 'finished');
    expect(report.evidenceFound).toEqual([
      { id: 'EV-01', text: 'La caja está a la vista. Su etiqueta remite al archivo de París.', origin: 'MAD-SALA', minute: 10 },
      { id: 'EV-02', text: 'La cerradura de la vitrina tiene residuo de herramienta.', origin: 'MAD-SALA', minute: 30 },
    ]);
    // Omitida: procedencia de la definición (dónde habría estado), sin
    // minuto — nunca se reveló y el minuto de la definición no es un hecho
    // de la partida.
    expect(report.evidenceMissed[0]).toEqual({
      id: 'EV-03',
      text: 'La huella técnica es compatible con una herramienta de la serie HV-17. No acusa a nadie por sí sola.',
      origin: 'MAD-SALA',
    });
  });

  it('la ruta recorre las ciudades visitadas con lo hecho en cada una', () => {
    const routed = {
      ...freshRun(),
      discoveries: ['MAD-SALA', 'travel:paris', 'PAR-ARCH', 'travel:lisboa', 'EV-01'],
      conversationRecords: ['talk:lucia@10', 'talk:emile@200', 'talk:lucia@15'],
      evidenceRecords: {
        'EV-01': { revealedMinute: 10, origin: 'MAD-SALA', method: 'inspect' },
        'EV-04': { revealedMinute: 200, origin: 'PAR-ARCH', method: 'inspect' },
      },
      position: { cityId: 'lisboa', locationId: 'LIS-ALM' },
    };
    expect(routeForReport(astrolabioDefinition, routed)).toEqual([
      { cityId: 'madrid', cityName: 'Madrid', arrivedMinute: null, inspected: ['Sala de embalaje'], talkedTo: ['Lucía'], evidenceIds: ['EV-01'] },
      { cityId: 'paris', cityName: 'París', arrivedMinute: null, inspected: ['Archivo de conservación'], talkedTo: ['Émile'], evidenceIds: ['EV-04'] },
      // Lisboa es ciudad de paso en este estado: se visitó (viaje + posición
      // final) aunque no se hiciera nada en ella; sus listas van vacías.
      { cityId: 'lisboa', cityName: 'Lisboa', arrivedMinute: null, inspected: [], talkedTo: [], evidenceIds: [] },
    ]);
    // La ruta también vive en el informe construido.
    expect(buildFinalReport(astrolabioDefinition, routed, 'finished').route).toHaveLength(3);
  });

  it('la ruta resuelve ciudades fuera del expediente con el catálogo geográfico', () => {
    const routed = {
      ...freshRun(),
      discoveries: ['travel:malaga'],
      conversationRecords: [],
      position: { cityId: 'malaga', locationId: 'MAL-SEGURIDAD' },
    };
    expect(routeForReport(astrolabioDefinition, routed)).toEqual([
      { cityId: 'madrid', cityName: 'Madrid', arrivedMinute: null, inspected: [], talkedTo: [], evidenceIds: [] },
      { cityId: 'malaga', cityName: 'Málaga', arrivedMinute: null, inspected: [], talkedTo: [], evidenceIds: [] },
    ]);
  });

  it('completeFinalReport reconstruye un informe guardado antes de la fase 4', () => {
    const solved = {
      ...freshRun(),
      minute: 455,
      status: 'closed' as const,
      discoveries: ['EV-01', 'EV-02', 'EV-03', 'EV-04', 'EV-05', 'EV-06', 'EV-07', 'EV-08', 'EV-09', 'EV-10', 'EV-11'],
      detentions: ['ines'],
      recoveredObjects: ['astrolabio-original'],
      evidenceRecords: {
        'EV-01': { revealedMinute: 10, origin: 'MAD-SALA', method: 'inspect' },
      },
    };
    // Informe con la forma anterior a la fase 4: desglose sin id/máximo y
    // sin ruta, pero completo por lo demás (como el guardado de una partida
    // cerrada el 2026-11-11).
    const oldStored = buildFinalReport(astrolabioDefinition, solved, 'finished');
    const legacy = {
      ...oldStored,
      route: undefined,
      score: {
        ...oldStored.score,
        breakdown: oldStored.score.breakdown.map(entry => ({ label: entry.label, points: entry.points })),
      },
      evidenceFound: oldStored.evidenceFound.map(entry => ({ id: entry.id, text: entry.text })),
    };
    const closed = { ...solved, finalReport: legacy as unknown as ReturnType<typeof buildFinalReport> };
    const report = completeFinalReport(astrolabioDefinition, closed);
    expect(report?.score.total).toBe(98);
    expect(report?.score.breakdown[0]).toEqual({ id: 'objectives', label: 'Objetivos logrados', points: 50, max: 50 });
    expect(report?.route?.map(city => city.cityId)).toEqual(['madrid']);
    expect(report?.evidenceFound[0]).toEqual({
      id: 'EV-01',
      text: 'La caja está a la vista. Su etiqueta remite al archivo de París.',
      origin: 'MAD-SALA',
      minute: 10,
    });
    // El resultado no cambia al reconstruir.
    expect(report?.result).toBe('complete');
  });

  it('completeFinalReport no muestra informe en partida activa y no deja modificar el guardado', () => {
    const run = freshRun();
    run.finalReport = buildFinalReport(astrolabioDefinition,
      { ...run, detentions: ['ines'], recoveredObjects: ['astrolabio-original'] }, 'finished');
    expect(completeFinalReport(astrolabioDefinition, run)).toBeNull();
    const closed = { ...run, status: 'closed' as const };
    const projected = completeFinalReport(astrolabioDefinition, closed);
    if (!projected) throw new Error('Missing report');
    projected.truth.culpritName = 'cambiado';
    projected.objectivesAchieved.push('cambiado');
    expect(closed.finalReport?.truth.culpritName).toBe('Inés Valera');
    expect(closed.finalReport?.objectivesAchieved).toEqual(['obj-detener', 'obj-recuperar']);
  });
});
