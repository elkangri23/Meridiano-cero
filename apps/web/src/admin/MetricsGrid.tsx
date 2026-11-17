import type { AdminDashboardMetrics } from './types.js';

interface MetricCard {
  label: string;
  value: string | number;
  icon: string;
  help?: string;
}

/** Tarjetas de métricas principales del dashboard. */
export function MetricsGrid({ metrics }: { metrics: AdminDashboardMetrics | null }) {
  const {
    usersTotal = 0,
    usersActive24h = 0,
    runsTotal = 0,
    runsActive = 0,
    aiTokensUsed24h = 0,
    aiErrorRate24h = 0,
  } = metrics ?? {};
  const cards: MetricCard[] = [
    { label: 'Usuarios totales', value: usersTotal, icon: '👥', help: 'Cuentas registradas' },
    { label: 'Activos (24h)', value: usersActive24h, icon: '🟢', help: 'Sesiones dentro de las últimas 24h' },
    { label: 'Partidas totales', value: runsTotal, icon: '🎮', help: 'Casos creados' },
    { label: 'Paradas activas', value: runsActive, icon: '▶️', help: 'Partidas no cerradas' },
    { label: 'Tokens IA (24h)', value: aiTokensUsed24h.toLocaleString(), icon: '🔤', help: 'Consumo total de IA' },
    { label: 'Errores IA (24h)', value: `${aiErrorRate24h}%`, icon: '⚠️', help: 'Tasa de errores en operaciones de IA' },
  ];

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
