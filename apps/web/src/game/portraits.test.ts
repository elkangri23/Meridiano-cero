import { describe, expect, it } from 'vitest';
import {
  ACCESSORIES, CLOTHING_COLORS, CLOTHING_STYLES, EYE_COLORS, FACIAL_HAIRS,
  FIXED_PORTRAITS, HAIR_COLORS, HAIR_STYLES, PORTRAIT_HEIGHT, PORTRAIT_WIDTH,
  SKIN_TONES, portraitGrid, portraitGridKey, portraitHash, portraitPaletteColors,
  portraitSeed, portraitTraitsFor, teamPortraitSeed,
} from './portraits';

/** Luminancia relativa (WCAG) de un color hex, para la guarda de daltonismo:
 * dos colores que solo se distinguen por el tono fallan; por luminancia, no. */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map(index => {
    const value = parseInt(hex.slice(index, index + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * (channels[0] ?? 0) + 0.7152 * (channels[1] ?? 0) + 0.0722 * (channels[2] ?? 0);
}

/** NPC reales de los 11 casos generados de producción (de la BD, sin
 * tocarlos) y del caso fijo: en cada caso, los cuatro retratos deben ser
 * distintos entre sí. */
const PRODUCTION_CASES: ReadonlyArray<readonly string[]> = [
  ['generado-1589b7bf:marcos', 'generado-1589b7bf:laura', 'generado-1589b7bf:jorge', 'generado-1589b7bf:ana'],
  ['generado-1dfd99b9:carlos', 'generado-1dfd99b9:marcos', 'generado-1dfd99b9:laura', 'generado-1dfd99b9:sofia'],
  ['generado-21d02570:elena', 'generado-21d02570:marcos', 'generado-21d02570:laura', 'generado-21d02570:jorge'],
  ['generado-25b39aed:elena', 'generado-25b39aed:marcos', 'generado-25b39aed:laura', 'generado-25b39aed:jorge'],
  ['generado-4242ea44:marcos-vega', 'generado-4242ea44:laura-santos', 'generado-4242ea44:jorge-mendez', 'generado-4242ea44:ana-ruiz'],
  ['generado-48a17a5b:laura-vega', 'generado-48a17a5b:marcos-ruiz', 'generado-48a17a5b:ana-soto', 'generado-48a17a5b:diego-ramos'],
  ['generado-4b7a3c11:marcos-ibarra', 'generado-4b7a3c11:laura-ruiz', 'generado-4b7a3c11:elena-vargas', 'generado-4b7a3c11:jorge-mendez'],
  ['generado-71f0f281:alvaro', 'generado-71f0f281:lucia', 'generado-71f0f281:carmen', 'generado-71f0f281:roberto'],
  ['generado-8621c8a9:marcos', 'generado-8621c8a9:laura', 'generado-8621c8a9:jorge', 'generado-8621c8a9:ana'],
  ['generado-9c165dae:marcos', 'generado-9c165dae:laura', 'generado-9c165dae:jorge', 'generado-9c165dae:sofia'],
  ['generado-f6559983:elena', 'generado-f6559983:marcos', 'generado-f6559983:lucia', 'generado-f6559983:diego'],
  ['astrolabio-tres-ciudades:lucia', 'astrolabio-tres-ciudades:tomas', 'astrolabio-tres-ciudades:marta', 'astrolabio-tres-ciudades:ines', 'astrolabio-tres-ciudades:emile'],
];

describe('retratos pixel-art: deterministas y distintos', () => {
  it('la misma semilla da siempre los mismos rasgos y la misma rejilla', () => {
    for (const seed of ['astrolabio-tres-ciudades:lucia', 'generado-21d02570:marcos', 'team:margaret', 'generado-99a81ebb:ines']) {
      expect(portraitTraitsFor(seed)).toEqual(portraitTraitsFor(seed));
      expect(portraitGridKey(portraitGrid(portraitTraitsFor(seed))))
        .toBe(portraitGridKey(portraitGrid(portraitTraitsFor(seed))));
      expect(portraitHash(seed)).toBe(portraitHash(seed));
    }
  });

  it('la semilla es caso:npc para expedientes y team:miembro para el equipo', () => {
    expect(portraitSeed('generado-21d02570', 'marcos')).toBe('generado-21d02570:marcos');
    expect(portraitSeed('astrolabio-tres-ciudades', 'ines')).toBe('astrolabio-tres-ciudades:ines');
    expect(teamPortraitSeed('margaret')).toBe('team:margaret');
  });

  it('la tabla fija cubre los 5 NPC del caso fijo y los 5 miembros del equipo', () => {
    expect(Object.keys(FIXED_PORTRAITS).sort()).toEqual([
      'astrolabio-tres-ciudades:emile', 'astrolabio-tres-ciudades:ines', 'astrolabio-tres-ciudades:lucia',
      'astrolabio-tres-ciudades:marta', 'astrolabio-tres-ciudades:tomas',
      'team:clara', 'team:david', 'team:elena', 'team:margaret', 'team:richter',
    ]);
    for (const traits of Object.values(FIXED_PORTRAITS)) {
      expect(SKIN_TONES).toContain(traits.skin);
      expect(HAIR_STYLES).toContain(traits.hairStyle);
      expect(HAIR_COLORS).toContain(traits.hairColor);
      expect(EYE_COLORS).toContain(traits.eyeColor);
      expect(CLOTHING_COLORS).toContain(traits.clothingColor);
      expect(CLOTHING_STYLES).toContain(traits.clothingStyle);
      expect(ACCESSORIES).toContain(traits.accessory);
      expect(FACIAL_HAIRS).toContain(traits.facialHair);
    }
  });

  it('los retratos fijos son distintos entre sí', () => {
    const keys = Object.keys(FIXED_PORTRAITS).map(seed => portraitGridKey(portraitGrid(portraitTraitsFor(seed))));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('en cada caso de producción, los cuatro personajes se ven distintos', () => {
    for (const seeds of PRODUCTION_CASES) {
      const keys = seeds.map(seed => portraitGridKey(portraitGrid(portraitTraitsFor(seed))));
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it('el mismo id en casos distintos da retratos distintos (la semilla lleva el caso)', () => {
    expect(portraitGridKey(portraitGrid(portraitTraitsFor('generado-71f0f281:lucia'))))
      .not.toBe(portraitGridKey(portraitGrid(portraitTraitsFor('generado-f6559983:lucia'))));
    expect(portraitGridKey(portraitGrid(portraitTraitsFor('generado-1589b7bf:marcos'))))
      .not.toBe(portraitGridKey(portraitGrid(portraitTraitsFor('generado-21d02570:marcos'))));
    expect(portraitGridKey(portraitGrid(portraitTraitsFor('generado-21d02570:elena'))))
      .not.toBe(portraitGridKey(portraitGrid(portraitTraitsFor('team:elena'))));
  });

  it('toda rejilla mide 16×20 y solo usa colores de la paleta del retrato', () => {
    const allowed = new Set(portraitPaletteColors());
    const seeds = [...PRODUCTION_CASES.flat(), 'team:margaret', 'team:richter', 'team:elena', 'team:david', 'team:clara'];
    for (const seed of seeds) {
      const grid = portraitGrid(portraitTraitsFor(seed));
      expect(grid.length).toBe(PORTRAIT_HEIGHT);
      for (const row of grid) {
        expect(row.length).toBe(PORTRAIT_WIDTH);
        for (const color of row) expect(allowed.has(color)).toBe(true);
      }
    }
  });

  it('cada retrato tiene cara: piel en la frente, ojos y boca', () => {
    for (const seed of ['astrolabio-tres-ciudades:lucia', 'generado-21d02570:marcos', 'team:richter']) {
      const traits = portraitTraitsFor(seed);
      const grid = portraitGrid(traits);
      // Frente (fila 5) y mejillas con el tono de piel del personaje.
      expect(grid[5]?.slice(5, 11)).toContain(traits.skin);
      // Ojos con su color y boca en su sitio.
      expect(grid[8]).toContain(traits.eyeColor);
      expect(grid[13]).toContain('#7a2a1a');
    }
  });

  it('los colores de cada vocabulario se distinguen por luminancia, no solo por tono', () => {
    for (const vocabulary of [SKIN_TONES, HAIR_COLORS, EYE_COLORS, CLOTHING_COLORS]) {
      const values = vocabulary.map(luminance).sort((a, b) => a - b);
      for (let i = 1; i < values.length; i++) {
        expect((values[i] ?? 0) - (values[i - 1] ?? 0)).toBeGreaterThanOrEqual(0.02);
      }
    }
  });
});
