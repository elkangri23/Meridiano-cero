import type { AdminAuditLogEntry } from './types.js';

/** Tabla de entradas de auditoría con sus estados de carga, error y vacío. */
export function AuditTable({ loading, error, data }: {
  loading: boolean;
  error: string | null;
  data: AdminAuditLogEntry[];
}) {
  return (
    <div className="audit-table-wrap">
      {loading && (
        <div className="audit-state">Cargando auditoría…</div>
      )}

      {error && (
        <div className="audit-state audit-state-error">Error: {error}</div>
      )}

      {!loading && !error && (
        <table className="audit-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Admin</th>
              <th>Acción</th>
              <th>Target Type</th>
              <th>Target ID</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && (
              <tr>
                <td colSpan={6} className="audit-empty-cell">
                  No hay entradas de auditoría con los filtros aplicados
                </td>
              </tr>
            )}
            {data.map((entry, index) => (
              <tr key={entry.id}>
                <td className="audit-num">{index + 1}</td>
                <td className="audit-id">{entry.adminId?.substring(0, 8) + '...'}</td>
                <td className="audit-action">{entry.action}</td>
                <td>{entry.targetType}</td>
                <td className="audit-id">{entry.targetId?.substring(0, 8) + '...'}</td>
                <td className="audit-date">{entry.createdAt ? entry.createdAt.substring(0, 16) : 'N/A'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Estado vacío cuando hay filtros pero no resultados */}
      {data.length === 0 && !loading && !error && (
        <div className="audit-state">
          No hay entradas de auditoría con los filtros aplicados
        </div>
      )}
    </div>
  );
}
