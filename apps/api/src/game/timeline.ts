// Cronología de una partida (GDD §12): la secuencia completa de acciones
// con su minuto y su resumen factual. Los registros de operaciones guardan
// los eventos proyectados de cada acción confirmada (`result_public.events`)
// con su revisión y su rama; la cronología es la concatenación de los de la
// rama actual, ordenada por la secuencia global del motor. Una carga de
// guardado abre una rama nueva, así que las acciones de ramas anteriores no
// aparecen: la cronología solo cuenta lo que pasó en esta línea temporal.
// Las vistas previas y las acciones rechazadas no se registran y tampoco
// aparecen.
import type { PublicEvent } from '@meridiano/contracts';

export type TimelineQuery = (sql: string, params: unknown[]) => Promise<{ rows: Array<{ result_public: unknown }> }>;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isStoredEvent(value: unknown): value is PublicEvent {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return isNonEmptyString(record.id) && isNonEmptyString(record.summary) &&
    isNonEmptyString(record.type) && isNonNegativeInteger(record.sequence) &&
    isNonNegativeInteger(record.minute);
}

export async function loadRunTimeline(query: TimelineQuery, runId: string, branchId: string): Promise<PublicEvent[]> {
  const result = await query(
    `SELECT result_public FROM operation_records WHERE run_id=$1 AND branch_id=$2 AND kind='action' ORDER BY revision ASC`,
    [runId, branchId]);
  const events: PublicEvent[] = [];
  for (const row of result.rows) {
    const stored = row.result_public as { events?: unknown } | null;
    if (!stored || !Array.isArray(stored.events)) continue;
    for (const event of stored.events) if (isStoredEvent(event)) events.push(event);
  }
  return events.sort((a, b) => a.sequence - b.sequence);
}
