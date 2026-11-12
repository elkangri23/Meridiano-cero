import { describe, expect, it } from 'vitest';
import {
  ACCESSORIES, CLOTHING_COLORS, CLOTHING_STYLES, EYE_COLORS, FACIAL_HAIRS,
  FIXED_PHOTO_PORTRAITS, FIXED_PORTRAITS, GENERIC_PHOTO_PORTRAITS,
  GENERIC_PHOTO_PORTRAITS_MEN, GENERIC_PHOTO_PORTRAITS_WOMEN, HAIR_COLORS, HAIR_STYLES, PORTRAIT_HEIGHT, PORTRAIT_WIDTH,
  SKIN_TONES, genericPhotoPortraitFor, inferNpcGender, photoPortraitFor, portraitGrid, portraitGridKey, portraitHash, portraitPaletteColors,
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

/** NPC reales de los 12 casos generados de producción (de la BD, sin
 * tocarlos) y del caso fijo: en cada caso, los cuatro retratos deben ser
 * distintos entre sí. El caso generado-639534d3 faltaba en esta lista
 * (se añadió con el arreglo por género, 2026-11-12): la BD tiene 12
 * generados, no 11. */
const PRODUCTION_CASES: ReadonlyArray<readonly string[]> = [
  ['generado-1589b7bf:marcos', 'generado-1589b7bf:laura', 'generado-1589b7bf:jorge', 'generado-1589b7bf:ana'],
  ['generado-1dfd99b9:carlos', 'generado-1dfd99b9:marcos', 'generado-1dfd99b9:laura', 'generado-1dfd99b9:sofia'],
  ['generado-21d02570:elena', 'generado-21d02570:marcos', 'generado-21d02570:laura', 'generado-21d02570:jorge'],
  ['generado-25b39aed:elena', 'generado-25b39aed:marcos', 'generado-25b39aed:laura', 'generado-25b39aed:jorge'],
  ['generado-4242ea44:marcos-vega', 'generado-4242ea44:laura-santos', 'generado-4242ea44:jorge-mendez', 'generado-4242ea44:ana-ruiz'],
  ['generado-48a17a5b:laura-vega', 'generado-48a17a5b:marcos-ruiz', 'generado-48a17a5b:ana-soto', 'generado-48a17a5b:diego-ramos'],
  ['generado-4b7a3c11:marcos-ibarra', 'generado-4b7a3c11:laura-ruiz', 'generado-4b7a3c11:elena-vargas', 'generado-4b7a3c11:jorge-mendez'],
  ['generado-639534d3:alvaro', 'generado-639534d3:carmen', 'generado-639534d3:luis', 'generado-639534d3:marta'],
  ['generado-71f0f281:alvaro', 'generado-71f0f281:lucia', 'generado-71f0f281:carmen', 'generado-71f0f281:roberto'],
  ['generado-8621c8a9:marcos', 'generado-8621c8a9:laura', 'generado-8621c8a9:jorge', 'generado-8621c8a9:ana'],
  ['generado-9c165dae:marcos', 'generado-9c165dae:laura', 'generado-9c165dae:jorge', 'generado-9c165dae:sofia'],
  ['generado-f6559983:elena', 'generado-f6559983:marcos', 'generado-f6559983:lucia', 'generado-f6559983:diego'],
  ['astrolabio-tres-ciudades:lucia', 'astrolabio-tres-ciudades:tomas', 'astrolabio-tres-ciudades:marta', 'astrolabio-tres-ciudades:ines', 'astrolabio-tres-ciudades:emile'],
];

/** Nombres para mostrar de los NPC de PRODUCTION_CASES, en el mismo orden
 * (de la BD, sin tocarlos): el género se infiere del nombre de pila. */
const PRODUCTION_NPC_NAMES: ReadonlyArray<readonly string[]> = [
  ['Marcos', 'Laura', 'Jorge', 'Ana'],
  ['Carlos Mendieta', 'Marcos Urrutia', 'Laura Soto', 'Sofía Rivas'],
  ['Elena', 'Marcos', 'Laura', 'Jorge'],
  ['Elena Vargas', 'Marcos Rivas', 'Laura Soto', 'Jorge Nieto'],
  ['Marcos Vega', 'Laura Santos', 'Jorge Méndez', 'Ana Ruiz'],
  ['Laura Vega', 'Marcos Ruiz', 'Ana Soto', 'Diego Ramos'],
  ['Marcos Ibarra', 'Laura Ruiz', 'Elena Vargas', 'Jorge Méndez'],
  ['Álvaro Mendieta', 'Carmen Soler', 'Luis Ortega', 'Marta Ríos'],
  ['Álvaro Méndez', 'Lucía Vargas', 'Carmen Ruiz', 'Roberto Gil'],
  ['Marcos Aldana', 'Laura Soto', 'Jorge Etxeberria', 'Ana Ruiz'],
  ['Marcos', 'Laura', 'Jorge', 'Sofía'],
  ['Elena Vargas', 'Marcos Rivas', 'Lucía Ortega', 'Diego Soto'],
  ['Lucía', 'Tomás', 'Marta', 'Inés', 'Émile'],
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

describe('fotos de los retratos del caso fijo (fase 3 del rediseño A2)', () => {
  it('los 5 NPC del caso fijo tienen foto, con su fichero en /images/', () => {
    expect(Object.keys(FIXED_PHOTO_PORTRAITS).sort()).toEqual([
      'astrolabio-tres-ciudades:emile', 'astrolabio-tres-ciudades:ines', 'astrolabio-tres-ciudades:lucia',
      'astrolabio-tres-ciudades:marta', 'astrolabio-tres-ciudades:tomas',
    ]);
    expect(photoPortraitFor('astrolabio-tres-ciudades:ines')).toBe('/images/ines-retrato.jpg');
    expect(photoPortraitFor('astrolabio-tres-ciudades:tomas')).toBe('/images/retrato-tomas.webp');
    expect(photoPortraitFor('astrolabio-tres-ciudades:lucia')).toBe('/images/retrato-lucia.webp');
    expect(photoPortraitFor('astrolabio-tres-ciudades:emile')).toBe('/images/retrato-emile.webp');
    expect(photoPortraitFor('astrolabio-tres-ciudades:marta')).toBe('/images/retrato-marta.webp');
  });

  it('sin foto para el equipo: usa el SVG procedural', () => {
    for (const seed of ['team:margaret', 'team:richter', 'team:elena', 'team:david', 'team:clara']) {
      expect(photoPortraitFor(seed)).toBeNull();
    }
  });
});

describe('fotos genéricas de los casos generados (set genérico)', () => {
  it('las 8 fotos genéricas están en /images/ y son .webp', () => {
    expect(GENERIC_PHOTO_PORTRAITS).toEqual([
      '/images/generico-hombre-1.webp', '/images/generico-hombre-2.webp',
      '/images/generico-hombre-3.webp', '/images/generico-hombre-4.webp',
      '/images/generico-mujer-1.webp', '/images/generico-mujer-2.webp',
      '/images/generico-mujer-3.webp', '/images/generico-mujer-4.webp',
    ]);
    for (const src of GENERIC_PHOTO_PORTRAITS) {
      expect(src.startsWith('/images/')).toBe(true);
      expect(src.endsWith('.webp')).toBe(true);
    }
  });

  it('en cada caso generado, los cuatro NPC tienen fotos genéricas distintas', () => {
    for (let c = 0; c < 12; c++) {
      const seeds = PRODUCTION_CASES[c] as readonly string[];
      const names = PRODUCTION_NPC_NAMES[c] as readonly string[];
      const npcIds = seeds.map(seed => seed.split(':')[1] as string);
      const photos = seeds.map((seed, i) => photoPortraitFor(seed, npcIds, names[i], names));
      for (const photo of photos) {
        expect(photo).not.toBeNull();
        expect(GENERIC_PHOTO_PORTRAITS).toContain(photo);
      }
      expect(new Set(photos).size).toBe(photos.length);
    }
  });

  it('la asignación es determinista: misma semilla y misma lista, misma foto', () => {
    const npcIds = ['marcos', 'laura', 'jorge', 'ana'];
    const names = ['Marcos', 'Laura', 'Jorge', 'Ana'];
    for (let i = 0; i < npcIds.length; i++) {
      const npcId = npcIds[i] as string;
      expect(photoPortraitFor(`generado-21d02570:${npcId}`, npcIds, names[i], names))
        .toBe(photoPortraitFor(`generado-21d02570:${npcId}`, npcIds, names[i], names));
      expect(genericPhotoPortraitFor('generado-21d02570', npcId, npcIds, names[i], names))
        .toBe(photoPortraitFor(`generado-21d02570:${npcId}`, npcIds, names[i], names));
    }
  });

  it('el caso fijo no usa fotos genéricas: sus 5 NPC mantienen las suyas', () => {
    const npcIds = ['lucia', 'tomas', 'marta', 'ines', 'emile'];
    for (const npcId of npcIds) {
      expect(photoPortraitFor(`astrolabio-tres-ciudades:${npcId}`, npcIds))
        .toBe(FIXED_PHOTO_PORTRAITS[`astrolabio-tres-ciudades:${npcId}`]);
      expect(genericPhotoPortraitFor('astrolabio-tres-ciudades', npcId, npcIds)).toBeNull();
    }
  });

  it('el mismo id en otro caso no hereda la foto del caso fijo', () => {
    const photo = photoPortraitFor('generado-71f0f281:lucia', ['lucia', 'marcos', 'jorge', 'ana']);
    expect(photo).not.toBeNull();
    expect(GENERIC_PHOTO_PORTRAITS).toContain(photo);
    expect(photo).not.toBe('/images/retrato-lucia.webp');
    expect(photoPortraitFor('generado-99a81ebb:ines', ['ines', 'marcos', 'jorge', 'ana']))
      .not.toBe('/images/ines-retrato.jpg');
  });
});

describe('fotos genéricas por género (decisión de Antonio 2026-11-12: «sí me chirría») ', () => {
  /** Género esperado de cada nombre de pila de producción, independiente
   * de las listas del módulo: si una lista del módulo se equivoca, este
   * test lo caza. */
  const EXPECTED_GENDER: Readonly<Record<string, 'male' | 'female'>> = {
    marcos: 'male', jorge: 'male', carlos: 'male', alvaro: 'male', luis: 'male',
    roberto: 'male', diego: 'male',
    laura: 'female', ana: 'female', sofia: 'female', elena: 'female',
    carmen: 'female', marta: 'female', lucia: 'female',
  };

  it('los pools son 4 hombres + 4 mujeres y juntos son las 8 fotos', () => {
    expect(GENERIC_PHOTO_PORTRAITS_MEN).toHaveLength(4);
    expect(GENERIC_PHOTO_PORTRAITS_WOMEN).toHaveLength(4);
    expect(GENERIC_PHOTO_PORTRAITS).toEqual([
      ...GENERIC_PHOTO_PORTRAITS_MEN, ...GENERIC_PHOTO_PORTRAITS_WOMEN,
    ]);
    for (const src of GENERIC_PHOTO_PORTRAITS_MEN) expect(src).toMatch(/generico-hombre-\d\.webp$/);
    for (const src of GENERIC_PHOTO_PORTRAITS_WOMEN) expect(src).toMatch(/generico-mujer-\d\.webp$/);
  });

  it('en los 12 casos generados, ningún NPC lleva foto del género contrario', () => {
    for (let c = 0; c < 12; c++) {
      const seeds = PRODUCTION_CASES[c] as readonly string[];
      const names = PRODUCTION_NPC_NAMES[c] as readonly string[];
      const npcIds = seeds.map(seed => seed.split(':')[1] as string);
      for (let i = 0; i < seeds.length; i++) {
        const photo = photoPortraitFor(seeds[i] as string, npcIds, names[i], names);
        const first = (names[i] as string).split(' ')[0]?.normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '').toLowerCase() as string;
        const pool = EXPECTED_GENDER[first] === 'male'
          ? GENERIC_PHOTO_PORTRAITS_MEN : GENERIC_PHOTO_PORTRAITS_WOMEN;
        expect(pool).toContain(photo);
      }
    }
  });

  it('los casos que motivaron el arreglo ya no cruzan el género', () => {
    // Verificación 21/21 del set genérico: Marcos Ruiz llevaba mujer-2 y
    // Diego Ramos llevaba mujer-4. Ahora llevan foto de hombre.
    const ids48 = ['laura-vega', 'marcos-ruiz', 'ana-soto', 'diego-ramos'];
    const names48 = ['Laura Vega', 'Marcos Ruiz', 'Ana Soto', 'Diego Ramos'];
    expect(GENERIC_PHOTO_PORTRAITS_MEN).toContain(
      photoPortraitFor('generado-48a17a5b:marcos-ruiz', ids48, 'Marcos Ruiz', names48));
    expect(GENERIC_PHOTO_PORTRAITS_MEN).toContain(
      photoPortraitFor('generado-48a17a5b:diego-ramos', ids48, 'Diego Ramos', names48));
    expect(GENERIC_PHOTO_PORTRAITS_WOMEN).toContain(
      photoPortraitFor('generado-48a17a5b:laura-vega', ids48, 'Laura Vega', names48));
    expect(GENERIC_PHOTO_PORTRAITS_WOMEN).toContain(
      photoPortraitFor('generado-48a17a5b:ana-soto', ids48, 'Ana Soto', names48));
  });

  it('inferNpcGender: listas, terminaciones y ambiguos', () => {
    expect(inferNpcGender('Marcos Ruiz')).toBe('male');
    expect(inferNpcGender('Lucía Vargas')).toBe('female');
    expect(inferNpcGender('Álvaro Mendieta')).toBe('male');
    expect(inferNpcGender('Sofía Rivas')).toBe('female');
    // En España, Andrea es mayoritariamente masculino.
    expect(inferNpcGender('Andrea')).toBe('male');
    // Nombres fuera de las listas: la terminación habitual clasifica.
    expect(inferNpcGender('Zoriondo')).toBe('male');
    expect(inferNpcGender('Naiara')).toBe('female');
    // Ambiguos o inclasificables: no se adivina.
    expect(inferNpcGender('Alex')).toBe('unknown');
    expect(inferNpcGender('Kim')).toBe('unknown');
    expect(inferNpcGender('Xabi')).toBe('unknown');
    expect(inferNpcGender('')).toBe('unknown');
  });

  it('sin nombre, el género se infiere del id (que deriva del nombre)', () => {
    const ids = ['laura-vega', 'marcos-ruiz', 'ana-soto', 'diego-ramos'];
    expect(GENERIC_PHOTO_PORTRAITS_MEN).toContain(
      photoPortraitFor('generado-48a17a5b:marcos-ruiz', ids));
    expect(GENERIC_PHOTO_PORTRAITS_MEN).toContain(
      photoPortraitFor('generado-48a17a5b:diego-ramos', ids));
    expect(GENERIC_PHOTO_PORTRAITS_WOMEN).toContain(
      photoPortraitFor('generado-48a17a5b:laura-vega', ids));
    expect(GENERIC_PHOTO_PORTRAITS_WOMEN).toContain(
      photoPortraitFor('generado-48a17a5b:ana-soto', ids));
  });

  it('un nombre ambiguo usa el pool completo y es determinista', () => {
    const ids = ['alex', 'marcos', 'laura', 'jorge'];
    const names = ['Alex', 'Marcos', 'Laura', 'Jorge'];
    const photo = photoPortraitFor('generado-21d02570:alex', ids, 'Alex', names);
    expect(photo).not.toBeNull();
    expect(GENERIC_PHOTO_PORTRAITS).toContain(photo);
    expect(photoPortraitFor('generado-21d02570:alex', ids, 'Alex', names)).toBe(photo);
    // Y los demás del caso siguen con su género y distintos entre sí.
    const photos = ids.map((id, i) => photoPortraitFor(`generado-21d02570:${id}`, ids, names[i], names));
    expect(new Set(photos).size).toBe(photos.length);
  });
});
