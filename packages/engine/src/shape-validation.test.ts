import { describe, expect, it } from 'vitest';
import { createValidationReport, validateCaseDefinition } from '@meridiano/case-schema';
import { hashDefinition } from '@meridiano/case-schema/server';
import { astrolabioDefinition as source } from './fixtures/case-astrolabio.js';

const collections = ['cities', 'locations', 'npcs', 'evidence', 'objectives', 'travelDurations'] as const;
describe('T2-01: formato cerrado del expediente 1.5', () => {
  it('original se acepta sin mutación ni cambio de hash y las claves no dependen del orden', () => {
    const before = structuredClone(source); const hash = hashDefinition(source);
    expect(validateCaseDefinition(source)).toEqual({ valid: true, errors: [] });
    const reordered = Object.fromEntries(Object.entries(source).reverse());
    expect(validateCaseDefinition(reordered).valid).toBe(true);
    expect(source).toEqual(before); expect(hashDefinition(source)).toBe(hash);
  });
  it.each(['conversationPolicy', 'disclosureRules', 'script', 'schema_version'])('rechaza campo raíz no ejecutado: %s', field => {
    const candidate = { ...structuredClone(source), [field]: { marker: 'SYNTHETIC_PRIVATE' } };
    const before = structuredClone(candidate); const report = validateCaseDefinition(candidate);
    expect(report.errors).toContain('definition campos no soportados o ausentes: valor inválido.');
    expect(JSON.stringify(report.errors)).not.toContain(field); expect(JSON.stringify(report.errors)).not.toContain('SYNTHETIC_PRIVATE');
    expect(candidate).toEqual(before);
  });
  it.each(collections)('rechaza campos desconocidos en %s sin limpiarlos silenciosamente', name => {
    const candidate = { ...structuredClone(source), [name]: source[name].map(entry => ({ ...entry, unsupported: 'SYNTHETIC_PRIVATE' })) };
    const report = validateCaseDefinition(candidate);
    expect(report.valid).toBe(false);
    expect(report.errors).toContain(name + ' campos no soportados o ausentes: valor inválido.');
    expect(JSON.stringify(report.errors)).not.toContain('SYNTHETIC_PRIVATE');
  });
  it('política NPC plausible no se aprueba sin soporte del motor', () => {
    const candidate = { ...source, npcs: source.npcs.map(npc => ({ ...npc, disclosureRules: [{ topicId: 'caja', requireEvidence: ['EV-03'] }] })) };
    expect(validateCaseDefinition(candidate).valid).toBe(false);
  });
  it.each(['id', 'rules', 'validationReport'])('rechaza campo obligatorio ausente: %s', field => {
    const candidate: Record<string, unknown> = { ...structuredClone(source) }; delete candidate[field];
    expect(validateCaseDefinition(candidate).valid).toBe(false);
  });
  it('reporte externo no amplía permisos ni añade resultados de simulación aceptados', () => {
    const candidate = { ...source, validationReport: { ...source.validationReport, approvedPolicies: true } };
    expect(validateCaseDefinition(candidate).valid).toBe(false);
    expect(createValidationReport([])).toEqual({ validatorVersion: '1.5.0', scenarios: ['structural'], errors: [], status: 'validated' });
  });
  it('nombres con coma no se confunden con varias claves del contrato', () => {
    const candidate: Record<string, unknown> = { ...structuredClone(source) };
    delete candidate.facts; delete candidate.id;
    candidate['facts,id'] = 'synthetic';
    expect(validateCaseDefinition(candidate).errors).toContain('definition campos no soportados o ausentes: valor inválido.');
  });
  it('propiedad JSON __proto__ se rechaza sin contaminar otros objetos', () => {
    const candidate: unknown = JSON.parse(JSON.stringify(source).replace('{', '{"__proto__":{"SYNTHETIC_PRIVATE":true},'));
    expect(validateCaseDefinition(candidate).valid).toBe(false);
    expect(Object.hasOwn(Object.prototype, 'SYNTHETIC_PRIVATE')).toBe(false);
  });
});
