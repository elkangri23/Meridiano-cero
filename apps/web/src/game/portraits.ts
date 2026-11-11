// Retratos pixel-art procedurales y deterministas (GDD §2, REQ-G02-03, T5-05)
// Módulo PURO de la web, sin importar case-schema (la regla de aislamiento
// de la web): los rasgos salen de la semilla, nunca de un proveedor de IA en
// tiempo de ejecución — el juego es determinista y un retrato generado por
// API rompería eso, costaría por uso y dependería de un servicio externo.
// El retrato es una rejilla de 16×20 celdas en la paleta plana del juego
// (la misma de las escenas: negro, azul, dorado, teal, grises, marrón);
// la web la dibuja como SVG con `shapeRendering="crispEdges"`. Arte
// original: ningún activo de Carmen Sandiego ni de ningún otro juego.
//
// La semilla es `caso:npc` para los personajes de un expediente y
// `team:miembro` para el equipo: el id del NPC solo no basta, porque los
// generados repiten ids entre casos (hay un Marcos en casi todos) y dos
// personajes distintos no pueden compartir cara. Los NPC del caso fijo y
// los cinco del equipo llevan rasgos elegidos a mano en FIXED_PORTRAITS;
// el resto se deriva de la semilla con el mismo hash djb2 que usa el
// generador para el tipo de detención.
export const PORTRAIT_WIDTH = 16;
export const PORTRAIT_HEIGHT = 20;

export type SkinTone = '#f2c89b' | '#e0aa72' | '#b07a45' | '#7a4a26';
export type HairStyle = 'short' | 'long' | 'curly' | 'bun' | 'bald';
export type HairColor = '#1a1a1a' | '#5a3a1a' | '#c8a028' | '#8a8a8a' | '#a03a10';
export type EyeColor = '#000000' | '#5a3a1a' | '#2244aa' | '#1a7a3a';
export type ClothingColor = '#0000aa' | '#aa5500' | '#00aaaa' | '#6a2a7a' | '#777777';
export type ClothingStyle = 'shirt' | 'jacket' | 'uniform' | 'dress';
export type Accessory = 'none' | 'glasses' | 'hat' | 'earring' | 'badge';
export type FacialHair = 'none' | 'mustache' | 'beard';

export interface PortraitTraits {
  skin: SkinTone;
  hairStyle: HairStyle;
  hairColor: HairColor;
  eyeColor: EyeColor;
  clothingColor: ClothingColor;
  clothingStyle: ClothingStyle;
  accessory: Accessory;
  facialHair: FacialHair;
}

export const SKIN_TONES: readonly SkinTone[] = ['#f2c89b', '#e0aa72', '#b07a45', '#7a4a26'];
export const HAIR_STYLES: readonly HairStyle[] = ['short', 'long', 'curly', 'bun', 'bald'];
export const HAIR_COLORS: readonly HairColor[] = ['#1a1a1a', '#5a3a1a', '#c8a028', '#8a8a8a', '#a03a10'];
export const EYE_COLORS: readonly EyeColor[] = ['#000000', '#5a3a1a', '#2244aa', '#1a7a3a'];
export const CLOTHING_COLORS: readonly ClothingColor[] = ['#0000aa', '#aa5500', '#00aaaa', '#6a2a7a', '#777777'];
export const CLOTHING_STYLES: readonly ClothingStyle[] = ['shirt', 'jacket', 'uniform', 'dress'];
export const ACCESSORIES: readonly Accessory[] = ['none', 'glasses', 'hat', 'earring', 'badge'];
export const FACIAL_HAIRS: readonly FacialHair[] = ['none', 'mustache', 'beard'];

/** Sombra de cada tono de piel (nariz) y de cada color de ropa (solapas). */
export const SKIN_SHADES: Record<SkinTone, string> = {
  '#f2c89b': '#d9a066',
  '#e0aa72': '#b07a45',
  '#b07a45': '#7a4a26',
  '#7a4a26': '#4a2a12',
};
export const CLOTHING_SHADES: Record<ClothingColor, string> = {
  '#0000aa': '#000055',
  '#aa5500': '#552a00',
  '#00aaaa': '#005555',
  '#6a2a7a': '#3a1545',
  '#777777': '#2a2a2a',
};

export const PORTRAIT_BACKGROUND = '#555555';
export const PORTRAIT_MOUTH = '#7a2a1a';
export const PORTRAIT_GOLD = '#ffff55';
export const PORTRAIT_WHITE = '#ffffff';
export const PORTRAIT_BLACK = '#1a1a1a';

/** Rasgos elegidos a mano para los personajes que el jugador debe reconocer
 * a simple vista. Clave: la semilla completa (`caso:npc` o `team:miembro`),
 * no el id solo: la Lucía del caso fijo no es la Lucía de un generado. */
export const FIXED_PORTRAITS: Readonly<Record<string, PortraitTraits>> = {
  'astrolabio-tres-ciudades:lucia': { skin: '#e0aa72', hairStyle: 'long', hairColor: '#5a3a1a', eyeColor: '#5a3a1a', clothingColor: '#0000aa', clothingStyle: 'shirt', accessory: 'none', facialHair: 'none' },
  'astrolabio-tres-ciudades:tomas': { skin: '#e0aa72', hairStyle: 'short', hairColor: '#1a1a1a', eyeColor: '#000000', clothingColor: '#aa5500', clothingStyle: 'uniform', accessory: 'badge', facialHair: 'beard' },
  'astrolabio-tres-ciudades:marta': { skin: '#f2c89b', hairStyle: 'bun', hairColor: '#8a8a8a', eyeColor: '#2244aa', clothingColor: '#777777', clothingStyle: 'jacket', accessory: 'glasses', facialHair: 'none' },
  'astrolabio-tres-ciudades:ines': { skin: '#f2c89b', hairStyle: 'long', hairColor: '#1a1a1a', eyeColor: '#1a7a3a', clothingColor: '#6a2a7a', clothingStyle: 'dress', accessory: 'earring', facialHair: 'none' },
  'astrolabio-tres-ciudades:emile': { skin: '#f2c89b', hairStyle: 'short', hairColor: '#8a8a8a', eyeColor: '#5a3a1a', clothingColor: '#0000aa', clothingStyle: 'jacket', accessory: 'glasses', facialHair: 'mustache' },
  'team:margaret': { skin: '#f2c89b', hairStyle: 'bun', hairColor: '#c8a028', eyeColor: '#2244aa', clothingColor: '#0000aa', clothingStyle: 'jacket', accessory: 'earring', facialHair: 'none' },
  'team:richter': { skin: '#f2c89b', hairStyle: 'bald', hairColor: '#8a8a8a', eyeColor: '#5a3a1a', clothingColor: '#777777', clothingStyle: 'jacket', accessory: 'glasses', facialHair: 'mustache' },
  'team:elena': { skin: '#e0aa72', hairStyle: 'short', hairColor: '#1a1a1a', eyeColor: '#5a3a1a', clothingColor: '#0000aa', clothingStyle: 'shirt', accessory: 'none', facialHair: 'none' },
  'team:david': { skin: '#e0aa72', hairStyle: 'short', hairColor: '#1a1a1a', eyeColor: '#000000', clothingColor: '#0000aa', clothingStyle: 'uniform', accessory: 'badge', facialHair: 'none' },
  'team:clara': { skin: '#f2c89b', hairStyle: 'long', hairColor: '#5a3a1a', eyeColor: '#2244aa', clothingColor: '#aa5500', clothingStyle: 'shirt', accessory: 'glasses', facialHair: 'none' },
};

/** Fotos de los 5 NPC del caso fijo (fase 3 del rediseño A2): retrato
 * fotográfico con el estilo aprobado por Antonio. Clave: la semilla
 * completa (`caso:npc`), como FIXED_PORTRAITS: la Lucía del caso fijo no
 * es la Lucía de un generado, y una `ines` de otro caso no es Inés
 * Valera. Los NPC de casos generados y el equipo A.C.M.E. NO tienen foto:
 * siguen con el retrato SVG procedural por semilla (fallback). Inés ya
 * tenía foto (`/images/ines-retrato.jpg`), usada solo en el
 * interrogatorio; aquí queda unificada con las demás en el mismo mapa. */
export const FIXED_PHOTO_PORTRAITS: Readonly<Record<string, string>> = {
  'astrolabio-tres-ciudades:ines': '/images/ines-retrato.jpg',
  'astrolabio-tres-ciudades:tomas': '/images/retrato-tomas.webp',
  'astrolabio-tres-ciudades:lucia': '/images/retrato-lucia.webp',
  'astrolabio-tres-ciudades:emile': '/images/retrato-emile.webp',
  'astrolabio-tres-ciudades:marta': '/images/retrato-marta.webp',
};

/** Foto de un personaje cuando la tiene (solo los 5 NPC del caso fijo);
 * `null` en el resto: el retrato SVG procedural es el fallback. */
export function photoPortraitFor(seed: string): string | null {
  return FIXED_PHOTO_PORTRAITS[seed] ?? null;
}

/** Semilla de un personaje de expediente: el caso forma parte de ella. */
export function portraitSeed(caseId: string, npcId: string): string {
  return `${caseId}:${npcId}`;
}

/** Semilla de un miembro del equipo A.C.M.E. */
export function teamPortraitSeed(memberId: string): string {
  return `team:${memberId}`;
}

/** Hash djb2, el mismo que usa el generador para el tipo de detención. */
export function portraitHash(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) hash = ((hash << 5) + hash + input.charCodeAt(i)) >>> 0;
  return hash;
}

function pick<T>(list: readonly T[], hash: number, shift: number): T {
  return list[(hash >>> shift) % list.length] as T;
}

/** Rasgos de una semilla: la tabla fija cuando la hay, derivación por hash
 * cuando no. La misma semilla da siempre los mismos rasgos. */
export function portraitTraitsFor(seed: string): PortraitTraits {
  const fixed = FIXED_PORTRAITS[seed];
  if (fixed) return { ...fixed };
  const a = portraitHash(seed);
  const b = portraitHash(`${seed}#2`);
  return {
    skin: pick(SKIN_TONES, a, 0),
    hairStyle: pick(HAIR_STYLES, a, 2),
    hairColor: pick(HAIR_COLORS, a, 5),
    eyeColor: pick(EYE_COLORS, a, 8),
    clothingColor: pick(CLOTHING_COLORS, b, 0),
    clothingStyle: pick(CLOTHING_STYLES, b, 3),
    accessory: pick(ACCESSORIES, b, 5),
    facialHair: pick(FACIAL_HAIRS, b, 8),
  };
}

type Grid = string[][];

function blankGrid(): Grid {
  return Array.from({ length: PORTRAIT_HEIGHT }, () => Array<string>(PORTRAIT_WIDTH).fill(PORTRAIT_BACKGROUND));
}

function paint(grid: Grid, x: number, y: number, w: number, h: number, color: string): void {
  for (let row = y; row < y + h; row++) {
    if (row < 0 || row >= PORTRAIT_HEIGHT) continue;
    const line = grid[row];
    if (!line) continue;
    for (let col = x; col < x + w; col++) {
      if (col >= 0 && col < PORTRAIT_WIDTH) line[col] = color;
    }
  }
}

function paintHead(grid: Grid, traits: PortraitTraits): void {
  const skin = traits.skin;
  paint(grid, 6, 3, 4, 2, skin);
  paint(grid, 5, 5, 6, 9, skin);
  paint(grid, 6, 14, 4, 1, skin);
  paint(grid, 4, 8, 1, 2, skin);
  paint(grid, 11, 8, 1, 2, skin);
  paint(grid, 7, 15, 2, 2, skin);
}

function paintHair(grid: Grid, traits: PortraitTraits): void {
  const hair = traits.hairColor;
  // Laterales primero: el pelo largo y el rizado tapan las orejas.
  if (traits.hairStyle === 'long') {
    paint(grid, 4, 5, 1, 7, hair);
    paint(grid, 11, 5, 1, 7, hair);
  } else if (traits.hairStyle === 'curly') {
    paint(grid, 4, 5, 1, 2, hair);
    paint(grid, 11, 5, 1, 2, hair);
  }
  if (traits.hairStyle === 'short' || traits.hairStyle === 'long' || traits.hairStyle === 'bun') {
    paint(grid, 5, 2, 6, 2, hair);
    paint(grid, 5, 4, 1, 1, hair);
    paint(grid, 10, 4, 1, 1, hair);
  } else if (traits.hairStyle === 'curly') {
    paint(grid, 4, 2, 8, 2, hair);
    paint(grid, 4, 4, 2, 1, hair);
    paint(grid, 10, 4, 2, 1, hair);
  } else if (traits.hairStyle === 'bald') {
    paint(grid, 5, 4, 1, 2, hair);
    paint(grid, 10, 4, 1, 2, hair);
  }
  if (traits.hairStyle === 'bun') paint(grid, 7, 0, 2, 2, hair);
}

function paintFace(grid: Grid, traits: PortraitTraits): void {
  const hair = traits.hairColor;
  paint(grid, 6, 7, 1, 1, hair);
  paint(grid, 9, 7, 1, 1, hair);
  paint(grid, 6, 8, 1, 1, traits.eyeColor);
  paint(grid, 9, 8, 1, 1, traits.eyeColor);
  paint(grid, 7, 10, 1, 2, SKIN_SHADES[traits.skin]);
  paint(grid, 7, 13, 2, 1, PORTRAIT_MOUTH);
  // Vello facial: el bigote va sobre el labio superior; la barba cubre la
  // barbilla y los lados, sin tapar la boca.
  if (traits.facialHair === 'mustache' || traits.facialHair === 'beard') {
    paint(grid, 6, 12, 4, 1, hair);
  }
  if (traits.facialHair === 'beard') {
    paint(grid, 5, 13, 2, 1, hair);
    paint(grid, 9, 13, 2, 1, hair);
    paint(grid, 5, 14, 6, 2, hair);
  }
}

function paintClothing(grid: Grid, traits: PortraitTraits): void {
  paint(grid, 2, 17, 12, 3, traits.clothingColor);
  if (traits.clothingStyle === 'shirt') {
    paint(grid, 6, 17, 1, 1, PORTRAIT_WHITE);
    paint(grid, 9, 17, 1, 1, PORTRAIT_WHITE);
    paint(grid, 7, 17, 2, 1, traits.skin);
  } else if (traits.clothingStyle === 'jacket') {
    paint(grid, 7, 17, 2, 2, PORTRAIT_WHITE);
    paint(grid, 6, 17, 1, 1, CLOTHING_SHADES[traits.clothingColor]);
    paint(grid, 9, 17, 1, 1, CLOTHING_SHADES[traits.clothingColor]);
  } else if (traits.clothingStyle === 'uniform') {
    paint(grid, 2, 17, 2, 1, PORTRAIT_GOLD);
    paint(grid, 12, 17, 2, 1, PORTRAIT_GOLD);
    paint(grid, 12, 18, 1, 1, PORTRAIT_GOLD);
  } else if (traits.clothingStyle === 'dress') {
    paint(grid, 6, 17, 4, 1, traits.skin);
  }
}

function paintAccessories(grid: Grid, traits: PortraitTraits): void {
  if (traits.accessory === 'glasses') {
    paint(grid, 5, 8, 1, 1, PORTRAIT_BLACK);
    paint(grid, 7, 8, 2, 1, PORTRAIT_BLACK);
    paint(grid, 10, 8, 1, 1, PORTRAIT_BLACK);
    paint(grid, 5, 7, 1, 1, PORTRAIT_BLACK);
    paint(grid, 10, 7, 1, 1, PORTRAIT_BLACK);
  } else if (traits.accessory === 'hat') {
    paint(grid, 5, 0, 6, 1, PORTRAIT_BLACK);
    paint(grid, 5, 1, 6, 1, PORTRAIT_GOLD);
    paint(grid, 3, 2, 10, 1, PORTRAIT_BLACK);
  } else if (traits.accessory === 'earring') {
    paint(grid, 4, 10, 1, 1, PORTRAIT_GOLD);
  } else if (traits.accessory === 'badge') {
    paint(grid, 3, 18, 1, 1, PORTRAIT_GOLD);
  }
}

/** Rejilla de 16×20 con los colores del retrato: cabeza, pelo, cara, ropa
 * y accesorios. El orden importa: el pelo largo tapa las orejas, el sombrero
 * tapa el pelo y la barba tapa la barbilla pero no la boca. */
export function portraitGrid(traits: PortraitTraits): Grid {
  const grid = blankGrid();
  paintHead(grid, traits);
  paintHair(grid, traits);
  paintFace(grid, traits);
  paintClothing(grid, traits);
  paintAccessories(grid, traits);
  return grid;
}

/** La rejilla como texto, para comparar retratos en tests. */
export function portraitGridKey(grid: Grid): string {
  return grid.map(row => row.join(',')).join('\n');
}

/** Todos los colores que puede usar un retrato: la guarda de daltonismo
 * comprueba que no se distinguen solo por el tono. */
export function portraitPaletteColors(): string[] {
  return [...new Set([
    PORTRAIT_BACKGROUND, PORTRAIT_MOUTH, PORTRAIT_GOLD, PORTRAIT_WHITE, PORTRAIT_BLACK,
    ...SKIN_TONES, ...Object.values(SKIN_SHADES), ...HAIR_COLORS, ...EYE_COLORS,
    ...CLOTHING_COLORS, ...Object.values(CLOTHING_SHADES),
  ])];
}
