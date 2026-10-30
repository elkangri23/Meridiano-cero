// Residencia, retención, supresiones y rotación de claves (T7-06)

export interface DataResidencyConfig {
  region: 'eu-west' | 'us-east' | 'ap-southeast' | 'custom';
  datacenter: string;
  jurisdiction: string;
  storageLocation: string;
  backupLocation: string;
  aiProviderRegion?: string;
}

export const DEFAULT_RESIDENCY: DataResidencyConfig = {
  region: 'eu-west',
  datacenter: 'eu-west-1',
  jurisdiction: 'EU',
  storageLocation: 'Frankfurt, Germany',
  backupLocation: 'Dublin, Ireland',
  aiProviderRegion: 'EU',
};

export interface RetentionPolicy {
  dataType: 'account' | 'session' | 'run' | 'conversation' | 'usage' | 'log' | 'backup';
  retentionDays: number;
  action: 'delete' | 'anonymize' | 'archive' | 'retain';
  description: string;
}

export const DEFAULT_RETENTION: RetentionPolicy[] = [
  { dataType: 'account', retentionDays: 365 * 3, action: 'delete', description: 'Cuentas inactivas > 3 años eliminadas' },
  { dataType: 'session', retentionDays: 30, action: 'delete', description: 'Sesiones expiradas eliminadas en 30 días' },
  { dataType: 'run', retentionDays: 365 * 2, action: 'archive', description: 'Partidas inactivas > 2 años archivadas' },
  { dataType: 'conversation', retentionDays: 90, action: 'delete', description: 'Conversaciones eliminadas en 90 días' },
  { dataType: 'usage', retentionDays: 365, action: 'anonymize', description: 'Datos de uso anonimizados en 1 año' },
  { dataType: 'log', retentionDays: 90, action: 'delete', description: 'Logs técnicos eliminados en 90 días' },
  { dataType: 'backup', retentionDays: 30, action: 'delete', description: 'Backups retenidos 30 días' },
];

export interface KeyRotationConfig {
  masterKeyRotationDays: number;
  sessionTokenRotationDays: number;
  csrfTokenRotationHours: number;
  recoveryTokenExpirationHours: number;
  apiKeyRotationDays: number;
}

export const DEFAULT_KEY_ROTATION: KeyRotationConfig = {
  masterKeyRotationDays: 90,
  sessionTokenRotationDays: 30,
  csrfTokenRotationHours: 8,
  recoveryTokenExpirationHours: 1,
  apiKeyRotationDays: 180,
};

export interface KeyRotationEvent {
  keyType: 'master' | 'session' | 'csrf' | 'recovery' | 'api';
  rotatedAt: string;
  rotatedBy: string;
  oldKeyFingerprint: string;
  newKeyFingerprint: string;
  affectedRecords: number;
  status: 'success' | 'failed' | 'partial';
  error?: string;
}

export interface SuppressionRequest {
  id: string;
  userId: string;
  requestedAt: string;
  completedAt?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  dataTypes: string[];
  reason: string;
  verifiedBy?: string;
}

export interface DataInventory {
  category: string;
  dataType: string;
  storageLocation: string;
  containsPII: boolean;
  encrypted: boolean;
  retentionDays: number;
  backupIncluded: boolean;
  provider: string;
}

export const DATA_INVENTORY: DataInventory[] = [
  { category: 'Cuenta', dataType: 'email, displayName, passwordHash', storageLocation: 'PostgreSQL', containsPII: true, encrypted: true, retentionDays: 1095, backupIncluded: true, provider: 'self-hosted' },
  { category: 'Sesión', dataType: 'tokenHash, csrfToken, expiresAt', storageLocation: 'PostgreSQL', containsPII: false, encrypted: true, retentionDays: 30, backupIncluded: false, provider: 'self-hosted' },
  { category: 'Partida', dataType: 'engineState, discoveries, inventory', storageLocation: 'PostgreSQL', containsPII: false, encrypted: false, retentionDays: 730, backupIncluded: true, provider: 'self-hosted' },
  { category: 'Conversación', dataType: 'conversationRecords', storageLocation: 'PostgreSQL', containsPII: false, encrypted: false, retentionDays: 90, backupIncluded: true, provider: 'self-hosted' },
  { category: 'Uso IA', dataType: 'tokens, latencia, errores (sin contenido)', storageLocation: 'PostgreSQL', containsPII: false, encrypted: false, retentionDays: 365, backupIncluded: true, provider: 'self-hosted' },
  { category: 'Logs', dataType: 'requestId, IP, timestamp, status', storageLocation: 'PostgreSQL', containsPII: true, encrypted: false, retentionDays: 90, backupIncluded: false, provider: 'self-hosted' },
  { category: 'Credenciales IA', dataType: 'encryptedCredential (AES-256-GCM)', storageLocation: 'PostgreSQL', containsPII: true, encrypted: true, retentionDays: 1095, backupIncluded: true, provider: 'self-hosted' },
  { category: 'Backup', dataType: 'dump cifrado + comprimido', storageLocation: 'Local/S3/GCS/Azure', containsPII: true, encrypted: true, retentionDays: 30, backupIncluded: false, provider: 'self-hosted' },
];

export function createKeyRotationEvent(
  keyType: KeyRotationEvent['keyType'],
  rotatedBy: string,
  oldKeyFingerprint: string,
  newKeyFingerprint: string,
  affectedRecords: number
): KeyRotationEvent {
  return {
    keyType,
    rotatedAt: new Date().toISOString(),
    rotatedBy,
    oldKeyFingerprint,
    newKeyFingerprint,
    affectedRecords,
    status: 'success',
  };
}

export function createSuppressionRequest(userId: string, reason: string, dataTypes: string[]): SuppressionRequest {
  return {
    id: `supp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    userId,
    requestedAt: new Date().toISOString(),
    status: 'pending',
    dataTypes,
    reason,
  };
}

export function getRetentionDays(dataType: string): number {
  const policy = DEFAULT_RETENTION.find(p => p.dataType === dataType);
  return policy?.retentionDays ?? 365;
}

export function isExpired(dataType: string, createdAt: Date): boolean {
  const retentionDays = getRetentionDays(dataType);
  const now = new Date();
  const ageDays = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
  return ageDays > retentionDays;
}

export function calculateRetentionExpiry(dataType: string, createdAt: Date): Date {
  const retentionDays = getRetentionDays(dataType);
  return new Date(createdAt.getTime() + retentionDays * 24 * 60 * 60 * 1000);
}

export function generateDataInventoryReport(): string {
  const lines = [
    '# Inventario de Datos por Proveedor',
    '',
    '| Categoría | Tipo de dato | Almacenamiento | PII | Cifrado | Retención (días) | Backup | Proveedor |',
    '|---|---|---|---|---|---|---|---|',
  ];

  for (const item of DATA_INVENTORY) {
    lines.push(`| ${item.category} | ${item.dataType} | ${item.storageLocation} | ${item.containsPII ? 'Sí' : 'No'} | ${item.encrypted ? 'Sí' : 'No'} | ${item.retentionDays} | ${item.backupIncluded ? 'Sí' : 'No'} | ${item.provider} |`);
  }

  return lines.join('\n');
}

export function generateRetentionReport(): string {
  const lines = [
    '# Política de Retención de Datos',
    '',
    '| Tipo de dato | Retención (días) | Acción | Descripción |',
    '|---|---|---|---|',
  ];

  for (const policy of DEFAULT_RETENTION) {
    lines.push(`| ${policy.dataType} | ${policy.retentionDays} | ${policy.action} | ${policy.description} |`);
  }

  return lines.join('\n');
}
