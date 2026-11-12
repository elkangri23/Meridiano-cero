import { useEffect, useState } from 'react';
import { adminApi } from './client.js';
import type { AdminDashboardMetrics } from './types.js';

interface MetricCard {
  label: string;
  value: string | number;
  icon: string;
  help?: string;
}

const EMPTY_METRICS: AdminDashboardMetrics = {
  usersTotal: 0,
  usersActive24h: 0,
  runsTotal: 0,
  runsActive: 0,
  aiTokensUsed24h: 0,
  aiErrorRate24h: 0,
};

function buildDashboardCards(metrics: AdminDashboardMetrics | null): MetricCard[] {
  const m = metrics ?? EMPTY_METRICS;
  return [
    { label: 'Usuarios totales', value: m.usersTotal, icon: '👥', help: 'Cuentas registradas' },
    { label: 'Activos (24h)', value: m.usersActive24h, icon: '🟢', help: 'Sesiones dentro de las últimas 24h' },
    { label: 'Partidas totales', value: m.runsTotal, icon: '🎮', help: 'Casos creados' },
    { label: 'Paradas activas', value: m.runsActive, icon: '▶️', help: 'Partidas no cerradas' },
    { label: 'Tokens IA (24h)', value: m.aiTokensUsed24h.toLocaleString(), icon: '🔤', help: 'Consumo total de IA' },
    { label: 'Errores IA (24h)', value: `${m.aiErrorRate24h}%`, icon: '⚠️', help: 'Tasa de errores en operaciones de IA' },
  ];
}

function MetricsGrid({ cards }: { cards: MetricCard[] }) {
  return (
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
  );
}

function QuickActions() {
  return (
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
  );
}

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

  return (
    <section className="admin-dashboard-section">
      <header className="dashboard-header">
        <h2>Dashboard</h2>
        <p className="dashboard-subtitle">Visión general del estado del sistema</p>
      </header>

      <MetricsGrid cards={buildDashboardCards(metrics)} />
      <QuickActions />
    </section>
  );
}
