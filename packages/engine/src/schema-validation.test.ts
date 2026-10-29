import { describe, expect, it } from 'vitest';
import { validateCaseDefinition, createValidationReport } from '@meridiano/case-schema';
import { astrolabioDefinition as source } from './fixtures/case-astrolabio.js';

const valid = () => structuredClone(source);

describe('T2-01: estructura y referencias del expediente', () => {
  it('valida el original sin modificarlo ni tratar su reporte como certificado', () => {
    const before = valid();
    expect(validateCaseDefinition(source)).toEqual({ valid: true, errors: [] });
    expect(source).toEqual(before);
  });
  it.each([
    { label: 'acceso string', patch: { locations: [{ ...source.locations[0], accessible: 'true' }] } },
    { label: 'admisibilidad string', patch: { evidence: [{ ...source.evidence[0], admissible: 'true' }] } },
    { label: 'cooperación string', patch: { npcs: [{ ...source.npcs[0], cooperation: '7' }] } },
    { label: 'cooperación fuera de rango', patch: { npcs: [{ ...source.npcs[0], cooperation: 11 }] } },
    { label: 'conocimiento objeto', patch: { npcs: [{ ...source.npcs[0], knowledge: [{}] }] } },
    { label: 'hecho objeto', patch: { facts: [{}] } },
    { label: 'regla objeto', patch: { rules: [{}] } },
    { label: 'objetivo falso booleano', patch: { objectives: [{ ...source.objectives[0], achieved: 'false' }] } },
    { label: 'nombre ausente', patch: { cities: [{ id: 'synthetic', country: 'ES' }] } },
    { label: 'país inválido', patch: { cities: [{ ...source.cities[0], country: 'España' }] } },
    { label: 'relación no string', patch: { evidence: [{ ...source.evidence[0], relations: [1] }] } },
    { label: 'relación duplicada', patch: { evidence: [{ ...source.evidence[0], relations: ['EV-02', 'EV-02'] }, source.evidence[1]] } },
    { label: 'ciudades vacío', patch: { cities: [] } },
    { label: 'lugares vacío', patch: { locations: [] } },
    { label: 'objetivos vacío', patch: { objectives: [] } },
    { label: 'array raíz', patch: null },
  ])('$label se rechaza sin excepción', ({ patch }) => {
    const candidate = patch === null ? [] : { ...valid(), ...patch };
    const before = structuredClone(candidate);
    const result = validateCaseDefinition(candidate);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(candidate).toEqual(before);
  });
  it.each([
    { label: 'ciudad de lugar', patch: { locations: [{ ...source.locations[0], cityId: 'missing' }] } },
    { label: 'ciudad de NPC', patch: { npcs: [{ ...source.npcs[0], cityId: 'missing' }] } },
    { label: 'origen de evidencia', patch: { evidence: [{ ...source.evidence[0], origin: 'missing' }] } },
    { label: 'prueba derivada', patch: { evidence: [{ ...source.evidence[0], relations: ['missing'] }] } },
    { label: 'viaje', patch: { travelDurations: [{ fromCityId: 'madrid', toCityId: 'missing', minutes: 10 }] } },
    { label: 'ruta duplicada', patch: { travelDurations: [source.travelDurations[0], source.travelDurations[0]] } },
    { label: 'ruta circular inmediata', patch: { travelDurations: [{ fromCityId: 'madrid', toCityId: 'madrid', minutes: 10 }] } },
    { label: 'viaje gratuito', patch: { travelDurations: [{ fromCityId: 'madrid', toCityId: 'paris', minutes: 0 }] } },
    { label: 'posición inicial inaccesible', patch: { locations: [{ ...source.locations[0], accessible: false }] } },
    { label: 'posición inicial en otra ciudad', patch: { locations: [source.locations[1], source.locations[0], source.locations[2]] } },
  ])('referencia inválida: $label, aunque el reporte diga validated', ({ patch }) => {
    expect(validateCaseDefinition({ ...valid(), ...patch }).valid).toBe(false);
  });
  it('rechaza ciclo indirecto de procedencia sin recursión ni desbordamiento', () => {
    const candidate = valid();
    candidate.evidence = candidate.evidence.map(evidence => evidence.id === 'EV-02' ? { ...evidence, relations: ['EV-03'] } : evidence);
    const result = validateCaseDefinition(candidate);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('evidence.relations grafo no resoluble: valor inválido.');
  });
  it('IDs duplicados entre colecciones se rechazan', () => {
    const candidate = valid();
    candidate.objectives = [{ id: 'madrid', description: 'sintético', achieved: false }];
    expect(validateCaseDefinition(candidate).valid).toBe(false);
  });
  it('solicitudes programadas requieren identidad, tipo y payload propios', () => {
    const candidate = { ...valid(), scheduledResults: [{ id: 'synthetic', dueMinute: 1 }] };
    expect(validateCaseDefinition(candidate).valid).toBe(false);
  });
  it('no acepta un reporte con errores ni campos de versión/escenarios inválidos', () => {
    for (const validationReport of [null, { status: 'validated', errors: ['falló'], scenarios: [], validatorVersion: 'synthetic' },
      { status: 'validated', errors: [], scenarios: [null], validatorVersion: 1 }]) {
      expect(validateCaseDefinition({ ...valid(), validationReport }).valid).toBe(false);
    }
  });
  it('limita tamaño de colecciones y textos antes de validarlos elemento a elemento', () => {
    expect(validateCaseDefinition({ ...valid(), facts: Array(2049).fill('synthetic') }).valid).toBe(false);
    expect(validateCaseDefinition({ ...valid(), solution: 'x'.repeat(16385) }).valid).toBe(false);
  });
  it('los errores no reproducen contenido privado suministrado', () => {
    const privateSentinel = 'SYNTHETIC_PRIVATE_SENTINEL';
    const candidate = { ...valid(), evidence: [{ id: privateSentinel, origin: privateSentinel, minute: -1, type: privateSentinel, relations: [] }] };
    const result = validateCaseDefinition(candidate);
    expect(result.valid).toBe(false);
    expect(JSON.stringify(result.errors)).not.toContain(privateSentinel);
  });
  it('el reporte creado copia errores y no atribuye rutas o simulaciones no ejecutadas', () => {
    const errors = ['sintético'];
    const report = createValidationReport(errors);
    errors.length = 0;
    expect(report.errors).toEqual(['sintético']);
    expect(report.scenarios).toEqual(['structural']);
    expect(report.status).toBe('rejected');
  });
  it.each([{ field: 'cities', maximum: 20 }, { field: 'locations', maximum: 100 }, { field: 'npcs', maximum: 100 }, { field: 'evidence', maximum: 1000 }])('acota $field conforme al límite documentado', ({ field, maximum }) => {
    const result = validateCaseDefinition({ ...valid(), [field]: Array(maximum + 1).fill({}) });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(`${field}: array requerido, máximo ${maximum} entradas.`);
  });

});
