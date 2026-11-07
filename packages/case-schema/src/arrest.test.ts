// Detenciones automáticas (GDD §12): tipo de detención y reparto.
import { describe, expect, it } from 'vitest';
import { ARREST_COORDINATION_MINUTES, arrestTypeForCaseId, arrestTypeOf, isArrestType } from './arrest.js';
import type { CaseDefinition } from './types.js';

const definition = (arrestType: CaseDefinition['arrestType']): CaseDefinition =>
  ({ arrestType }) as CaseDefinition;

describe('tipo de detención (GDD §12)', () => {
  it('sin campo, la detención es interactiva (expedientes anteriores)', () => {
    expect(arrestTypeOf(definition(undefined))).toBe('interactive');
    expect(arrestTypeOf(definition('interactive'))).toBe('interactive');
    expect(arrestTypeOf(definition('automatic'))).toBe('automatic');
  });

  it('el reparto determinista por id es ~30 % automático y estable', () => {
    expect(arrestTypeForCaseId('generado-21d02570')).toBe(arrestTypeForCaseId('generado-21d02570'));
    let automatic = 0;
    const total = 1000;
    for (let i = 0; i < total; i++) {
      if (arrestTypeForCaseId(`generado-${i.toString(16).padStart(8, '0')}`) === 'automatic') automatic++;
    }
    expect(automatic / total).toBeGreaterThanOrEqual(0.25);
    expect(automatic / total).toBeLessThanOrEqual(0.35);
  });

  it('solo admite los dos modos del GDD', () => {
    expect(isArrestType('automatic')).toBe(true);
    expect(isArrestType('interactive')).toBe(true);
    expect(isArrestType('remote')).toBe(false);
    expect(isArrestType(undefined)).toBe(false);
  });

  it('coordinar con las autoridades cuesta 30 min, como un trámite', () => {
    expect(ARREST_COORDINATION_MINUTES).toBe(30);
  });
});
