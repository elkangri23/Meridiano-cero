import { hashDefinition } from '@meridiano/case-schema/server';
import { describe, expect, it } from 'vitest';
import { createInitialRun, resolveAction, confirmAction, availableOffers, astrolabioDefinition } from './index.js';
import type { Action, ActionResult } from './index.js';
import type { CaseDefinition } from '@meridiano/case-schema';

function scenario(def: CaseDefinition = astrolabioDefinition) {
  let run = createInitialRun(def, 'synthetic-owner', 'synthetic-run', hashDefinition(def));
  function attempt(type: Action['type'], params: Action['params']): ActionResult {
    const action = { type, params };
    let result = resolveAction(def, run, action);
    if (result.status === 'confirmation_required') result = confirmAction(def, run, action);
    if (result.status === 'applied' || result.status === 'case_closed') run = result.run;
    return result;
  }
  function step(type: Action['type'], params: Action['params']) {
    const result = attempt(type, params);
    if (result.status !== 'applied' && result.status !== 'case_closed') throw new Error('Unexpected action outcome: ' + type + '/' + result.status);
    return result;
  }
  return { step, attempt, offers: () => availableOffers(def, run).map(offer => offer.id), read: () => structuredClone(run) };
}

describe('ofertas disponibles (Fase A)', () => {
  it('al inicio ofrece inspeccionar, hablar, viajar y cerrar; sin recoger ni esperar', () => {
    const s = scenario();
    const ids = s.offers();
    expect(ids).toContain('inspect:MAD-SALA');
    expect(ids).toContain('talk:lucia:identidad');
    expect(ids).toContain('talk:tomas:identidad');
    expect(ids).toContain('travel:paris');
    expect(ids).toContain('travel:lisboa');
    expect(ids).toContain('finish');
    expect(ids).not.toContain('inspect:MAD-SALA:cerradura');
    expect(ids).not.toContain('collect:EV-02');
    expect(ids).not.toContain('wait:30');
    expect(ids).not.toContain('request_warrant:ines');
  });

  it('la oferta de análisis del caso fijo es de huellas, con su coste', () => {
    const s = scenario();
    s.step('inspect', { targetId: 'MAD-SALA' });
    s.step('inspect', { targetId: 'MAD-SALA', elementId: 'cerradura' });
    s.step('collect', { evidenceId: 'EV-02' });
    const offer = availableOffers(astrolabioDefinition, s.read()).find(item => item.id === 'analyze:EV-02');
    expect(offer).toBeDefined();
    expect(offer?.forensicType).toBe('huellas');
    expect(offer?.label).toContain('huellas');
    expect(offer?.detail).toContain('90 min');
    expect(offer?.action).toEqual({ type: 'analyze', params: { evidenceId: 'EV-02' } });
  });

  it('tras inspeccionar la sala aparecen los elementos; tras la cerradura, recoger EV-02', () => {
    const s = scenario();
    s.step('inspect', { targetId: 'MAD-SALA' });
    expect(s.offers()).toContain('inspect:MAD-SALA:cerradura');
    expect(s.offers()).toContain('inspect:MAD-SALA:caja');
    s.step('inspect', { targetId: 'MAD-SALA', elementId: 'cerradura' });
    expect(s.offers()).toContain('collect:EV-02');
    s.step('collect', { evidenceId: 'EV-02' });
    expect(s.offers()).toContain('analyze:EV-02');
    expect(s.offers()).not.toContain('collect:EV-02');
  });

  it('la ruta A completa se puede recorrer solo con ofertas', () => {
    const s = scenario();
    const byId = () => new Map(availableOffers(astrolabioDefinition, s.read()).map(offer => [offer.id, offer.action]));
    const doOffer = (id: string) => {
      const action = byId().get(id);
      if (!action) throw new Error('Oferta no disponible: ' + id);
      s.step(action.type, action.params);
    };
    doOffer('inspect:MAD-SALA');
    doOffer('inspect:MAD-SALA:cerradura');
    doOffer('collect:EV-02');
    doOffer('analyze:EV-02');
    doOffer('travel:paris');
    doOffer('query:herramienta-hv17');
    doOffer('query:traslado-ines');
    doOffer('wait:30');
    expect(s.offers()).toContain('request_warrant:ines');
    doOffer('request_warrant:ines');
    doOffer('wait:30');
    doOffer('travel:lisboa');
    doOffer('talk:ines:identidad');
    doOffer('detain:ines');
    doOffer('recover:astrolabio-original');
    const closed = s.attempt('finish', {});
    expect(closed.status).toBe('case_closed');
    expect(s.read().status).toBe('closed');
  });

  it('la ruta B completa se puede recorrer solo con ofertas', () => {
    const s = scenario();
    const byId = () => new Map(availableOffers(astrolabioDefinition, s.read()).map(offer => [offer.id, offer.action]));
    const doOffer = (id: string) => {
      const action = byId().get(id);
      if (!action) throw new Error('Oferta no disponible: ' + id);
      s.step(action.type, action.params);
    };
    doOffer('inspect:MAD-SALA');
    doOffer('inspect:MAD-SALA:caja');
    doOffer('collect:EV-06');
    doOffer('travel:paris');
    doOffer('query:firma-sello');
    doOffer('wait:30');
    doOffer('travel:lisboa');
    doOffer('query:custodia-envio');
    doOffer('wait:30');
    doOffer('request_warrant:ines');
    doOffer('wait:30');
    doOffer('talk:ines:identidad');
    doOffer('detain:ines');
    doOffer('recover:astrolabio-original');
    expect(s.attempt('finish', {}).status).toBe('case_closed');
  });

  it('en partida cerrada no hay ofertas', () => {
    const s = scenario();
    s.step('inspect', { targetId: 'MAD-SALA' });
    const run = { ...s.read(), status: 'closed' as const };
    expect(availableOffers(astrolabioDefinition, run)).toEqual([]);
  });
});

describe('ofertas disponibles (pulido cosmético)', () => {
  /** Recorre la ruta B por ofertas hasta la maduración de la orden. */
  function untilWarrant() {
    const s = scenario();
    const byId = () => new Map(availableOffers(astrolabioDefinition, s.read()).map(offer => [offer.id, offer.action]));
    const doOffer = (id: string) => {
      const action = byId().get(id);
      if (!action) throw new Error('Oferta no disponible: ' + id);
      s.step(action.type, action.params);
    };
    doOffer('inspect:MAD-SALA');
    doOffer('inspect:MAD-SALA:caja');
    doOffer('collect:EV-06');
    doOffer('travel:paris');
    doOffer('query:firma-sello');
    doOffer('wait:30');
    doOffer('travel:lisboa');
    doOffer('query:custodia-envio');
    doOffer('wait:30');
    doOffer('request_warrant:ines');
    doOffer('wait:30');
    return { s, doOffer };
  }

  it('recoger y analizar nombran la evidencia por su texto, nunca por su ID crudo', () => {
    const s = scenario();
    s.step('inspect', { targetId: 'MAD-SALA' });
    s.step('inspect', { targetId: 'MAD-SALA', elementId: 'caja' });
    const collect = availableOffers(astrolabioDefinition, s.read()).find(item => item.id === 'collect:EV-06');
    expect(collect?.label).toContain('La caja guarda una copia del manifiesto, con sello y firma verificables.');
    expect(collect?.label).not.toContain('EV-06');
    s.step('inspect', { targetId: 'MAD-SALA', elementId: 'cerradura' });
    s.step('collect', { evidenceId: 'EV-02' });
    const analyze = availableOffers(astrolabioDefinition, s.read()).find(item => item.id === 'analyze:EV-02');
    expect(analyze?.label).toContain('La cerradura de la vitrina tiene residuo de herramienta.');
    expect(analyze?.label).not.toContain('EV-02');
  });

  it('con la orden ya concedida no se vuelve a ofrecer «Solicitar orden»', () => {
    const { s } = untilWarrant();
    expect(s.read().warrants).toContain('warrant:ines');
    expect(s.offers()).not.toContain('request_warrant:ines');
    expect(s.offers()).toContain('detain:ines');
  });

  it('un detenido ya no aparece en la escena (ni para hablar ni para sobornar)', () => {
    const { s, doOffer } = untilWarrant();
    doOffer('talk:ines:identidad');
    doOffer('detain:ines');
    expect(s.read().detentions).toContain('ines');
    expect(s.offers().filter(id => id.startsWith('talk:ines:'))).toEqual([]);
    expect(s.offers().filter(id => id.startsWith('irregular:') && id.endsWith(':ines'))).toEqual([]);
  });

  it('forzar el acceso avisa de la alternativa legal (orden con una prueba de acceso)', () => {
    const s = scenario();
    s.step('travel', { toCityId: 'lisboa' });
    const force = availableOffers(astrolabioDefinition, s.read()).find(item => item.id === 'irregular:force_entry:LIS-ALM');
    expect(force?.detail).toContain('o pide una orden con una prueba de acceso');
  });
});
