// La rama legada del validador se decidía por el id del expediente: al
// importar el caso fijo su id se reasigna a `importado-<hex>` y la copia
// dejaba de validar (rules no vacías, solution por identidad, tokens
// legados), así que el catálogo la daba por inexistente (404 al
// exportarla). La detección es ahora por contenido (manifiesto de reglas).
import { describe, expect, it } from 'vitest';
import { hasLegacyAstrolabioRules, isLegacyAstrolabioDefinition, LEGACY_ASTROLABIO_ID } from './legacy-astrolabio.js';

const manifest = [
  'warrant-ines: EV-03 + EV-04 OR EV-06 + EV-07 + EV-08',
  'warrant-tomas: EV-09 + EV-10 (insufficient for theft)',
  'access-l7: warrant-ines + (EV-05 OR EV-08)',
];

describe('isLegacyAstrolabioDefinition', () => {
  it('el fijo lo es por su id', () => {
    expect(isLegacyAstrolabioDefinition({ id: LEGACY_ASTROLABIO_ID, rules: [] })).toBe(true);
    expect(hasLegacyAstrolabioRules(manifest)).toBe(true);
  });

  it('la copia importada lo es por su manifiesto de reglas aunque el id sea otro', () => {
    expect(isLegacyAstrolabioDefinition({ id: 'importado-abcdef01', rules: manifest })).toBe(true);
  });

  it('un generado no lo es, ni con rules ni sin ellas', () => {
    expect(isLegacyAstrolabioDefinition({ id: 'generado-21d02570', rules: [] })).toBe(false);
    expect(isLegacyAstrolabioDefinition({ id: 'generado-21d02570', rules: ['otra'] })).toBe(false);
    expect(hasLegacyAstrolabioRules([])).toBe(false);
  });

  it('valores que no son definiciones no lo son', () => {
    expect(isLegacyAstrolabioDefinition(null)).toBe(false);
    expect(isLegacyAstrolabioDefinition('astrolabio-tres-ciudades')).toBe(false);
    expect(isLegacyAstrolabioDefinition([LEGACY_ASTROLABIO_ID])).toBe(false);
  });
});
