import { describe, it, expect } from 'vitest';
import { validateCatalogParams, getBudgetForParams, getSuggestedDuration, ALLOWED_REGIONS, ALLOWED_CRIME_TYPES } from './catalog.js';

describe('catalog', () => {
  it('acepta parámetros válidos', () => {
    const result = validateCatalogParams({
      crimeType: 'fraude',
      difficulty: 'normal',
      explorationMode: 'guided',
      duration: 'medium',
      region: 'madrid',
      contentMode: 'generated',
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rechaza tipo de delito inválido', () => {
    const result = validateCatalogParams({
      crimeType: 'inventado',
      difficulty: 'normal',
      explorationMode: 'guided',
      duration: 'medium',
      region: 'madrid',
      contentMode: 'generated',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Tipo de delito'))).toBe(true);
  });

  it('rechaza región inválida', () => {
    const result = validateCatalogParams({
      crimeType: 'fraude',
      difficulty: 'normal',
      explorationMode: 'guided',
      duration: 'medium',
      region: 'atlantis',
      contentMode: 'generated',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Región'))).toBe(true);
  });

  it('rechaza combinación hard + short', () => {
    const result = validateCatalogParams({
      crimeType: 'fraude',
      difficulty: 'hard',
      explorationMode: 'guided',
      duration: 'short',
      region: 'madrid',
      contentMode: 'generated',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Combinación inválida'))).toBe(true);
  });

  it('rechaza combinación normal + short', () => {
    const result = validateCatalogParams({
      crimeType: 'fraude',
      difficulty: 'normal',
      explorationMode: 'guided',
      duration: 'short',
      region: 'madrid',
      contentMode: 'generated',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Combinación inválida'))).toBe(true);
  });

  it('rechaza objeto no válido', () => {
    const result = validateCatalogParams(null);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
  });

  it('rechaza modo de contenido inválido', () => {
    const result = validateCatalogParams({
      crimeType: 'fraude',
      difficulty: 'normal',
      explorationMode: 'guided',
      duration: 'medium',
      region: 'madrid',
      contentMode: 'premium',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Modo de contenido'))).toBe(true);
  });

  it('getBudgetForParams devuelve presupuesto correcto', () => {
    const params = { crimeType: 'fraude', difficulty: 'easy' as const, explorationMode: 'guided' as const, duration: 'short' as const, region: 'madrid', contentMode: 'generated' as const };
    expect(getBudgetForParams(params)).toBe(300);
  });

  it('getSuggestedDuration devuelve duración sugerida', () => {
    expect(getSuggestedDuration('hard')).toBe('long');
    expect(getSuggestedDuration('easy')).toBe('short');
  });

  it('ALLOWED_REGIONS incluye aleatorio y ciudades reales', () => {
    expect(ALLOWED_REGIONS).toContain('aleatorio');
    expect(ALLOWED_REGIONS).toContain('madrid');
    expect(ALLOWED_REGIONS).toContain('barcelona');
  });

  it('ALLOWED_CRIME_TYPES incluye aleatorio', () => {
    expect(ALLOWED_CRIME_TYPES).toContain('aleatorio');
    expect(ALLOWED_CRIME_TYPES).toContain('fraude');
  });
});