// Regresión del lote intérprete de texto libre (2026-11-09): cada frase
// problemática documentada, en los tres idiomas, más los negativos que
// no deben emparejarse (varias acciones, sospechoso equivocado, textos
// que no son orden/detención/cierre).
import { describe, expect, it } from 'vitest';
import {
  detectInterpreterType, lockedMessageEs, matchLockedAction, matchOfferedAction,
} from './interpreter.ts';
import type { LockedAction } from '@meridiano/engine';
import type { ActionOffer } from './context.ts';

const warrantInes: ActionOffer = { id: 'request_warrant:ines', label: 'Solicitar orden contra Inés Valera' };
const warrantTomas: ActionOffer = { id: 'request_warrant:tomas', label: 'Solicitar orden contra Tomás Ríos' };
const detainInes: ActionOffer = { id: 'detain:ines', label: 'Coordinar la detención de Inés Valera con las autoridades' };
const finish: ActionOffer = { id: 'finish', label: 'Cerrar el caso y presentar el informe' };
const inspect: ActionOffer = { id: 'inspect:MAD-SALA', label: 'Examinar la sala' };

const lockedEarly: LockedAction[] = [
  { type: 'warrant', suspectId: 'ines', suspectName: 'Inés Valera', missing: ['suspect_unknown', 'no_authorizing_evidence'] },
  { type: 'warrant', suspectId: 'tomas', suspectName: 'Tomás Ríos', missing: ['suspect_unknown', 'no_authorizing_evidence'] },
  { type: 'detain', suspectId: 'ines', suspectName: 'Inés Valera', missing: ['no_warrant'] },
  { type: 'detain', suspectId: 'tomas', suspectName: 'Tomás Ríos', missing: ['no_warrant'] },
];

describe('detectar el tipo de acción (es/en/fr)', () => {
  it.each([
    ['Solicitar orden de detención', 'warrant'],
    ['Solicitar una orden', 'warrant'],
    ['Quiero pedir una orden para detener a Inés', 'warrant'],
    ['Request a warrant against Inés', 'warrant'],
    ['I need an arrest warrant', 'warrant'],
    ['Demander un mandat contre Inés', 'warrant'],
    ['Je voudrais un mandat', 'warrant'],
    ['Coordinar la detención de Inés', 'detain'],
    ['Coordinar la detención de Inés Valera', 'detain'],
    ['Coordinar la detención de Inés Valera con las autoridades', 'detain'],
    ['Detener a Inés', 'detain'],
    ['Detener a Inés Valera', 'detain'],
    ['Coordinar la detención…', 'detain'],
    ['Coordinate the arrest of Inés', 'detain'],
    ['Arrest Inés', 'detain'],
    ['Coordonner l’arrestation d’Inés', 'detain'],
    ['Arrêter Inés', 'detain'],
    ['Cerrar el caso', 'finish'],
    ['Cerrar el caso y presentar el informe', 'finish'],
    ['Close the case', 'finish'],
    ['Clore le dossier', 'finish'],
  ] as const)('«%s» es %s', (text, expected) => {
    expect(detectInterpreterType(text)).toBe(expected);
  });

  it.each([
    'Detén a Inés y pide una orden',
    'Cerrar el caso y pedir una orden',
    'Examina la sala',
    'Haz eso',
    'Viajar a Marte',
    'Hablar con Lucía',
  ])('«%s» no se empareja (lo decide el LLM)', text => {
    expect(detectInterpreterType(text)).toBeNull();
  });
});

describe('emparejar la oferta (lecturas raras 1 y 2)', () => {
  it('pedir una orden es la oferta de solicitar orden, no cerrar el caso', () => {
    const offers = [inspect, warrantInes, finish];
    expect(matchOfferedAction('Solicitar orden de detención', offers)).toBe('request_warrant:ines');
    expect(matchOfferedAction('Solicitar una orden', offers)).toBe('request_warrant:ines');
    expect(matchOfferedAction('Quiero pedir una orden para detener a Inés', offers)).toBe('request_warrant:ines');
  });

  it('coordinar la detención es la oferta de detención, no solicitar orden', () => {
    const offers = [inspect, warrantInes, detainInes, finish];
    expect(matchOfferedAction('Coordinar la detención de Inés', offers)).toBe('detain:ines');
    expect(matchOfferedAction('Coordinar la detención de Inés Valera', offers)).toBe('detain:ines');
    expect(matchOfferedAction('Coordinar la detención de Inés Valera con las autoridades', offers)).toBe('detain:ines');
    expect(matchOfferedAction('Detener a Inés', offers)).toBe('detain:ines');
    expect(matchOfferedAction('Detener a Inés Valera', offers)).toBe('detain:ines');
    expect(matchOfferedAction('Coordinar la detención…', offers)).toBe('detain:ines');
  });

  it('cerrar el caso sigue siendo la oferta de cierre', () => {
    expect(matchOfferedAction('Cerrar el caso', [inspect, warrantInes, finish])).toBe('finish');
    expect(matchOfferedAction('Close the case', [inspect, warrantInes, finish])).toBe('finish');
    expect(matchOfferedAction('Clore le dossier', [inspect, warrantInes, finish])).toBe('finish');
  });

  it('en inglés y francés empareja igual', () => {
    const offers = [inspect, warrantInes, detainInes, finish];
    expect(matchOfferedAction('Request a warrant against Inés', offers)).toBe('request_warrant:ines');
    expect(matchOfferedAction('Coordinate the arrest of Inés', offers)).toBe('detain:ines');
    expect(matchOfferedAction('I need an arrest warrant', [inspect, warrantInes, finish])).toBe('request_warrant:ines');
    expect(matchOfferedAction('Demander un mandat contre Inés', offers)).toBe('request_warrant:ines');
    expect(matchOfferedAction('Coordonner l’arrestation d’Inés', offers)).toBe('detain:ines');
    expect(matchOfferedAction('Arrêter Inés', offers)).toBe('detain:ines');
  });

  it('con dos ofertas del tipo, el nombre desambigua', () => {
    const offers = [warrantInes, warrantTomas, finish];
    expect(matchOfferedAction('Solicitar orden contra Tomás', offers)).toBe('request_warrant:tomas');
    expect(matchOfferedAction('Solicitar una orden', offers)).toBeNull();
  });

  it('nombrar a otro sospechoso no devuelve la oferta del ofrecido', () => {
    const offers = [detainInes, finish];
    const locked: LockedAction[] = [
      { type: 'warrant', suspectId: 'tomas', suspectName: 'Tomás Ríos', missing: ['suspect_unknown', 'no_authorizing_evidence'] },
      { type: 'detain', suspectId: 'tomas', suspectName: 'Tomás Ríos', missing: ['no_warrant'] },
    ];
    expect(matchOfferedAction('Detener a Tomás', offers, locked)).toBeNull();
    expect(matchOfferedAction('Solicitar orden contra Tomás', [warrantInes, finish], locked)).toBeNull();
  });

  it('sin oferta de ese tipo no empareja', () => {
    expect(matchOfferedAction('Solicitar una orden', [inspect, finish])).toBeNull();
    expect(matchOfferedAction('Detener a Inés', [inspect, finish])).toBeNull();
  });
});

describe('emparejar la acción bloqueada (lectura rara 3)', () => {
  it('pedir orden al principio explica lo que falta, sin nombre si no lo da', () => {
    const match = matchLockedAction('Solicitar orden de detención', lockedEarly);
    expect(match).toEqual({
      type: 'warrant', suspectName: null,
      missing: ['suspect_unknown', 'no_authorizing_evidence'],
    });
  });

  it('pedir detener al principio explica que falta la orden (caso 3: antes era hablar de su identidad)', () => {
    expect(matchLockedAction('Detener a Inés', lockedEarly)).toEqual({
      type: 'detain', suspectName: 'Inés Valera', missing: ['no_warrant'],
    });
    expect(matchLockedAction('Detener a Inés Valera', lockedEarly)).toEqual({
      type: 'detain', suspectName: 'Inés Valera', missing: ['no_warrant'],
    });
    expect(matchLockedAction('Coordinar la detención de Inés', lockedEarly)).toEqual({
      type: 'detain', suspectName: 'Inés Valera', missing: ['no_warrant'],
    });
  });

  it('nombrar al sospechoso elige su bloqueo', () => {
    const match = matchLockedAction('Solicitar una orden contra Tomás', lockedEarly);
    expect(match?.suspectName).toBe('Tomás Ríos');
    expect(match?.type).toBe('warrant');
  });

  it('con motivos distintos y sin nombre no adivina al sospechoso', () => {
    const locked: LockedAction[] = [
      { type: 'warrant', suspectId: 'ines', suspectName: 'Inés Valera', missing: ['warrant_granted'] },
      { type: 'warrant', suspectId: 'tomas', suspectName: 'Tomás Ríos', missing: ['suspect_unknown', 'no_authorizing_evidence'] },
    ];
    expect(matchLockedAction('Solicitar una orden', locked)).toBeNull();
    expect(matchLockedAction('Solicitar orden contra Inés', locked)).toEqual({
      type: 'warrant', suspectName: 'Inés Valera', missing: ['warrant_granted'],
    });
  });

  it('cerrar el caso nunca es un bloqueo', () => {
    expect(matchLockedAction('Cerrar el caso', lockedEarly)).toBeNull();
  });

  it('el mensaje en español dice lo que falta', () => {
    const match = matchLockedAction('Solicitar orden de detención', lockedEarly);
    if (match === null) throw new Error('Se esperaba un bloqueo de orden');
    expect(lockedMessageEs(match)).toBe(
      'Todavía no puedes pedir una orden. Primero tienes que conocer a la persona: habla con esa persona ' +
      'o encuentra pruebas que la señalen. Te faltan pruebas que autoricen la orden.',
    );
    expect(lockedMessageEs({ type: 'detain', suspectName: 'Inés Valera', missing: ['no_warrant'] })).toBe(
      'Todavía no puedes detener a Inés Valera. Primero necesitas una orden válida.',
    );
  });
});
