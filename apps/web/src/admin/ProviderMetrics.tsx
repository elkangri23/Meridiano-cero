import type { AdminAIMetrics } from './types.js';

/** Métricas de IA por proveedor (24h). El padre solo lo monta cuando hay datos. */
export function ProviderMetrics({ providers }: { providers: AdminAIMetrics[] }) {
  return (
    <section className="provider-metrics">
      <h3>Métricas de IA por proveedor (24h)</h3>
      <div className="metrics-grid-small">
        {providers.map((provider) => (
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
      {providers.length === 0 && (
        <div className="no-data">No hay métricas de IA disponibles para el período seleccionado.</div>
      )}
    </section>
  );
}
