import { hashDefinition } from '@meridiano/case-schema/server';
import { describe, expect, it } from 'vitest';
import { createInitialRun, resolveAction, confirmAction, canIssueWarrant, astrolabioDefinition } from './index.js';
import type { Action, ActionResult } from './index.js';
import type { CaseDefinition } from '@meridiano/case-schema';

// Único origen de estado: createInitialRun y resultados del motor. El helper
// representa aprobación explícita del jugador si el motor solicita confirmación.
function scenario(def: CaseDefinition = astrolabioDefinition) {
  let run = createInitialRun(def, 'synthetic-owner', 'synthetic-run', hashDefinition(def));
  function attempt(type: Action['type'], params: Action['params']): ActionResult {
    const action = { type, params };
    const before = structuredClone(run);
    let result = resolveAction(def, run, action);
    if (result.status === 'confirmation_required') {
      expect(result.run).toEqual(before);
      expect(result.events).toEqual([]);
      result = confirmAction(def, run, action);
    }
    if (result.status === 'applied' || result.status === 'case_closed') run = result.run;
    return result;
  }
  function step(type: Action['type'], params: Action['params']) {
    const result = attempt(type, params);
    if (result.status !== 'applied' && result.status !== 'case_closed') throw new Error('Unexpected action outcome: ' + type + '/' + result.status);
    return result;
  }
  return { step, attempt, read: () => structuredClone(run) };
}
type Scenario = ReturnType<typeof scenario>;
function prepareA(s: Scenario) {
  s.step('inspect', { targetId: 'MAD-SALA' });
  s.step('inspect', { targetId: 'MAD-SALA', elementId: 'cerradura' });
  s.step('collect', { evidenceId: 'EV-02' });
  s.step('analyze', { evidenceId: 'EV-02' });
  s.step('travel', { toCityId: 'paris' });
  s.step('query', { topicId: 'herramienta-hv17' });
  s.step('query', { topicId: 'traslado-ines' });
  s.step('wait', { minutes: 30 });
}
function order(s: Scenario, suspectId: string, evidenceIds: string[]) {
  s.step('request_warrant', { suspectId, evidenceIds });
  s.step('wait', { minutes: 30 });
}
function detain(s: Scenario, suspectId: 'ines' | 'tomas') {
  s.step('talk', { npcId: suspectId, topicId: 'identidad' });
  s.step('detain', { suspectId, warrantId: 'warrant:' + suspectId,
    locationId: suspectId === 'ines' ? 'LIS-ALM' : 'MAD-SALA', mode: 'interactive' });
}
function finishOriginal(s: Scenario) {
  detain(s, 'ines');
  s.step('recover', { objectId: 'astrolabio-original' });
  return s.step('finish', { confirmed: true });
}
function routeA(def: CaseDefinition) {
  const s = scenario(def); prepareA(s);
  order(s, 'ines', ['EV-03', 'EV-04', 'EV-05']);
  s.step('travel', { toCityId: 'lisboa' });
  finishOriginal(s);
  return s.read();
}
function routeB(def: CaseDefinition) {
  const s = scenario(def);
  s.step('inspect', { targetId: 'MAD-SALA' });
  s.step('inspect', { targetId: 'MAD-SALA', elementId: 'caja' });
  s.step('collect', { evidenceId: 'EV-06' });
  s.step('travel', { toCityId: 'paris' });
  s.step('query', { topicId: 'firma-sello' });
  s.step('wait', { minutes: 30 });
  s.step('travel', { toCityId: 'lisboa' });
  s.step('query', { topicId: 'custodia-envio' });
  s.step('wait', { minutes: 30 });
  order(s, 'ines', ['EV-06', 'EV-07', 'EV-08']);
  finishOriginal(s);
  return s.read();
}

function routeWithBatches(def: CaseDefinition, route: 'A' | 'B') {
  const s = scenario(def);
  const technical = route === 'A';
  const opening: Action[] = [
    { type: 'inspect', params: { targetId: 'MAD-SALA' } },
    { type: 'inspect', params: { targetId: 'MAD-SALA', elementId: technical ? 'cerradura' : 'caja' } },
    { type: 'collect', params: { evidenceId: technical ? 'EV-02' : 'EV-06' } },
  ];
  if (technical) opening.push({ type: 'analyze', params: { evidenceId: 'EV-02' } });
  s.step('batch', { steps: opening });
  s.step('travel', { toCityId: 'paris' });
  if (technical) s.step('batch', { steps: [
    { type: 'query', params: { topicId: 'herramienta-hv17' } },
    { type: 'query', params: { topicId: 'traslado-ines' } },
    { type: 'wait', params: { minutes: 30 } },
    { type: 'request_warrant', params: { suspectId: 'ines', evidenceIds: ['EV-03', 'EV-04', 'EV-05'] } },
    { type: 'wait', params: { minutes: 30 } },
  ] });
  else s.step('batch', { steps: [{ type: 'query', params: { topicId: 'firma-sello' } }, { type: 'wait', params: { minutes: 30 } }] });
  s.step('travel', { toCityId: 'lisboa' });
  if (!technical) s.step('batch', { steps: [
    { type: 'query', params: { topicId: 'custodia-envio' } }, { type: 'wait', params: { minutes: 30 } },
    { type: 'request_warrant', params: { suspectId: 'ines', evidenceIds: ['EV-06', 'EV-07', 'EV-08'] } },
    { type: 'wait', params: { minutes: 30 } },
  ] });
  finishOriginal(s);
  return s.read();
}

describe('T2: rutas por acciones, sin inyectar descubrimientos', () => {
  it.each([1, 42])('ruta A completa con semilla %s sin pruebas exclusivas B', seed => {
    const def = { ...astrolabioDefinition, seed,
      evidence: astrolabioDefinition.evidence.filter(evidence => !['EV-06', 'EV-07', 'EV-08'].includes(evidence.id)) };
    const run = routeA(def);
    expect(run.finalReport?.result).toBe('complete');
    expect(run.minute).toBe(seed === 1 ? 455 : 482);
    for (const id of ['EV-06', 'EV-07', 'EV-08']) expect([...run.discoveries, ...run.inventory]).not.toContain(id);
    expect(run.evidenceRecords?.['EV-03']).toMatchObject({ revealedMinute: 120, method: 'analyze', origin: 'MAD-SALA' });
    expect(run.position).toEqual({ cityId: 'lisboa', locationId: 'LIS-ALM' });
  });
  it.each([1, 42])('ruta B completa con semilla %s sin pruebas exclusivas A', seed => {
    const def = { ...astrolabioDefinition, seed,
      evidence: astrolabioDefinition.evidence.filter(evidence => !['EV-02', 'EV-03', 'EV-04', 'EV-05'].includes(evidence.id)) };
    const run = routeB(def);
    expect(run.finalReport?.result).toBe('complete');
    expect(run.minute).toBe(seed === 1 ? 485 : 512);
    for (const id of ['EV-02', 'EV-03', 'EV-04', 'EV-05']) expect([...run.discoveries, ...run.inventory]).not.toContain(id);
    expect(run.evidenceRecords?.['EV-07']?.method).toBe('query');
  });
  it('mismas acciones y semilla producen el mismo expediente de partida', () => {
    expect(routeA(astrolabioDefinition)).toEqual(routeA(astrolabioDefinition));
  });
  it('recoger una prueba oculta o inexistente no modifica el estado', () => {
    const s = scenario(); const before = s.read();
    for (const evidenceId of ['EV-02', 'EV-03', 'EV-11', 'unknown']) {
      expect(s.attempt('collect', { evidenceId })).toMatchObject({ status: 'impossible', run: before, events: [], reason: 'Evidencia no disponible.' });
    }
  });
  it('análisis no consume envío y revela únicamente al madurar', () => {
    const s = scenario();
    s.step('inspect', { targetId: 'MAD-SALA', elementId: 'cerradura' });
    s.step('collect', { evidenceId: 'EV-02' });
    const minute = s.read().minute;
    s.step('analyze', { evidenceId: 'EV-02' });
    expect(s.read().minute).toBe(minute);
    expect(s.read().discoveries).not.toContain('EV-03');
    s.step('wait', { minutes: 89 }); expect(s.read().discoveries).not.toContain('EV-03');
    s.step('wait', { minutes: 1 }); expect(s.read().discoveries).toContain('EV-03');
    expect(s.attempt('collect', { evidenceId: 'EV-03' }).status).toBe('impossible');
  });
  it('no acepta consultas arbitrarias, tipos coaccionados ni consultas desde otra ciudad', () => {
    const s = scenario(); const before = s.read();
    for (const params of [{ topicId: 'herramienta-hv17' }, { topicId: '__proto__' }, { topicId: 123 }, { topic: 'herramienta HV-17' }]) {
      expect(s.attempt('query', params)).toMatchObject({ status: 'impossible', run: before, events: [] });
    }
  });
  it('orden insuficiente se deniega después de 30 min sin cerrar ni consultar culpa', () => {
    const s = scenario();
    s.step('talk', { npcId: 'lucia', topicId: 'caja' });
    expect(s.read().discoveries).toContain('EV-09');
    s.step('request_warrant', { suspectId: 'tomas', evidenceIds: ['EV-09'] });
    s.step('wait', { minutes: 29 }); expect(s.read().warrants).toEqual([]);
    const result = s.step('wait', { minutes: 1 });
    expect(result.events.some(event => event.type === 'warrant_denied')).toBe(true);
    expect(s.read().warrants).toEqual([]);
    expect(s.read().status).toBe('active');
  });
  it('una orden de inocente puede concederse con hechos verdaderos y acabar en incorrect', () => {
    const s = scenario();
    s.step('talk', { npcId: 'lucia', topicId: 'caja' });
    s.step('query', { topicId: 'accesos-tomas' }); s.step('wait', { minutes: 30 });
    order(s, 'tomas', ['EV-09', 'EV-10']);
    detain(s, 'tomas');
    const result = s.step('finish', { confirmed: true });
    expect(result.run.finalReport?.result).toBe('incorrect');
  });
  it('no usa pruebas omitidas ni permite modificar la selección ya enviada', () => {
    const s = scenario(); prepareA(s);
    const selected = ['EV-03', 'EV-04'];
    s.step('request_warrant', { suspectId: 'ines', evidenceIds: selected });
    selected.push('EV-05');
    s.step('wait', { minutes: 30 });
    expect(s.read().warrants).toContain('warrant:ines');
    expect(s.read().warrants).not.toContain('warrant:access');
    order(s, 'ines', ['EV-03', 'EV-04', 'EV-05']);
    expect(s.read().warrants).toContain('warrant:access');
  });
  it('omitir una prueba necesaria no se suple con otras conocidas', () => {
    const s = scenario(); prepareA(s);
    order(s, 'ines', ['EV-03']);
    expect(s.read().warrants).not.toContain('warrant:ines');
  });
  it('la suficiencia no depende de la solución secreta', () => {
    const s = scenario(); prepareA(s);
    const altered = { ...astrolabioDefinition, solution: 'another-person' };
    expect(canIssueWarrant(altered, s.read(), 'ines', ['EV-03', 'EV-04'])).toBe(true);
    expect(canIssueWarrant(astrolabioDefinition, s.read(), 'ines', ['EV-03', 'EV-04'])).toBe(true);
  });
  it('no lava la inadmisibilidad de una fuente con el laboratorio', () => {
    const def = { ...astrolabioDefinition,
      evidence: astrolabioDefinition.evidence.map(evidence => evidence.id === 'EV-02' ? { ...evidence, admissible: false } : evidence) };
    const s = scenario(def); prepareA(s);
    expect(s.read().admissibility['EV-03']).toBe(false);
    order(s, 'ines', ['EV-03', 'EV-04', 'EV-05']);
    expect(s.read().warrants).not.toContain('warrant:ines');
  });
  it('no detiene sin confirmar identidad ni recupera por adivinar un objeto', () => {
    const s = scenario(); prepareA(s); order(s, 'ines', ['EV-03', 'EV-04', 'EV-05']);
    s.step('travel', { toCityId: 'lisboa' });
    expect(s.attempt('detain', { suspectId: 'ines', warrantId: 'warrant:ines', locationId: 'LIS-ALM', mode: 'interactive' }).status).toBe('impossible');
    expect(s.attempt('recover', { objectId: 'another-object' }).status).toBe('impossible');
    detain(s, 'ines');
    expect(s.step('finish', { confirmed: true }).run.finalReport?.result).toBe('partial');
  });
  it('plazo alcanzado no revela el registro situado exactamente en ese minuto', () => {
    const s = scenario({ ...astrolabioDefinition, deadlineMinutes: 30 });
    s.step('query', { topicId: 'accesos-tomas' });
    s.step('wait', { minutes: 30 });
    expect(s.read().status).toBe('closed');
    expect(s.read().discoveries).not.toContain('EV-10');
  });
  it('sin investigación el cierre confirmado es unresolved', () => {
    expect(scenario().step('finish', { confirmed: true }).run.finalReport?.result).toBe('unresolved');
  });
  it.each([{ route: 'A' as const, seed: 1 }, { route: 'A' as const, seed: 42 }, { route: 'B' as const, seed: 1 }, { route: 'B' as const, seed: 42 }])('ruta $route en lotes equivale a acciones sueltas, semilla $seed', ({ route, seed }) => {
    const excluded = route === 'A' ? ['EV-06', 'EV-07', 'EV-08'] : ['EV-02', 'EV-03', 'EV-04', 'EV-05'];
    const def = { ...astrolabioDefinition, seed, evidence: astrolabioDefinition.evidence.filter(evidence => !excluded.includes(evidence.id)) };
    const individual = route === 'A' ? routeA(def) : routeB(def);
    const batched = routeWithBatches(def, route);
    expect(batched.finalReport?.result).toBe('complete');
    expect(batched).toMatchObject({ minute: individual.minute, position: individual.position,
      discoveries: individual.discoveries, inventory: individual.inventory, admissibility: individual.admissibility,
      evidenceRecords: individual.evidenceRecords, warrants: individual.warrants, detentions: individual.detentions,
      recoveredObjects: individual.recoveredObjects, finalReport: individual.finalReport, pendingRequests: [], pendingBatch: null });
  });

});
