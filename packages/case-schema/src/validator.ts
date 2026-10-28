import type { ValidationReport } from './types.js';

const VALID_DIFFICULTIES = new Set(['easy', 'normal', 'hard']);
const VALID_EXPLORATION = new Set(['guided', 'free']);
const VALID_CONTENT_MODES = new Set(['fixed', 'generated']);
const VALID_EVIDENCE_TYPES = new Set(['object', 'observation', 'testimony', 'analysis', 'record']);

export function validateCaseDefinition(def: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (typeof def !== 'object' || def === null) {
    return { valid: false, errors: ['La definición debe ser un objeto.'] };
  }

  const d = def as Record<string, unknown>;

  // Campos obligatorios
  if (typeof d.id !== 'string' || d.id.length === 0) errors.push('id: debe ser string no vacío.');
  if (typeof d.schemaVersion !== 'number' || !Number.isInteger(d.schemaVersion) || d.schemaVersion < 1) errors.push('schemaVersion: entero >= 1.');
  if (typeof d.engineCompatibility !== 'number' || !Number.isInteger(d.engineCompatibility) || d.engineCompatibility < 1) errors.push('engineCompatibility: entero >= 1.');
  if (typeof d.contentVersion !== 'number' || !Number.isInteger(d.contentVersion) || d.contentVersion < 1) errors.push('contentVersion: entero >= 1.');
  if (typeof d.seed !== 'number' || !Number.isInteger(d.seed)) errors.push('seed: entero.');
  if (typeof d.contentMode !== 'string' || !VALID_CONTENT_MODES.has(d.contentMode)) errors.push('contentMode: fixed o generated.');
  if (typeof d.difficulty !== 'string' || !VALID_DIFFICULTIES.has(d.difficulty)) errors.push('difficulty: easy, normal o hard.');
  if (typeof d.explorationMode !== 'string' || !VALID_EXPLORATION.has(d.explorationMode)) errors.push('explorationMode: guided o free.');
  if (typeof d.catalogVersion !== 'string' || d.catalogVersion.length === 0) errors.push('catalogVersion: string no vacío.');
  if (typeof d.deadlineMinutes !== 'number' || !Number.isInteger(d.deadlineMinutes) || d.deadlineMinutes < 1) errors.push('deadlineMinutes: entero >= 1.');
  if (typeof d.solution !== 'string' || d.solution.length === 0) errors.push('solution: string no vacío.');

  // Arrays
  if (!Array.isArray(d.objectives)) errors.push('objectives: array obligatorio.');
  if (!Array.isArray(d.cities)) errors.push('cities: array obligatorio.');
  if (!Array.isArray(d.locations)) errors.push('locations: array obligatorio.');
  if (!Array.isArray(d.npcs)) errors.push('npcs: array obligatorio.');
  if (!Array.isArray(d.facts)) errors.push('facts: array obligatorio.');
  if (!Array.isArray(d.evidence)) errors.push('evidence: array obligatorio.');
  if (!Array.isArray(d.rules)) errors.push('rules: array obligatorio.');
  if (!Array.isArray(d.travelDurations)) errors.push('travelDurations: array obligatorio.');
  if (!Array.isArray(d.scheduledResults)) errors.push('scheduledResults: array obligatorio.');

  // Validación de IDs únicos
  const ids = new Set<string>();
  const collectIds = (arr: unknown[], field: string) => {
    if (!Array.isArray(arr)) return;
    for (const item of arr) {
      if (typeof item === 'object' && item !== null && 'id' in item) {
        const id = (item as { id: unknown }).id;
        if (typeof id === 'string') {
          if (ids.has(id)) errors.push(`ID duplicado: ${id} (en ${field}).`);
          ids.add(id);
        }
      }
    }
  };

  collectIds(d.cities as unknown[], 'cities');
  collectIds(d.locations as unknown[], 'locations');
  collectIds(d.npcs as unknown[], 'npcs');
  collectIds(d.evidence as unknown[], 'evidence');
  collectIds(d.objectives as unknown[], 'objectives');

  // Validación de evidencias
  if (Array.isArray(d.evidence)) {
    for (const e of d.evidence) {
      if (typeof e === 'object' && e !== null) {
        const ev = e as Record<string, unknown>;
        if (typeof ev.type !== 'string' || !VALID_EVIDENCE_TYPES.has(ev.type)) {
          errors.push(`evidence ${ev.id ?? '?'}: type inválido.`);
        }
        if (typeof ev.minute !== 'number' || !Number.isInteger(ev.minute) || ev.minute < 0) {
          errors.push(`evidence ${ev.id ?? '?'}: minute debe ser entero >= 0.`);
        }
      }
    }
  }

  // Validación de travelDurations
  if (Array.isArray(d.travelDurations)) {
    for (const t of d.travelDurations) {
      if (typeof t === 'object' && t !== null) {
        const td = t as Record<string, unknown>;
        if (typeof td.minutes !== 'number' || !Number.isInteger(td.minutes) || td.minutes < 0) {
          errors.push(`travelDuration ${td.fromCityId ?? '?'}→${td.toCityId ?? '?'}: minutes inválido.`);
        }
      }
    }
  }

  // Validación de scheduledResults
  if (Array.isArray(d.scheduledResults)) {
    for (const s of d.scheduledResults) {
      if (typeof s === 'object' && s !== null) {
        const sr = s as Record<string, unknown>;
        if (typeof sr.dueMinute !== 'number' || !Number.isInteger(sr.dueMinute) || sr.dueMinute < 0) {
          errors.push(`scheduledResult ${sr.id ?? '?'}: dueMinute inválido.`);
        }
      }
    }
  }

  // Validación de validationReport
  if (typeof d.validationReport !== 'object' || d.validationReport === null) {
    errors.push('validationReport: objeto obligatorio.');
  } else {
    const vr = d.validationReport as Record<string, unknown>;
    if (vr.status !== 'validated') errors.push('validationReport.status debe ser "validated".');
    if (!Array.isArray(vr.scenarios)) errors.push('validationReport.scenarios: array obligatorio.');
    if (!Array.isArray(vr.errors)) errors.push('validationReport.errors: array obligatorio.');
  }

  return { valid: errors.length === 0, errors };
}

export function createValidationReport(errors: string[]): ValidationReport {
  return {
    validatorVersion: '1.0.0',
    scenarios: ['structural', 'references', 'routes', 'simulation'],
    errors,
    status: errors.length === 0 ? 'validated' : 'rejected',
  };
}