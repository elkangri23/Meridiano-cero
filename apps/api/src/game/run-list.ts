import { listCases } from './catalog.ts';
import type { RunListDto, RunSummaryDto } from '@meridiano/contracts';
import type { Database } from '../database/connection.ts';
import { inSession, RunStoreError } from './runs.ts';

type Status = RunSummaryDto['status'];
type Options = { limit: number; status: Status | null; anchor: string | null };
const uuid = '[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}';
const cursorPattern = new RegExp('^v1\\.(all|active|closed)\\.(' + uuid + ')$');

function pageLimit(value: unknown): number {
  if (value === undefined) return 25;
  if (typeof value !== 'string' || !/^(?:[1-9][0-9]?|100)$/.test(value)) throw new RunStoreError('INVALID_REQUEST');
  return Number(value);
}
function pageStatus(value: unknown): Status | null {
  if (value === undefined) return null;
  if (value !== 'active' && value !== 'closed') throw new RunStoreError('INVALID_REQUEST');
  return value;
}
function pageAnchor(value: unknown, status: Status | null): string | null {
  if (value === undefined) return null;
  if (typeof value !== 'string' || value.length > 64) throw new RunStoreError('INVALID_REQUEST');
  const match = cursorPattern.exec(value);
  if (!match || match[1] !== (status ?? 'all') || !match[2]) throw new RunStoreError('INVALID_REQUEST');
  return match[2];
}
function runListOptions(query: Record<string, unknown>): Options {
  if (!Object.keys(query).every(key => ['limit', 'status', 'cursor'].includes(key))) throw new RunStoreError('INVALID_REQUEST');
  const status = pageStatus(query.status);
  return { limit: pageLimit(query.limit), status, anchor: pageAnchor(query.cursor, status) };
}

type Row = { cursorValid: boolean; runId: string | null; caseId: string; status: unknown; version: number; createdAt: Date };
function summary(row: Row, titles: Map<string, string>): RunSummaryDto {
  if (!row.runId || !/^[A-Za-z0-9._:-]{1,128}$/.test(row.caseId) ||
      (row.status !== 'active' && row.status !== 'closed') || !Number.isSafeInteger(row.version) || row.version < 1 ||
      !(row.createdAt instanceof Date) || !Number.isFinite(row.createdAt.getTime())) throw new RunStoreError('DEPENDENCY_UNAVAILABLE');
  return { runId: row.runId, caseId: row.caseId, caseTitle: titles.get(row.caseId) ?? null, status: row.status, version: row.version, createdAt: row.createdAt.toISOString() };
}

export function listStoredRuns(database: Database, digest: string, query: Record<string, unknown>): Promise<RunListDto> {
  const options = runListOptions(query);
  const titles = new Map(listCases().map(item => [item.caseId, item.title]));
  return inSession(database, digest, async (client, ownerId) => {
    // Un snapshot para ancla/página; timestamps de DB conservan microsegundos.
    const result = await client.query<Row>(`
      WITH anchor AS (
        SELECT created_at,id FROM runs WHERE owner_id=$1 AND id=$3::uuid
          AND ($2::text IS NULL OR engine_state->>'status'=$2)
      ), page AS (
        SELECT id AS "runId",definition_id AS "caseId",engine_state->>'status' AS status,
          revision AS version,created_at AS "createdAt" FROM runs
        WHERE owner_id=$1 AND ($2::text IS NULL OR engine_state->>'status'=$2)
          AND ($3::uuid IS NULL OR (created_at,id)<(SELECT created_at,id FROM anchor))
        ORDER BY created_at DESC,id DESC LIMIT $4
      )
      SELECT ($3::uuid IS NULL OR EXISTS(SELECT 1 FROM anchor)) AS "cursorValid",page.*
      FROM (SELECT 1) gate LEFT JOIN page ON true
      ORDER BY page."createdAt" DESC,page."runId" DESC`, [ownerId, options.status, options.anchor, options.limit + 1]);
    if (!result.rows[0]?.cursorValid) throw new RunStoreError('INVALID_REQUEST');
    const all = result.rows.filter(row => row.runId !== null).map(row => summary(row, titles));
    const items = all.slice(0, options.limit);
    const last = items.at(-1);
    const nextCursor = all.length > options.limit && last ? 'v1.' + (options.status ?? 'all') + '.' + last.runId : null;
    return { profileId: ownerId, items, nextCursor };
  });
}
