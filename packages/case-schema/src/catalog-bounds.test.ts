import { describe, it, expect } from 'vitest';
import { validateCatalogBoundary, validateCareerBoundary } from './catalog-bounds.js';
import { createInitialCareer } from './career.js';
import { CAREER_VERSION, isCareerVersionCompatible } from './borders.js';

describe('catalog-bounds', () => {
  it('validateCatalogBoundary acepta parámetros válidos', () => {
    const result = validateCatalogBoundary({
      crimeType: 'fraude',
      difficulty: 'normal',
      explorationMode: 'guided',
      duration: 'medium',
      region: 'madrid',
      contentMode: 'fixed',
    });
    expect(result.valid).toBe(true);
  });

  it('validateCatalogBoundary rechaza combinación prohibida', () => {
    const result = validateCatalogBoundary({
      crimeType: 'fraude',
      difficulty: 'hard',
      explorationMode: 'guided',
      duration: 'short',
      region: 'madrid',
      contentMode: 'fixed',
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it('validateCatalogBoundary rechaza región inventada', () => {
    const result = validateCatalogBoundary({
      crimeType: 'fraude',
      difficulty: 'easy',
      explorationMode: 'guided',
      duration: 'medium',
      region: 'ciudad-fantasma',
      contentMode: 'fixed',
    });
    expect(result.valid).toBe(false);
  });

  it('validateCareerBoundary acepta resultados válidos', () => {
    const career = createInitialCareer('u');
    // complete/parcial/unresolved no producen dimensiones negativas desde cero
    expect(validateCareerBoundary('complete', career).valid).toBe(true);
    expect(validateCareerBoundary('partial', career).valid).toBe(true);
    expect(validateCareerBoundary('unresolved', career).valid).toBe(true);
  });

  it('validateCareerBoundary rechaza resultado que produce dimensión negativa', () => {
    const career = createInitialCareer('u');
    // incorrect produce trustDelta=-10 desde cero → negativo
    expect(validateCareerBoundary('incorrect', career).valid).toBe(false);
  });

  it('validateCareerBoundary acepta incorrect con career suficientemente alto', () => {
    const career = { ...createInitialCareer('u'), prestige: 20, integrity: 20, trust: 20 };
    expect(validateCareerBoundary('incorrect', career).valid).toBe(true);
  });

  it('isCareerVersionCompatible detecta versión', () => {
    expect(isCareerVersionCompatible(1, CAREER_VERSION)).toBe(true);
    expect(isCareerVersionCompatible(99, CAREER_VERSION)).toBe(false);
  });
});
