// Carrera y reputación (GDD §13, DEC-020, T5-04): persistencia del primer
// resultado oficial y derivación del perfil desde `official_results`.
//
// La carrera es la suma de los resultados oficiales: no hay agregado
// mutable aparte. El primer cierre definitivo de un contenido para un
// perfil fija su resultado oficial (idempotente por unicidad
// owner+contentHash, con `ON CONFLICT DO NOTHING`); los cierres
// posteriores del mismo contenido son práctica y no cambian nada.
// Cargar un guardado antes del primer cierre no crea resultado oficial,
// así que cambiar decisiones sigue siendo posible hasta cerrar.
import type { CaseDefinition, CaseRun, FinalReport, Language } from '@meridiano/case-schema';
import {
  caseText, deriveCareerProfile, getCity, outcomeFromReport,
  rankForTotals, reputationLabel, type CareerResultEntry,
} from '@meridiano/case-schema';
import { contentHashForDefinition } from '@meridiano/case-schema/server';
import type { CareerProfileDto, OfficialResultDto } from '@meridiano/contracts';

type Queryable = { query: (sql: string, params: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }> };

/** Contenido de `first_result` (JSONB): lo que fija el primer cierre. */
export interface CareerFirstResult {
  caseId: string;
  caseTitle: string;
  result: 'complete' | 'partial' | 'incorrect' | 'unresolved';
  reason: 'finished' | 'deadline' | 'withdrawn';
  minute: number;
  points: number;
  medal: string | null;
  prestigeDelta: number;
  integrityDelta: number;
  trustDelta: number;
  irregularActs: number;
  countries: string[];
  places: string[];
}

interface OfficialResultRow {
  id: string;
  ownerId: string;
  definitionHash: string;
  contentHash: string;
  variantOrigin: string | null;
  firstResult: CareerFirstResult;
  ruleVersion: number;
  operationId: string;
  createdAt: Date;
}

function parseRow(row: Record<string, unknown>): OfficialResultRow {
  const firstResult = row.first_result as CareerFirstResult;
  return {
    id: String(row.id),
    ownerId: String(row.owner_id),
    definitionHash: String(row.definition_hash),
    contentHash: String(row.content_hash),
    variantOrigin: row.variant_origin === null ? null : String(row.variant_origin),
    firstResult,
    ruleVersion: Number(row.rule_version),
    operationId: String(row.operation_id),
    createdAt: row.created_at instanceof Date ? row.created_at : new Date(String(row.created_at)),
  };
}

const OFFICIAL_RESULT_COLUMNS = 'id, owner_id, definition_hash, content_hash, variant_origin, first_result, rule_version, operation_id, created_at';

async function loadOfficialRows(queryable: Queryable, ownerId: string): Promise<OfficialResultRow[]> {
  const result = await queryable.query(
    `SELECT ${OFFICIAL_RESULT_COLUMNS} FROM official_results WHERE owner_id=$1 ORDER BY created_at ASC, id ASC`,
    [ownerId]);
  return result.rows.map(parseRow);
}

/** Título del expediente: el mismo que enseña el catálogo. */
export function caseTitleForDefinition(definition: CaseDefinition, language: Language = 'es'): string {
  return caseText(definition.id, 'briefing.title', language) ?? definition.briefing?.title ?? 'El astrolabio de las tres ciudades';
}

/** Países y lugares visitados al cerrar: los lugares descubiertos (más
 * la posición actual) con su ciudad y su país del catálogo geográfico.
 * Solo lugares de la definición: otros descubrimientos (p. ej. el mapa)
 * no son lugares y no se cuentan. */
export function placesAndCountries(definition: CaseDefinition, run: CaseRun): { countries: string[]; places: string[] } {
  const seen = new Set<string>();
  const places: string[] = [];
  const countries: string[] = [];
  for (const locationId of [run.position.locationId, ...run.discoveries]) {
    if (seen.has(locationId)) continue;
    seen.add(locationId);
    const location = definition.locations.find(item => item.id === locationId);
    if (!location) continue;
    places.push(location.name);
    const city = definition.cities.find(item => item.id === location.cityId);
    const countryName = city ? (getCity(city.id)?.countryName ?? city.country) : undefined;
    if (countryName && !countries.includes(countryName)) countries.push(countryName);
  }
  return { countries, places };
}

/** Persiste el primer resultado oficial de un cierre, en la misma
 * transacción que el cierre. Idempotente y seguro ante concurrencia: si
 * ya existe un resultado oficial para este contenido, el conflicto no
 * crea fila ni sustituye la primera (`recorded: false`). El cierre y el
 * registro oficial son atómicos porque quien llama lo hace dentro de la
 * transacción de `persistAction`. */
export async function recordOfficialResult(
  queryable: Queryable, ownerId: string, run: CaseRun & { id: string; definitionHash: string },
  definition: CaseDefinition, report: FinalReport, operationId: string,
): Promise<{ recorded: boolean; contentHash: string }> {
  const contentHash = contentHashForDefinition(definition);
  const outcome = outcomeFromReport(report, { recovered: run.recoveredObjects.length > 0 });
  const { countries, places } = placesAndCountries(definition, run);
  const firstResult: CareerFirstResult = {
    caseId: definition.id,
    caseTitle: caseTitleForDefinition(definition),
    result: report.result,
    reason: report.reason,
    minute: report.minute,
    points: outcome.points,
    medal: outcome.medal ?? null,
    prestigeDelta: outcome.prestigeDelta,
    integrityDelta: outcome.integrityDelta,
    trustDelta: outcome.trustDelta,
    irregularActs: report.irregularActs.length,
    countries,
    places,
  };
  const inserted = await queryable.query(
    `INSERT INTO official_results(owner_id, definition_hash, content_hash, variant_origin, first_result, rule_version, operation_id)
     VALUES ($1,$2,$3,$4,$5::jsonb,1,$6)
     ON CONFLICT (owner_id, content_hash) DO NOTHING RETURNING id`,
    [ownerId, run.definitionHash, contentHash, definition.contentMode, JSON.stringify(firstResult), operationId]);
  return { recorded: inserted.rows.length === 1, contentHash };
}

function entryForRow(row: OfficialResultRow, language: Language = 'es'): CareerResultEntry {
  const first = row.firstResult;
  return {
    caseId: first.caseId,
    // El título guardado es el español de cuando se cerró el caso; al
    // leerlo se traduce con el locale del expediente, sin tocar la fila.
    caseTitle: caseText(first.caseId, 'briefing.title', language) ?? first.caseTitle,
    contentHash: row.contentHash,
    result: first.result,
    reason: first.reason,
    minute: first.minute,
    points: first.points,
    medal: first.medal ?? undefined,
    prestigeDelta: first.prestigeDelta,
    integrityDelta: first.integrityDelta,
    trustDelta: first.trustDelta,
    irregularActs: first.irregularActs,
    countries: first.countries,
    places: first.places,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Rango antes y después de un resultado oficial, por el orden de
 * creación: los deltas acumulados hasta (sin) ese resultado. */
function ranksForEntry(rows: OfficialResultRow[], index: number, language: Language = 'es'): { rankBefore: string; rankAfter: string } {
  const sum = (upto: number): { prestige: number; integrity: number; trust: number } => {
    let prestige = 0;
    let integrity = 0;
    let trust = 0;
    for (const row of rows.slice(0, upto)) {
      const first = row.firstResult;
      prestige += first.prestigeDelta;
      integrity += first.integrityDelta;
      trust += first.trustDelta;
    }
    return { prestige, integrity, trust };
  };
  const before = sum(index);
  const after = sum(index + 1);
  return {
    rankBefore: rankForTotals(before.prestige, before.integrity, before.trust, language),
    rankAfter: rankForTotals(after.prestige, after.integrity, after.trust, language),
  };
}

/** Resultado oficial de un contenido para un perfil, o null si aún no
 * hay cierre oficial. `isThisRun` es true solo si el resultado oficial
 * lo produjo esta partida (su operación de cierre); si lo produjo otra
 * partida del mismo contenido, esta es de práctica. */
export async function loadOfficialResultForContent(
  queryable: Queryable, ownerId: string, contentHash: string, runId?: string, language: Language = 'es',
): Promise<OfficialResultDto | null> {
  const rows = await loadOfficialRows(queryable, ownerId);
  const index = rows.findIndex(row => row.contentHash === contentHash);
  if (index === -1) return null;
  const row = rows.at(index);
  if (!row) return null;
  const first = row.firstResult;
  const { rankBefore, rankAfter } = ranksForEntry(rows, index, language);
  let isThisRun = false;
  if (runId) {
    const operation = await queryable.query(
      'SELECT run_id FROM operation_records WHERE id=$1', [row.operationId]);
    isThisRun = operation.rows[0]?.run_id === runId;
  }
  return {
    caseId: first.caseId,
    caseTitle: caseText(first.caseId, 'briefing.title', language) ?? first.caseTitle,
    contentHash: row.contentHash,
    result: first.result,
    reason: first.reason,
    minute: first.minute,
    points: first.points,
    medal: first.medal,
    prestigeDelta: first.prestigeDelta,
    integrityDelta: first.integrityDelta,
    trustDelta: first.trustDelta,
    irregularActs: first.irregularActs,
    countries: [...first.countries],
    places: [...first.places],
    rankBefore,
    rankAfter,
    isThisRun,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Perfil de carrera completo del detective, derivado de sus resultados
 * oficiales. Sin resultados oficiales, el perfil está vacío (rango
 * Aspirante, cero casos): la carrera empieza con el primer cierre. */
export async function loadCareerProfile(queryable: Queryable, ownerId: string, language: Language = 'es'): Promise<CareerProfileDto> {
  const rows = await loadOfficialRows(queryable, ownerId);
  const entries = rows.map(row => entryForRow(row, language));
  const derived = deriveCareerProfile(entries, language);
  return {
    rank: derived.rank,
    points: derived.points,
    prestige: derived.prestige,
    integrity: derived.integrity,
    trust: derived.trust,
    prestigeLabel: reputationLabel(derived.prestige, language),
    integrityLabel: reputationLabel(derived.integrity, language),
    trustLabel: reputationLabel(derived.trust, language),
    totalCases: derived.totalCases,
    completedCases: derived.completedCases,
    medals: derived.medals,
    countries: derived.countries,
    places: derived.places,
    sanctions: derived.sanctions.map(sanction => ({
      id: sanction.id,
      caseId: sanction.caseId,
      reason: sanction.reason,
      // La derivación solo crea suspensiones (las advertencias quedan en
      // el dossier de su partida); el `as const` lo deja explícito.
      severity: 'suspension' as const,
      imposedAt: sanction.imposedAt,
      ...(sanction.resolvedAt !== undefined ? { resolvedAt: sanction.resolvedAt } : {}),
      active: sanction.resolvedAt === undefined,
    })),
    results: entries.map(entry => ({
      caseId: entry.caseId,
      caseTitle: entry.caseTitle,
      result: entry.result,
      reason: entry.reason,
      minute: entry.minute,
      points: entry.points,
      medal: entry.medal ?? null,
      createdAt: entry.createdAt,
    })),
  };
}
