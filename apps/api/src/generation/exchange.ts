// Intercambio de expedientes (T4-05 expuesto): exportar el expediente
// completo solo por su dueño autorizado (DEC-011, GDD §17) e importar un
// fichero con validación antes de jugarse. El formato es el de
// packages/generator/src/import-export.ts (versionado, con checksum); el
// checksum es integridad, no firma ni garantía de autoría (SPEC-007).
// La IA no viaja en el fichero: el expediente es autocontenido y cada
// jugador pone su propio proveedor (configuración por usuario).
import { randomBytes } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { validateCaseDefinition, crimeAllowedForRating, GDD_CRIME_TYPES, type CaseDefinition } from '@meridiano/case-schema';
import { hashDefinition } from '@meridiano/case-schema/server';
import { createExport, validateImport, type CaseExport } from '@meridiano/generator';
import type { CaseImportResultDto } from '@meridiano/contracts';
import { astrolabioDefinition } from '@meridiano/engine';
import type { Database } from '../database/connection.ts';
import { generatedCases } from '../database/schema.ts';
import { RunStoreError } from '../game/runs.ts';
import { findCase } from '../game/catalog.ts';

type Orm = Database['orm'];

/** Tope anti-abuso del catálogo compartido: importar sin límite dejaría
 * inundarlo con copias. Los generados por el generador no cuentan (llevan
 * jobId); solo los importados (jobId null). */
export const MAX_IMPORTS_PER_DAY_PER_USER = 10;
/** Profundidad JSON máxima (SPEC-007 §1): rechazar, nunca truncar. */
const MAX_JSON_DEPTH = 32;
/** El título viaja en CaseSummary y el cliente lo valida como texto corto. */
const MAX_TITLE_LENGTH = 160;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Profundidad máxima de un JSON, iterativa: la recursión con un fichero
 * malicioso de miles de niveles rompería la pila antes de rechazarlo. */
function jsonDepth(value: unknown): number {
  let max = 0;
  const stack: Array<{ node: unknown; depth: number }> = [{ node: value, depth: 1 }];
  while (stack.length > 0) {
    const { node, depth } = stack.pop()!;
    if (depth > max) max = depth;
    if (depth >= MAX_JSON_DEPTH) continue;
    if (Array.isArray(node)) {
      for (const child of node) stack.push({ node: child, depth: depth + 1 });
    } else if (isRecord(node)) {
      for (const child of Object.values(node)) stack.push({ node: child, depth: depth + 1 });
    }
  }
  return max;
}

function validationError(errors: string[]): never {
  const shown = errors.slice(0, 3).join(' ');
  const rest = errors.length > 3 ? ` (y ${errors.length - 3} más)` : '';
  throw new RunStoreError('VALIDATION_ERROR', (shown + rest).slice(0, 500));
}

function exportMetadata(definition: CaseDefinition, duration: string): CaseExport['metadata'] {
  return {
    difficulty: definition.difficulty,
    // El generador solo produce Europa hoy (pipeline DEFAULT_GENERATION_PARAMS).
    duration,
    region: 'europa',
    seed: definition.seed,
    catalogVersion: definition.catalogVersion,
  };
}

/** Descarga explícita del expediente completo por su dueño autorizado
 * (DEC-011). El caso fijo no es de nadie y no se descarga; el de otro
 * jugador se rechaza sin descargar nada. */
export async function exportCase(orm: Orm, ownerId: string, caseId: string): Promise<CaseExport> {
  if (caseId === astrolabioDefinition.id) {
    throw new RunStoreError('FORBIDDEN', 'El expediente fijo del archivo no se puede descargar.');
  }
  const rows = await orm.select().from(generatedCases).where(eq(generatedCases.caseId, caseId)).limit(1);
  const row = rows[0];
  if (!row) throw new RunStoreError('NOT_FOUND');
  if (row.createdBy !== ownerId) {
    throw new RunStoreError('FORBIDDEN', 'Este expediente no es tuyo: solo su dueño puede descargarlo.');
  }
  const definition = await findCase(orm, caseId);
  const result = createExport(definition, exportMetadata(definition, row.duration));
  if (!result.success || !result.export) validationError(result.errors);
  return result.export;
}

/** Valida el fichero (formato, checksum, profundidad, v1.5) y lo registra
 * en el catálogo como expediente del importador. Un fichero inválido no
 * registra nada y un expediente ya importado por el mismo usuario no se
 * duplica. */
export async function importCase(orm: Orm, ownerId: string, data: unknown): Promise<CaseImportResultDto> {
  if (jsonDepth(data) > MAX_JSON_DEPTH) validationError(['El fichero es demasiado profundo.']);
  const checked = validateImport(data);
  if (!checked.success) validationError(checked.errors);
  const warnings = [...checked.warnings];
  const exported = data as CaseExport;
  const definition = exported.definition as unknown;
  if (!isRecord(definition)) validationError(['Definición de caso requerida.']);
  const catalogMeta = definition.catalogMeta as unknown;
  if (!isRecord(catalogMeta) || typeof catalogMeta.crimeType !== 'string' ||
      !(GDD_CRIME_TYPES as readonly string[]).includes(catalogMeta.crimeType) || catalogMeta.crimeType === 'aleatorio' ||
      (catalogMeta.contentRating !== 'familiar' && catalogMeta.contentRating !== 'general') ||
      !crimeAllowedForRating(catalogMeta.crimeType as never, catalogMeta.contentRating)) {
    validationError(['El expediente no trae delito y contenido válidos.']);
  }
  const meta = catalogMeta as { crimeType: string; contentRating: string };
  const rawId = definition.id;
  if (typeof rawId !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(rawId)) {
    validationError(['El expediente no trae un identificador válido.']);
  }
  const briefing = isRecord(definition.briefing) ? definition.briefing : null;
  const rawTitle = briefing !== null && typeof briefing.title === 'string' ? briefing.title : rawId;
  if (rawTitle.trim().length === 0 || rawTitle.length > MAX_TITLE_LENGTH) {
    validationError(['El título del expediente es demasiado largo.']);
  }
  const title: string = rawTitle;
  // Lo importado vive en generated_cases: su modo es generado, aunque el
  // fichero diga otra cosa.
  definition.contentMode = 'generated';
  const report = validateCaseDefinition(definition);
  if (!report.valid) validationError(['El expediente no pasa la validación: ' + report.errors.slice(0, 3).join(' ') +
    (report.errors.length > 3 ? ` (y ${report.errors.length - 3} más)` : '')]);
  const typed = definition as unknown as CaseDefinition;
  const definitionHash = hashDefinition(typed);

  const existing = await orm.select().from(generatedCases).where(eq(generatedCases.caseId, typed.id)).limit(1);
  const found = existing[0];
  if (found) {
    // El mismo expediente ya está en el catálogo del importador: no duplicar.
    if (found.createdBy === ownerId && found.definitionHash === definitionHash) {
      return { caseId: found.caseId, title: found.title, canStart: true, warnings, alreadyExisted: true };
    }
    // El identificador ya existe (de otro jugador o con otro contenido):
    // el importador se queda su propia copia con un identificador nuevo.
    const freshId = `importado-${randomBytes(4).toString('hex')}`;
    warnings.push(`El identificador ${typed.id} ya existe en el catálogo; se ha importado como ${freshId}.`);
    typed.id = freshId;
  }
  // El id fijo nunca se importa como tal: su definición ya gobierna el caso
  // fijo y la fila quedaría tapada por el fixture.
  if (typed.id === astrolabioDefinition.id) {
    const freshId = `importado-${randomBytes(4).toString('hex')}`;
    warnings.push(`El identificador ${typed.id} es el del expediente fijo; se ha importado como ${freshId}.`);
    typed.id = freshId;
  }

  const today = await orm.select({ n: sql<string>`count(*)::text` }).from(generatedCases)
    .where(and(eq(generatedCases.createdBy, ownerId), sql`${generatedCases.jobId} IS NULL`,
      sql`date_trunc('day', ${generatedCases.createdAt}) = date_trunc('day', now())`));
  if (Number(today[0]?.n ?? 0) >= MAX_IMPORTS_PER_DAY_PER_USER) {
    throw new RunStoreError('GENERATION_LIMIT', `Has llegado al límite de ${MAX_IMPORTS_PER_DAY_PER_USER} expedientes importados por día.`);
  }

  const duration = exported.metadata !== undefined && isRecord(exported.metadata) &&
    (exported.metadata.duration === 'short' || exported.metadata.duration === 'medium' || exported.metadata.duration === 'long')
    ? exported.metadata.duration
    : 'medium';
  const finalHash = hashDefinition(typed);
  await orm.insert(generatedCases).values({
    caseId: typed.id,
    title,
    crimeType: meta.crimeType,
    contentRating: meta.contentRating,
    duration,
    definition: typed as unknown as Record<string, unknown>,
    definitionHash: finalHash,
    jobId: null,
    createdBy: ownerId,
  });
  return { caseId: typed.id, title, canStart: true, warnings, alreadyExisted: false };
}
