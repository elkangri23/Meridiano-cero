import { describe, expect, it } from 'vitest';
import { displayCaseTitle } from './case-title';

describe('displayCaseTitle', () => {
  it('quita el prefijo «Expediente:» que duplicaba la interfaz', () => {
    expect(displayCaseTitle('Expediente: cuaderno desaparecido')).toBe('cuaderno desaparecido');
    expect(displayCaseTitle('EXPEDIENTE:  cuaderno desaparecido')).toBe('cuaderno desaparecido');
  });

  it('deja intactos los títulos que no llevan ese prefijo', () => {
    expect(displayCaseTitle('Caso: desaparición en el Meridiano-cero')).toBe('Caso: desaparición en el Meridiano-cero');
    expect(displayCaseTitle('El astrolabio de las tres ciudades')).toBe('El astrolabio de las tres ciudades');
  });
});
