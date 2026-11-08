import { eq } from 'drizzle-orm';
import { validateCaseDefinition } from '@meridiano/case-schema';
import { deadlineMinutesForDifficulty, type Difficulty } from '@meridiano/case-schema';
import type { CaseDefinition } from '@meridiano/case-schema';
import type { CaseSummary } from '@meridiano/contracts';
import type { ContentRating, CrimeType, ExplorationMode } from '@meridiano/contracts';
import { astrolabioDefinition } from '@meridiano/engine';
import type { Database } from '../database/connection.ts';
import { generatedCases } from '../database/schema.ts';
import { RunStoreError } from './runs.ts';

type Orm = Database['orm'];

/** Delito y contenido del expediente fijo (GDD §3/§14). Son metadatos del
 * catálogo, no del motor: el juego no cambia por el delito, pero la
 * creación y todas las pantallas los muestran siempre juntos
 * («Robo internacional · Familiar»). Los expedientes generados traen los
 * suyos en la definición (`catalogMeta`). */
const CASE_META: Record<string, { crimeType: CrimeType; contentRating: ContentRating }> = {
  [astrolabioDefinition.id]: { crimeType: 'robo', contentRating: 'familiar' },
};

/** Delito y contenido desde la definición, sin tocar la BD: el caso fijo
 * los tiene en CASE_META y el generado en `catalogMeta`. */
export function metaForDefinition(definition: CaseDefinition): { crimeType: CrimeType; contentRating: ContentRating } {
  if (definition.catalogMeta) return { ...definition.catalogMeta };
  const meta = CASE_META[definition.id];
  if (!meta) throw new RunStoreError('NOT_FOUND');
  return { ...meta };
}

export async function caseMeta(db: Orm, caseId: string): Promise<{ crimeType: CrimeType; contentRating: ContentRating }> {
  return metaForDefinition(await findCase(db, caseId));
}

export async function findCase(db: Orm, caseId: string): Promise<CaseDefinition> {
  if (caseId === astrolabioDefinition.id) {
    // No entregar referencias mutables al fixture usado por otras peticiones.
    return structuredClone(astrolabioDefinition);
  }
  const rows = await db.select().from(generatedCases).where(eq(generatedCases.caseId, caseId)).limit(1);
  const row = rows[0];
  if (!row || typeof row.definition !== 'object' || row.definition === null) throw new RunStoreError('NOT_FOUND');
  const definition = row.definition as unknown as CaseDefinition;
  if (definition.id !== caseId || validateCaseDefinition(definition).valid === false) throw new RunStoreError('NOT_FOUND');
  return structuredClone(definition);
}

/**
 * Definición efectiva de una partida nueva: el expediente del catálogo con la
 * dificultad elegida y su plazo. El plazo es un factor sobre el plazo base
 * del expediente (ver deadlineMinutesForDifficulty); el DIFFICULTY_BUDGET del
 * catálogo de generación no se aplica al caso fijo (lo haría incompletable).
 */
export function applyDifficulty(definition: CaseDefinition, difficulty: Difficulty) {
  const effective = structuredClone(definition);
  effective.difficulty = difficulty;
  effective.deadlineMinutes = deadlineMinutesForDifficulty(definition.deadlineMinutes, difficulty);
  return effective;
}

/**
 * Modo de exploración elegido al crear la partida (GDD §5): independiente
 * de la dificultad (REQ-G03-02). Se aplica a la definición efectiva como la
 * dificultad, para que el motor y la vista usen el modo de la partida y no
 * el del expediente (todos traen 'guided').
 */
export function applyExplorationMode(definition: CaseDefinition, explorationMode: ExplorationMode) {
  const effective = structuredClone(definition);
  effective.explorationMode = explorationMode;
  return effective;
}

/** Definición que gobierna una partida ya creada: el expediente con los
 * parámetros persistidos en su fila (dificultad, plazo y modo de
 * exploración). La definición se recarga del catálogo en cada petición; sin
 * aplicar la fila, el plazo y el modo elegidos al crear se perderían al
 * recargar. */
export async function definitionForRun(db: Orm, definitionId: string, difficulty: Difficulty, deadlineMinutes: number, explorationMode: ExplorationMode) {
  const definition = await findDefinitionById(db, definitionId);
  definition.difficulty = difficulty;
  definition.deadlineMinutes = deadlineMinutes;
  definition.explorationMode = explorationMode;
  return definition;
}

/**
 * Introducción del caso (GDD §3: la ofrece Margaret Sullivan; breve,
 * omisible y siempre recuperable en el dossier). Texto de presentación
 * redactado a partir de SPEC-003 —inicio en la sala de embalaje de Madrid,
 * objetivos (detener con orden válida y recuperar el original) y plazo— sin
 * revelar la solución: lo que el jugador sabe al empezar es solo que el
 * astrolabio desapareció durante el traslado. Los expedientes generados
 * traen su propia intro en la definición (`briefing`).
 */
export function briefingForDefinition(definition: CaseDefinition): { speaker: string; title: string; paragraphs: string[] } | null {
  if (definition.briefing) return { ...definition.briefing, paragraphs: [...definition.briefing.paragraphs] };
  if (definition.id !== astrolabioDefinition.id) return null;
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

export async function caseBriefing(db: Orm, caseId: string): Promise<{ speaker: string; title: string; paragraphs: string[] } | null> {
  return briefingForDefinition(await findCase(db, caseId));
}

export function caseSummaryFor(definition: CaseDefinition, ownedByMe = false): CaseSummary {
  const meta = metaForDefinition(definition);
  return {
    caseId: definition.id,
    title: definition.briefing?.title ?? 'El astrolabio de las tres ciudades',
    contentMode: definition.contentMode,
    crimeType: meta.crimeType,
    contentRating: meta.contentRating,
    difficulty: definition.difficulty,
    explorationMode: definition.explorationMode,
    deadlineMinutes: definition.deadlineMinutes,
    contentVersion: definition.contentVersion,
    canStart: validateCaseDefinition(definition).valid,
    ownedByMe,
  };
}

export async function caseSummary(db: Orm, caseId: string, ownerId?: string): Promise<CaseSummary> {
  const definition = await findCase(db, caseId);
  if (caseId === astrolabioDefinition.id || ownerId === undefined) return caseSummaryFor(definition, false);
  const rows = await db.select({ createdBy: generatedCases.createdBy }).from(generatedCases)
    .where(eq(generatedCases.caseId, caseId)).limit(1);
  return caseSummaryFor(definition, rows[0]?.createdBy === ownerId);
}

export async function listCases(db: Orm, ownerId?: string): Promise<CaseSummary[]> {
  const items = [caseSummaryFor(structuredClone(astrolabioDefinition))];
  const rows = await db.select().from(generatedCases).orderBy(generatedCases.createdAt);
  for (const row of rows) {
    if (typeof row.definition !== 'object' || row.definition === null) continue;
    const definition = row.definition as unknown as CaseDefinition;
    if (definition.id !== row.caseId || validateCaseDefinition(definition).valid === false) continue;
    items.push(caseSummaryFor(structuredClone(definition), ownerId !== undefined && row.createdBy === ownerId));
  }
  return items;
}

export async function findDefinitionById(db: Orm, definitionId: string) {
  return findCase(db, definitionId);
}
