// Acciones irregulares (GDD §14, SPEC-008): forzar un acceso, sobornar y
// suplantar, con consecuencias proporcionales y basadas en conocimiento
// plausible de testigos. Ningún acto revela la solución ni sustituye las
// pruebas: lo obtenido por vía irregular no es admisible.
import { describe, expect, it } from 'vitest';
import { hashDefinition } from '@meridiano/case-schema/server';
import { availableOffers, buildFinalReport, canIssueWarrant, completeFinalReport, createInitialRun, confirmAction, generadoFraudeDefinition, resolveAction, scoreForReport } from './index.js';
import { astrolabioDefinition as source } from './fixtures/case-astrolabio.js';
import { misconductOf, witnessedCount } from './misconduct.js';
import type { Action, ActionResult } from './types.js';

const forceEntry = (targetId = 'LIS-ALM'): Action => ({ type: 'irregular', params: { kind: 'force_entry', targetId } });
const bribe = (npcId: string): Action => ({ type: 'irregular', params: { kind: 'bribe', targetId: npcId } });
const impersonate = (npcId: string): Action => ({ type: 'irregular', params: { kind: 'impersonate', targetId: npcId } });
const wait = (minutes: number): Action => ({ type: 'wait', params: { minutes } });
const travel = (toCityId: string): Action => ({ type: 'travel', params: { toCityId } });
const talk = (npcId: string, topicId = 'identidad'): Action => ({ type: 'talk', params: { npcId, topicId } });

function initial(def = source) { return createInitialRun(def, 'synthetic', 'synthetic', hashDefinition(def)); }
/** Aplica una acción en un paso, como hace la web: preview y, si pide
 * confirmación, commit. Las acciones sin coste material se aplican en el
 * preview y no hay nada que confirmar. */
function commit(def: typeof source, run: ReturnType<typeof initial>, action: Action): ActionResult {
  const preview = resolveAction(def, run, action);
  expect(['confirmation_required', 'applied']).toContain(preview.status);
  return preview.status === 'confirmation_required' ? confirmAction(def, run, action) : preview;
}
function inLisboa() {
  const run = confirmAction(source, initial(), travel('lisboa')).run;
  expect(run.position.cityId).toBe('lisboa');
  return run;
}
function offerIds(def: typeof source, run: ReturnType<typeof initial>): string[] {
  return availableOffers(def, run).map(offer => offer.id);
}

describe('GDD §14: acciones irregulares', () => {
  it('las ofertas aparecen solo donde tienen sentido: soborno en Madrid, forzar acceso solo en Lisboa', () => {
    const madrid = initial();
    const ids = offerIds(source, madrid);
    expect(ids).toContain('irregular:bribe:lucia');
    expect(ids).toContain('irregular:impersonate:lucia');
    expect(ids).toContain('irregular:bribe:tomas');
    expect(ids).not.toContain('irregular:force_entry:LIS-ALM');
    expect(offerIds(source, inLisboa())).toContain('irregular:force_entry:LIS-ALM');
  });

  it('la vista previa nombra a los testigos y la retirada antes de confirmar', () => {
    const preview = resolveAction(source, inLisboa(), forceEntry());
    expect(preview.status).toBe('confirmation_required');
    if (preview.status !== 'confirmation_required') throw new Error('se esperaba confirmación');
    expect(preview.preview.estimatedMinutes).toBe(30);
    expect(preview.preview.description).toContain('Marta');
    expect(preview.preview.description).toContain('Inés Valera');
    expect(preview.preview.description).toContain('retirará el caso');
  });

  it('forzar el acceso permite recuperar sin orden, pero lo recuperado no es admisible', () => {
    const before = inLisboa();
    const forced = commit(source, before, forceEntry());
    const minute = before.minute + 30;
    expect(forced.status).toBe('applied');
    expect(forced.run.minute).toBe(minute);
    expect(forced.run.discoveries).toContain('forced-entry');
    expect(forced.run.discoveries).toContain('warning');
    expect(misconductOf(forced.run)).toEqual([
      { id: 'irr-1', kind: 'force_entry', targetId: 'LIS-ALM', minute, seenBy: ['marta', 'ines'] },
    ]);
    expect(witnessedCount(forced.run)).toBe(1);
    expect(forced.run.npcRelations.marta).toBe(0);
    expect(forced.run.npcRelations.ines).toBe(0);
    expect(forced.run.conversationRecords).toContain(`irregular:force_entry:LIS-ALM@${minute}`);
    expect(forced.run.conversationRecords).toContain(`warning:irr-1@${minute}`);
    expect(forced.events[0]?.type).toBe('irregular');
    expect(offerIds(source, forced.run)).toContain('recover:astrolabio-original');
    expect(offerIds(source, forced.run)).not.toContain('irregular:force_entry:LIS-ALM');
    const recovered = commit(source, forced.run, { type: 'recover', params: { objectId: 'astrolabio-original' } });
    expect(recovered.status).toBe('applied');
    expect(recovered.run.inventory).toContain('EV-11');
    expect(recovered.run.admissibility['EV-11']).toBe(false);
  });

  it('sobornar revela lo que la charla revelaría, pero manchado: no sostiene una orden', () => {
    const run = commit(source, initial(), bribe('lucia'));
    expect(run.status).toBe('applied');
    expect(run.run.minute).toBe(30);
    // Identidad + la caja (EV-09), como hablar con ella, pero inadmisible.
    expect(run.run.discoveries).toContain('identity:lucia');
    expect(run.run.discoveries).toContain('EV-09');
    expect(run.run.admissibility['EV-09']).toBe(false);
    expect(misconductOf(run.run)).toEqual([
      { id: 'irr-1', kind: 'bribe', targetId: 'lucia', minute: 30, seenBy: ['tomas'] },
    ]);
    expect(run.run.npcRelations.tomas).toBe(0);
    // La cooperación de Lucía no se restaura con el soborno.
    expect(run.run.npcRelations.lucia).toBeUndefined();
    // EV-09 manchada no sostiene la orden contra Tomás aunque se conozca EV-10.
    const queried = commit(source, run.run, { type: 'query', params: { topicId: 'accesos-tomas' } });
    const matured = confirmAction(source, queried.run, wait(30));
    expect(matured.run.discoveries).toContain('EV-10');
    expect(canIssueWarrant(source, matured.run, 'tomas', ['EV-09', 'EV-10'])).toBe(false);
    const denied = commit(source, matured.run,
      { type: 'request_warrant', params: { suspectId: 'tomas', evidenceIds: ['EV-09', 'EV-10'] } });
    expect(denied.status).toBe('applied');
    const resolved = confirmAction(source, denied.run, wait(30));
    expect(resolved.run.discoveries.some(id => id.startsWith('warrant-denied:'))).toBe(true);
    expect(resolved.run.warrants).not.toContain('warrant:tomas');
  });

  it('sobornar salta el bloqueo por cooperación perdida: es la vía de vuelta', () => {
    // Primera vista: suplantar a Tomás (le ven Tomás y Lucía).
    const first = commit(source, initial(), impersonate('tomas'));
    expect(misconductOf(first.run)[0]?.seenBy).toEqual(['tomas', 'lucia']);
    expect(first.run.npcRelations.lucia).toBe(0);
    // Hablar con Lucía de la caja ya no se ofrece: su cooperación es 0.
    expect(offerIds(source, first.run)).not.toContain('talk:lucia:caja');
    // Pero sobornarla sigue revelando EV-09 (manchada).
    const bribed = commit(source, first.run, bribe('lucia'));
    expect(bribed.run.discoveries).toContain('EV-09');
    expect(bribed.run.admissibility['EV-09']).toBe(false);
    expect(bribed.run.npcRelations.lucia).toBe(0);
  });

  it('suplantar siempre lo acaba descubriendo la víctima', () => {
    // Émile está solo en París: nadie más podría verlo, pero él se da cuenta.
    const paris = confirmAction(source, initial(), travel('paris')).run;
    const result = commit(source, paris, impersonate('emile'));
    expect(misconductOf(result.run)[0]?.seenBy).toEqual(['emile']);
    expect(result.run.npcRelations.emile).toBe(0);
  });

  it('sobornar a Inés no revela la solución: solo su identidad, como hablar con ella', () => {
    const result = commit(source, inLisboa(), bribe('ines'));
    expect(result.status).toBe('applied');
    expect(result.run.discoveries).toContain('identity:ines');
    expect(result.run.discoveries).toContain('location:ines');
    expect(result.run.discoveries).not.toContain('truth');
    expect(JSON.stringify(result.run.discoveries)).not.toContain('EV-11');
    expect(result.run.discoveries).not.toContain('EV-04');
  });

  it('sin testigos no hay advertencia, pero el acto queda y descuenta', () => {
    const paris = confirmAction(source, initial(), travel('paris')).run;
    const result = commit(source, paris, bribe('emile'));
    expect(misconductOf(result.run)).toEqual([
      { id: 'irr-1', kind: 'bribe', targetId: 'emile', minute: result.run.minute, seenBy: [] },
    ]);
    expect(result.run.discoveries).not.toContain('warning');
    expect(witnessedCount(result.run)).toBe(0);
    expect(scoreForReport(source, result.run, [], 'finished').breakdown
      .find(entry => entry.label === 'Conducta irregular')).toEqual({ label: 'Conducta irregular', points: -10, id: 'irregular', max: 0 });
  });

  it('a la tercera vez que te ven, A.C.M.E. retira el caso y el informe lo refleja', () => {
    const first = commit(source, inLisboa(), forceEntry());
    expect(first.status).toBe('applied');
    const madrid = confirmAction(source, first.run, travel('madrid')).run;
    const second = commit(source, madrid, bribe('lucia'));
    expect(second.status).toBe('applied');
    expect(witnessedCount(second.run)).toBe(2);
    const third = confirmAction(source, second.run, impersonate('tomas'));
    expect(third.status).toBe('case_closed');
    if (third.status !== 'case_closed') throw new Error('se esperaba el cierre del caso');
    expect(third.run.status).toBe('closed');
    expect(third.report.reason).toBe('withdrawn');
    expect(third.report.result).toBe('unresolved');
    expect(third.report.irregularActs).toHaveLength(3);
    expect(third.report.irregularActs.every(act => act.seen)).toBe(true);
    expect(third.report.score.breakdown.find(entry => entry.label === 'Conducta irregular'))
      .toEqual({ label: 'Conducta irregular', points: -30, id: 'irregular', max: 0 });
    expect(third.report.score.breakdown.find(entry => entry.label === 'Tiempo restante'))
      .toEqual({ label: 'Tiempo restante', points: 0, id: 'time', max: 10 });
    expect(third.events.some(event => event.type === 'case_withdrawn')).toBe(true);
    // La partida cerrada ya no admite acciones.
    expect(resolveAction(source, third.run, talk('lucia')).status).toBe('impossible');
    // El informe guardado se proyecta completo con la retirada.
    const projected = completeFinalReport(source, third.run);
    expect(projected?.reason).toBe('withdrawn');
    expect(projected?.irregularActs).toHaveLength(3);
  });

  it('el informe de una partida limpia no descuenta nada por conducta', () => {
    const report = buildFinalReport(source, initial(), 'finished');
    expect(report.irregularActs).toEqual([]);
    expect(report.score.breakdown.find(entry => entry.label === 'Conducta irregular'))
      .toEqual({ label: 'Conducta irregular', points: 0, id: 'irregular', max: 0 });
  });

  it('parámetros inválidos y objetivos imposibles se rechazan sin escribir', () => {
    const run = initial();
    const invalid = resolveAction(source, run, { type: 'irregular', params: { kind: 'robar', targetId: 'lucia' } });
    expect(invalid).toMatchObject({ status: 'impossible', run, events: [] });
    const wrongCity = resolveAction(source, run, forceEntry());
    expect(wrongCity).toMatchObject({ status: 'impossible', run, events: [] });
    const unknown = resolveAction(source, run, bribe('nadie'));
    expect(unknown).toMatchObject({ status: 'impossible', run, events: [] });
  });

  it('expediente generado: forzar el acceso en Valencia y sobornar a Jorge', () => {
    const def = generadoFraudeDefinition;
    const run = confirmAction(def, initial(def), travel('valencia')).run;
    expect(run.position.locationId).toBe('VLC-ALM');
    expect(offerIds(def, run)).toContain('irregular:force_entry:VLC-ALM');
    const forced = commit(def, run, forceEntry('VLC-ALM'));
    expect(forced.status).toBe('applied');
    expect(forced.run.discoveries).toContain('forced-entry');
    expect(misconductOf(forced.run)[0]?.seenBy).toEqual(['carmen']);
    expect(offerIds(def, forced.run)).toContain('recover:contrato-original');
    const recovered = commit(def, forced.run, { type: 'recover', params: { objectId: 'contrato-original' } });
    expect(recovered.run.inventory).toContain('EV-11');
    expect(recovered.run.admissibility['EV-11']).toBe(false);
    // Jorge, en Madrid, tiene un tema que exige cooperación: sobornarlo lo revela manchado.
    const madrid = confirmAction(def, recovered.run, travel('madrid')).run;
    const bribed = commit(def, madrid, bribe('jorge'));
    expect(bribed.run.discoveries).toContain('EV-09');
    expect(bribed.run.admissibility['EV-09']).toBe(false);
    expect(misconductOf(bribed.run)).toHaveLength(2);
  });
});
