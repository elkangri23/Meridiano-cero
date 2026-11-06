import { validateCaseDefinition } from '@meridiano/case-schema';
import { deadlineMinutesForDifficulty, type Difficulty } from '@meridiano/case-schema';
import type { CaseSummary } from '@meridiano/contracts';
import type { ContentRating, CrimeType } from '@meridiano/contracts';
import { astrolabioDefinition } from '@meridiano/engine';
import { RunStoreError } from './runs.ts';

/** Delito y contenido de cada expediente (GDD §3/§14). Son metadatos del
 * catálogo, no del motor: el juego no cambia por el delito, pero la
 * creación y todas las pantallas los muestran siempre juntos
 * («Robo internacional · Familiar»). Cuando la generación conecte casos
 * nuevos, su delito/contenido vendrán de su expediente generado. */
const CASE_META: Record<string, { crimeType: CrimeType; contentRating: ContentRating }> = {
  [astrolabioDefinition.id]: { crimeType: 'robo', contentRating: 'familiar' },
};

export function caseMeta(caseId: string): { crimeType: CrimeType; contentRating: ContentRating } {
  const meta = CASE_META[caseId];
  if (!meta) throw new RunStoreError('NOT_FOUND');
  return { ...meta };
}

export function findCase(caseId: string) {
  if (caseId !== astrolabioDefinition.id) throw new RunStoreError('NOT_FOUND');
  // No entregar referencias mutables al fixture usado por otras peticiones.
  return structuredClone(astrolabioDefinition);
}

/**
 * Definición efectiva de una partida nueva: el expediente del catálogo con la
 * dificultad elegida y su plazo. El plazo es un factor sobre el plazo base
 * del expediente (ver deadlineMinutesForDifficulty); el DIFFICULTY_BUDGET del
 * catálogo de generación no se aplica al caso fijo (lo haría incompletable).
 */
export function applyDifficulty(definition: ReturnType<typeof findCase>, difficulty: Difficulty) {
  const effective = structuredClone(definition);
  effective.difficulty = difficulty;
  effective.deadlineMinutes = deadlineMinutesForDifficulty(definition.deadlineMinutes, difficulty);
  return effective;
}

/** Definición que gobierna una partida ya creada: el expediente con los
 * parámetros persistidos en su fila (dificultad y plazo). La definición se
 * recarga del catálogo en cada petición; sin aplicar la fila, el plazo
 * elegido al crear se perdería al recargar. */
export function definitionForRun(definitionId: string, difficulty: Difficulty, deadlineMinutes: number) {
  const definition = findDefinitionById(definitionId);
  definition.difficulty = difficulty;
  definition.deadlineMinutes = deadlineMinutes;
  return definition;
}

/**
 * Introducción del caso (GDD §3: la ofrece Margaret Sullivan; breve,
 * omisible y siempre recuperable en el dossier). Texto de presentación
 * redactado a partir de SPEC-003 —inicio en la sala de embalaje de Madrid,
 * objetivos (detener con orden válida y recuperar el original) y plazo— sin
 * revelar la solución: lo que el jugador sabe al empezar es solo que el
 * astrolabio desapareció durante el traslado.
 */
export function caseBriefing(caseId: string): { speaker: string; title: string; paragraphs: string[] } | null {
  if (caseId !== astrolabioDefinition.id) return null;
  return {
    speaker: 'Margaret Sullivan',
    title: 'El astrolabio de las tres ciudades',
    paragraphs: [
      'Un astrolabio de la exposición del Instituto Horizonte, en Madrid, ha desaparecido durante su traslado. La pieza estaba en la sala de embalaje y ya no está. Eres detective de la agencia internacional A.C.M.E. y el caso es tuyo.',
      'Empiezas en la sala de embalaje de Madrid, donde se preparó el envío. Habla con quien estaba allí, inspecciona la sala y sigue el rastro: el caso puede llevarte a París y a Lisboa si las pruebas te llevan hasta allí.',
      'Tu trabajo es averiguar quién se llevó el astrolabio, reunir pruebas que lo demuestren y recuperar la pieza original. Para detener a alguien necesitarás una orden válida. El reloj del caso marca tu plazo: cuando se agote, la investigación se cierra.',
    ],
  };
}

export function caseSummary(caseId: string): CaseSummary {
  const definition = findCase(caseId);
  const meta = caseMeta(caseId);
  return {
    caseId: definition.id,
    title: 'El astrolabio de las tres ciudades',
    contentMode: definition.contentMode,
    crimeType: meta.crimeType,
    contentRating: meta.contentRating,
    difficulty: definition.difficulty,
    explorationMode: definition.explorationMode,
    deadlineMinutes: definition.deadlineMinutes,
    contentVersion: definition.contentVersion,
    canStart: validateCaseDefinition(definition).valid,
  };
}

export function listCases() {
  return [caseSummary(astrolabioDefinition.id)];
}

export function findDefinitionById(definitionId: string) {
  if (definitionId !== astrolabioDefinition.id) throw new RunStoreError('NOT_FOUND');
  return structuredClone(astrolabioDefinition);
}
