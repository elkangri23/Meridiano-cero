import type { CaseRun, ScheduledResult } from '@meridiano/case-schema';
import { EngineStateError } from './state-error.js';

export const MAX_PENDING_REQUESTS = 32;
export function appendRequest(run: CaseRun, request: ScheduledResult): CaseRun {
  if (run.pendingRequests.length >= MAX_PENDING_REQUESTS) throw new EngineStateError('REQUEST_CAPACITY_EXCEEDED');
  if (!Number.isSafeInteger(request.dueMinute) || request.dueMinute < run.minute || !Number.isSafeInteger(run.version + 1)) throw new EngineStateError('REQUEST_STATE_INVALID');
  return { ...run, version: run.version + 1, pendingRequests: [...run.pendingRequests, request] };
}

export function pendingEvidence(run: CaseRun, id: string): boolean {
  return run.pendingRequests.some(request => {
    if (request.type !== 'fixed_evidence' || typeof request.payload !== 'object' || request.payload === null) return false;
    return 'evidenceId' in request.payload && request.payload.evidenceId === id;
  });
}
