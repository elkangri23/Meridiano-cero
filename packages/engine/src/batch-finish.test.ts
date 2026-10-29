import { describe, expect, it } from 'vitest';
import { hashDefinition } from '@meridiano/case-schema/server';
import { createInitialRun, resolveAction, confirmAction, EngineStateError } from './index.js';
import { astrolabioDefinition as source } from './fixtures/case-astrolabio.js';
import type { Action } from './types.js';

const finish: Action = { type: 'finish', params: {} };
const talk: Action = { type: 'talk', params: { npcId: 'lucia' } };
const impossible: Action = { type: 'collect', params: { evidenceId: 'EV-unknown' } };
const proceed: Action = { type: 'batch_decision', params: { decision: 'continue_independent' } };
function batch(steps: Action[], dependencies?: number[][]): Action {
  return { type: 'batch', params: { steps, ...(dependencies ? { dependencies } : {}) } };
}
function initial(def = source) { return createInitialRun(def, 'synthetic', 'synthetic', hashDefinition(def)); }

describe('T2: cierre confirmado en lotes v11', () => {
  it('cierre de coste cero exige preview sin efectos, informe ni solución prospectiva', () => {
    const run = initial(); const before = structuredClone(run);
    const preview = resolveAction(source, run, batch([finish]));
    expect(preview).toMatchObject({ status: 'confirmation_required', run: before, events: [], preview: { estimatedMinutes: 0, estimatedEndTime: 0 } });
    expect(Object.keys(preview).sort()).toEqual(['events', 'preview', 'run', 'status']);
    if (preview.status !== 'confirmation_required') throw new Error('Missing confirmation');
    expect(preview.preview.description).toContain('cierre del caso');
    expect(run).toEqual(before);
    const result = confirmAction(source, run, batch([finish]));
    expect(result).toMatchObject({ status: 'case_closed', report: { result: 'unresolved', reason: 'finished', minute: 0 } });
    expect(result.run.pendingBatch).toBeNull();
    expect(result.events.map(event => event.type)).toEqual(['finish']);
  });
  it('cierra tras el prefijo y descarta acciones posteriores sin coste ni eventos', () => {
    const run = initial(); const action = batch([talk, finish, { type: 'wait', params: { minutes: 100 } }, talk]);
    expect(resolveAction(source, run, action).status).toBe('confirmation_required');
    const result = confirmAction(source, run, action);
    expect(result.status).toBe('case_closed'); expect(result.run.minute).toBe(0);
    expect(result.run.conversationRecords).toHaveLength(1);
    expect(result.events.map(event => event.type)).toEqual(['talk', 'finish']);
    const first = confirmAction(source, run, talk);
    expect(result.run).toEqual(confirmAction(source, first.run, { type: 'finish', params: {} }).run);
  });
  it('finish dependiente de fallo se omite sin cerrar', () => {
    const paused = confirmAction(source, initial(), batch([impossible, finish]));
    expect(paused.status).toBe('batch_paused');
    const result = confirmAction(source, paused.run, proceed);
    expect(result.status).toBe('applied'); expect(result.run.status).toBe('active');
    expect(result.run.finalReport).toBeNull(); expect(result.run.pendingBatch).toBeNull();
    expect(result.events.map(event => event.type)).toEqual(['batch_step_skipped', 'batch_completed']);
  });
  it('finish independiente tras pausa/serialización requiere otra confirmación y no repite prefijo', () => {
    const paused = confirmAction(source, initial(), batch([talk, impossible, finish], [[], [], []]));
    expect(paused.status).toBe('batch_paused');
    const saved = JSON.parse(JSON.stringify(paused.run)) as typeof paused.run;
    const preview = resolveAction(source, saved, proceed);
    expect(preview).toMatchObject({ status: 'confirmation_required', run: saved, events: [], preview: { estimatedMinutes: 0 } });
    if (preview.status !== 'confirmation_required') throw new Error('Missing confirmation');
    expect(preview.preview.description).toContain('cierre del caso');
    const result = confirmAction(source, saved, proceed);
    expect(result.status).toBe('case_closed'); expect(result.run.conversationRecords).toHaveLength(1);
    expect(result.events.map(event => event.type)).toEqual(['finish']);
    expect(result.run.pendingBatch).toBeNull();
  });
  it('cancelar el pendiente conserva prefijo y no ejecuta cierre', () => {
    const paused = confirmAction(source, initial(), batch([talk, impossible, finish], [[], [], []]));
    const result = resolveAction(source, paused.run, { type: 'batch_decision', params: { decision: 'cancel' } });
    expect(result.run.status).toBe('active'); expect(result.run.finalReport).toBeNull();
    expect(result.run.conversationRecords).toHaveLength(1); expect(result.run.pendingBatch).toBeNull();
    expect(result.events.map(event => event.type)).toEqual(['batch_cancelled']);
  });
  it('vencimiento anterior a finish prevalece y no materializa resultado pendiente al plazo', () => {
    const def = { ...source, deadlineMinutes: 30 }; const run = initial(def);
    const action = batch([{ type: 'query', params: { topicId: 'accesos-tomas' } }, { type: 'wait', params: { minutes: 30 } }, finish]);
    const result = confirmAction(def, run, action);
    expect(result).toMatchObject({ status: 'case_closed', report: { reason: 'deadline', minute: 30 } });
    expect(result.run.discoveries).not.toContain('EV-10');
    expect(result.events.some(event => event.type === 'finish')).toBe(false);
    expect(result.run.pendingBatch).toBeNull();
  });
  it.each([{ confirmed: true }, { confirmed: false }, { result: 'complete' }, { ownerId: 'synthetic' }])('rechaza aprobación o resultado en params: %j', params => {
    const run = initial(); const action = batch([talk, { type: 'finish', params }]);
    expect(resolveAction(source, run, action)).toMatchObject({ status: 'impossible', run, events: [] });
    expect(confirmAction(source, run, action)).toMatchObject({ status: 'impossible', run, events: [] });
  });
  it('no vuelve a cerrar una rama cerrada ni interpreta estado v10 con motor v11', () => {
    const run = initial(); const action = batch([finish]);
    const closed = confirmAction(source, run, action);
    expect(confirmAction(source, closed.run, action)).toMatchObject({ status: 'impossible', run: closed.run, events: [] });
    expect(() => confirmAction(source, { ...run, engineVersion: 10 }, action)).toThrow(EngineStateError);
  });
});
