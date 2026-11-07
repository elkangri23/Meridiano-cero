import { hashDefinition } from '@meridiano/case-schema/server';
import { describe, expect, it } from 'vitest';
import { astrolabioDefinition, createInitialRun, EngineStateError, ENGINE_VERSION } from './index.js';

describe('integridad del expediente antes de persistirlo', () => {
  it('detecta cambios anidados que la normalización superficial omitía', () => {
    const changed = structuredClone(astrolabioDefinition);
    const city = changed.cities[0];
    if (!city) throw new Error('Missing fixture');
    city.name = 'Otra ciudad sintética';
    expect(hashDefinition(changed)).not.toBe(hashDefinition(astrolabioDefinition));
  });
  it('ignora orden de claves recursivo y reporte volátil, conservando orden de arrays', () => {
    const reordered = structuredClone(astrolabioDefinition);
    reordered.cities = reordered.cities.map(city => ({ country: city.country, name: city.name, id: city.id }));
    reordered.validationReport.errors.push('Volatile synthetic note');
    expect(hashDefinition(reordered)).toBe(hashDefinition(astrolabioDefinition));
    reordered.cities.reverse();
    expect(hashDefinition(reordered)).not.toBe(hashDefinition(astrolabioDefinition));
  });
  it('conserva byte a byte el hash anterior a separar integridad del motor', () => {
    // El hash cambió una sola vez al añadir `arrestType: 'automatic'` al
    // expediente fijo (GDD §12): la huella sigue siendo estable a partir
    // de aquí y cualquier cambio posterior debe actualizarla a conciencia.
    const expected = '6ea8db16cdf0143e2141b66be49789aa431b23c57bbfb370ee6673a3226b562f';
    const digest = hashDefinition(astrolabioDefinition);
    expect(digest).toBe(expected);
    const run = createInitialRun(astrolabioDefinition, 'synthetic', 'synthetic', digest);
    expect(run.definitionHash).toBe(expected);
    expect(run.engineVersion).toBe(ENGINE_VERSION);
    expect(ENGINE_VERSION).toBe(14);
  });
  it.each([undefined, '', 'not-a-hash', 'X'.repeat(64), 42])('el motor rechaza una huella ausente o mal formada sin calcularla: %s', value => {
    expect(() => createInitialRun(astrolabioDefinition, 'synthetic', 'synthetic', value as unknown as string))
      .toThrow(EngineStateError);
  });

});
