import { describe, it, expect } from 'vitest';
import { validateCatalogParams, getBudgetForParams, getSuggestedDuration, deadlineMinutesForDifficulty, ALLOWED_REGIONS, ALLOWED_CRIME_TYPES, GDD_CRIME_TYPES, CRIME_TYPE_KEYS, CONTENT_RATING_KEYS, caseLabel } from './catalog.js';
import { createTranslator } from './i18n.js';

const t = createTranslator('es').t;

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

  it('deadlineMinutesForDifficulty escala el plazo base del expediente', () => {
    // Caso fijo del astrolabio (plazo base 2880, diseñado en normal): normal
    // conserva el plazo del expediente, fácil lo duplica y difícil lo reduce
    // a la mitad, siempre por encima de las rutas mínimas verificadas
    // (455/485, 545/575 con retrasos máximos).
    expect(deadlineMinutesForDifficulty(2880, 'easy')).toBe(5760);
    expect(deadlineMinutesForDifficulty(2880, 'normal')).toBe(2880);
    expect(deadlineMinutesForDifficulty(2880, 'hard')).toBe(1440);
    expect(deadlineMinutesForDifficulty(100, 'hard')).toBe(60);
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

  it('GDD_CRIME_TYPES es la lista canónica reconciliada en T4-08 (SPEC-007)', () => {
    expect([...GDD_CRIME_TYPES]).toEqual(['robo', 'desaparicion', 'fraude', 'espionaje', 'sabotaje', 'misterio-historico', 'extorsion', 'contrabando', 'corrupcion', 'falsificacion', 'homicidio', 'secuestro', 'aleatorio']);
  });

  it('cada delito del GDD tiene clave de etiqueta y se resuelve en español', () => {
    for (const crime of GDD_CRIME_TYPES) {
      expect(t(CRIME_TYPE_KEYS[crime]).length).toBeGreaterThan(0);
    }
    expect(t(CRIME_TYPE_KEYS.robo)).toBe('Robo internacional');
    expect(t(CRIME_TYPE_KEYS['misterio-historico'])).toBe('Misterio histórico');
    expect(t(CRIME_TYPE_KEYS.aleatorio)).toBe('Aleatorio');
  });

  it('caseLabel muestra delito y contenido por separado, nunca mezclados', () => {
    expect(caseLabel('robo', 'familiar', t)).toBe('Robo internacional · Familiar');
    expect(caseLabel('fraude', 'general', t)).toBe('Fraude · General');
    expect(caseLabel('robo', 'familiar', t)).not.toBe('Robo Familiar');
  });

  it('CONTENT_RATING_KEYS distingue Familiar y General', () => {
    expect(t(CONTENT_RATING_KEYS.familiar)).toBe('Familiar');
    expect(t(CONTENT_RATING_KEYS.general)).toBe('General');
  });
});
