// Intercambio de expedientes (T4-05 expuesto): exportar el expediente
// completo solo por su dueño autorizado (DEC-011, GDD §17) e importar un
// fichero con validación antes de jugarse. El formato es el de
// packages/generator/src/import-export.ts (versionado, con checksum); el
// checksum es integridad, no firma ni garantía de autoría (SPEC-007).
// La IA no viaja en el fichero: el expediente es autocontenido y cada
// jugador pone su propio proveedor (configuración por usuario).
import { randomBytes } from 'node:crypto';
import { and, desc, eq, sql } from 'drizzle-orm';
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
    const item = stack.pop();
    if (!item) break;
    const { node, depth } = item;
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

/** Delito y contenido del fichero: el validador v1.5 los admite ausentes,
 * pero el catálogo los necesita para listar y crear partidas. */
function checkImportCatalogMeta(definition: Record<string, unknown>): { crimeType: string; contentRating: string } {
  const catalogMeta = definition.catalogMeta as unknown;
  if (!isRecord(catalogMeta) || typeof catalogMeta.crimeType !== 'string' ||
      !(GDD_CRIME_TYPES as readonly string[]).includes(catalogMeta.crimeType) || catalogMeta.crimeType === 'aleatorio' ||
      (catalogMeta.contentRating !== 'familiar' && catalogMeta.contentRating !== 'general') ||
      !crimeAllowedForRating(catalogMeta.crimeType as never, catalogMeta.contentRating)) {
    validationError(['El expediente no trae delito y contenido válidos.']);
  }
  return catalogMeta as { crimeType: string; contentRating: string };
}

function importTitle(definition: Record<string, unknown>): string {
  const rawId = definition.id;
  if (typeof rawId !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(rawId)) {
    validationError(['El expediente no trae un identificador válido.']);
  }
  const briefing = isRecord(definition.briefing) ? definition.briefing : null;
  const title = briefing !== null && typeof briefing.title === 'string' ? briefing.title : rawId;
  if (title.trim().length === 0 || title.length > MAX_TITLE_LENGTH) {
    validationError(['El título del expediente es demasiado largo.']);
  }
  return title;
}

interface ParsedImport {
  exported: CaseExport;
  definition: Record<string, unknown>;
  meta: { crimeType: string; contentRating: string };
  title: string;
  warnings: string[];
}

/** Formato, checksum, profundidad, delito/contenido e identificador: todo
 * lo que se puede comprobar sin abrir el validador v1.5. */
function parseImportFile(data: unknown): ParsedImport {
  if (jsonDepth(data) > MAX_JSON_DEPTH) validationError(['El fichero es demasiado profundo.']);
  const checked = validateImport(data);
  if (!checked.success) validationError(checked.errors);
  const exported = data as CaseExport;
  const definition = exported.definition as unknown;
  if (!isRecord(definition)) validationError(['Definición de caso requerida.']);
  const meta = checkImportCatalogMeta(definition);
  const title = importTitle(definition);
  return { exported, definition, meta, title, warnings: [...checked.warnings] };
}

/** La puerta v1.5: lo importado vive en generated_cases, así que su modo
 * es generado aunque el fichero diga otra cosa. */
function validateImportDefinition(definition: Record<string, unknown>): CaseDefinition {
  definition.contentMode = 'generated';
  const report = validateCaseDefinition(definition);
  if (!report.valid) validationError(['El expediente no pasa la validación: ' + report.errors.slice(0, 3).join(' ') +
    (report.errors.length > 3 ? ` (y ${report.errors.length - 3} más)` : '')]);
  return definition as unknown as CaseDefinition;
}

/** Resuelve el identificador en el catálogo: deduplica si el importador ya
 * tiene ese mismo expediente; si colisiona, el importador se queda su
 * propia copia con un identificador nuevo. Devuelve null si hay que
 * insertar. El id fijo nunca se importa como tal: su definición ya
 * gobierna el caso fijo y la fila quedaría tapada por el fixture. */
async function resolveImportTarget(orm: Orm, ownerId: string, typed: CaseDefinition, definitionHash: string,
  warnings: string[]): Promise<{ caseId: string; title: string } | null> {
  const existing = await orm.select().from(generatedCases).where(eq(generatedCases.caseId, typed.id)).limit(1);
  const found = existing[0];
  if (found && found.createdBy === ownerId && found.definitionHash === definitionHash) {
    return { caseId: found.caseId, title: found.title };
  }
  // Reimportar la misma copia (título distinto, id reasignado en la
  // primera importación): el catálogo ya tiene esa definición con otro
  // identificador; no duplicar.
  const ownCopy = await findOwnImportedCopy(orm, ownerId, typed);
  if (ownCopy) return ownCopy;
  if (found) {
    const freshId = `importado-${randomBytes(4).toString('hex')}`;
    warnings.push(`El identificador ${typed.id} ya existe en el catálogo; se ha importado como ${freshId}.`);
    typed.id = freshId;
  }
  if (typed.id === astrolabioDefinition.id) {
    const freshId = `importado-${randomBytes(4).toString('hex')}`;
    warnings.push(`El identificador ${typed.id} es el del expediente fijo; se ha importado como ${freshId}.`);
    typed.id = freshId;
  }
  return null;
}

/** Busca entre los expedientes importados por el usuario uno con la misma
 * definición que el fichero, alineando el identificador: la copia
 * importada guarda el contenido del fichero con un id reasignado, así que
 * la huella se calcula con el id de cada fila candidata. Solo se miran las
 * 50 importaciones más recientes; importar es raro y la cuota diaria es
 * de 10. */
async function findOwnImportedCopy(orm: Orm, ownerId: string, typed: CaseDefinition): Promise<{ caseId: string; title: string } | null> {
  const rows = await orm.select({ caseId: generatedCases.caseId, title: generatedCases.title, definitionHash: generatedCases.definitionHash })
    .from(generatedCases)
    .where(and(eq(generatedCases.createdBy, ownerId), sql`${generatedCases.jobId} IS NULL`))
    .orderBy(desc(generatedCases.createdAt)).limit(50);
  for (const row of rows) {
    if (hashDefinition({ ...typed, id: row.caseId }) === row.definitionHash) {
      return { caseId: row.caseId, title: row.title };
    }
  }
  return null;
}

async function checkImportLimit(orm: Orm, ownerId: string): Promise<void> {
  const today = await orm.select({ n: sql<string>`count(*)::text` }).from(generatedCases)
    .where(and(eq(generatedCases.createdBy, ownerId), sql`${generatedCases.jobId} IS NULL`,
      sql`date_trunc('day', ${generatedCases.createdAt}) = date_trunc('day', now())`));
  if (Number(today[0]?.n ?? 0) >= MAX_IMPORTS_PER_DAY_PER_USER) {
    throw new RunStoreError('GENERATION_LIMIT', `Has llegado al límite de ${MAX_IMPORTS_PER_DAY_PER_USER} expedientes importados por día.`);
  }
}

function importDuration(exported: CaseExport): 'short' | 'medium' | 'long' {
  const duration = (exported.metadata as unknown as Record<string, unknown> | undefined)?.duration;
  return duration === 'short' || duration === 'medium' || duration === 'long' ? duration : 'medium';
}

/** Valida el fichero (formato, checksum, profundidad, v1.5) y lo registra
 * en el catálogo como expediente del importador. Un fichero inválido no
 * registra nada y un expediente ya importado por el mismo usuario no se
 * duplica. */
export async function importCase(orm: Orm, ownerId: string, data: unknown): Promise<CaseImportResultDto> {
  const parsed = parseImportFile(data);
  const typed = validateImportDefinition(parsed.definition);
  const definitionHash = hashDefinition(typed);
  const existing = await resolveImportTarget(orm, ownerId, typed, definitionHash, parsed.warnings);
  if (existing) return { caseId: existing.caseId, title: existing.title, canStart: true, warnings: parsed.warnings, alreadyExisted: true };
  await checkImportLimit(orm, ownerId);
  await orm.insert(generatedCases).values({
    caseId: typed.id,
    title: parsed.title,
    crimeType: parsed.meta.crimeType,
    contentRating: parsed.meta.contentRating,
    duration: importDuration(parsed.exported),
    definition: typed as unknown as Record<string, unknown>,
    definitionHash: hashDefinition(typed),
    jobId: null,
    createdBy: ownerId,
  });
  return { caseId: typed.id, title: parsed.title, canStart: true, warnings: parsed.warnings, alreadyExisted: false };
}
