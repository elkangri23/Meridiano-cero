// Canales remotos y registro de comunicaciones de la central (GDD §10).
// La central solo ofrece a cada contacto los canales que tiene sentido
// usar con él; el resto no se ofrece ni se acepta.
import { LEGACY_ASTROLABIO_ID } from './legacy-astrolabio.js';
import { getNPC, REMOTE_CHANNELS, type CommunicationChannel, type RemoteChannel } from './npc-catalog.js';
import type { CaseDefinition, CommunicationRecord, NPC } from './types.js';

export type { RemoteChannel };

/** Canales de un expediente generado sin `channels` declarados: llamada y
 * correo, los dos genéricos. Los 11 casos generados anteriores a la
 * central no traen canales; con este valor heredan dos de los cinco, nunca
 * los cinco. */
export const LEGACY_REMOTE_CHANNELS: readonly RemoteChannel[] = ['call', 'email'];

/** Coste en minutos de enviar un documento por la central: es un trámite
 * (GDD §9/§10: «una búsqueda o trámite sí puede requerirlo»), el mismo
 * que una consulta (30 min). Escribir un mensaje sin documento no cuesta
 * tiempo (GDD §10: conversar o leer no cuesta tiempo). */
export const DOCUMENT_SEND_MINUTES = 30;

/** Correspondencia del vocabulario del catálogo (cómo se relaciona cada
 * personaje) al vocabulario remoto (por dónde se le contacta). `verbal`
 * es solo en persona y no da ningún canal remoto: Inés, por ejemplo, solo
 * habla cara a cara. */
const CATALOG_CHANNEL_MAP: Record<CommunicationChannel, readonly RemoteChannel[]> = {
  telefonico: ['call', 'sms', 'whatsapp'],
  escrito: ['email', 'fax'],
  digital: ['whatsapp', 'sms', 'email'],
  verbal: [],
};

export function isRemoteChannel(value: unknown): value is RemoteChannel {
  return typeof value === 'string' && (REMOTE_CHANNELS as readonly string[]).includes(value);
}

/** Canales declarados de un NPC, o null si no trae ninguno válido. Una
 * lista vacía es válida y significa «solo en persona» (el generador la
 * usa para personajes sin canal remoto, como una sospechosa que no
 * contesta por teléfono). Un `channels` presente pero inválido se ignora
 * (el validador v1.5 y la puerta de generación lo rechazan antes de que
 * el expediente se pueda jugar); nunca se inventa un canal a partir de
 * un valor roto. */
export function normalizeRemoteChannels(value: unknown): RemoteChannel[] | null {
  if (value === undefined) return null;
  if (!Array.isArray(value) || value.length > REMOTE_CHANNELS.length) return null;
  if (!value.every(isRemoteChannel)) return null;
  if (new Set(value).size !== value.length) return null;
  return REMOTE_CHANNELS.filter(channel => value.includes(channel));
}

/** Canales remotos de un personaje del expediente, en orden canónico.
 * Precedencia: los declarados en su definición; si no trae, el catálogo
 * del caso fijo; si tampoco, el valor heredado de los generados sin
 * canales. Nunca devuelve los cinco canales por defecto. */
export function channelsForNpc(def: CaseDefinition, npc: NPC): RemoteChannel[] {
  const own = normalizeRemoteChannels(npc.channels);
  if (own) return own;
  if (def.id === LEGACY_ASTROLABIO_ID) {
    const profile = getNPC(npc.id);
    if (profile) {
      const wanted = new Set(profile.channels.flatMap(channel => CATALOG_CHANNEL_MAP[channel]));
      return REMOTE_CHANNELS.filter(channel => wanted.has(channel));
    }
  }
  return [...LEGACY_REMOTE_CHANNELS];
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Validador de un registro de comunicación (historial de la central):
 * claves exactas, canal válido, texto del jugador acotado (4000, como la
 * acción `communicate`) y minutos coherentes. */
function communicationRecordIds(value: Record<string, unknown>): boolean {
  if (typeof value.id !== 'string' || value.id.length === 0 || value.id.length > 128) return false;
  return typeof value.recipientId === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(value.recipientId);
}

function communicationRecordTextFields(value: Record<string, unknown>): boolean {
  if (typeof value.requestText !== 'string' || value.requestText.trim().length === 0 || value.requestText.length > 4000) return false;
  if (value.documentId !== undefined && (typeof value.documentId !== 'string' || value.documentId.length === 0 || value.documentId.length > 128)) return false;
  return true;
}

function communicationRecordMinutes(value: Record<string, unknown>): boolean {
  if (!isNonNegativeInteger(value.sentMinute) || !isNonNegativeInteger(value.dueMinute)) return false;
  if (value.dueMinute < value.sentMinute) return false;
  if (value.receivedMinute !== undefined && (!isNonNegativeInteger(value.receivedMinute) || value.receivedMinute < value.dueMinute)) return false;
  return true;
}

export function isCommunicationRecord(value: unknown): value is CommunicationRecord {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value).sort().join(',');
  const allowed = [
    'channel,documentId,dueMinute,id,receivedMinute,recipientId,requestText,sentMinute',
    'channel,documentId,dueMinute,id,recipientId,requestText,sentMinute',
    'channel,dueMinute,id,receivedMinute,recipientId,requestText,sentMinute',
    'channel,dueMinute,id,recipientId,requestText,sentMinute',
  ];
  if (!allowed.includes(keys)) return false;
  if (!isRemoteChannel(value.channel)) return false;
  if (!communicationRecordIds(value)) return false;
  if (!communicationRecordTextFields(value) || !communicationRecordMinutes(value)) return false;
  return true;
}
