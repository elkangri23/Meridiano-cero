// Informe final completo (GDD §12): resultado, objetivos, verdad, pruebas,
// detenciones y puntuación. Todo es determinista y sale de la definición del
// expediente + el estado de la partida: nada se inventa y nada cambia con
// IA. La cronología NO se construye aquí (el motor no tiene acceso a los
// registros de operaciones): `buildFinalReport` la deja vacía y la API la
// rellena al proyectar una partida cerrada.
import { evidenceText, caseText, resolveMessage, type Language } from '@meridiano/case-schema';
import { fixedSuspect, isFixedCase, ORIGINAL_OBJECT, ORIGINAL_OBJECT_LABEL } from './fixed-case.js';
import { knowsEvidence } from './fixed-evidence.js';
import { irregularActsForReport, misconductOf, IRREGULAR_SCORE_PENALTY } from './misconduct.js';
import type { CaseDefinition, CaseRun, FinalReport } from '@meridiano/case-schema';

// Alias históricos del caso fijo, no inferidos de nombres visibles o substrings.
function canonicalSuspect(def: CaseDefinition, id: string): string {
  return isFixedCase(def) ? fixedSuspect(id)?.identity ?? id : id;
}

/** Identificador de personaje (id de NPC) a partir de cualquier forma que
 * guarde el estado: id de NPC (`ines`) o identidad canónica (`ines-valera`)
 * en el caso fijo; en los generados, el id ya es el del NPC. */
function npcIdForSuspect(def: CaseDefinition, id: string): string {
  return isFixedCase(def) ? fixedSuspect(id)?.id ?? id : id;
}

function suspectName(def: CaseDefinition, id: string): string {
  return def.npcs.find(npc => npc.id === npcIdForSuspect(def, id))?.name ?? id;
}

function objectiveAchieved(def: CaseDefinition, run: CaseRun, id: string): boolean {
  if (id === 'obj-detener') return run.detentions.some(suspect => canonicalSuspect(def, suspect) === def.solution);
  if (id === 'obj-recuperar') {
    // Expediente generado (T4-08): el objeto a recuperar lo declara la mecánica.
    const objectId = isFixedCase(def) ? ORIGINAL_OBJECT : def.mechanics?.recovery.objectId;
    return objectId !== undefined && run.recoveredObjects.includes(objectId);
  }
  // El formato heredado no define condiciones para objetivos arbitrarios.
  return false;
}

/** Objetivos logrados en este momento de la partida, según el estado del
 * motor (detenciones y objetos recuperados). Es la misma evaluación que
 * usa el informe final, pero en vivo: el panel de objetivos de la pantalla
 * de juego la enseña sin esperar al cierre. Los objetivos sin condición
 * conocida quedan siempre pendientes (no se inventa su logro). */
export function liveObjectives(def: CaseDefinition, run: CaseRun): string[] {
  return def.objectives.filter(objective => objectiveAchieved(def, run, objective.id)).map(objective => objective.id);
}

function result(def: CaseDefinition, run: CaseRun, achieved: string[]): FinalReport['result'] {
  if (run.detentions.some(suspect => canonicalSuspect(def, suspect) !== def.solution)) return 'incorrect';
  if (def.objectives.length > 0 && achieved.length === def.objectives.length) return 'complete';
  return achieved.length > 0 ? 'partial' : 'unresolved';
}

// ── Verdad completa ──────────────────────────────────────────────────────────

/** Pruebas decisivas del caso fijo: las que nombran a Inés Valera y la
 * vinculan con el robo. Es la misma lista que `knownSuspect` en
 * `warrants.ts` usa para dar por conocido a un sospechoso (el test de
 * deriva de este módulo las mantiene alineadas): EV-04 asigna la
 * herramienta HV-17 a Inés, EV-05 pone el envío a Lisboa a su nombre, EV-07
 * verifica su firma y autorización, EV-08 registra su recepción en el
 * depósito L-7. */
const FIXED_KEY_EVIDENCE = ['EV-04', 'EV-05', 'EV-07', 'EV-08'] as const;

function keyEvidenceIds(def: CaseDefinition): string[] {
  if (isFixedCase(def)) return [...FIXED_KEY_EVIDENCE];
  const suspect = def.mechanics?.suspects.find(entry => entry.id === def.solution);
  // La primera combinación de orden es la que basta para acreditar al
  // responsable; el objeto se demuestra con su propia evidencia de
  // recuperación. Si el expediente no trae combinaciones, se usan las
  // evidencias que hacen conocido al sospechoso.
  const combo = suspect?.warrantCombinations?.[0] ?? suspect?.knownFromEvidence ?? [];
  const recoveryEvidence = def.mechanics?.recovery.evidenceId;
  return [...new Set([...combo, ...(recoveryEvidence ? [recoveryEvidence] : [])])];
}

function truthForDefinition(def: CaseDefinition, language: Language = 'es'): FinalReport['truth'] {
  const recovery = isFixedCase(def)
    ? { objectId: ORIGINAL_OBJECT, label: caseText(def.id, 'object.label', language) ?? ORIGINAL_OBJECT_LABEL }
    : def.mechanics?.recovery
      ? { objectId: def.mechanics.recovery.objectId, label: caseText(def.id, 'object.label', language) ?? def.mechanics.recovery.label }
      : { objectId: null, label: null };
  return {
    culpritId: def.solution,
    culpritName: suspectName(def, def.solution),
    objectId: recovery.objectId,
    objectLabel: recovery.label,
    keyEvidence: keyEvidenceIds(def).map(id => ({ id, text: evidenceText(id, def.texts, def.id, language) ?? id })),
  };
}

// ── Pruebas halladas y omitidas ──────────────────────────────────────────────

function evidenceLists(def: CaseDefinition, run: CaseRun, language: Language = 'es'): Pick<FinalReport, 'evidenceFound' | 'evidenceMissed'> {
  const found: FinalReport['evidenceFound'] = [];
  const missed: FinalReport['evidenceMissed'] = [];
  for (const evidence of def.evidence) {
    const entry = { id: evidence.id, text: evidenceText(evidence.id, def.texts, def.id, language) ?? evidence.id };
    if (knowsEvidence(run, evidence.id)) found.push(entry);
    else missed.push(entry);
  }
  return { evidenceFound: found, evidenceMissed: missed };
}

// ── Detenciones ─────────────────────────────────────────────────────────────

function detentionEntries(def: CaseDefinition, run: CaseRun): FinalReport['detentions'] {
  return run.detentions.map(suspect => {
    const npcId = npcIdForSuspect(def, suspect);
    return {
      suspectId: npcId,
      suspectName: suspectName(def, suspect),
      correct: canonicalSuspect(def, suspect) === def.solution,
      withWarrant: run.warrants.includes('warrant:' + npcId),
    };
  });
}

// ── Puntuación ──────────────────────────────────────────────────────────────
// Reglas transparentes, documentadas en el propio informe (desglose) y en
// docs/plan: objetivos hasta 50 (proporcional a los logrados), pruebas
// halladas hasta 25 (proporcional a las descubiertas), detención correcta
// +15, cada detención errónea −20, cada acción irregular −10 (GDD §14,
// valor inicial para playtest), tiempo restante hasta +10 (proporcional
// al plazo que queda, solo al cerrar por decisión propia). Máximo 100;
// el total nunca baja de 0. Es la puntuación del informe, no de la carrera:
// la carrera sigue pendiente de calibración (DEC-020) y no se alimenta de
// aquí.
export const SCORE_MAX = 100;

export function scoreForReport(
  def: CaseDefinition,
  run: CaseRun,
  achieved: string[],
  reason: FinalReport['reason'],
  language: Language = 'es',
): FinalReport['score'] {
  const objectivesPoints = def.objectives.length === 0
    ? 0
    : Math.round((50 * achieved.length) / def.objectives.length);
  const foundCount = def.evidence.filter(evidence => knowsEvidence(run, evidence.id)).length;
  const evidencePoints = def.evidence.length === 0
    ? 0
    : Math.round((25 * foundCount) / def.evidence.length);
  const correctDetention = run.detentions.some(suspect => canonicalSuspect(def, suspect) === def.solution);
  const wrongDetentions = run.detentions.filter(suspect => canonicalSuspect(def, suspect) !== def.solution).length;
  const detentionPoints = correctDetention ? 15 : 0;
  const wrongPoints = wrongDetentions === 0 ? 0 : -20 * wrongDetentions;
  const irregularCount = misconductOf(run).length;
  const irregularPoints = irregularCount === 0 ? 0 : -IRREGULAR_SCORE_PENALTY * irregularCount;
  const timePoints = reason === 'finished' && def.deadlineMinutes > 0
    ? Math.round((10 * (def.deadlineMinutes - run.minute)) / def.deadlineMinutes)
    : 0;
  const total = Math.min(
    SCORE_MAX,
    Math.max(0, objectivesPoints + evidencePoints + detentionPoints + wrongPoints + irregularPoints + timePoints),
  );
  return {
    total,
    max: SCORE_MAX,
    breakdown: [
      { label: resolveMessage(language, 'engine.report.scoreObjectives'), points: objectivesPoints },
      { label: resolveMessage(language, 'engine.report.scoreEvidence'), points: evidencePoints },
      { label: resolveMessage(language, 'engine.report.scoreDetention'), points: detentionPoints },
      { label: resolveMessage(language, 'engine.report.scoreWrongDetentions'), points: wrongPoints },
      { label: resolveMessage(language, 'engine.report.scoreIrregular'), points: irregularPoints },
      { label: resolveMessage(language, 'engine.report.scoreTime'), points: timePoints },
    ],
  };
}

export function buildFinalReport(def: CaseDefinition, run: CaseRun, reason: FinalReport['reason'], language: Language = 'es'): FinalReport {
  const achieved = liveObjectives(def, run);
  return {
    result: result(def, run, achieved),
    objectivesAchieved: achieved,
    reason,
    minute: run.minute,
    truth: truthForDefinition(def, language),
    // La cronología vive en los registros de operaciones: la API la
    // rellena al proyectar una partida cerrada (ver `completeFinalReport`).
    timeline: [],
    ...evidenceLists(def, run, language),
    detentions: detentionEntries(def, run),
    irregularActs: irregularActsForReport(def, run, language),
    score: scoreForReport(def, run, achieved, reason, language),
  };
}

function hasReportSections(report: Record<string, unknown>): boolean {
  return Array.isArray(report.timeline) && Array.isArray(report.evidenceFound) &&
    Array.isArray(report.evidenceMissed) && Array.isArray(report.detentions);
}

/** Un informe guardado está completo si trae todas las secciones del
 * informe final completo (no solo resultado/objetivos/motivo/minuto). */
export function isCompleteFinalReport(value: unknown): value is FinalReport {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const report = value as Record<string, unknown>;
  return typeof report.truth === 'object' && report.truth !== null &&
    typeof report.score === 'object' && report.score !== null && hasReportSections(report);
}

function copyFinalReport(report: FinalReport): FinalReport {
  return {
    result: report.result,
    objectivesAchieved: [...report.objectivesAchieved],
    reason: report.reason,
    minute: report.minute,
    truth: { ...report.truth, keyEvidence: report.truth.keyEvidence.map(entry => ({ ...entry })) },
    timeline: report.timeline.map(entry => ({ ...entry })),
    evidenceFound: report.evidenceFound.map(entry => ({ ...entry })),
    evidenceMissed: report.evidenceMissed.map(entry => ({ ...entry })),
    detentions: report.detentions.map(entry => ({ ...entry })),
    irregularActs: [...(report.irregularActs ?? [])],
    score: { total: report.score.total, max: report.score.max, breakdown: report.score.breakdown.map(entry => ({ ...entry })) },
  };
}

/** Informe final de una partida cerrada, listo para proyectar. Si el
 * informe guardado en el estado es el antiguo de 4 campos (partidas
 * cerradas antes de esta entrega), se reconstruye desde la definición y el
 * estado congelado de la partida — determinista, mismo resultado que al
 * cerrar — en vez de enseñar un informe incompleto. En un idioma distinto
 * de español se reconstruye siempre en ese idioma (el guardado es español):
 * la reconstrucción es determinista desde definición + estado, así que el
 * contenido es el mismo que al cerrar, solo traducido. */
export function completeFinalReport(def: CaseDefinition, run: CaseRun, language: Language = 'es'): FinalReport | null {
  if (run.status !== 'closed' || !run.finalReport) return null;
  // El informe guardado puede ser el antiguo de 4 campos: el tipo lo
  // declara completo, así que se comprueba en runtime sobre `unknown`.
  const stored: unknown = run.finalReport;
  const rawReason = (stored as { reason?: unknown }).reason;
  const storedReason = rawReason === 'deadline' ? 'deadline' as const
    : rawReason === 'withdrawn' ? 'withdrawn' as const : 'finished' as const;
  if (language !== 'es') return buildFinalReport(def, run, storedReason, language);
  if (isCompleteFinalReport(stored)) {
    const copied = copyFinalReport(stored);
    // Informes guardados antes de las acciones irregulares no traen la
    // sección: se deriva del estado congelado de la partida, no se inventa.
    if (!Array.isArray((stored as { irregularActs?: unknown }).irregularActs)) {
      copied.irregularActs = irregularActsForReport(def, run);
    }
    return copied;
  }
  const reason = storedReason;
  return buildFinalReport(def, run, reason);
}
