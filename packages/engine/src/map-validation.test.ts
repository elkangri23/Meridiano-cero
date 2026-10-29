import { describe, expect, it } from 'vitest';
import { validateCaseDefinition, createValidationReport } from '@meridiano/case-schema';
import { astrolabioDefinition as source } from './fixtures/case-astrolabio.js';

const chain = [
  { fromCityId: 'madrid', toCityId: 'paris', minutes: 180 },
  { fromCityId: 'paris', toCityId: 'lisboa', minutes: 150 },
];

describe('T2-01: navegabilidad estructural del mapa', () => {
  it('acepta original y cadena dirigida sin exigir retorno ni modificar definición', () => {
    const original = structuredClone(source);
    const candidate = { ...original, travelDurations: chain };
    const before = structuredClone(candidate);
    expect(validateCaseDefinition(candidate)).toEqual({ valid: true, errors: [] });
    expect(validateCaseDefinition(source)).toEqual({ valid: true, errors: [] });
    expect(candidate).toEqual(before); expect(source).toEqual(original);
  });
  it('rechaza ciudad aislada aunque todos los IDs y el reporte sean válidos', () => {
    const candidate = { ...structuredClone(source), travelDurations: chain.slice(0, 1) };
    const result = validateCaseDefinition(candidate);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('travelDurations ciudades inalcanzables desde inicio: valor inválido.');
  });
  it('no inventa inversa ni conecta un ciclo separado del inicio', () => {
    const candidate = { ...structuredClone(source), travelDurations: [
      { fromCityId: 'paris', toCityId: 'madrid', minutes: 180 },
      { fromCityId: 'paris', toCityId: 'lisboa', minutes: 150 },
      { fromCityId: 'lisboa', toCityId: 'paris', minutes: 150 },
    ] };
    expect(validateCaseDefinition(candidate).valid).toBe(false);
  });
  it('cada ciudad necesita un lugar accesible; puede conservar lugares cerrados adicionales', () => {
    const candidate = structuredClone(source);
    candidate.locations = candidate.locations.map(location => ({ ...location, accessible: location.cityId !== 'lisboa' }));
    expect(validateCaseDefinition(candidate).errors).toContain('cities sin lugar accesible: valor inválido.');
    candidate.locations.push({ id: 'synthetic-open', cityId: 'lisboa', name: 'Entrada sintética', description: 'Acceso sintético', accessible: true });
    expect(validateCaseDefinition(candidate).valid).toBe(true);
  });
  it('ciudad sin lugares falla sin necesidad de consultar NPC o solución', () => {
    const candidate = { ...structuredClone(source), locations: source.locations.filter(location => location.cityId !== 'paris') };
    expect(validateCaseDefinition(candidate).errors).toContain('cities sin lugar accesible: valor inválido.');
  });
  it('puentes a través de referencias desconocidas no hacen navegable el mapa', () => {
    const candidate = { ...structuredClone(source), travelDurations: [
      { fromCityId: 'madrid', toCityId: 'missing', minutes: 1 },
      { fromCityId: 'missing', toCityId: 'paris', minutes: 1 }, chain[1],
    ] };
    const result = validateCaseDefinition(candidate);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('travelDurations ciudades inalcanzables desde inicio: valor inválido.');
  });
  it.each([0, -1, 0.5, Number.NaN, Number.POSITIVE_INFINITY])('ruta con coste inválido %s no conecta ciudades', minutes => {
    const candidate = { ...structuredClone(source), travelDurations: [{ ...chain[0], minutes }, chain[1]] };
    expect(validateCaseDefinition(candidate).errors).toContain('travelDurations ciudades inalcanzables desde inicio: valor inválido.');
  });
  it('mapa de una ciudad no necesita viajes', () => {
    const candidate = { ...structuredClone(source), id: 'synthetic-map', solution: 'synthetic-npc', rules: [], cities: source.cities.slice(0, 1), locations: source.locations.slice(0, 1),
      npcs: [{ id: 'synthetic-npc', name: 'Persona sintética', cityId: 'madrid', cooperation: 5, knowledge: [] }], evidence: [], travelDurations: [] };
    expect(validateCaseDefinition(candidate).valid).toBe(true);
  });
  it('errores genéricos no reproducen nombres ni identificadores privados', () => {
    const marker = 'SYNTHETIC_PRIVATE_MAP';
    const candidate = { ...structuredClone(source), cities: [...source.cities, { id: marker, name: marker, country: 'ES' }], travelDurations: [] };
    const result = validateCaseDefinition(candidate);
    expect(result.valid).toBe(false); expect(JSON.stringify(result.errors)).not.toContain(marker);
  });
  it('el reporte actual solo acredita etapa estructural, sin atribuir rutas de investigación', () => {
    expect(createValidationReport([])).toEqual({ validatorVersion: '1.5.0', scenarios: ['structural'], errors: [], status: 'validated' });
  });
});
