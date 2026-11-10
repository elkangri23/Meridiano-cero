// La aclaración de una orden o detención bloqueada dice qué falta, en
// los tres idiomas, sin inventar otra acción (lote intérprete de texto
// libre, 2026-11-09).
import { describe, expect, it } from 'vitest';
import { createTranslator } from '@meridiano/contracts';
import { interpretClarificationText, lockedClarificationText } from './interpret-clarification';

describe('lockedClarificationText', () => {
  it('en español nombra al sospechoso y lo que falta', () => {
    const t = createTranslator('es').t;
    expect(lockedClarificationText(t, {
      type: 'warrant', suspectName: 'Inés Valera', missing: ['suspect_unknown', 'no_authorizing_evidence'],
    })).toBe(
      'Todavía no puedes pedir una orden contra Inés Valera. ' +
      'Primero tienes que conocer a la persona: habla con esa persona o encuentra pruebas que la señalen. ' +
      'Te faltan pruebas que autoricen la orden.',
    );
    expect(lockedClarificationText(t, {
      type: 'detain', suspectName: 'Inés Valera', missing: ['no_warrant'],
    })).toBe('Todavía no puedes detener a Inés Valera. Primero necesitas una orden válida.');
  });

  it('sin nombre usa la versión genérica', () => {
    const t = createTranslator('es').t;
    expect(lockedClarificationText(t, {
      type: 'warrant', suspectName: null, missing: ['suspect_unknown', 'no_authorizing_evidence'],
    })).toBe(
      'Todavía no puedes pedir una orden. ' +
      'Primero tienes que conocer a la persona: habla con esa persona o encuentra pruebas que la señalen. ' +
      'Te faltan pruebas que autoricen la orden.',
    );
  });

  it('con la orden concedida dice que ya la tienes', () => {
    const t = createTranslator('es').t;
    expect(lockedClarificationText(t, {
      type: 'warrant', suspectName: 'Inés Valera', missing: ['warrant_granted'],
    })).toBe('Todavía no puedes pedir una orden contra Inés Valera. Ya tienes la orden.');
  });

  it('en inglés y francés traduce la aclaración', () => {
    const en = createTranslator('en').t;
    expect(lockedClarificationText(en, {
      type: 'detain', suspectName: 'Inés Valera', missing: ['no_warrant'],
    })).toBe('You cannot arrest Inés Valera yet. First you need a valid warrant.');
    const fr = createTranslator('fr').t;
    expect(lockedClarificationText(fr, {
      type: 'warrant', suspectName: null, missing: ['no_authorizing_evidence'],
    })).toBe('Tu ne peux pas encore demander un mandat. Il te manque des preuves qui autorisent le mandat.');
  });
});

describe('interpretClarificationText', () => {
  it('el motivo del servidor se resuelve en el idioma del jugador, no en español fijo', () => {
    const en = createTranslator('en').t;
    expect(interpretClarificationText(en, { message: 'Aclara la acción y su objetivo.', reason: 'ambiguous' }))
      .toBe('Clarify the action and its objective.');
    expect(interpretClarificationText(en, { message: 'Acota la orden antes de interpretarla.', reason: 'budget_exceeded' }))
      .toBe('Narrow down the order before interpreting it.');
    expect(interpretClarificationText(en, { message: 'No se pudo interpretar la orden con seguridad.', reason: 'invalid_response' }))
      .toBe('The order could not be interpreted safely.');
    expect(interpretClarificationText(en, { message: 'No se pudo interpretar la orden. Puedes volver a intentarlo.', reason: 'unavailable' }))
      .toBe('The order could not be interpreted. You can try again.');
    const fr = createTranslator('fr').t;
    expect(interpretClarificationText(fr, { message: 'Aclara la acción y su objetivo.', reason: 'ambiguous' }))
      .toBe('Précise l\'action et son objectif.');
  });

  it('en español el texto es el mismo literal del servidor', () => {
    const es = createTranslator('es').t;
    expect(interpretClarificationText(es, { message: 'Aclara la acción y su objetivo.', reason: 'ambiguous' }))
      .toBe('Aclara la acción y su objetivo.');
  });

  it('un motivo desconocido cae al mensaje del servidor o a la ambigua genérica', () => {
    const en = createTranslator('en').t;
    expect(interpretClarificationText(en, { message: 'Mensaje del servidor.', reason: 'desconocido' }))
      .toBe('Mensaje del servidor.');
    expect(interpretClarificationText(en, {})).toBe('The order is ambiguous.');
  });

  it('el bloqueo sigue teniendo prioridad sobre el motivo', () => {
    const en = createTranslator('en').t;
    expect(interpretClarificationText(en, {
      message: 'Aclara la acción y su objetivo.', reason: 'ambiguous',
      locked: { type: 'detain', suspectName: 'Inés Valera', missing: ['no_warrant'] },
    })).toBe('You cannot arrest Inés Valera yet. First you need a valid warrant.');
  });
});
