// Catálogo de parámetros para generación de casos (T5-01)
// SPEC-007: Generación, simulación e intercambio

import type { ContentRating, CrimeType } from '@meridiano/contracts';
export type { ContentRating, CrimeType } from '@meridiano/contracts';

export type Difficulty = 'easy' | 'normal' | 'hard';
export type ExplorationMode = 'guided' | 'free';
export type Duration = 'short' | 'medium' | 'long';
export type ContentMode = 'fixed' | 'generated';

// Delitos del GDD §3 (orden del documento): la lista que ofrece el
// formulario de «Nueva partida». RECONCILIADA en T4-08 (SPEC-007): unión de
// GDD §3, ALLOWED_CRIME_TYPES de T5-01 (que añadía extorsión/contrabando/
// corrupción/falsificación y omitía espionaje y misterio histórico) y el
// CrimeType del generador (que añadía homicidio/secuestro, que el GDD §14
// solo admite en modo General). `aleatorio` sigue siendo modo de selección,
// no delito.
export const GDD_CRIME_TYPES: readonly CrimeType[] = [
  'robo',
  'desaparicion',
  'fraude',
  'espionaje',
  'sabotaje',
  'misterio-historico',
  'extorsion',
  'contrabando',
  'corrupcion',
  'falsificacion',
  'homicidio',
  'secuestro',
  'aleatorio',
] as const;

/** Delitos que solo se admiten en contenido General (GDD §14): homicidio y
 * secuestro son temas perturbadores y nunca salen en Familiar. */
export const GENERAL_ONLY_CRIMES: readonly CrimeType[] = ['homicidio', 'secuestro'] as const;

/** ¿Se puede generar/jugar este delito con este nivel de contenido? */
export function crimeAllowedForRating(crimeType: CrimeType, contentRating: ContentRating): boolean {
  if (crimeType === 'aleatorio') return true;
  if (contentRating === 'general') return true;
  return !GENERAL_ONLY_CRIMES.includes(crimeType);
}

export const CRIME_TYPE_LABELS: Record<CrimeType, string> = {
  robo: 'Robo internacional',
  desaparicion: 'Desaparición',
  fraude: 'Fraude',
  espionaje: 'Espionaje',
  sabotaje: 'Sabotaje',
  'misterio-historico': 'Misterio histórico',
  extorsion: 'Extorsión',
  contrabando: 'Contrabando',
  corrupcion: 'Corrupción',
  falsificacion: 'Falsificación',
  homicidio: 'Homicidio',
  secuestro: 'Secuestro',
  aleatorio: 'Aleatorio',
};

export const CONTENT_RATING_LABELS: Record<ContentRating, string> = {
  familiar: 'Familiar',
  general: 'General',
};

/** Etiqueta de un expediente: delito y contenido siempre juntos y por
 * separado («Robo internacional · Familiar»). «Robo Familiar» no es un
 * delito: es delito=robo + contenido=Familiar (GDD §3/§14). */
export function caseLabel(crimeType: CrimeType, contentRating: ContentRating): string {
  return `${CRIME_TYPE_LABELS[crimeType]} · ${CONTENT_RATING_LABELS[contentRating]}`;
}

export interface CatalogParams {
  crimeType: string;
  difficulty: Difficulty;
  explorationMode: ExplorationMode;
  duration: Duration;
  region: string;
  contentMode: ContentMode;
}

// Regiones permitidas (verificables, no inventadas)
export const ALLOWED_REGIONS = [
  'aleatorio',
  'madrid',
  'barcelona',
  'valencia',
  'sevilla',
  'bilbao',
  'malaga',
  'zaragoza',
] as const;

// Tipos de delito permitidos (T4-08: la misma lista canónica que
// GDD_CRIME_TYPES, incluido 'aleatorio' como modo de selección).
export const ALLOWED_CRIME_TYPES = GDD_CRIME_TYPES;

// Presupuesto de tiempo por dificultad (minutos internos)
export const DIFFICULTY_BUDGET: Record<Difficulty, number> = {
  easy: 300,
  normal: 480,
  hard: 600,
};

// Plazo interno de una partida sobre un expediente ya construido, según la
// dificultad elegida al crearla. Es un factor sobre el plazo base del
// expediente, NO el DIFFICULTY_BUDGET: ese presupuesto es de generación de
// casos nuevos (el generador construye el contenido para que quepa en él) y
// no se puede aplicar literalmente al caso fijo del astrolabio, cuyas rutas
// mínimas verificadas son 455/485 minutos (545/575 con retrasos máximos,
// SPEC-003 v8): con 300 minutos en fácil el caso sería incompletable, y con
// 480 en normal la ruta B (485) tampoco cabría. El factor se mide sobre la
// dificultad normal del expediente —el astrolabio se diseñó y verificó en
// normal con 2880 minutos (SPEC-003)—, así que normal conserva el plazo
// base (factor 1), fácil lo duplica (factor 2) y difícil lo reduce a la
// mitad (factor 0.5, todavía 2,5 veces la ruta peor, 575), de modo que las
// tres dificultades se pueden completar y la creación sin dificultad elegida
// se comporta exactamente como antes.
export const DIFFICULTY_DEADLINE_FACTOR: Record<Difficulty, number> = {
  easy: 2,
  normal: 1,
  hard: 0.5,
};

export function deadlineMinutesForDifficulty(baseDeadlineMinutes: number, difficulty: Difficulty): number {
  return Math.max(60, Math.round(baseDeadlineMinutes * DIFFICULTY_DEADLINE_FACTOR[difficulty]));
}

// Duración por defecto por dificultad
export const DIFFICULTY_DURATION: Record<Difficulty, Duration> = {
  easy: 'short',
  normal: 'medium',
  hard: 'long',
};

// Combinaciones inválidas: dificultad alta con duración corta
const INVALID_COMBINATIONS: Array<{ difficulty: Difficulty; duration: Duration }> = [
  { difficulty: 'hard', duration: 'short' },
  { difficulty: 'normal', duration: 'short' },
];

export interface CatalogValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateCatalogParams(params: unknown): CatalogValidationResult {
  const errors: string[] = [];

  if (typeof params !== 'object' || params === null) {
    return { valid: false, errors: ['Los parámetros deben ser un objeto.'] };
  }

  const p = params as Record<string, unknown>;

  // crimeType
  if (typeof p.crimeType !== 'string' || !ALLOWED_CRIME_TYPES.includes(p.crimeType as any)) {
    errors.push(`Tipo de delito inválido: "${p.crimeType}". Debe ser uno de: ${ALLOWED_CRIME_TYPES.join(', ')}.`);
  }

  // difficulty
  const validDifficulties: Difficulty[] = ['easy', 'normal', 'hard'];
  if (typeof p.difficulty !== 'string' || !validDifficulties.includes(p.difficulty as Difficulty)) {
    errors.push(`Dificultad inválida: "${p.difficulty}". Debe ser: easy, normal o hard.`);
  }

  // explorationMode
  const validModes: ExplorationMode[] = ['guided', 'free'];
  if (typeof p.explorationMode !== 'string' || !validModes.includes(p.explorationMode as ExplorationMode)) {
    errors.push(`Modo de exploración inválido: "${p.explorationMode}". Debe ser: guided o free.`);
  }

  // duration
  const validDurations: Duration[] = ['short', 'medium', 'long'];
  if (typeof p.duration !== 'string' || !validDurations.includes(p.duration as Duration)) {
    errors.push(`Duración inválida: "${p.duration}". Debe ser: short, medium o long.`);
  }

  // region
  if (typeof p.region !== 'string' || !ALLOWED_REGIONS.includes(p.region as any)) {
    errors.push(`Región inválida: "${p.region}". Debe ser una de: ${ALLOWED_REGIONS.join(', ')}.`);
  }

  // contentMode
  const validContentModes: ContentMode[] = ['fixed', 'generated'];
  if (typeof p.contentMode !== 'string' || !validContentModes.includes(p.contentMode as ContentMode)) {
    errors.push(`Modo de contenido inválido: "${p.contentMode}". Debe ser: fixed o generated.`);
  }

  // Combinaciones inválidas
  if (typeof p.difficulty === 'string' && typeof p.duration === 'string') {
    const combo = INVALID_COMBINATIONS.find(c => c.difficulty === p.difficulty && c.duration === p.duration);
    if (combo) {
      errors.push(`Combinación inválida: dificultad "${combo.difficulty}" con duración "${combo.duration}".`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export function getBudgetForParams(params: CatalogParams): number {
  return DIFFICULTY_BUDGET[params.difficulty];
}

export function getSuggestedDuration(difficulty: Difficulty): Duration {
  return DIFFICULTY_DURATION[difficulty];
}
