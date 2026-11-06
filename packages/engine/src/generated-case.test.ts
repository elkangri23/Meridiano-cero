import { hashDefinition } from '@meridiano/case-schema/server';
import { validateCaseDefinition, validateGeneratedContent } from '@meridiano/case-schema';
import { describe, expect, it } from 'vitest';
import { availableOffers, createInitialRun, resolveAction, confirmAction, canIssueWarrant, generadoFraudeDefinition, liveObjectives } from './index.js';
import type { Action, ActionResult } from './index.js';
import type { CaseDefinition } from '@meridiano/case-schema';

// Mismo helper que simulation.test.ts: la confirmación es la aprobación
// explícita del jugador cuando el motor la pide.
function scenario(def: CaseDefinition = generadoFraudeDefinition) {
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
    if (result.status !== 'applied' && result.status !== 'case_closed') throw new Error('Unexpected action outcome: ' + type + '/' + result.status + ' ' + (result as { reason?: string }).reason);
    return result;
  }
  return { step, attempt, read: () => structuredClone(run) };
}

describe('caso generado (vía genérica)', () => {
  it('el fixture valida con el validador v1.5 y con contenido Familiar', () => {
    expect(validateCaseDefinition(generadoFraudeDefinition).valid).toBe(true);
    const errors: string[] = [];
    validateGeneratedContent(generadoFraudeDefinition as unknown as Record<string, unknown>, 'familiar', errors);
    expect(errors).toEqual([]);
  });

  it('rechaza una mecánica con referencias inexistentes', () => {
    const broken = structuredClone(generadoFraudeDefinition) as unknown as Record<string, unknown>;
    const mechanics = broken.mechanics as Record<string, unknown>;
    const firstQuery = (mechanics.queries as Array<Record<string, unknown>>)[0];
    if (!firstQuery) throw new Error('fixture sin consultas');
    firstQuery.evidenceId = 'EV-99';
    expect(validateCaseDefinition(broken).valid).toBe(false);
  });

  it('rechaza contenido Familiar con un término prohibido en los textos', () => {
    const broken = structuredClone(generadoFraudeDefinition) as unknown as Record<string, unknown>;
    const texts = broken.texts as Record<string, unknown>;
    (texts.evidence as Record<string, string>)['EV-01'] = 'La oficina huele a sangre.';
    const errors: string[] = [];
    validateGeneratedContent(broken, 'familiar', errors);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('la ruta dorada completa el caso con los dos objetivos', () => {
    const s = scenario();
    s.step('inspect', { targetId: 'MAD-OFIC' });
    expect(s.read().minute).toBe(10);
    expect(s.read().discoveries).toContain('EV-01');
    expect(s.read().discoveries).toContain('barcelona');
    s.step('inspect', { targetId: 'MAD-OFIC', elementId: 'cajon' });
    expect(s.read().minute).toBe(30);
    s.step('collect', { evidenceId: 'EV-02' });
    s.step('analyze', { evidenceId: 'EV-02' });
    s.step('inspect', { targetId: 'MAD-OFIC', elementId: 'archivador' });
    s.step('collect', { evidenceId: 'EV-06' });
    s.step('talk', { npcId: 'jorge', topicId: 'identidad' });
    s.step('talk', { npcId: 'jorge', topicId: 'facturas' });
    expect(s.read().discoveries).toContain('EV-09');
    s.step('query', { topicId: 'accesos-jorge' });
    s.step('wait', { minutes: 30 });
    expect(s.read().discoveries).toContain('EV-10');
    s.step('wait', { minutes: 30 });
    s.step('wait', { minutes: 30 });
    expect(s.read().discoveries).toContain('EV-03');
    s.step('travel', { toCityId: 'barcelona' });
    expect(s.read().position.cityId).toBe('barcelona');
    s.step('query', { topicId: 'registro-facturas' });
    s.step('query', { topicId: 'registro-envios' });
    s.step('query', { topicId: 'firma-contrato' });
    s.step('wait', { minutes: 30 });
    expect(s.read().discoveries).toContain('EV-04');
    expect(s.read().discoveries).toContain('EV-05');
    expect(s.read().discoveries).toContain('EV-07');
    expect(s.read().discoveries).toContain('location:carmen');
    expect(canIssueWarrant(generadoFraudeDefinition, s.read(), 'carmen')).toBe(true);
    expect(availableOffers(generadoFraudeDefinition, s.read()).map(offer => offer.id)).toContain('request_warrant:carmen');
    s.step('travel', { toCityId: 'valencia' });
    expect(s.read().position.cityId).toBe('valencia');
    s.step('query', { topicId: 'custodia-contrato' });
    s.step('wait', { minutes: 30 });
    expect(s.read().discoveries).toContain('EV-08');
    s.step('request_warrant', { suspectId: 'carmen', evidenceIds: ['EV-06', 'EV-07', 'EV-08'] });
    s.step('wait', { minutes: 30 });
    expect(s.read().warrants).toContain('warrant:carmen');
    expect(s.read().warrants).toContain('warrant:access');
    s.step('talk', { npcId: 'carmen', topicId: 'identidad' });
    s.step('detain', { suspectId: 'carmen', warrantId: 'warrant:carmen', locationId: 'VLC-ALM', mode: 'interactive' });
    expect(liveObjectives(generadoFraudeDefinition, s.read())).toContain('obj-detener');
    s.step('recover', { objectId: 'contrato-original' });
    expect(s.read().inventory).toContain('EV-11');
    const closed = s.step('finish', {});
    expect(closed.status).toBe('case_closed');
    const report = s.read().finalReport;
    expect(report?.result).toBe('complete');
    expect(report?.objectivesAchieved).toEqual(['obj-detener', 'obj-recuperar']);
    expect(s.read().minute).toBeLessThan(generadoFraudeDefinition.deadlineMinutes);
  });

  it('la segunda combinación de orden también autoriza la detención', () => {
    const s = scenario();
    s.step('inspect', { targetId: 'MAD-OFIC' });
    s.step('inspect', { targetId: 'MAD-OFIC', elementId: 'cajon' });
    s.step('collect', { evidenceId: 'EV-02' });
    s.step('analyze', { evidenceId: 'EV-02' });
    s.step('travel', { toCityId: 'barcelona' });
    s.step('query', { topicId: 'registro-facturas' });
    s.step('query', { topicId: 'registro-envios' });
    s.step('wait', { minutes: 30 });
    expect(s.read().discoveries).toContain('EV-03');
    expect(s.read().discoveries).toContain('EV-04');
    expect(canIssueWarrant(generadoFraudeDefinition, s.read(), 'carmen', ['EV-03', 'EV-04'])).toBe(true);
    expect(canIssueWarrant(generadoFraudeDefinition, s.read(), 'carmen', ['EV-06', 'EV-07', 'EV-08'])).toBe(false);
  });

  it('detener sin orden y recuperar sin acceso son imposibles', () => {
    const s = scenario();
    const detained = s.attempt('detain', { suspectId: 'carmen', warrantId: 'warrant:carmen', locationId: 'VLC-ALM', mode: 'interactive' });
    expect(detained.status).toBe('impossible');
    const recovered = s.attempt('recover', { objectId: 'contrato-original' });
    expect(recovered.status).toBe('impossible');
  });

  it('las ofertas de la escena salen de la mecánica, con sus etiquetas', () => {
    const s = scenario();
    s.step('inspect', { targetId: 'MAD-OFIC' });
    const offers = availableOffers(generadoFraudeDefinition, s.read());
    expect(offers.map(offer => offer.id)).toContain('inspect:MAD-OFIC:cajon');
    expect(offers.find(offer => offer.id === 'inspect:MAD-OFIC:cajon')?.label).toBe('Inspeccionar el cajón del escritorio');
    expect(offers.map(offer => offer.id)).toContain('talk:jorge:identidad');
    expect(offers.map(offer => offer.id)).toContain('query:accesos-jorge');
  });
});
