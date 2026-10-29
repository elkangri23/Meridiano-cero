import type { CaseDefinition, CaseRun, ScheduledResult } from '@meridiano/case-schema';
import type { ActionResult } from './types.js';
import { isFixedCase } from './fixed-case.js';
import { appendRequest } from './requests.js';
import { EngineStateError } from './state-error.js';

const channels = new Set(['call', 'whatsapp', 'sms', 'email', 'fax']);
type CommunicationParams = { channel: string; recipientId: string; requestText: string };

function requestText(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 4000 && value.trim().length > 0;
}

export function isCommunicationParams(value: unknown): value is CommunicationParams {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const data = value as Record<string, unknown>;
  if (Object.keys(data).sort().join(',') !== 'channel,recipientId,requestText') return false;
  if (typeof data.channel !== 'string' || !channels.has(data.channel)) return false;
  if (typeof data.recipientId !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(data.recipientId)) return false;
  return requestText(data.requestText);
}

function samePending(run: CaseRun, params: CommunicationParams): boolean {
  return run.pendingRequests.some(request => {
    if (request.type !== 'communicate' || !isCommunicationParams(request.payload)) return false;
    return request.payload.channel === params.channel && request.payload.recipientId === params.recipientId &&
      request.payload.requestText === params.requestText;
  });
}

export function submitCommunication(def: CaseDefinition, run: CaseRun, params: Record<string, unknown>): ActionResult {
  const refuse = (): ActionResult => ({ status: 'impossible', run, events: [], reason: 'Comunicación no disponible.' });
  if (!isCommunicationParams(params) || !isFixedCase(def)) return refuse();
  const contact = def.npcs.find(npc => npc.id === params.recipientId);
  if (!contact || !Object.hasOwn(run.npcRelations, contact.id) || samePending(run, params)) return refuse();
  const requestId = 'req-' + (run.version + 1);
  const request: ScheduledResult = { id: requestId, dueMinute: run.minute + 30, type: 'communicate', payload: { ...params } };
  return { status: 'applied', run: appendRequest(run, request),
    events: [{ ordinal: 0, minute: run.minute, type: 'communicate', payload: { requestId } }] };
}

export function matureCommunication(run: CaseRun, request: ScheduledResult): CaseRun {
  if (!isCommunicationParams(request.payload)) throw new EngineStateError('REQUEST_STATE_INVALID');
  // Acuse neutral; no interpretar texto como orden, evidencia o respuesta factual.
  return { ...run, conversationRecords: [...run.conversationRecords, 'communication_received:' + request.id + '@' + request.dueMinute] };
}
