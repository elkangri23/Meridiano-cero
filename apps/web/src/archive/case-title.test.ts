import { describe, expect, it } from 'vitest';
import { displayCaseTitle, shortCaseRef } from './case-title';

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

describe('shortCaseRef', () => {
  it('distingue los generados con el mismo título por sus últimos 8 caracteres', () => {
    expect(shortCaseRef('generado-21d02570')).toBe('21d02570');
    expect(shortCaseRef('generado-639534d3')).toBe('639534d3');
    expect(shortCaseRef('generado-21d02570')).not.toBe(shortCaseRef('generado-639534d3'));
  });

  it('enseña el id entero del caso fijo', () => {
    expect(shortCaseRef('astrolabio-tres-ciudades')).toBe('astrolabio-tres-ciudades');
  });
});
