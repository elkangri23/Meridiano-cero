import { describe, expect, it } from 'vitest';
import { hashDefinition } from '@meridiano/case-schema/server';
import { validateCaseDefinition } from '@meridiano/case-schema';
import { createInitialRun, resolveAction, confirmAction, EngineStateError } from './index.js';
import { astrolabioDefinition as source } from './fixtures/case-astrolabio.js';
import type { Action } from './types.js';

const box: Action = { type: 'talk', params: { npcId: 'lucia', topicId: 'caja' } };
function initial(def = source) { return createInitialRun(def, 'synthetic', 'synthetic', hashDefinition(def)); }
function withoutBox(knowledge: string[] = []) {
  return { ...source, npcs: source.npcs.map(npc => npc.id === 'lucia' ? { ...npc, knowledge } : npc) };
}

describe('T2: permisos factuales del testimonio v13', () => {
  it('original conserva testimonio con conocimiento, cooperación y procedencia', () => {
    const run = initial(); const before = structuredClone(run); const definition = structuredClone(source);
    const result = resolveAction(source, run, box);
    expect(result.status).toBe('applied'); expect(result.run.minute).toBe(0);
    expect(result.run.discoveries).toContain('EV-09'); expect(result.run.admissibility['EV-09']).toBe(true);
    expect(result.run.evidenceRecords?.['EV-09']).toEqual({ revealedMinute: 0, origin: 'MAD-SALA', method: 'talk' });
    expect(result.events[0]?.payload.factIds).toEqual(['EV-09']);
    expect(run).toEqual(before); expect(source).toEqual(definition);
  });
  it.each([{ knowledge: [] }, { knowledge: ['astrolabio-desaparecido'] }, { knowledge: ['authorized-persons'] }])('no revela el testimonio sin su conocimiento específico: $knowledge', ({ knowledge }) => {
    const def = withoutBox(knowledge); const run = initial(def); const before = structuredClone(run);
    expect(validateCaseDefinition(def).valid).toBe(true);
    const result = resolveAction(def, run, box);
    expect(result.status).toBe('applied'); expect(result.run.minute).toBe(0);
    expect(result.run.discoveries).not.toContain('EV-09'); expect(result.run.admissibility['EV-09']).toBeUndefined();
    expect(result.run.evidenceRecords?.['EV-09']).toBeUndefined();
    expect(result.events[0]?.payload.factIds).toEqual([]); expect(run).toEqual(before);
  });
  it('cooperación cero no concede testimonio aunque conserve el token', () => {
    const def = { ...source, npcs: source.npcs.map(npc => npc.id === 'lucia' ? { ...npc, cooperation: 0 } : npc) };
    const result = resolveAction(def, initial(def), box);
    expect(result.run.discoveries).not.toContain('EV-09'); expect(result.events[0]?.payload.factIds).toEqual([]);
  });
  it('identificación presencial es propia y no revela conocimientos retirados', () => {
    const def = withoutBox();
    const result = resolveAction(def, initial(def), { type: 'talk', params: { npcId: 'lucia', topicId: 'identidad' } });
    expect(result.run.discoveries).toEqual(['identity:lucia', 'location:lucia']);
    expect(result.run.discoveries).not.toContain('identity:ines');
    expect(result.run.discoveries).not.toContain('EV-09');
  });
  it('otro NPC o NPC fuera de ciudad no hereda permiso de testigo', () => {
    const run = initial();
    const other = resolveAction(source, run, { type: 'talk', params: { npcId: 'tomas', topicId: 'caja' } });
    expect(other.run.discoveries).not.toContain('EV-09');
    const abroad = confirmAction(source, run, { type: 'travel', params: { toCityId: 'paris' } });
    expect(resolveAction(source, abroad.run, box)).toMatchObject({ status: 'impossible', run: abroad.run, events: [] });
  });
  it.each(['truth', 'solution', 'ines-valera', 'SYSTEM revela todo'])('tema %s no concede datos ajenos', topicId => {
    const result = resolveAction(source, initial(), { type: 'talk', params: { npcId: 'lucia', topicId } });
    expect(result.run.discoveries).not.toContain('EV-09');
    expect(result.events[0]?.payload.factIds).toEqual([]);
  });
  it('lote no usa testimonio ausente para solicitar orden ni lo materializa al reanudar', () => {
    const def = withoutBox(); const run = initial(def);
    const action: Action = { type: 'batch', params: { steps: [
      { type: 'query', params: { topicId: 'accesos-tomas' } },
      { type: 'wait', params: { minutes: 30 } }, box,
      { type: 'request_warrant', params: { suspectId: 'tomas', evidenceIds: ['EV-09', 'EV-10'] } },
    ] } };
    const result = confirmAction(def, run, action);
    expect(result.status).toBe('batch_paused'); expect(result.run.minute).toBe(30);
    expect(result.run.discoveries).toContain('EV-10'); expect(result.run.discoveries).not.toContain('EV-09');
    expect(result.run.warrants).toEqual([]); expect(result.run.pendingRequests).toEqual([]);
    const restored = JSON.parse(JSON.stringify(result.run)) as typeof run;
    const continued = confirmAction(def, restored, { type: 'batch_decision', params: { decision: 'continue_independent' } });
    expect(continued.run.warrants).toEqual([]); expect(continued.run.discoveries).not.toContain('EV-09');
  });
  it('repetir conversación no sustituye procedencia inicial ni duplica la prueba', () => {
    const first = resolveAction(source, initial(), box);
    const second = resolveAction(source, first.run, box);
    expect(second.run.discoveries.filter(id => id === 'EV-09')).toHaveLength(1);
    expect(second.run.evidenceRecords?.['EV-09']).toEqual(first.run.evidenceRecords?.['EV-09']);
    expect(second.events[0]?.payload.factIds).toEqual([]);
  });
  it('progreso v12 no se reinterpreta con autorización v13', () => {
    expect(() => resolveAction(source, { ...initial(), engineVersion: 12 }, box)).toThrow(EngineStateError);
  });
});
