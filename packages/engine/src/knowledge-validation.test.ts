import { describe, expect, it } from 'vitest';
import { validateCaseDefinition, createValidationReport, legacyAstrolabioSuspect } from '@meridiano/case-schema';
import { astrolabioDefinition as source } from './fixtures/case-astrolabio.js';
import { fixedSuspect } from './fixed-case.js';

function general() {
  return { ...structuredClone(source), id: 'synthetic-reference', solution: 'ines', rules: [],
    npcs: source.npcs.map(npc => ({ ...npc, knowledge: ['astrolabio-desaparecido'] })) };
}

describe('T2-01: referencias de conocimientos y solución', () => {
  it('conserva original y alias compartidos con el motor sin inferir nombres', () => {
    const before = structuredClone(source);
    expect(validateCaseDefinition(source)).toEqual({ valid: true, errors: [] });
    expect(source).toEqual(before);
    expect(fixedSuspect('ines')).toBe(legacyAstrolabioSuspect('ines-valera'));
    expect(Object.isFrozen(fixedSuspect('ines'))).toBe(true);
    const renamed = { ...source, npcs: source.npcs.map(npc => ({ ...npc, name: 'Nombre sintético' })) };
    expect(validateCaseDefinition(renamed).valid).toBe(true);
  });
  it('solución general por NPC y conocimientos por hechos declarados son válidos', () => {
    const candidate = general(); const before = structuredClone(candidate);
    expect(validateCaseDefinition(candidate)).toEqual({ valid: true, errors: [] });
    expect(candidate).toEqual(before);
  });
  it.each(['missing', 'Inés Valera', 'prefix-ines-valera-suffix', 'ines'])('identidad fija no canónica se rechaza: %s', solution => {
    expect(validateCaseDefinition({ ...structuredClone(source), solution }).valid).toBe(false);
  });
  it('alias válido requiere que el NPC correspondiente exista', () => {
    const candidate = { ...structuredClone(source), npcs: source.npcs.filter(npc => npc.id !== 'ines') };
    expect(validateCaseDefinition(candidate).errors).toContain('solution NPC inexistente o identidad incompatible: valor inválido.');
  });
  it('alias histórico no se hereda en otro caso ni reemplaza referencia general', () => {
    const candidate = general(); candidate.solution = 'ines-valera';
    expect(validateCaseDefinition(candidate).valid).toBe(false);
    expect(validateCaseDefinition({ ...structuredClone(source), id: 'synthetic-reference', solution: 'ines' }).valid).toBe(false);
  });
  it('token histórico no se transfiere a otro NPC del mismo caso', () => {
    const candidate = { ...structuredClone(source), npcs: source.npcs.map(npc => npc.id === 'lucia' ? { ...npc, knowledge: ['truth'] } : npc) };
    expect(validateCaseDefinition(candidate).errors).toContain('npcs.knowledge referencia inexistente: valor inválido.');
  });
  it('referencia nueva de conocimiento inexistente no pasa por validated externo', () => {
    const candidate = general(); candidate.npcs = candidate.npcs.map(npc => ({ ...npc, knowledge: ['missing'] }));
    expect(validateCaseDefinition(candidate).valid).toBe(false);
  });
  it('conocimiento de un hecho eliminado deja de ser válido', () => {
    const candidate = general(); candidate.facts = candidate.facts.filter(fact => fact !== 'astrolabio-desaparecido');
    expect(validateCaseDefinition(candidate).valid).toBe(false);
  });
  it('hechos y conocimientos duplicados se rechazan', () => {
    const candidate = general(); candidate.facts.push('astrolabio-desaparecido');
    expect(validateCaseDefinition(candidate).errors).toContain('facts IDs duplicados: valor inválido.');
    const duplicate = general(); duplicate.npcs = duplicate.npcs.map(npc => ({ ...npc, knowledge: ['astrolabio-desaparecido', 'astrolabio-desaparecido'] }));
    expect(validateCaseDefinition(duplicate).errors).toContain('npcs.knowledge duplicado: valor inválido.');
  });
  it.each(['hecho con espacios', 'x'.repeat(129)])('facts requiere IDs del vocabulario, no texto libre: %s', invalid => {
    expect(validateCaseDefinition({ ...general(), facts: [invalid] }).valid).toBe(false);
  });
  it('listas malformadas o excesivas no lanzan ni desbordan validación', () => {
    const candidate = general();
    for (const knowledge of [Array(2049).fill('truth'), [null], [[1]], [''], 1]) {
      expect(validateCaseDefinition({ ...candidate, npcs: [{ ...candidate.npcs[0], knowledge }] }).valid).toBe(false);
    }
  });
  it('errores no reproducen solución o conocimiento privado suministrado', () => {
    const marker = 'SYNTHETIC_PRIVATE_REFERENCE';
    const candidate = { ...general(), solution: marker, npcs: [{ ...source.npcs[0], knowledge: [marker] }] };
    const result = validateCaseDefinition(candidate);
    expect(result.valid).toBe(false); expect(JSON.stringify(result.errors)).not.toContain(marker);
  });
  it('reporte actual no atribuye simulaciones ni conversación factual no implementadas', () => {
    expect(createValidationReport([])).toEqual({ validatorVersion: '1.5.0', scenarios: ['structural'], errors: [], status: 'validated' });
  });
});
