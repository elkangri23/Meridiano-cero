// Catálogo de parámetros para generación de casos (T5-01)
// SPEC-007: Generación, simulación e intercambio

export type Difficulty = 'easy' | 'normal' | 'hard';
export type ExplorationMode = 'guided' | 'free';
export type Duration = 'short' | 'medium' | 'long';
export type ContentMode = 'fixed' | 'generated';

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

// Tipos de delito permitidos
export const ALLOWED_CRIME_TYPES = [
  'aleatorio',
  'fraude',
  'robo',
  'sabotaje',
  'desaparicion',
  'extorsion',
  'contrabando',
  'corrupcion',
  'falsificacion',
] as const;

// Presupuesto de tiempo por dificultad (minutos internos)
export const DIFFICULTY_BUDGET: Record<Difficulty, number> = {
  easy: 300,
  normal: 480,
  hard: 600,
};

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
