// Traducción i18n (T5-05): el motor resuelve sus textos en el idioma
// pedido y en español sigue diciendo exactamente lo mismo que antes.
import { hashDefinition } from '@meridiano/case-schema/server';
import { describe, expect, it } from 'vitest';
import { evidenceText, npcGreeting, objectiveText, rankForTotals, reputationLabel } from '@meridiano/case-schema';
import { astrolabioDefinition, availableOffers, completeFinalReport, confirmAction, createInitialRun, resolveAction } from './index.js';

function freshRun() {
  return createInitialRun(astrolabioDefinition, 'synthetic-owner', 'synthetic-run', hashDefinition(astrolabioDefinition));
}

describe('motor en otro idioma', () => {
  it('las ofertas salen en francés: inspeccionar, hablar, viajar y cerrar', () => {
    const offers = availableOffers(astrolabioDefinition, freshRun(), 'fr');
    const byId = new Map(offers.map(offer => [offer.id, offer.label]));
    expect(byId.get('inspect:MAD-SALA')).toBe('Inspecter Salle d\'emballage');
    expect(byId.get('talk:lucia:identidad')).toBe('Parler à Lucía de son identité');
    // París es nombre propio: no se traduce, ni siquiera su acento.
    expect(byId.get('travel:paris')).toBe('Voyager vers París');
    expect(byId.get('finish')).toBe('Clore le dossier et présenter le rapport');
  });

  it('las ofertas salen en inglés', () => {
    const offers = availableOffers(astrolabioDefinition, freshRun(), 'en');
    const byId = new Map(offers.map(offer => [offer.id, offer.label]));
    expect(byId.get('inspect:MAD-SALA')).toBe('Inspect Packing room');
    expect(byId.get('talk:lucia:identidad')).toBe('Talk to Lucía about their identity');
    expect(byId.get('travel:paris')).toBe('Travel to París');
    expect(byId.get('finish')).toBe('Close the case and present the report');
  });

  it('el motivo de rechazo sale en francés y en español sigue igual', () => {
    const impossible = resolveAction(astrolabioDefinition, freshRun(),
      { type: 'inspect', params: { targetId: 'PAR-ARCH' } }, 'fr');
    expect(impossible.status).toBe('impossible');
    if (impossible.status === 'impossible') expect(impossible.reason).toBe('Cible non accessible.');
    const spanish = resolveAction(astrolabioDefinition, freshRun(),
      { type: 'inspect', params: { targetId: 'PAR-ARCH' } });
    expect(spanish.status).toBe('impossible');
    if (spanish.status === 'impossible') expect(spanish.reason).toBe('Objetivo no accesible.');
  });

  it('la confirmación de cierre sale en inglés y en español sigue igual', () => {
    const run = freshRun();
    const english = resolveAction(astrolabioDefinition, run, { type: 'finish', params: {} }, 'en');
    expect(english.status).toBe('confirmation_required');
    if (english.status === 'confirmation_required') expect(english.preview.description).toBe('Confirm case closure.');
    const spanish = resolveAction(astrolabioDefinition, run, { type: 'finish', params: {} });
    expect(spanish.status).toBe('confirmation_required');
    if (spanish.status === 'confirmation_required') expect(spanish.preview.description).toBe('Confirmar cierre del caso.');
  });

  it('el informe final se reconstruye en francés con sus textos traducidos', () => {
    const run = freshRun();
    const closed = confirmAction(astrolabioDefinition, run, { type: 'finish', params: {} });
    expect(closed.status).toBe('case_closed');
    if (closed.status !== 'case_closed') throw new Error('expected case_closed');
    const report = completeFinalReport(astrolabioDefinition, closed.run, 'fr');
    expect(report).not.toBeNull();
    expect(report?.score.breakdown[0]?.label).toBe('Objectifs réussis');
    // La primera prueba clave es EV-04, no EV-01 (FIXED_KEY_EVIDENCE).
    expect(report?.truth.keyEvidence[0]?.id).toBe('EV-04');
    expect(report?.truth.keyEvidence[0]?.text).toBe('Le registre signé attribue l\'outil HV-17 à Inés Valera.');
    // En español, el mismo informe guardado se devuelve tal cual.
    const spanish = completeFinalReport(astrolabioDefinition, closed.run);
    expect(spanish?.score.breakdown[0]?.label).toBe('Objetivos logrados');
  });

  it('los textos del caso fijo se resuelven en francés con su caso', () => {
    const id = astrolabioDefinition.id;
    expect(evidenceText('EV-01', undefined, id, 'fr'))
      .toBe('La caisse est bien en vue. Son étiquette renvoie aux archives de Paris.');
    expect(npcGreeting('lucia', undefined, id, 'fr'))
      .toBe('Je suis Lucía, conservatrice de l\'Instituto Horizonte. Comment puis-je t\'aider ?');
    expect(objectiveText('obj-detener', id, 'fr')).toBe('Arrêter Inés avec un mandat valide');
    // Sin idioma pedido, todo sigue en español.
    expect(evidenceText('EV-01')).toBe('La caja está a la vista. Su etiqueta remite al archivo de París.');
    expect(objectiveText('obj-detener')).toBe('Detener a Inés con orden válida');
  });

  it('rango y reputación de carrera salen en francés', () => {
    expect(rankForTotals(100, 0, 0, 'fr')).toBe('Inspecteur');
    expect(reputationLabel(20, 'fr')).toBe('Exemplaire');
    expect(rankForTotals(100, 0, 0)).toBe('Inspector');
    expect(reputationLabel(20)).toBe('Ejemplar');
  });
});
