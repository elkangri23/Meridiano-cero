export type DataRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is DataRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function text(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 16384;
}

export function identifier(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(value);
}

export function integer(value: unknown, minimum: number): boolean {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum;
}

export function check(valid: boolean, field: string, errors: string[]): void {
  if (!valid) errors.push(`${field}: valor inválido.`);
}

export function strings(value: unknown, field: string, errors: string[]): string[] {
  if (!Array.isArray(value) || value.length > 2048) {
    errors.push(`${field}: array requerido, máximo 2048 entradas.`);
    return [];
  }
  const result: string[] = [];
  for (const item of value) {
    if (!text(item)) errors.push(`${field}: requiere strings no vacíos, máximo 16384 caracteres.`);
    else result.push(item);
  }
  return result;
}

export function records(value: unknown, field: string, errors: string[], maximum = 2048): DataRecord[] {
  if (!Array.isArray(value) || value.length > maximum) {
    errors.push(`${field}: array requerido, máximo ${maximum} entradas.`);
    return [];
  }
  const result: DataRecord[] = [];
  for (const item of value) {
    if (!isRecord(item)) errors.push(`${field}: cada entrada debe ser un objeto.`);
    else result.push(item);
  }
  return result;
}
