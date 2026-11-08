// Tipos compartidos del generador (T4-08, SPEC-007)
//
// Este módulo existe para que `pipeline.ts`, `stages.ts` y `validator.ts`
// no se importen entre sí en ciclo: los tres necesitan estos tipos y el
// validador además necesita la lista de delitos generables. Antes vivían
// en `pipeline.ts` (parámetros, etapas, resultado de validación) y en
// `stages.ts` (delitos generables), y `dependency-cruiser` marcaba tres
// ciclos (`validator → stages → pipeline → validator`). No hay lógica
// aquí: solo los tipos y la lista canónica, movidos tal cual.

/** Delitos generables (lista canónica sin 'aleatorio', que es modo de
 * selección). Homicidio y secuestro solo en General (GDD §14). */
export const GENERATABLE_CRIMES = ['robo', 'desaparicion', 'fraude', 'espionaje', 'sabotaje', 'misterio-historico', 'extorsion', 'contrabando', 'corrupcion', 'falsificacion', 'homicidio', 'secuestro'] as const;
export type GeneratableCrime = (typeof GENERATABLE_CRIMES)[number];

/** Delitos generables (lista canónica reconciliada en T4-08, sin
 * 'aleatorio', que es modo de selección). */
export type CrimeType = GeneratableCrime;

export type Region = 'europa' | 'america' | 'asia' | 'africa' | 'oceania' | 'global';

export type SurpriseMode = 'familiar' | 'general' | 'sorprende';

type Difficulty = 'easy' | 'normal' | 'hard';
type ExplorationMode = 'guided' | 'free';

export interface GenerationParams {
  crimeType?: CrimeType;
  difficulty: Difficulty;
  explorationMode: ExplorationMode;
  duration: 'short' | 'medium' | 'long';
  region?: Region;
  surpriseMode: SurpriseMode;
  seed?: number;
  catalogVersion?: string;
}

export type GenerationStage =
  | 1  // Fijar delito, objetivos, verdad y motivaciones (LLM)
  | 2  // Seleccionar geografía desde catálogo verificable (determinista)
  | 3  // Definir NPC, conocimiento, relaciones y cronología (LLM)
  | 4  // Construir lugares investigables y grafo de pistas (LLM)
  | 5  // Ensamblar la definición (determinista)
  | 6  // Validar estructura/referencias/contenido (determinista, puerta)
  | 7  // Revisión semántica independiente (LLM, puerta)
  | 8  // Simular la ruta dorada por el motor real (determinista, puerta)
  | 9; // Publicar versión/hash/reporte y metadatos jugables

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ValidationError {
  code: string;
  message: string;
  path?: string;
}
