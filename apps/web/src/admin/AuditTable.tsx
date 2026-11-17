import type { AdminAuditLogEntry } from './types.js';

/** Tabla de entradas de auditoría con sus estados de carga, error y vacío. */
export function AuditTable({ loading, error, data }: {
  loading: boolean;
  error: string | null;
  data: AdminAuditLogEntry[];
}) {
  return (
    <div style={{
      background: '#111',
      border: '1px solid #333',
      borderRadius: '6px',
      overflow: 'hidden',
    }}>
      {loading && (
        <div style={{ padding: '24px', textAlign: 'center' }}>
          <span style={{ color: '#666', fontFamily: "'Courier New', monospace" }}>Cargando auditoría…</span>
        </div>
      )}

      {error && (
        <div style={{ padding: '24px', textAlign: 'center', color: '#ff5555' }}>
          <span style={{ color: '#fff', fontFamily: "'Courier New', monospace" }}>Error: {error}</span>
        </div>
      )}

      {!loading && !error && (
        <div style={{ padding: '16px' }}>
          <style>{`
            .audit-table th {
              background: #0000aa;
              color: #fff;
              padding: 8px 12px;
              font-family: 'Courier New', monospace;
              font-size: 12px;
              border-bottom: 1px solid #333;
            }
            .audit-table td {
              color: #fff;
              padding: 8px 12px;
              font-family: 'Courier New', monospace;
              font-size: 12px;
              border-bottom: 1px solid #333;
            }
            .audit-table tr:hover {
              background: rgba(255, 255, 85, 0.05);
            }
          `}</style>
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
                  <td colSpan={6} style={{ textAlign: 'center', color: '#666' }}>
                    No hay entradas de auditoría con los filtros aplicados
                  </td>
                </tr>
              )}
              {data.map((entry, index) => (
                <tr key={entry.id}>
                  <td style={{ color: '#666' }}>{index + 1}</td>
                  <td style={{ color: '#ffff55' }}>{entry.adminId?.substring(0, 8) + '...'}</td>
                  <td style={{ color: '#ffff55' }}>{entry.action}</td>
                  <td style={{ color: '#ffff55' }}>{entry.targetType}</td>
                  <td style={{ color: '#ffff55' }}>{entry.targetId?.substring(0, 8) + '...'}</td>
                  <td style={{ color: '#ffff55' }}>{entry.createdAt ? entry.createdAt.substring(0, 16) : 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Estado vacío cuando hay filtros pero no resultados */}
      {data.length === 0 && !loading && !error && (
        <div style={{ padding: '24px', textAlign: 'center', color: '#666' }}>
          No hay entradas de auditoría con los filtros aplicados
        </div>
      )}
    </div>
  );
}
