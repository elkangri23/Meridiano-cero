import { EngineStateError } from './state-error.js';
import { knowsEvidence, revealEvidence } from './fixed-evidence.js';
import type { CaseDefinition, CaseMechanics, CaseRun, MechanicsAnalysis, MechanicsQuery, MechanicsSuspect, ScheduledResult } from '@meridiano/case-schema';

/**
 * Mecánica declarativa de los expedientes generados (T4-08). El caso fijo
 * tiene esta misma mecánica hardcodeada en `fixed-evidence.ts`,
 * `warrants.ts` y `offers.ts`; los expedientes generados la declaran en
 * `CaseDefinition.mechanics` y el motor la ejecuta aquí, por la vía
 * genérica. Las reglas se mantienen idénticas a las del caso fijo: inspeccionar
 * la sala 10 min y un elemento 20 min solo cuando revela algo nuevo;
 * detener 15 min; recuperar 20 min; una consulta admite cualquiera de sus
 * requisitos («cualquiera de», como la custodia del astrolabio); la orden se
 * concede cuando la selección cubre una combinación admisible completa.
 */

export function generatedMechanics(def: CaseDefinition): CaseMechanics | undefined {
  return def.mechanics;
}

export function isGeneratedCase(def: CaseDefinition): boolean {
  return def.mechanics !== undefined;
}

// ── Inspección ────────────────────────────────────────────────────────────────

/** Evidencia que revela inspeccionar un lugar; `elementId` vacío es la sala. */
export function generatedInspectEvidence(def: CaseDefinition, locationId: string, elementId?: string): { evidenceId: string; reveals: string[] } | undefined {
  const item = def.mechanics?.inspectables.find(entry => entry.locationId === locationId && entry.elementId === (elementId ?? ''));
  return item ? { evidenceId: item.evidenceId, reveals: item.reveals ?? [] } : undefined;
}

/** Elementos inspeccionables de un lugar (sin la sala). */
export function listGeneratedInspectableElements(def: CaseDefinition, locationId: string): string[] {
  return def.mechanics?.inspectables.filter(entry => entry.locationId === locationId && entry.elementId !== '').map(entry => entry.elementId) ?? [];
}

/** Etiqueta legible de un elemento inspeccionable, si la declara el expediente. */
export function generatedInspectLabel(def: CaseDefinition, locationId: string, elementId: string): string | undefined {
  return def.mechanics?.inspectables.find(entry => entry.locationId === locationId && entry.elementId === elementId)?.label;
}

export function revealGeneratedInspection(def: CaseDefinition, run: CaseRun, target: string, element?: string): CaseRun {
  const found = generatedInspectEvidence(def, target, element);
  if (!found) return run;
  const revealed = revealEvidence(def, run, found.evidenceId, run.minute, 'inspect');
  if (found.reveals.length === 0) return revealed;
  return { ...revealed, discoveries: [...revealed.discoveries, ...found.reveals.filter(marker => !revealed.discoveries.includes(marker))] };
}

// ── Recogida ──────────────────────────────────────────────────────────────────

/** Un objeto se recoge cuando ya se conoce y está en el lugar actual. */
export function generatedCanCollect(def: CaseDefinition, run: CaseRun, id: string): boolean {
  const evidence = def.evidence.find(item => item.id === id);
  if (!evidence || evidence.type !== 'object') return false;
  return run.discoveries.includes(id) && evidence.origin === run.position.locationId;
}

// ── Consultas y análisis ──────────────────────────────────────────────────────

export interface GeneratedQueryRule {
  id: string;
  label: string;
  cityId: string;
  locationId: string;
  evidenceId: string;
  requires: string[];
  delayMinutes: number;
  reveals: string[];
}

export function generatedQueryRule(def: CaseDefinition, run: CaseRun, topicId: unknown): GeneratedQueryRule | undefined {
  const mechanics = def.mechanics;
  if (!mechanics || typeof topicId !== 'string') return undefined;
  const rule = mechanics.queries.find(entry => entry.id === topicId);
  if (!rule || run.position.cityId !== rule.cityId || run.position.locationId !== rule.locationId) return undefined;
  if (!def.evidence.some(evidence => evidence.id === rule.evidenceId)) return undefined;
  // Cualquiera de los requisitos basta, como en el caso fijo.
  if (rule.requires.length > 0 && !rule.requires.some(id => knowsEvidence(run, id))) return undefined;
  return { ...rule, requires: [...rule.requires], reveals: [...(rule.reveals ?? [])] };
}

export function generatedAnalysis(def: CaseDefinition, run: CaseRun, evidenceId: unknown): { inputEvidenceId: string; resultEvidenceId: string; delayMinutes: number } | undefined {
  const mechanics = def.mechanics;
  if (!mechanics || typeof evidenceId !== 'string') return undefined;
  const rule = mechanics.analyses.find(entry => entry.inputEvidenceId === evidenceId);
  if (!rule || !run.inventory.includes(rule.inputEvidenceId)) return undefined;
  if (run.discoveries.includes(rule.resultEvidenceId)) return undefined;
  return { ...rule };
}

function maturePayload(request: ScheduledResult): { id: string; method: 'analyze' | 'query' } {
  if (typeof request.payload !== 'object' || request.payload === null) throw new EngineStateError('REQUEST_STATE_INVALID');
  const payload = request.payload as Record<string, unknown>;
  if (Object.keys(payload).sort().join(',') !== 'evidenceId,method') throw new EngineStateError('REQUEST_STATE_INVALID');
  const id = payload.evidenceId;
  const method = payload.method;
  if (typeof id !== 'string' || (method !== 'analyze' && method !== 'query')) throw new EngineStateError('REQUEST_STATE_INVALID');
  return { id, method };
}

function matureRule(def: CaseDefinition, method: 'analyze' | 'query', id: string): MechanicsAnalysis | MechanicsQuery {
  const mechanics = def.mechanics;
  if (!mechanics) throw new EngineStateError('REQUEST_STATE_INVALID');
  const rule = method === 'analyze'
    ? mechanics.analyses.find(entry => entry.resultEvidenceId === id)
    : mechanics.queries.find(entry => entry.evidenceId === id);
  if (!rule || !def.evidence.some(evidence => evidence.id === id)) throw new EngineStateError('REQUEST_STATE_INVALID');
  return rule;
}

/** Madura una evidencia de consulta o análisis de un expediente generado. */
export function matureGeneratedEvidence(def: CaseDefinition, run: CaseRun, request: ScheduledResult): CaseRun {
  const { id, method } = maturePayload(request);
  const rule = matureRule(def, method, id);
  const revealed = revealEvidence(def, run, id, request.dueMinute, method);
  const reveals = method === 'query' ? (rule as MechanicsQuery).reveals ?? [] : [];
  if (reveals.length === 0) return revealed;
  return { ...revealed, discoveries: [...revealed.discoveries, ...reveals.filter(marker => !revealed.discoveries.includes(marker))] };
}

// ── Conversación ──────────────────────────────────────────────────────────────

/** Hablar: la identidad deja los marcadores de siempre; un tema declarado
 * revela su evidencia cuando se cumple la condición de relación. */
export function revealGeneratedTalk(def: CaseDefinition, run: CaseRun, npcId: string, topicId: unknown): CaseRun {
  const mechanics = def.mechanics;
  if (!mechanics) return run;
  if (topicId === 'identidad') {
    const markers = ['identity:' + npcId, 'location:' + npcId];
    return { ...run, discoveries: [...run.discoveries, ...markers.filter(marker => !run.discoveries.includes(marker))] };
  }
  if (typeof topicId !== 'string') return run;
  const entry = mechanics.talkEvidence.find(item => item.npcId === npcId && item.topicId === topicId);
  if (!entry) return run;
  if (entry.requiresRelation && (run.npcRelations[npcId] ?? 0) <= 0) return run;
  return revealEvidence(def, run, entry.evidenceId, run.minute, 'talk');
}

// ── Órdenes, detenciones y recuperación ───────────────────────────────────────

export function generatedSuspect(def: CaseDefinition, suspectId: string): MechanicsSuspect | undefined {
  return def.mechanics?.suspects.find(suspect => suspect.id === suspectId);
}

export function generatedKnownSuspect(def: CaseDefinition, run: CaseRun, id: string): boolean {
  const suspect = generatedSuspect(def, id);
  if (!suspect) return false;
  if (run.discoveries.includes('identity:' + id)) return true;
  return suspect.knownFromEvidence.some(evidenceId => knowsEvidence(run, evidenceId));
}

export function generatedCanIssueWarrant(def: CaseDefinition, run: CaseRun, suspectId: string, selection?: readonly string[]): boolean {
  const suspect = generatedSuspect(def, suspectId);
  if (!suspect) return false;
  const chosen = selection ?? [...run.inventory, ...run.discoveries];
  const admissible = (id: string): boolean => {
    const flag = run.admissibility[id];
    return def.evidence.find(evidence => evidence.id === id)?.admissible === true && flag !== false;
  };
  const has = (ids: string[]): boolean => ids.every(id => chosen.includes(id) && knowsEvidence(run, id) && admissible(id));
  return suspect.warrantCombinations.some(has);
}

/** Espejo de `detentionAuthorized` (index.ts): conocido, presente, con orden
 * y sin detener. */
export function generatedDetentionAvailable(def: CaseDefinition, run: CaseRun, suspectId: string): boolean {
  const suspect = generatedSuspect(def, suspectId);
  if (!suspect) return false;
  const known = run.discoveries.includes('identity:' + suspect.id) && run.discoveries.includes('location:' + suspect.id);
  const present = run.position.cityId === suspect.cityId && run.position.locationId === suspect.locationId;
  return known && present && run.warrants.includes('warrant:' + suspect.id) && !run.detentions.includes(suspect.id);
}
