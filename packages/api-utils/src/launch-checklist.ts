// Staging, revisión OWASP y puerta de lanzamiento (T7-04)
// Configuración de staging, checks de seguridad, checklist de lanzamiento

export interface StagingConfig {
  enabled: boolean;
  baseUrl: string;
  databaseUrl: string;
  aiProvider: string;
  aiBaseUrl: string;
  aiModel: string;
  registrationEnabled: boolean;
  adminEmail: string;
  alertEmail?: string;
  backupEnabled: boolean;
  backupSchedule: string;
}

export const DEFAULT_STAGING_CONFIG: StagingConfig = {
  enabled: false,
  baseUrl: 'https://staging.meridiano.example.com',
  databaseUrl: 'postgresql://staging_user:staging_pass@staging-db:5432/meridiano_staging',
  aiProvider: 'freellmapi',
  aiBaseUrl: 'https://api.freellmapi.com/v1',
  aiModel: 'gpt-4o-mini',
  registrationEnabled: true,
  adminEmail: 'admin@staging.example.com',
  backupEnabled: true,
  backupSchedule: '0 3 * * *',
};

export interface SecurityCheck {
  id: string;
  category: 'A01' | 'A02' | 'A03' | 'A04' | 'A05' | 'A06' | 'A07' | 'A08' | 'A09' | 'A10' | 'ASVS';
  name: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  status: 'pass' | 'fail' | 'warn' | 'not_applicable' | 'pending';
  evidence?: string;
  remediation?: string;
}

export interface LaunchChecklist {
  version: string;
  environment: 'staging' | 'production';
  checks: SecurityCheck[];
  overallStatus: 'ready' | 'blocked' | 'pending';
  blockers: string[];
  warnings: string[];
  lastRunAt: string;
  runBy: string;
}

export const OWASP_CHECKS: SecurityCheck[] = [
  // A01: Broken Access Control
  { id: 'A01-01', category: 'A01', name: 'Ownership validation', description: 'Todas las rutas validan ownership del recurso', severity: 'critical', status: 'pending' },
  { id: 'A01-02', category: 'A01', name: 'IDOR prevention', description: 'Prevenir Insecure Direct Object Reference en runs/creations', severity: 'critical', status: 'pending' },
  { id: 'A01-03', category: 'A01', name: 'CSRF protection', description: 'CSRF tokens validados en todas las mutaciones', severity: 'high', status: 'pending' },
  { id: 'A01-04', category: 'A01', name: 'Session isolation', description: 'Sesiones aisladas por usuario, revocación en logout', severity: 'high', status: 'pending' },
  // A02: Cryptographic Failures
  { id: 'A02-01', category: 'A02', name: 'TLS enforcement', description: 'HTTPS obligatorio en producción, HSTS habilitado', severity: 'critical', status: 'pending' },
  { id: 'A02-02', category: 'A02', name: 'Password hashing', description: 'bcrypt/scrypt con factor de trabajo adecuado', severity: 'high', status: 'pending' },
  { id: 'A02-03', category: 'A02', name: 'Credential encryption', description: 'Claves API cifradas en reposo con AES-256-GCM', severity: 'high', status: 'pending' },
  { id: 'A02-04', category: 'A02', name: 'Secrets management', description: 'Secretos fuera de Git, rotación documentada', severity: 'medium', status: 'pending' },
  // A03: Injection
  { id: 'A03-01', category: 'A03', name: 'SQL injection', description: 'Queries parametrizadas via Drizzle ORM', severity: 'critical', status: 'pending' },
  { id: 'A03-02', category: 'A03', name: 'XSS prevention', description: 'Sanitización de inputs, escape de output', severity: 'high', status: 'pending' },
  { id: 'A03-03', category: 'A03', name: 'Command injection', description: 'No ejecutar shell con inputs de usuario', severity: 'critical', status: 'pending' },
  // A04: Insecure Design
  { id: 'A04-01', category: 'A04', name: 'Rate limiting', description: 'Rate limits por IP, usuario, función y modelo', severity: 'high', status: 'pending' },
  { id: 'A04-02', category: 'A04', name: 'Global cutoff', description: 'Mecanismo de corte global funcional y probado', severity: 'high', status: 'pending' },
  { id: 'A04-03', category: 'A04', name: 'Quota enforcement', description: 'Cuotas verificadas antes de invocar IA', severity: 'high', status: 'pending' },
  // A05: Security Misconfiguration
  { id: 'A05-01', category: 'A05', name: 'Security headers', description: 'CSP, X-Frame-Options, X-Content-Type-Options', severity: 'medium', status: 'pending' },
  { id: 'A05-02', category: 'A05', name: 'Debug disabled', description: 'Modo debug deshabilitado en producción', severity: 'medium', status: 'pending' },
  { id: 'A05-03', category: 'A05', name: 'Error handling', description: 'Mensajes de error sin información sensible', severity: 'medium', status: 'pending' },
  // A06: Vulnerable Components
  { id: 'A06-01', category: 'A06', name: 'Dependency audit', description: 'npm audit sin vulnerabilidades críticas/altas', severity: 'high', status: 'pending' },
  { id: 'A06-02', category: 'A06', name: 'Lockfile integrity', description: 'pnpm-lock.yaml commitado y verificado', severity: 'medium', status: 'pending' },
  // A07: Auth Failures
  { id: 'A07-01', category: 'A07', name: 'Session security', description: 'Tokens seguros, HttpOnly, SameSite, expiración', severity: 'high', status: 'pending' },
  { id: 'A07-02', category: 'A07', name: 'Account enumeration', description: 'Mensajes genéricos en recuperación de contraseña', severity: 'medium', status: 'pending' },
  { id: 'A07-03', category: 'A07', name: 'Brute force protection', description: 'Rate limiting en login/registro', severity: 'high', status: 'pending' },
  // A08: Data Integrity
  { id: 'A08-01', category: 'A08', name: 'Input validation', description: 'Validación de todos los inputs en API', severity: 'high', status: 'pending' },
  { id: 'A08-02', category: 'A08', name: 'Checksum verification', description: 'Import/export verificado con checksum', severity: 'medium', status: 'pending' },
  // A09: Logging & Monitoring
  { id: 'A09-01', category: 'A09', name: 'Audit logging', description: 'Logs de acciones sensibles (login, delete, etc.)', severity: 'medium', status: 'pending' },
  { id: 'A09-02', category: 'A09', name: 'Alerting', description: 'Alertas configuradas para incidentes', severity: 'medium', status: 'pending' },
  // A10: SSRF
  { id: 'A10-01', category: 'A10', name: 'SSRF prevention', description: 'Validación de URLs en adaptadores IA', severity: 'high', status: 'pending' },
  { id: 'A10-02', category: 'A10', name: 'DNS rebinding', description: 'Protección contra DNS rebinding en URLs externas', severity: 'medium', status: 'pending' },
];

export function createLaunchChecklist(version: string, environment: 'staging' | 'production', runBy: string): LaunchChecklist {
  return {
    version,
    environment,
    checks: OWASP_CHECKS.map(c => ({ ...c })),
    overallStatus: 'pending',
    blockers: [],
    warnings: [],
    lastRunAt: new Date().toISOString(),
    runBy,
  };
}

export function updateCheck(checklist: LaunchChecklist, checkId: string, status: SecurityCheck['status'], evidence?: string, remediation?: string): void {
  const check = checklist.checks.find(c => c.id === checkId);
  if (check) {
    check.status = status;
    if (evidence) check.evidence = evidence;
    if (remediation) check.remediation = remediation;
  }
}

export function evaluateLaunchReadiness(checklist: LaunchChecklist): LaunchChecklist {
  const blockers: string[] = [];
  const warnings: string[] = [];

  for (const check of checklist.checks) {
    if (check.severity === 'critical' && check.status === 'fail') {
      blockers.push(`${check.id}: ${check.name} - ${check.description}`);
    }
    if (check.severity === 'high' && check.status === 'fail') {
      blockers.push(`${check.id}: ${check.name} - ${check.description}`);
    }
    if (check.status === 'warn') {
      warnings.push(`${check.id}: ${check.name}`);
    }
  }

  const pendingCritical = checklist.checks.filter(c => c.severity === 'critical' && c.status === 'pending').length;
  const pendingHigh = checklist.checks.filter(c => c.severity === 'high' && c.status === 'pending').length;

  if (blockers.length > 0) {
    checklist.overallStatus = 'blocked';
  } else if (pendingCritical > 0 || pendingHigh > 0) {
    checklist.overallStatus = 'pending';
  } else {
    checklist.overallStatus = 'ready';
  }

  checklist.blockers = blockers;
  checklist.warnings = warnings;
  return checklist;
}

export function generateLaunchReport(checklist: LaunchChecklist): string {
  const total = checklist.checks.length;
  const passed = checklist.checks.filter(c => c.status === 'pass').length;
  const failed = checklist.checks.filter(c => c.status === 'fail').length;
  const pending = checklist.checks.filter(c => c.status === 'pending').length;
  const warned = checklist.checks.filter(c => c.status === 'warn').length;

  return `
# Reporte de Lanzamiento - ${checklist.environment}

**Versión:** ${checklist.version}
**Fecha:** ${checklist.lastRunAt}
**Ejecutado por:** ${checklist.runBy}
**Estado general:** ${checklist.overallStatus.toUpperCase()}

## Resumen
- Total checks: ${total}
- Pasados: ${passed}
- Fallidos: ${failed}
- Pendientes: ${pending}
- Advertencias: ${warned}

## Bloqueadores
${checklist.blockers.length > 0 ? checklist.blockers.map(b => `- ${b}`).join('\n') : 'Ninguno'}

## Advertencias
${checklist.warnings.length > 0 ? checklist.warnings.map(w => `- ${w}`).join('\n') : 'Ninguna'}

## Checks por categoría
${['A01', 'A02', 'A03', 'A04', 'A05', 'A06', 'A07', 'A08', 'A09', 'A10'].map(cat => {
    const catChecks = checklist.checks.filter(c => c.category === cat);
    const catPassed = catChecks.filter(c => c.status === 'pass').length;
    return `- ${cat}: ${catPassed}/${catChecks.length}`;
  }).join('\n')}
`;
}
