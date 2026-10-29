import type { Writable } from 'node:stream';

const buckets = [10, 50, 100, 500, 1000, 5000, Infinity];
type Scope = 'application' | 'health' | 'readiness';
function scopeOf(value: unknown): Scope {
  return value === 'health' || value === 'readiness' ? value : 'application';
}
function metrics() { return { statusClasses: [0, 0, 0, 0, 0], durations: buckets.map(() => 0) }; }
function copyMetrics(value: ReturnType<typeof metrics>) {
  return { statusClasses: [...value.statusClasses], durations: [...value.durations] };
}
export function createTelemetry(sink: Pick<Writable, 'write' | 'once' | 'on'>) {
  let blocked = false;
  let dropped = 0;
  let exporterFailures = 0;
  sink.on('error', () => { exporterFailures++; blocked = true; });
  const scopes = { application: metrics(), health: metrics(), readiness: metrics() };
  return {
    snapshot() {
      return { dropped, exporterFailures, ...copyMetrics(scopes.application),
        probes: { health: copyMetrics(scopes.health), readiness: copyMetrics(scopes.readiness) } };
    },
    completed(input: { requestId: string; statusCode: number; durationMs: number; scope?: Scope }): void {
      const scope = scopeOf(input.scope);
      const { statusClasses, durations } = scopes[scope];
      const statusClass = Math.floor(input.statusCode / 100);
      const index = Math.max(0, Math.min(4, statusClass - 1));
      statusClasses[index] = (statusClasses[index] ?? 0) + 1;
      const durationMs = Number.isFinite(input.durationMs) ? Math.max(0, Math.min(600_000, input.durationMs)) : 600_000;
      const bucket = buckets.findIndex(limit => durationMs <= limit);
      durations[bucket] = (durations[bucket] ?? 0) + 1;
      if (blocked) { dropped++; return; }
      // Construcción por allowlist: nunca serializar request, Error o campos extra.
      const event = {
        schemaVersion: 1, timestamp: new Date().toISOString(), level: 'info',
        eventName: 'request.completed', service: 'api', release: '0.0.0', environment: 'development',
        requestId: /^[a-f0-9-]{36}$/.test(input.requestId) ? input.requestId : undefined,
        phase: 'http.' + scope, outcome: statusClass >= 5 ? 'failed' : statusClass >= 4 ? 'rejected' : 'success', durationMs,
      };
      try {
        if (!sink.write(JSON.stringify(event) + '\n')) {
          blocked = true;
          sink.once('drain', () => { blocked = false; });
        }
      } catch { exporterFailures++; dropped++; }
    },
  };
}
export type Telemetry = ReturnType<typeof createTelemetry>;
