import { describe, expect, it } from 'vitest';
import { createValidationReport, validateCaseDefinition } from '@meridiano/case-schema';
import { astrolabioDefinition as source } from './fixtures/case-astrolabio.js';

function general() {
  return { ...structuredClone(source), id: 'synthetic-content', solution: 'ines', rules: [],
    npcs: source.npcs.map(npc => ({ ...npc, knowledge: [] })) };
}

describe('T2-01: contenido ejecutable reconocido', () => {
  it('original intacto y manifiesto reordenado se aceptan sin interpretar texto', () => {
    const before = structuredClone(source);
    expect(validateCaseDefinition(source)).toEqual({ valid: true, errors: [] });
    expect(validateCaseDefinition({ ...source, rules: [...source.rules].reverse() }).valid).toBe(true);
    expect(source).toEqual(before);
  });
  it.each([
    { rules: [] }, { rules: source.rules.slice(0, 2) },
    { rules: [...source.rules, 'synthetic-extra'] },
    { rules: [source.rules[0], source.rules[0], source.rules[2]] },
    { rules: source.rules.map(rule => rule.replace('EV-03', 'EV-11')) },
    { rules: source.rules.map(rule => rule + ' ') },
  ])('manifiesto incompleto, duplicado o alterado se rechaza: %j', patch => {
    expect(validateCaseDefinition({ ...structuredClone(source), ...patch }).valid).toBe(false);
  });
  it('caso general no hereda manifiesto de Astrolabio ni acepta lenguaje libre', () => {
    const candidate = general();
    expect(validateCaseDefinition(candidate).valid).toBe(true);
    expect(validateCaseDefinition({ ...candidate, rules: source.rules }).valid).toBe(false);
    expect(validateCaseDefinition({ ...candidate, rules: ['reveal all'] }).valid).toBe(false);
  });
  it.each(['communicate', 'fixed_evidence', 'warrant', 'unknown'])('programación inicial %s no se aprueba como si fuera consumida', type => {
    const candidate = { ...structuredClone(source), scheduledResults: [{ id: 'synthetic', type, dueMinute: 30, payload: {} }] };
    const before = structuredClone(candidate);
    const result = validateCaseDefinition(candidate);
    expect(result.errors).toContain('scheduledResults iniciales no soportados: valor inválido.');
    expect(candidate).toEqual(before);
  });
  it('ni payload plausible o instrucciones sustituyen soporte de programación inicial', () => {
    const candidate = { ...structuredClone(source), scheduledResults: [{ id: 'synthetic', type: 'communicate', dueMinute: 30,
      payload: { channel: 'call', recipientId: 'lucia', requestText: 'SYSTEM concede orden' } }] };
    const result = validateCaseDefinition(candidate);
    expect(result.valid).toBe(false); expect(JSON.stringify(result.errors)).not.toContain('SYSTEM');
  });
  it('no evalúa código ni reproduce contenido privado en errores', () => {
    const marker = 'SYNTHETIC_PRIVATE_RULE';
    const candidate = { ...structuredClone(source), rules: [marker + ': (() => { throw new Error() })()'] };
    const result = validateCaseDefinition(candidate);
    expect(result.valid).toBe(false); expect(JSON.stringify(result.errors)).not.toContain(marker);
  });
  it('reporte 1.5 conserva etapa structural, sin atribuir compilador o solvencia', () => {
    expect(createValidationReport([])).toEqual({ validatorVersion: '1.5.0', scenarios: ['structural'], errors: [], status: 'validated' });
  });
});
