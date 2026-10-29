import type { ValidationReport } from './types.js';
import { check, identifier, integer, isRecord, records, strings, text, type DataRecord } from './validation-fields.js';
import { validateEntities, type EntityGroups } from './validation-entities.js';
import { validateReferences, validateEvidenceGraph, validateStart } from './validation-references.js';

function metadata(d: DataRecord, errors: string[]) {
  check(identifier(d.id), 'id', errors);
  check(d.schemaVersion === 1, 'schemaVersion soportada', errors);
  check(d.engineCompatibility === 1, 'engineCompatibility soportada', errors);
  check(integer(d.contentVersion, 1), 'contentVersion', errors);
  check(typeof d.seed === 'number' && Number.isSafeInteger(d.seed), 'seed', errors);
  check(typeof d.contentMode === 'string' && ['fixed', 'generated'].includes(d.contentMode), 'contentMode', errors);
  check(typeof d.difficulty === 'string' && ['easy', 'normal', 'hard'].includes(d.difficulty), 'difficulty', errors);
  check(typeof d.explorationMode === 'string' && ['guided', 'free'].includes(d.explorationMode), 'explorationMode', errors);
  check(text(d.catalogVersion), 'catalogVersion', errors);
  check(integer(d.deadlineMinutes, 1), 'deadlineMinutes', errors);
  check(text(d.solution), 'solution', errors);
}

function collections(d: DataRecord, errors: string[]): EntityGroups {
  strings(d.facts, 'facts', errors);
  strings(d.rules, 'rules', errors);
  return {
    cities: records(d.cities, 'cities', errors, 20),
    locations: records(d.locations, 'locations', errors, 100),
    npcs: records(d.npcs, 'npcs', errors, 100),
    evidence: records(d.evidence, 'evidence', errors, 1000),
    objectives: records(d.objectives, 'objectives', errors),
    travelDurations: records(d.travelDurations, 'travelDurations', errors),
    scheduledResults: records(d.scheduledResults, 'scheduledResults', errors),
  };
}

function report(value: unknown, errors: string[]) {
  if (!isRecord(value)) { errors.push('validationReport: objeto obligatorio.'); return; }
  check(text(value.validatorVersion), 'validationReport.validatorVersion', errors);
  check(value.status === 'validated', 'validationReport.status', errors);
  const reported = strings(value.errors, 'validationReport.errors', errors);
  strings(value.scenarios, 'validationReport.scenarios', errors);
  check(reported.length === 0, 'validationReport contiene errores', errors);
}

/** Estructura y referencias verificables; no certifica solvencia ni ejecuta rules. */
export function validateCaseDefinition(def: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!isRecord(def)) return { valid: false, errors: ['La definición debe ser un objeto.'] };
  metadata(def, errors);
  const groups = collections(def, errors);
  validateEntities(groups, errors);
  validateReferences(groups, errors);
  validateEvidenceGraph(groups.evidence, errors);
  validateStart(groups, errors);
  report(def.validationReport, errors);
  return { valid: errors.length === 0, errors };
}

/** Solo declara la etapa estructural solicitada; no confía en certificados externos. */
export function createValidationReport(errors: string[]): ValidationReport {
  return { validatorVersion: '1.1.0', scenarios: ['structural'], errors: [...errors],
    status: errors.length === 0 ? 'validated' : 'rejected' };
}
