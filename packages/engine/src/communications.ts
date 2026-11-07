import type { CaseDefinition, CaseRun, CommunicationRecord, RemoteChannel, ScheduledResult } from '@meridiano/case-schema';
import { channelsForNpc, DOCUMENT_SEND_MINUTES } from '@meridiano/case-schema';
import type { ActionResult } from './types.js';
import { appendRequest } from './requests.js';
import { EngineStateError } from './state-error.js';

export { DOCUMENT_SEND_MINUTES };

const channels = new Set(['call', 'whatsapp', 'sms', 'email', 'fax']);
type CommunicationParams = { channel: string; recipientId: string; requestText: string; documentId?: string };

function requestText(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 4000 && value.trim().length > 0;
}

function communicationKeys(data: Record<string, unknown>): boolean {
  const keys = Object.keys(data).sort().join(',');
  return keys === 'channel,recipientId,requestText' || keys === 'channel,documentId,recipientId,requestText';
}

function communicationDocumentId(value: unknown): boolean {
  return value === undefined || (typeof value === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(value));
}

export function isCommunicationParams(value: unknown): value is CommunicationParams {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const data = value as Record<string, unknown>;
  if (!communicationKeys(data)) return false;
  if (typeof data.channel !== 'string' || !channels.has(data.channel)) return false;
  if (typeof data.recipientId !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(data.recipientId)) return false;
  if (!communicationDocumentId(data.documentId)) return false;
  return requestText(data.requestText);
}

function samePending(run: CaseRun, params: CommunicationParams): boolean {
  return run.pendingRequests.some(request => {
    if (request.type !== 'communicate' || !isCommunicationParams(request.payload)) return false;
    return request.payload.channel === params.channel && request.payload.recipientId === params.recipientId &&
      request.payload.requestText === params.requestText && request.payload.documentId === params.documentId;
  });
}

/** Id de la comunicación: `comm-N`, con N el número de envíos de la
 * partida (los registros nunca se borran). NO usa la revisión como los
 * `req-N` de órdenes y consultas: el envío de un documento avanza el
 * reloj en dos pasos internos y la revisión persistida no refleja el
 * segundo, así que un `req-N` calculado ahí chocaría con el siguiente
 * envío o consulta. El prefijo distinto tampoco choca con los `req-N`
 * pendientes de partidas anteriores a la central. */
function nextCommunicationId(run: CaseRun): string {
  return 'comm-' + ((run.communications?.length ?? 0) + 1);
}

/** Motivos de rechazo de un envío (el formulario de la central ya no los
 * ofrece, pero el motor no se fía del cliente). */
function communicationRefusal(def: CaseDefinition, run: CaseRun, params: CommunicationParams): boolean {
  const contact = def.npcs.find(npc => npc.id === params.recipientId);
  if (!contact || !Object.hasOwn(run.npcRelations, contact.id)) return true;
  // Solo los canales del contacto: un canal que no tiene no se acepta
  // aunque el cliente lo pida (el formulario tampoco lo ofrece).
  if (!channelsForNpc(def, contact).includes(params.channel as RemoteChannel)) return true;
  // El documento debe estar en poder del jugador: solo se envía lo ya
  // descubierto y recogido, nunca la solución ni pruebas no halladas.
  if (params.documentId !== undefined && !run.inventory.includes(params.documentId)) return true;
  return samePending(run, params);
}

function communicationRecord(requestId: string, run: CaseRun, params: CommunicationParams): CommunicationRecord {
  return { id: requestId, channel: params.channel as RemoteChannel,
    recipientId: params.recipientId, requestText: params.requestText,
    ...(params.documentId !== undefined ? { documentId: params.documentId } : {}),
    sentMinute: run.minute, dueMinute: run.minute + 30 };
}

/** Registro del envío en el dossier: solo identificadores y el minuto
 * (T2); el texto libre NO va en el registro. */
function communicationSentRecord(requestId: string, run: CaseRun, params: CommunicationParams): string {
  return `communication_sent:${requestId}:${params.channel}:${params.recipientId}` +
    `${params.documentId !== undefined ? ':' + params.documentId : ''}@${run.minute}`;
}

export function submitCommunication(def: CaseDefinition, run: CaseRun, params: Record<string, unknown>): ActionResult {
  const refuse = (): ActionResult => ({ status: 'impossible', run, events: [], reason: 'Comunicación no disponible.' });
  if (!isCommunicationParams(params) || communicationRefusal(def, run, params)) return refuse();
  const requestId = nextCommunicationId(run);
  const record = communicationRecord(requestId, run, params);
  const request: ScheduledResult = { id: requestId, dueMinute: run.minute + 30, type: 'communicate', payload: { ...params } };
  // El envío queda en el dossier (registro de conversación) y en el
  // historial de la central.
  const withRecord: CaseRun = { ...run,
    conversationRecords: [...run.conversationRecords, communicationSentRecord(requestId, run, params)],
    communications: [...(run.communications ?? []), record] };
  return { status: 'applied', run: appendRequest(withRecord, request),
    events: [{ ordinal: 0, minute: run.minute, type: 'communicate',
      payload: { requestId, recipientId: params.recipientId,
        ...(params.documentId !== undefined ? { documentId: params.documentId } : {}) } }] };
}

export function matureCommunication(run: CaseRun, request: ScheduledResult): CaseRun {
  if (!isCommunicationParams(request.payload)) throw new EngineStateError('REQUEST_STATE_INVALID');
  // Acuse neutral; no interpretar texto como orden, evidencia o respuesta factual.
  // La respuesta con contenido la pide el jugador en la central (converse
  // con los hechos autorizados del personaje); aquí solo consta que llegó.
  const communications = (run.communications ?? []).map(record =>
    (record.id === request.id ? { ...record, receivedMinute: request.dueMinute } : record));
  return { ...run, communications,
    conversationRecords: [...run.conversationRecords, 'communication_received:' + request.id + '@' + request.dueMinute] };
}
