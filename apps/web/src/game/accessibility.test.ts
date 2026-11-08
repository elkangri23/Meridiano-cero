// Accesibilidad (§15, WCAG 2.2 AA): contraste de los pares texto/fondo que
// usa de verdad la pantalla de juego, por paleta. Los valores son los
// tokens de game.css (.game) y style.css (paletas); el script
// scripts/dev/contrast-audit.mjs los mide desde el CSS real. AA pide
// >= 4.5 en texto normal y >= 3 en indicadores de foco.
import { describe, expect, it } from 'vitest';
import { contrastRatio, effectiveReducedMotion, objectiveStateText, relativeLuminance } from './accessibility';
import { createTranslator } from '@meridiano/contracts';

const t = createTranslator('es').t;

const BLACK = '#000000';
const WHITE = '#ffffff';

type PaletteTokens = { panel: string; gold: string; muted: string; error: string };
const PALETTES: Record<string, PaletteTokens> = {
  // Paleta por defecto (game.css): --error era #ff5555 (4,23 sobre panel)
  // y se aclaró a #ff7777 para pasar AA donde de verdad se pinta (ventanas).
  default: { panel: '#0000aa', gold: '#ffff55', muted: '#aaaaaa', error: '#ff7777' },
  protanopia: { panel: '#0000aa', gold: '#ffe14d', muted: '#aaaaaa', error: '#ff8800' },
  deuteranopia: { panel: '#0000aa', gold: '#ffe14d', muted: '#aaaaaa', error: '#ff8800' },
  // Tritanopia: --error era #ff5522 (3,79 sobre panel) y se aclaró a #ff8855.
  tritanopia: { panel: '#4a0096', gold: '#ffd400', muted: '#aaaaaa', error: '#ff8855' },
  // Alto contraste: panel negro, apagado blanco; dorado y error heredados.
  'high-contrast': { panel: '#000000', gold: '#ffff55', muted: '#ffffff', error: '#ff7777' },
};

describe('Contraste WCAG 2.2 AA (§15)', () => {
  it('blanco sobre negro es el máximo (21) y la fórmula es la WCAG', () => {
    expect(contrastRatio(WHITE, BLACK)).toBeCloseTo(21, 1);
    expect(relativeLuminance(WHITE)).toBeCloseTo(1, 3);
    expect(relativeLuminance(BLACK)).toBeCloseTo(0, 3);
  });

  it.each(Object.entries(PALETTES))('paleta %s: papel, dorado, apagado y error pasan AA sobre panel y sobre negro', (_name, tokens) => {
    expect(contrastRatio(WHITE, tokens.panel)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(tokens.gold, tokens.panel)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(tokens.muted, tokens.panel)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(tokens.error, tokens.panel)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(tokens.gold, BLACK)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(tokens.muted, BLACK)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(tokens.error, BLACK)).toBeGreaterThanOrEqual(4.5);
  });

  it('el botón activo de la barra (blanco sobre #005555) pasa AA en todas las paletas', () => {
    expect(contrastRatio(WHITE, '#005555')).toBeGreaterThanOrEqual(4.5);
  });

  it('el botón activo ya NO usa teal como fondo: blanco sobre #00aaaa era 2,86', () => {
    expect(contrastRatio(WHITE, '#00aaaa')).toBeLessThan(4.5);
  });

  it('el foco dorado sobre panel pasa el 3:1 de indicador de foco (WCAG 2.4.11)', () => {
    for (const tokens of Object.values(PALETTES)) {
      expect(contrastRatio(tokens.gold, tokens.panel)).toBeGreaterThanOrEqual(3);
    }
    expect(contrastRatio('#ffff55', BLACK)).toBeGreaterThanOrEqual(3);
  });

  it('los botones deshabilitados (#555555 sobre #aaaaaa, 3,2) están exentos por WCAG 1.4.3 (controles inactivos)', () => {
    expect(contrastRatio('#555555', '#aaaaaa')).toBeGreaterThan(3);
    expect(contrastRatio('#555555', '#aaaaaa')).toBeLessThan(4.5);
  });
});

describe('Movimiento reducido (§15)', () => {
  it('el interruptor manual manda si difiere del sistema', () => {
    expect(effectiveReducedMotion(true, false)).toBe(true);
    expect(effectiveReducedMotion(false, true)).toBe(true);
    expect(effectiveReducedMotion(false, false)).toBe(false);
    expect(effectiveReducedMotion(true, true)).toBe(true);
  });
});

describe('Equivalente textual de estados (§15)', () => {
  it('un objetivo logrado o pendiente se dice con palabras, no solo con ✓/○', () => {
    expect(objectiveStateText(true, t)).toBe('Logrado');
    expect(objectiveStateText(false, t)).toBe('Pendiente');
  });
});
