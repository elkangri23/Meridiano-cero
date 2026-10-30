// Import/Export JSON versionado (T4-05)
// Intercambio con límites, validación y autorización

export interface CaseExport {
  version: string;
  exportedAt: string;
  caseId: string;
  definition: unknown;
  metadata: {
    difficulty: string;
    duration: string;
    region: string;
    seed: number;
    catalogVersion: string;
  };
  checksum: string;
}

export interface ImportResult {
  success: boolean;
  caseId?: string;
  errors: string[];
  warnings: string[];
}

export interface ExportResult {
  success: boolean;
  export?: CaseExport;
  errors: string[];
}

export const EXPORT_VERSION = '1.0.0';
export const MAX_IMPORT_SIZE_BYTES = 2 * 1024 * 1024; // 2 MiB

export function computeChecksum(data: unknown): string {
  const json = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < json.length; i++) {
    const char = json.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

export function createExport(definition: unknown, metadata: CaseExport['metadata']): ExportResult {
  const errors: string[] = [];

  if (!definition) {
    errors.push('Definición requerida');
  }
  if (!metadata) {
    errors.push('Metadata requerida');
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  const exportData: CaseExport = {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    caseId: (definition as any)?.id || 'unknown',
    definition,
    metadata,
    checksum: computeChecksum(definition),
  };

  return { success: true, export: exportData, errors: [] };
}

export function validateImport(data: unknown, maxSizeBytes: number = MAX_IMPORT_SIZE_BYTES): ImportResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!data || typeof data !== 'object') {
    errors.push('Datos de importación inválidos');
    return { success: false, errors, warnings };
  }

  const exp = data as CaseExport;

  // Validar versión
  if (!exp.version) {
    errors.push('Versión de exportación requerida');
  } else if (exp.version !== EXPORT_VERSION) {
    warnings.push(`Versión ${exp.version} puede no ser compatible con ${EXPORT_VERSION}`);
  }

  // Validar tamaño
  const size = JSON.stringify(data).length;
  if (size > maxSizeBytes) {
    errors.push(`Importación excede tamaño máximo: ${size} > ${maxSizeBytes} bytes`);
  }

  // Validar estructura
  if (!exp.definition) {
    errors.push('Definición de caso requerida');
  }
  if (!exp.metadata) {
    errors.push('Metadata requerida');
  }
  if (!exp.checksum) {
    errors.push('Checksum requerido');
  } else if (exp.definition) {
    const computed = computeChecksum(exp.definition);
    if (computed !== exp.checksum) {
      errors.push('Checksum no coincide: posible corrupción de datos');
    }
  }

  // Validar campos prohibidos (seguridad: no ejecutar código)
  const jsonStr = JSON.stringify(data);
  if (jsonStr.includes('__proto__') || jsonStr.includes('constructor') || jsonStr.includes('prototype')) {
    errors.push('Datos contienen campos prohibidos');
  }

  if (errors.length > 0) {
    return { success: false, errors, warnings };
  }

  return { success: true, caseId: exp.caseId, errors: [], warnings };
}

export function serializeExport(exportData: CaseExport): string {
  return JSON.stringify(exportData, null, 2);
}

export function deserializeImport(json: string): ImportResult {
  try {
    const data = JSON.parse(json);
    return validateImport(data);
  } catch (e) {
    return { success: false, errors: ['JSON inválido: ' + (e instanceof Error ? e.message : String(e))], warnings: [] };
  }
}
