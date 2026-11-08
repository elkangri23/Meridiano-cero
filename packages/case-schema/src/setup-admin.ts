// Configuración de setup inicial y administración (T6-01)
// SPEC-009: instalación nueva sin pnpm ni cuenta central

import { hashPassword } from './auth-utils.js';

/** Cliente mínimo de base de datos: solo la consulta que usan estas funciones. */
interface DbQueryClient {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
}

/** Primera fila de un resultado, o error si la consulta no devolvió ninguna. */
function firstRowOrThrow(result: { rows: Array<Record<string, unknown>> }, what: string): Record<string, unknown> {
  const row = result.rows[0];
  if (row === undefined) throw new Error(`Sin fila devuelta al crear ${what}`);
  return row;
}

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

/** Validación básica de la configuración; devuelve el error o null si es válida. */
function validateSetupConfig(config: SetupConfig): string | null {
  if (!config.adminEmail || !config.adminEmail.includes('@')) {
    return 'Email de administrador inválido';
  }
  if (!config.adminPassword || config.adminPassword.length < 12) {
    return 'Contraseña de administrador debe tener al menos 12 caracteres';
  }
  if (!config.adminName || config.adminName.length < 2) {
    return 'Nombre de administrador requerido';
  }
  if (!config.instanceName || config.instanceName.length < 2) {
    return 'Nombre de instancia requerido';
  }
  return null;
}

/** Crea el usuario administrador, su perfil de detective y la instancia. */
async function createAdminRecords(
  db: DbQueryClient,
  config: SetupConfig,
): Promise<{ adminUserId: string; instanceId: string }> {
  const passwordHash = await hashPassword(config.adminPassword);
  const result = await db.query(
    `INSERT INTO users (email, password_hash, name, role, created_at)
     VALUES ($1, $2, $3, 'admin', NOW())
     RETURNING id`,
    [config.adminEmail.toLowerCase(), passwordHash, config.adminName]
  );
  const adminUserId = String(firstRowOrThrow(result, 'el usuario').id ?? '');

  await db.query(
    `INSERT INTO detective_profiles (user_id, alias, avatar, created_at)
     VALUES ($1, $2, 'detective', NOW())`,
    [adminUserId, config.adminName]
  );

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
  const instanceId = String(firstRowOrThrow(instanceResult, 'la instancia').id ?? '');

  return { adminUserId, instanceId };
}

export async function runInitialSetup(
  config: SetupConfig,
  db: DbQueryClient,
): Promise<SetupResult> {
  const validationError = validateSetupConfig(config);
  if (validationError) {
    return { success: false, error: validationError };
  }

  try {
    // Verificar si ya existe setup
    const existing = await db.query('SELECT 1 FROM users WHERE role = $1 LIMIT 1', ['admin']);
    if (existing.rows.length > 0) {
      return { success: false, error: 'Setup ya completado; hay administrador existente' };
    }

    const { adminUserId, instanceId } = await createAdminRecords(db, config);
    return { success: true, adminUserId, instanceId };
  } catch (error) {
    console.error('SETUP_FAILED:', error);
    return { success: false, error: 'Error interno durante setup' };
  }
}

type CheckEntry = HealthCheckResult['checks'][string];
type CheckLevel = 'ok' | 'degraded' | 'unhealthy';
interface CheckOutcome { entry: CheckEntry; level: CheckLevel; }

async function checkDatabaseHealth(db: DbQueryClient): Promise<CheckOutcome> {
  try {
    await db.query('SELECT 1');
    return { entry: { status: 'pass', message: 'Conexión OK' }, level: 'ok' };
  } catch (error) {
    return { entry: { status: 'fail', message: String(error) }, level: 'unhealthy' };
  }
}

async function checkMigrationsHealth(db: DbQueryClient): Promise<CheckOutcome> {
  try {
    const mig = await db.query('SELECT COUNT(*) as count FROM base_migrations');
    const count = parseInt(String(mig.rows[0]?.count ?? '0'), 10);
    return {
      entry: { status: count > 0 ? 'pass' : 'warn', message: `${count} migraciones aplicadas` },
      level: count === 0 ? 'degraded' : 'ok',
    };
  } catch {
    return { entry: { status: 'fail', message: 'Tabla base_migrations no accesible' }, level: 'unhealthy' };
  }
}

async function checkAiProviderHealth(aiConfig: AiProviderConfig): Promise<CheckOutcome> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), aiConfig.timeoutMs ?? 5000);
    const url = `${aiConfig.baseUrl}/api/tags`;
    const response = await fetch(url, { signal: controller.signal, headers: aiConfig.apiKey ? { Authorization: `Bearer ${aiConfig.apiKey}` } : {} });
    clearTimeout(timeout);
    if (response.ok) return { entry: { status: 'pass', message: 'Responde' }, level: 'ok' };
    return { entry: { status: 'warn', message: `HTTP ${response.status}` }, level: 'degraded' };
  } catch {
    return { entry: { status: 'warn', message: 'No accesible (modo fallback disponible)' }, level: 'degraded' };
  }
}

async function checkDiskHealth(db: DbQueryClient): Promise<CheckOutcome> {
  try {
    const disk = await db.query(`SELECT pg_database_size(current_database()) as size`);
    const sizeMb = Math.round(parseInt(String(disk.rows[0]?.size ?? '0'), 10) / 1024 / 1024);
    return {
      entry: { status: sizeMb < 1000 ? 'pass' : 'warn', message: `${sizeMb} MB usados` },
      level: sizeMb >= 1000 ? 'degraded' : 'ok',
    };
  } catch {
    return { entry: { status: 'warn', message: 'No se pudo consultar' }, level: 'ok' };
  }
}

export async function runHealthChecks(db: DbQueryClient, aiConfig?: AiProviderConfig): Promise<HealthCheckResult> {
  const checks: HealthCheckResult['checks'] = {};
  let overall: HealthCheckResult['status'] = 'healthy';
  const apply = (level: CheckLevel): void => {
    if (level === 'unhealthy') overall = 'unhealthy';
    else if (level === 'degraded') overall = 'degraded';
  };

  const database = await checkDatabaseHealth(db);
  checks.database = database.entry;
  apply(database.level);

  const migrations = await checkMigrationsHealth(db);
  checks.migrations = migrations.entry;
  apply(migrations.level);

  if (aiConfig && aiConfig.type !== 'disabled') {
    const ai = await checkAiProviderHealth(aiConfig);
    checks.ai_provider = ai.entry;
    apply(ai.level);
  } else {
    checks.ai_provider = { status: 'pass', message: 'Deshabilitado / modo fixture' };
  }

  const disk = await checkDiskHealth(db);
  checks.disk_space = disk.entry;
  apply(disk.level);

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

export async function getAdminPanelConfig(db: DbQueryClient): Promise<AdminPanelConfig> {
  const [inst, users, cases] = await Promise.all([
    db.query('SELECT name, allow_registration, default_ai_provider FROM instances ORDER BY created_at DESC LIMIT 1'),
    db.query('SELECT COUNT(*) as count FROM users'),
    db.query('SELECT COUNT(*) as count FROM case_runs WHERE finished_at IS NULL'),
  ]);
  const instRow = inst.rows[0];
  return {
    instanceName: typeof instRow?.name === 'string' ? instRow.name : 'Meridiano Cero',
    allowRegistration: instRow?.allow_registration !== false,
    totalUsers: parseInt(String(users.rows[0]?.count ?? '0'), 10),
    activeCases: parseInt(String(cases.rows[0]?.count ?? '0'), 10),
    aiProvider: typeof instRow?.default_ai_provider === 'string' ? instRow.default_ai_provider : 'disabled',
  };
}
