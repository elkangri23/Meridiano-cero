// Configuración de setup inicial y administración (T6-01)
// SPEC-009: instalación nueva sin pnpm ni cuenta central

import { hashPassword } from './auth-utils.js';

export interface SetupConfig {
  adminEmail: string;
  adminPassword: string;
  adminName: string;
  instanceName: string;
  allowRegistration: boolean;
  defaultAiProvider: 'ollama' | 'openai-compatible' | 'freellmapi' | 'disabled';
  aiConfig?: AiProviderConfig;
}

export interface AiProviderConfig {
  type: 'ollama' | 'openai-compatible' | 'freellmapi' | 'disabled';
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
  maxRetries?: number;
}

export interface SetupResult {
  success: boolean;
  adminUserId?: string;
  instanceId?: string;
  error?: string;
}

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Record<string, { status: 'pass' | 'fail' | 'warn'; message?: string }>;
  timestamp: string;
}

export async function runInitialSetup(
  config: SetupConfig,
  db: any, // Database connection
): Promise<SetupResult> {
  // Validaciones básicas
  if (!config.adminEmail || !config.adminEmail.includes('@')) {
    return { success: false, error: 'Email de administrador inválido' };
  }
  if (!config.adminPassword || config.adminPassword.length < 12) {
    return { success: false, error: 'Contraseña de administrador debe tener al menos 12 caracteres' };
  }
  if (!config.adminName || config.adminName.length < 2) {
    return { success: false, error: 'Nombre de administrador requerido' };
  }
  if (!config.instanceName || config.instanceName.length < 2) {
    return { success: false, error: 'Nombre de instancia requerido' };
  }

  try {
    // Verificar si ya existe setup
    const existing = await db.query('SELECT 1 FROM users WHERE role = $1 LIMIT 1', ['admin']);
    if (existing.rows.length > 0) {
      return { success: false, error: 'Setup ya completado; hay administrador existente' };
    }

    // Crear usuario administrador
    const passwordHash = await hashPassword(config.adminPassword);
    const result = await db.query(
      `INSERT INTO users (email, password_hash, name, role, created_at)
       VALUES ($1, $2, $3, 'admin', NOW())
       RETURNING id`,
      [config.adminEmail.toLowerCase(), passwordHash, config.adminName]
    );
    const adminUserId = result.rows[0].id;

    // Crear perfil de detective por defecto
    await db.query(
      `INSERT INTO detective_profiles (user_id, alias, avatar, created_at)
       VALUES ($1, $2, 'detective', NOW())`,
      [adminUserId, config.adminName]
    );

    // Registrar configuración de instancia
    const instanceResult = await db.query(
      `INSERT INTO instances (name, allow_registration, default_ai_provider, ai_config, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id`,
      [
        config.instanceName,
        config.allowRegistration,
        config.defaultAiProvider,
        JSON.stringify(config.aiConfig ?? {})
      ]
    );
    const instanceId = instanceResult.rows[0].id;

    return { success: true, adminUserId, instanceId };
  } catch (error) {
    console.error('SETUP_FAILED:', error);
    return { success: false, error: 'Error interno durante setup' };
  }
}

export async function runHealthChecks(db: any, aiConfig?: AiProviderConfig): Promise<HealthCheckResult> {
  const checks: HealthCheckResult['checks'] = {};
  let overall: HealthCheckResult['status'] = 'healthy';

  // Check: Base de datos
  try {
    await db.query('SELECT 1');
    checks.database = { status: 'pass', message: 'Conexión OK' };
  } catch (error) {
    checks.database = { status: 'fail', message: String(error) };
    overall = 'unhealthy';
  }

  // Check: Migraciones aplicadas
  try {
    const mig = await db.query('SELECT COUNT(*) as count FROM base_migrations');
    const count = parseInt(mig.rows[0].count, 10);
    checks.migrations = { status: count > 0 ? 'pass' : 'warn', message: `${count} migraciones aplicadas` };
    if (count === 0) overall = 'degraded';
  } catch {
    checks.migrations = { status: 'fail', message: 'Tabla base_migrations no accesible' };
    overall = 'unhealthy';
  }

  // Check: Proveedor IA (si configurado)
  if (aiConfig && aiConfig.type !== 'disabled') {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), aiConfig.timeoutMs ?? 5000);
      const url = `${aiConfig.baseUrl}/api/tags`;
      const response = await fetch(url, { signal: controller.signal, headers: aiConfig.apiKey ? { Authorization: `Bearer ${aiConfig.apiKey}` } : {} });
      clearTimeout(timeout);
      checks.ai_provider = { status: response.ok ? 'pass' : 'warn', message: response.ok ? 'Responde' : `HTTP ${response.status}` };
      if (!response.ok) overall = 'degraded';
    } catch {
      checks.ai_provider = { status: 'warn', message: 'No accesible (modo fallback disponible)' };
      overall = 'degraded';
    }
  } else {
    checks.ai_provider = { status: 'pass', message: 'Deshabilitado / modo fixture' };
  }

  // Check: Espacio en disco (aproximado via PostgreSQL)
  try {
    const disk = await db.query(`SELECT pg_database_size(current_database()) as size`);
    const sizeMb = Math.round(parseInt(disk.rows[0].size, 10) / 1024 / 1024);
    checks.disk_space = { status: sizeMb < 1000 ? 'pass' : 'warn', message: `${sizeMb} MB usados` };
    if (sizeMb >= 1000) overall = 'degraded';
  } catch {
    checks.disk_space = { status: 'warn', message: 'No se pudo consultar' };
  }

  return {
    status: overall,
    checks,
    timestamp: new Date().toISOString(),
  };
}

export interface AdminPanelConfig {
  instanceName: string;
  allowRegistration: boolean;
  totalUsers: number;
  activeCases: number;
  aiProvider: string;
}

export async function getAdminPanelConfig(db: any): Promise<AdminPanelConfig> {
  const [inst, users, cases] = await Promise.all([
    db.query('SELECT name, allow_registration, default_ai_provider FROM instances ORDER BY created_at DESC LIMIT 1'),
    db.query('SELECT COUNT(*) as count FROM users'),
    db.query('SELECT COUNT(*) as count FROM case_runs WHERE finished_at IS NULL'),
  ]);
  return {
    instanceName: inst.rows[0]?.name ?? 'Meridiano Cero',
    allowRegistration: inst.rows[0]?.allow_registration ?? true,
    totalUsers: parseInt(users.rows[0].count, 10),
    activeCases: parseInt(cases.rows[0].count, 10),
    aiProvider: inst.rows[0]?.default_ai_provider ?? 'disabled',
  };
}