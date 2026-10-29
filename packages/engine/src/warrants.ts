import { appendRequest } from './requests.js';
import { EngineStateError } from './state-error.js';
import type { CaseDefinition, CaseRun, ScheduledResult } from '@meridiano/case-schema';
import type { ActionResult } from './types.js';
import { fixedSuspect, isFixedCase } from './fixed-case.js';
import { knowsEvidence } from './fixed-evidence.js';

export function isEvidenceSelection(value: unknown): value is string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 16) return false;
  if (!Array.from(value).every(id => typeof id === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(id))) return false;
  return new Set(value).size === value.length;
}

function selectedEvidence(def: CaseDefinition, run: CaseRun, value: unknown): string[] | undefined {
  if (!isEvidenceSelection(value)) return undefined;
  if (!value.every(id => def.evidence.some(evidence => evidence.id === id) && knowsEvidence(run, id))) return undefined;
  return [...value];
}

function admissible(def: CaseDefinition, run: CaseRun, id: string): boolean {
  const flag = run.admissibility[id];
  if (flag !== undefined && typeof flag !== 'boolean') throw new EngineStateError('REQUEST_STATE_INVALID');
  return def.evidence.find(evidence => evidence.id === id)?.admissible === true && flag !== false;
}

export function canIssueWarrant(def: CaseDefinition, run: CaseRun, suspectId: string, selection?: readonly string[]): boolean {
  if (!isFixedCase(def)) return false;
  const suspect = fixedSuspect(suspectId);
  if (!suspect) return false;
  const chosen = selection ?? [...run.inventory, ...run.discoveries];
  const has = (ids: string[]) => ids.every(id => chosen.includes(id) && knowsEvidence(run, id) && admissible(def, run, id));

  return suspect.id === 'ines'
    ? has(['EV-03', 'EV-04']) || has(['EV-06', 'EV-07', 'EV-08'])
    : has(['EV-09', 'EV-10']);
}

function knownSuspect(run: CaseRun, id: string): boolean {
  if (run.discoveries.includes('identity:' + id)) return true;
  const references = id === 'ines' ? ['EV-04', 'EV-05', 'EV-07', 'EV-08'] : ['EV-09', 'EV-10'];
  return references.some(evidence => knowsEvidence(run, evidence));
}

export function requestWarrant(def: CaseDefinition, run: CaseRun, params: Record<string, unknown>): ActionResult {
  const fail = (): ActionResult => ({ status: 'impossible', run, events: [], reason: 'Solicitud no disponible.' });
  if (Object.keys(params).sort().join(',') !== 'evidenceIds,suspectId') return fail();
  if (!isFixedCase(def) || typeof params.suspectId !== 'string') return fail();
  const suspect = fixedSuspect(params.suspectId);
  if (!suspect || !knownSuspect(run, suspect.id) || !def.npcs.some(npc => npc.id === suspect.id)) return fail();
  const evidenceIds = selectedEvidence(def, run, params.evidenceIds);
  if (!evidenceIds) return fail();
  if (run.pendingRequests.some(request => sameWarrant(request, suspect.id, evidenceIds))) {
    return { status: 'impossible', run, events: [], reason: 'Solicitud ya en curso.' };
  }
  const id = `req-${run.version + 1}`;
  const request: ScheduledResult = { id, dueMinute: run.minute + 30, type: 'warrant', payload: { suspectId: suspect.id, evidenceIds } };
  return {
    status: 'applied', run: appendRequest(run, request),
    events: [{ ordinal: 0, minute: run.minute, type: 'request_warrant', payload: { requestId: id, suspectId: suspect.id } }],
  };
}

function warrantPayload(value: unknown): { suspectId: string; evidenceIds: string[] } {
  if (typeof value !== 'object' || value === null) throw new EngineStateError('REQUEST_STATE_INVALID');
  const payload = value as Record<string, unknown>;
  if (Object.keys(payload).sort().join(',') !== 'evidenceIds,suspectId') throw new EngineStateError('REQUEST_STATE_INVALID');
  if (typeof payload.suspectId !== 'string' || !fixedSuspect(payload.suspectId)) throw new EngineStateError('REQUEST_STATE_INVALID');
  const ids = payload.evidenceIds;
  if (!isEvidenceSelection(ids)) throw new EngineStateError('REQUEST_STATE_INVALID');
  return { suspectId: payload.suspectId, evidenceIds: ids };
}

function sameWarrant(request: ScheduledResult, suspectId: string, ids: string[]): boolean {
  if (request.type !== 'warrant') return false;
  const payload = warrantPayload(request.payload);
  return payload.suspectId === suspectId && payload.evidenceIds.length === ids.length && payload.evidenceIds.every(id => ids.includes(id));
}

export function matureSelectedWarrant(def: CaseDefinition, run: CaseRun, request: ScheduledResult): CaseRun {
  const payload = warrantPayload(request.payload);
  const evidenceIds = selectedEvidence(def, run, payload.evidenceIds);
  if (!evidenceIds || !canIssueWarrant(def, run, payload.suspectId, evidenceIds)) {
    return { ...run, discoveries: [...run.discoveries, 'warrant-denied:' + request.id] };
  }
  const warrants = new Set(run.warrants);
  warrants.add('warrant:' + payload.suspectId);
  if (payload.suspectId === 'ines' && ['EV-05', 'EV-08'].some(id => evidenceIds.includes(id) && admissible(def, run, id))) warrants.add('warrant:access');
  return { ...run, warrants: [...warrants] };
}
