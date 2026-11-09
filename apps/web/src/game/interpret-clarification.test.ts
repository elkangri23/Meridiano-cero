// La aclaración de una orden o detención bloqueada dice qué falta, en
// los tres idiomas, sin inventar otra acción (lote intérprete de texto
// libre, 2026-11-09).
import { describe, expect, it } from 'vitest';
import { createTranslator } from '@meridiano/contracts';
import { lockedClarificationText } from './interpret-clarification';

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
