import { useEffect, useState } from 'react';
import { adminApi } from './client.js';
import type { AdminDashboardMetrics, AdminAuditLogEntry } from './types.js';

/**
 * Dashboard principal del panel de administración.
 * En Fase 1, las métricas son mockadas; se conectarán a la API real en Fase 2.
 */
export function DashboardPage() {
  const [metrics, setMetrics] = useState<AdminDashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros de auditoría
  const [auditFilters, setAuditFilters] = useState<{
    startDate?: string;
    endDate?: string;
    action?: string;
  }>({});

  const [auditLoading, setAuditLoading] = useState(true);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditData, setAuditData] = useState<AdminAuditLogEntry[]>([]);
  const [auditPagination, setAuditPagination] = useState<{
    totalItems: number;
    totalPages: number;
    currentPage: number;
    itemsPerPage: number;
  }>({
    totalItems: 0,
    totalPages: 0,
    currentPage: 1,
    itemsPerPage: 50,
  });

  useEffect(() => {
    let cancelled = false;
    adminApi.getDashboardMetrics()
      .then((data) => {
        if (!cancelled) {
          setMetrics(data);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  // Cargar auditoría cuando cambian los filtros
  useEffect(() => {
    let cancelled = false;
    const loadAudit = async () => {
      setAuditLoading(true);
      try {
        const response = await adminApi.getAuditLog(auditFilters);
        if (!cancelled) {
          setAuditData(response.logs);
          setAuditPagination({
            totalItems: response.total,
            totalPages: Math.ceil(response.total / 50),
            currentPage: 1,
            itemsPerPage: 50,
          });
          setAuditLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setAuditError(e.message);
          setAuditLoading(false);
        }
      }
    };
    loadAudit();
    return () => { cancelled = true; };
  }, [JSON.stringify(auditFilters)]);

  if (loading) {
    return (
      <section className="admin-dashboard-section">
        <h2>Dashboard</h2>
        <div className="dashboard-loading">Cargando métricas…</div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="admin-dashboard-section">
        <h2>Dashboard</h2>
        <div className="dashboard-error">Error: {error}</div>
      </section>
    );
  }

  const cards: Array<{ label: string; value: string | number; icon: string; help?: string }> = [
    { label: 'Usuarios totales', value: metrics?.usersTotal ?? 0, icon: '👥', help: 'Cuentas registradas' },
    { label: 'Activos (24h)', value: metrics?.usersActive24h ?? 0, icon: '🟢', help: 'Sesiones dentro de las últimas 24h' },
    { label: 'Partidas totales', value: metrics?.runsTotal ?? 0, icon: '🎮', help: 'Casos creados' },
    { label: 'Paradas activas', value: metrics?.runsActive ?? 0, icon: '▶️', help: 'Partidas no cerradas' },
    { label: 'Tokens IA (24h)', value: metrics?.aiTokensUsed24h?.toLocaleString() ?? '0', icon: '🔤', help: 'Consumo total de IA' },
    { label: 'Errores IA (24h)', value: `${metrics?.aiErrorRate24h ?? 0}%`, icon: '⚠️', help: 'Tasa de errores en operaciones de IA' },
  ];

  // Información adicional por proveedor para futuras tablas/gráficos
  const providerMetrics = metrics?.byProvider ?? [];

  return (
    <section className="admin-dashboard-section">
      <header className="dashboard-header">
        <h2>Dashboard</h2>
        <p className="dashboard-subtitle">Visión general del estado del sistema</p>
      </header>

      <div className="metrics-grid" aria-label="Métricas principales">
        {cards.map((card) => (
          <article key={card.label} className="metric-card">
            <span className="metric-icon" aria-hidden="true">{card.icon}</span>
            <div className="metric-content">
              <span className="metric-label">{card.label}</span>
              <span className="metric-value">{card.value}</span>
              {card.help && <span className="metric-help">{card.help}</span>}
            </div>
          </article>
        ))}
      </div>

      <section className="quick-actions">
        <h3>Acciones rápidas</h3>
        <div className="action-buttons">
          <button disabled className="btn-secondary">Ver usuarios</button>
          <button disabled className="btn-secondary">Ver partidas</button>
          <button disabled className="btn-secondary">Ver IA</button>
        </div>
        <p className="microcopy">
          Estas funcionalidades estarán disponibles en versiones posteriores del panel.
        </p>
      </section>

      {providerMetrics.length > 0 && (
        <section className="provider-metrics">
          <h3>Métricas de IA por proveedor (24h)</h3>
          <div className="metrics-grid-small">
            {providerMetrics.map((provider) => (
              <article key={`${provider.providerId}-${provider.model}`} className="provider-card">
                <div className="provider-header">
                  <span className="provider-name">{provider.providerId}</span>
                  <span className="model-name">{provider.model}</span>
                </div>
                <div className="metrics">
                  <div className="metric-row">
                    <span className="label">Tokens:</span>
                    <span className="value">{provider.totalTokens?.toLocaleString() ?? 0}</span>
                  </div>
                  <div className="metric-row">
                    <span className="label">Reqs:</span>
                    <span className="value">{provider.requestCount}</span>
                  </div>
                  <div className="metric-row">
                    <span className="label">Errores:</span>
                    <span className="value error">{provider.errorCount}</span>
                  </div>
                  <div className="metric-row">
                    <span className="label">Latencia:</span>
                    <span className="value">{provider.avgLatencyMs}ms</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
          {providerMetrics.length === 0 && (
            <div className="no-data">No hay métricas de IA disponibles para el período seleccionado.</div>
          )}
        </section>
      )}

      {/* Sección de Auditoría con Filtros y Paginación */}
      <section className="audit-section" style={{ marginTop: '32px' }}>
        <h3>📋 Auditoría de Acciones Administrativas</h3>

        {/* Filtros */}
        <div className="audit-filters" style={{
          background: '#111',
          border: '1px solid #333',
          borderRadius: '6px',
          padding: '16px',
          marginBottom: '24px',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ color: '#fff', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Fecha Inicio:</label>
              <input
                type="date"
                value={auditFilters.startDate || ''}
                onChange={(e) => setAuditFilters({ ...auditFilters, startDate: e.target.value || undefined })}
                style={{
                  background: '#333',
                  color: '#fff',
                  border: '1px solid #555',
                  padding: '8px',
                  borderRadius: '4px',
                  fontFamily: "'Courier New', monospace",
                }}
              />
            </div>
            <div>
              <label style={{ color: '#fff', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Fecha Fin:</label>
              <input
                type="date"
                value={auditFilters.endDate || ''}
                onChange={(e) => setAuditFilters({ ...auditFilters, endDate: e.target.value || undefined })}
                style={{
                  background: '#333',
                  color: '#fff',
                  border: '1px solid #555',
                  padding: '8px',
                  borderRadius: '4px',
                  fontFamily: "'Courier New', monospace",
                }}
              />
            </div>
            <div>
              <label style={{ color: '#fff', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Acción:</label>
              <select
                value={auditFilters.action || ''}
                onChange={(e) => setAuditFilters({ ...auditFilters, action: e.target.value || undefined })}
                style={{
                  background: '#333',
                  color: '#fff',
                  border: '1px solid #555',
                  padding: '8px',
                  borderRadius: '4px',
                  fontFamily: "'Courier New', monospace",
                }}
              >
                <option value="">Todas las acciones</option>
                <option value="view_user">view_user</option>
                <option value="update_user">update_user</option>
                <option value="revoke_sessions">revoke_sessions</option>
                <option value="view_run">view_run</option>
                <option value="update_run">update_run</option>
                <option value="revoke_run_sessions">revoke_run_sessions</option>
                <option value="view_audit">view_audit</option>
              </select>
            </div>
          </div>

          {/* Paginación */}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
            <label style={{ color: '#aaa', fontSize: '12px' }}>Mostrar:</label>
            <select
              value={auditPagination.itemsPerPage.toString()}
              onChange={(e) => {
                const newLimit = Number(e.target.value);
                setAuditPagination(prev => ({ ...prev, itemsPerPage: newLimit, currentPage: 1 }));
              }}
              style={{
                background: '#333',
                color: '#fff',
                border: '1px solid #555',
                padding: '6px 12px',
                borderRadius: '4px',
                fontFamily: "'Courier New', monospace",
              }}
            >
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>

            <span style={{ color: '#fff', fontSize: '12px', margin: '0 8px' }}>/ {auditPagination.totalItems}</span>

            <button
              onClick={() => setAuditPagination(prev => {
                if (prev.currentPage > 1) {
                  return { ...prev, currentPage: prev.currentPage - 1 };
                }
                return prev;
              })}
              style={{
                background: '#0000aa',
                color: '#fff',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '4px',
                fontFamily: "'Courier New', monospace',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
 anterior
            </button>

            <button
              onClick={() => setAuditPagination(prev => {
                const maxPage = Math.max(1, Math.ceil(prev.totalItems / prev.itemsPerPage));
                if (prev.currentPage < maxPage) {
                  return { ...prev, currentPage: prev.currentPage + 1 };
                }
                return prev;
              })}
              style={{
                background: '#0000aa',
                color: '#fff',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '4px',
                fontFamily: "'Courier New', monospace',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              siguiente
            </button>
          </div>
        </div>

        {/* Tabla de Entradas de Auditoría */}
        <div style={{
          background: '#111',
          border: '1px solid #333',
          borderRadius: '6px',
          overflow: 'hidden',
        }}>
          {auditLoading && (
            <div style={{ padding: '24px', textAlign: 'center' }}>
              <span style={{ color: '#666', fontFamily: "'Courier New', monospace' }}>Cargando auditoría…</span>
            </div>
          )}

          {auditError && (
            <div style={{ padding: '24px', textAlign: 'center', color: '#ff5555' }}>
              <span style={{ color: '#fff', fontFamily: "'Courier New', monospace' }}>Error: {auditError}</span>
            </div>
          )}

          {!auditLoading && !auditError && (
            <div style={{ padding: '16px' }}>
              <style>
                .audit-table th {
                  background: #0000aa;
                  color: #fff;
                  padding: 8px 12px;
                  fontFamily: "'Courier New', monospace';
                  fontSize: 12px;
                  border-bottom: 1px solid #333;
                }
                .audit-table td {
                  color: #fff;
                  padding: 8px 12px;
                  fontFamily: "'Courier New', monospace';
                  fontSize: 12px;
                  border-bottom: 1px solid #333;
                }
                .audit-table tr:hover {
                  background: rgba(255, 255, 85, 0.05);
                }
              </style>
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
                  {auditData.length === 0 && (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', color: '#666' }}>
                        No hay entradas de auditoría con los filtros aplicados
                      </td>
                    </tr>
                  )}
                  {auditData.map((entry, index) => (
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
          {auditData.length === 0 && !auditLoading && !auditError && (
            <div style={{ padding: '24px', textAlign: 'center', color: '#666' }}>
              No hay entradas de auditoría con los filtros aplicados
            </div>
          )}
        </div>
      </section>
    </section>
  );
}