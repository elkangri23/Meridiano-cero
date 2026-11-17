import { useEffect, useState } from 'react';
import { adminApi } from './client.js';
import type { AdminDashboardMetrics } from './types.js';
import { MetricsGrid } from './MetricsGrid.js';
import { ProviderMetrics } from './ProviderMetrics.js';
import { AuditSection } from './AuditSection.js';

/**
 * Dashboard principal del panel de administración.
 * En Fase 1, las métricas son mockadas; se conectarán a la API real en Fase 2.
 */
export function DashboardPage() {
  const [metrics, setMetrics] = useState<AdminDashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  // Información adicional por proveedor para futuras tablas/gráficos
  const providerMetrics = metrics?.byProvider ?? [];

  return (
    <section className="admin-dashboard-section">
      <header className="dashboard-header">
        <h2>Dashboard</h2>
        <p className="dashboard-subtitle">Visión general del estado del sistema</p>
      </header>

      <MetricsGrid metrics={metrics} />

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
        <ProviderMetrics providers={providerMetrics} />
      )}

      <AuditSection />
    </section>
  );
}
