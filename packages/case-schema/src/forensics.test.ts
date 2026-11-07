import { describe, expect, it } from 'vitest';
import { FORENSIC_TYPES, forensicTypeForAnalysis, forensicTypeForEvidenceType, isForensicType } from './forensics.js';
import type { CaseDefinition } from './types.js';

function definition(rules: Array<{ inputEvidenceId: string; resultEvidenceId: string; delayMinutes: number; forensicType?: string }>): CaseDefinition {
  return {
    id: 'caso-prueba', schemaVersion: 1, engineCompatibility: 14, contentVersion: 1, seed: 1,
    contentMode: 'generated', difficulty: 'normal', explorationMode: 'guided', catalogVersion: '1',
    deadlineMinutes: 2880, solution: 'sospechoso', objectives: [], cities: [], locations: [],
    npcs: [], facts: [],
    evidence: [
      { id: 'EV-02', type: 'object', origin: 'BIL-OFIC', minute: 0, admissible: true, relations: [] },
      { id: 'EV-03', type: 'analysis', origin: 'BIL-OFIC', minute: 0, admissible: true, relations: ['EV-02'] },
      { id: 'EV-04', type: 'record', origin: 'BIL-OFIC', minute: 0, admissible: true, relations: [] },
    ],
    rules: [], travelDurations: [], scheduledResults: [],
    validationReport: { validatorVersion: '1.5', scenarios: [], errors: [], status: 'validated' },
    mechanics: { inspectables: [], queries: [], analyses: rules, talkEvidence: [], suspects: [],
      recovery: { objectId: 'objeto', label: 'Recuperar', cityId: 'bilbao', locationId: 'BIL-OFIC', evidenceId: 'EV-11', requiresAccessWarrant: false } },
  } as unknown as CaseDefinition;
}

describe('tipos forenses', () => {
  it('los seis tipos del GDD §11 son canónicos', () => {
    expect([...FORENSIC_TYPES]).toEqual(['huellas', 'documentos', 'fotografias', 'audio', 'muestras', 'materiales']);
    expect(isForensicType('huellas')).toBe(true);
    expect(isForensicType('adn')).toBe(false);
    expect(isForensicType(undefined)).toBe(false);
  });

  it('deriva el tipo del tipo de evidencia de entrada', () => {
    expect(forensicTypeForEvidenceType('record')).toBe('documentos');
    expect(forensicTypeForEvidenceType('object')).toBe('materiales');
    expect(forensicTypeForEvidenceType('observation')).toBe('fotografias');
    expect(forensicTypeForEvidenceType('testimony')).toBe('audio');
    expect(forensicTypeForEvidenceType('analysis')).toBe('muestras');
  });

  it('el tipo declarado en la mecánica manda sobre la derivación', () => {
    const def = definition([{ inputEvidenceId: 'EV-02', resultEvidenceId: 'EV-03', delayMinutes: 90, forensicType: 'huellas' }]);
    expect(forensicTypeForAnalysis(def, def.mechanics!.analyses[0]!)).toBe('huellas');
  });

  it('sin tipo declarado deriva del tipo de la evidencia de entrada', () => {
    const def = definition([{ inputEvidenceId: 'EV-02', resultEvidenceId: 'EV-03', delayMinutes: 90 }]);
    expect(forensicTypeForAnalysis(def, def.mechanics!.analyses[0]!)).toBe('materiales');
    const record = definition([{ inputEvidenceId: 'EV-04', resultEvidenceId: 'EV-03', delayMinutes: 90 }]);
    expect(forensicTypeForAnalysis(record, record.mechanics!.analyses[0]!)).toBe('documentos');
  });

  it('un tipo declarado no canónico se ignora y se deriva', () => {
    const def = definition([{ inputEvidenceId: 'EV-02', resultEvidenceId: 'EV-03', delayMinutes: 90, forensicType: 'adn' }]);
    expect(forensicTypeForAnalysis(def, def.mechanics!.analyses[0]!)).toBe('materiales');
  });

  it('sin evidencia de entrada conocida usa materiales como respaldo', () => {
    const def = definition([{ inputEvidenceId: 'EV-99', resultEvidenceId: 'EV-03', delayMinutes: 90 }]);
    expect(forensicTypeForAnalysis(def, def.mechanics!.analyses[0]!)).toBe('materiales');
  });
});
