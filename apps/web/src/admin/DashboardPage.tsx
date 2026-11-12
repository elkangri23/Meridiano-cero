import { useEffect, useState } from 'react';
import { adminApi } from './client.js';
import type { AdminDashboardMetrics } from './types.js';

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

  const cards: Array<{ label: string; value: string | number; icon: string; help?: string }> = [
    { label: 'Usuarios totales', value: metrics?.usersTotal ?? 0, icon: '👥', help: 'Cuentas registradas' },
    { label: 'Activos (24h)', value: metrics?.usersActive24h ?? 0, icon: '🟢', help: 'Sesiones dentro de las últimas 24h' },
    { label: 'Partidas totales', value: metrics?.runsTotal ?? 0, icon: '🎮', help: 'Casos creados' },
    { label: 'Paradas activas', value: metrics?.runsActive ?? 0, icon: '▶️', help: 'Partidas no cerradas' },
    { label: 'Tokens IA (24h)', value: metrics?.aiTokensUsed24h?.toLocaleString() ?? '0', icon: '🔤', help: 'Consumo total de IA' },
    { label: 'Errores IA (24h)', value: `${metrics?.aiErrorRate24h ?? 0}%`, icon: '⚠️', help: 'Tasa de errores en operaciones de IA' },
  ];

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
    </section>
  );
}
