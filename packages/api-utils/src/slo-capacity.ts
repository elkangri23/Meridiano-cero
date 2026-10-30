// SLO, capacidad y corte global (T7-05)
// Perfil de carga, paneles y ensayo de incidentes

export interface SLOConfig {
  availabilityTarget: number; // e.g., 99.9
  latencyP95Ms: number; // e.g., 2000
  latencyP99Ms: number; // e.g., 5000
  errorRateTarget: number; // e.g., 0.1 (0.1%)
  aiLatencyP95Ms: number; // e.g., 10000
  aiErrorRateTarget: number; // e.g., 1 (1%)
  queueDepthMax: number; // e.g., 50
  dbConnectionMax: number; // e.g., 20
}

export const DEFAULT_SLO: SLOConfig = {
  availabilityTarget: 99.9,
  latencyP95Ms: 2000,
  latencyP99Ms: 5000,
  errorRateTarget: 0.1,
  aiLatencyP95Ms: 10000,
  aiErrorRateTarget: 1,
  queueDepthMax: 50,
  dbConnectionMax: 20,
};

export interface CapacityProfile {
  concurrentUsers: number;
  requestsPerSecond: number;
  aiRequestsPerMinute: number;
  dbConnections: number;
  memoryMB: number;
  cpuCores: number;
}

export const DEFAULT_CAPACITY: CapacityProfile = {
  concurrentUsers: 100,
  requestsPerSecond: 50,
  aiRequestsPerMinute: 10,
  dbConnections: 20,
  memoryMB: 512,
  cpuCores: 2,
};

export interface LoadTestResult {
  scenario: string;
  concurrentUsers: number;
  durationSeconds: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  maxLatencyMs: number;
  throughputRps: number;
  errorRate: number;
  aiRequests: number;
  aiAvgLatencyMs: number;
  aiErrorRate: number;
  dbConnectionsUsed: number;
  memoryPeakMB: number;
  passed: boolean;
  issues: string[];
}

export interface IncidentScenario {
  id: string;
  name: string;
  description: string;
  category: 'provider_down' | 'db_slow' | 'high_load' | 'quota_exhausted' | 'network_partition' | 'memory_leak';
  severity: 'critical' | 'high' | 'medium' | 'low';
  expectedBehavior: string;
  actualBehavior?: string;
  passed?: boolean;
  durationMs?: number;
}

export const INCIDENT_SCENARIOS: IncidentScenario[] = [
  {
    id: 'INC-01',
    name: 'Proveedor IA caído',
    description: 'El proveedor de IA (FreeLLMAPI) deja de responder',
    category: 'provider_down',
    severity: 'high',
    expectedBehavior: 'Las acciones se encolan o fallan con error normalizado; el juego no se corrompe; se muestra mensaje al usuario',
  },
  {
    id: 'INC-02',
    name: 'Base de datos lenta',
    description: 'PostgreSQL responde con latencia > 5s',
    category: 'db_slow',
    severity: 'high',
    expectedBehavior: 'Las operaciones fallan con timeout; no se pierden datos; se activa alerta',
  },
  {
    id: 'INC-03',
    name: 'Carga alta (10x)',
    description: '10x usuarios concurrentes de lo normal',
    category: 'high_load',
    severity: 'medium',
    expectedBehavior: 'Rate limiting activo; degradación controlada; no crash',
  },
  {
    id: 'INC-04',
    name: 'Cuota agotada',
    description: 'Un usuario agota su cuota diaria de tokens',
    category: 'quota_exhausted',
    severity: 'medium',
    expectedBehavior: 'Se deniegan nuevas peticiones con mensaje claro; se indica cuándo reintentar',
  },
  {
    id: 'INC-05',
    name: 'Partición de red',
    description: 'Pérdida de conectividad entre API y DB',
    category: 'network_partition',
    severity: 'critical',
    expectedBehavior: 'API devuelve 503; no se corrompen datos; recuperación automática al restablecer',
  },
  {
    id: 'INC-06',
    name: 'Fuga de memoria',
    description: 'Consumo de memoria crece sin límite',
    category: 'memory_leak',
    severity: 'high',
    expectedBehavior: 'Alerta cuando memoria > 80% del límite; restart automático si > 95%',
  },
];

export interface AlertRule {
  id: string;
  name: string;
  condition: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  threshold: number;
  windowMinutes: number;
  action: 'email' | 'webhook' | 'log' | 'restart';
  enabled: boolean;
}

export const DEFAULT_ALERTS: AlertRule[] = [
  { id: 'ALR-01', name: 'Disponibilidad baja', condition: 'availability < 99%', severity: 'critical', threshold: 99, windowMinutes: 5, action: 'email', enabled: true },
  { id: 'ALR-02', name: 'Latencia alta', condition: 'p95_latency > 5000ms', severity: 'high', threshold: 5000, windowMinutes: 5, action: 'webhook', enabled: true },
  { id: 'ALR-03', name: 'Tasa de error alta', condition: 'error_rate > 5%', severity: 'high', threshold: 5, windowMinutes: 5, action: 'webhook', enabled: true },
  { id: 'ALR-04', name: 'Proveedor IA caído', condition: 'ai_availability = 0', severity: 'high', threshold: 0, windowMinutes: 1, action: 'email', enabled: true },
  { id: 'ALR-05', name: 'Memoria alta', condition: 'memory_usage > 80%', severity: 'medium', threshold: 80, windowMinutes: 5, action: 'log', enabled: true },
  { id: 'ALR-06', name: 'DB conexiones agotadas', condition: 'db_connections > 90%', severity: 'high', threshold: 90, windowMinutes: 1, action: 'restart', enabled: true },
  { id: 'ALR-07', name: 'Corte global activo', condition: 'global_cutoff = true', severity: 'critical', threshold: 1, windowMinutes: 1, action: 'email', enabled: true },
];

export function evaluateLoadTest(result: LoadTestResult, slo: SLOConfig): { passed: boolean; issues: string[] } {
  const issues: string[] = [];

  if (result.errorRate > slo.errorRateTarget) {
    issues.push(`Tasa de error ${result.errorRate}% > objetivo ${slo.errorRateTarget}%`);
  }
  if (result.p95LatencyMs > slo.latencyP95Ms) {
    issues.push(`Latencia P95 ${result.p95LatencyMs}ms > objetivo ${slo.latencyP95Ms}ms`);
  }
  if (result.p99LatencyMs > slo.latencyP99Ms) {
    issues.push(`Latencia P99 ${result.p99LatencyMs}ms > objetivo ${slo.latencyP99Ms}ms`);
  }
  if (result.aiErrorRate > slo.aiErrorRateTarget) {
    issues.push(`Tasa de error IA ${result.aiErrorRate}% > objetivo ${slo.aiErrorRateTarget}%`);
  }
  if (result.aiAvgLatencyMs > slo.aiLatencyP95Ms) {
    issues.push(`Latencia IA P95 ${result.aiAvgLatencyMs}ms > objetivo ${slo.aiLatencyP95Ms}ms`);
  }
  if (result.dbConnectionsUsed > slo.dbConnectionMax) {
    issues.push(`Conexiones DB ${result.dbConnectionsUsed} > máximo ${slo.dbConnectionMax}`);
  }

  return { passed: issues.length === 0, issues };
}

export function createLoadTestResult(scenario: string, data: Partial<LoadTestResult>): LoadTestResult {
  return {
    scenario,
    concurrentUsers: data.concurrentUsers ?? 0,
    durationSeconds: data.durationSeconds ?? 0,
    totalRequests: data.totalRequests ?? 0,
    successfulRequests: data.successfulRequests ?? 0,
    failedRequests: data.failedRequests ?? 0,
    avgLatencyMs: data.avgLatencyMs ?? 0,
    p95LatencyMs: data.p95LatencyMs ?? 0,
    p99LatencyMs: data.p99LatencyMs ?? 0,
    maxLatencyMs: data.maxLatencyMs ?? 0,
    throughputRps: data.throughputRps ?? 0,
    errorRate: data.errorRate ?? 0,
    aiRequests: data.aiRequests ?? 0,
    aiAvgLatencyMs: data.aiAvgLatencyMs ?? 0,
    aiErrorRate: data.aiErrorRate ?? 0,
    dbConnectionsUsed: data.dbConnectionsUsed ?? 0,
    memoryPeakMB: data.memoryPeakMB ?? 0,
    passed: data.passed ?? false,
    issues: data.issues ?? [],
  };
}
