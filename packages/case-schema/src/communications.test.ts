// Canales remotos de la central de comunicaciones (GDD §10): cada
// contacto solo ofrece los canales que tienen sentido con él.
import { describe, expect, it } from 'vitest';
import { LEGACY_ASTROLABIO_ID } from './legacy-astrolabio.js';
import {
  channelsForNpc, isCommunicationRecord, isRemoteChannel, normalizeRemoteChannels,
  DOCUMENT_SEND_MINUTES, LEGACY_REMOTE_CHANNELS,
} from './communications.js';
import type { CaseDefinition, NPC } from './types.js';

function definition(id: string, npcs: NPC[]): CaseDefinition {
  return { id, npcs } as unknown as CaseDefinition;
}

const lucia: NPC = { id: 'lucia', name: 'Lucía', cityId: 'madrid', knowledge: [], cooperation: 7 };
const marcos: NPC = { id: 'marcos', name: 'Marcos', cityId: 'bilbao', knowledge: [], cooperation: 6 };

describe('canales remotos de la central', () => {
  it('el caso fijo resuelve los canales por catálogo', () => {
    const def = definition(LEGACY_ASTROLABIO_ID, [lucia]);
    // Lucía: verbal + escrito → correo y fax; hablar en persona no es remoto.
    expect(channelsForNpc(def, lucia)).toEqual(['email', 'fax']);
    const tomas: NPC = { id: 'tomas', name: 'Tomás Ríos', cityId: 'madrid', knowledge: [], cooperation: 8 };
    // Tomás: verbal + telefonico → llamada, SMS y WhatsApp.
    expect(channelsForNpc(def, tomas)).toEqual(['call', 'whatsapp', 'sms']);
    const ines: NPC = { id: 'ines', name: 'Inés Valera', cityId: 'lisboa', knowledge: [], cooperation: 3 };
    // Inés: solo verbal → ningún canal remoto.
    expect(channelsForNpc(def, ines)).toEqual([]);
  });

  it('los canales declarados en la definición mandan sobre el catálogo', () => {
    const def = definition(LEGACY_ASTROLABIO_ID, [lucia]);
    const declared: NPC = { ...lucia, channels: ['fax'] };
    expect(channelsForNpc(def, declared)).toEqual(['fax']);
    // Una lista vacía declara «solo en persona»: no hereda nada.
    const inPerson: NPC = { ...lucia, channels: [] };
    expect(channelsForNpc(def, inPerson)).toEqual([]);
  });

  it('un generado sin canales hereda llamada y correo, nunca los cinco', () => {
    const def = definition('generado-00000000', [marcos]);
    expect(channelsForNpc(def, marcos)).toEqual([...LEGACY_REMOTE_CHANNELS]);
    expect(channelsForNpc(def, marcos)).toHaveLength(2);
  });

  it('normalizeRemoteChannels acepta la lista vacía (solo en persona) y rechaza repetidas o con canales ajenos', () => {
    expect(normalizeRemoteChannels(undefined)).toBeNull();
    expect(normalizeRemoteChannels([])).toEqual([]);
    expect(normalizeRemoteChannels(['call', 'call'])).toBeNull();
    expect(normalizeRemoteChannels(['call', 'paloma'])).toBeNull();
    expect(normalizeRemoteChannels(['sms', 'call'])).toEqual(['call', 'sms']);
    expect(isRemoteChannel('email')).toBe(true);
    expect(isRemoteChannel('verbal')).toBe(false);
  });

  it('enviar un documento cuesta 30 min, como una consulta', () => {
    expect(DOCUMENT_SEND_MINUTES).toBe(30);
  });
});

describe('registro de comunicación', () => {
  const base = { id: 'req-2', channel: 'email', recipientId: 'lucia', requestText: 'Hola', sentMinute: 0, dueMinute: 30 };
  it('acepta mensajes y documentos, con y sin acuse', () => {
    expect(isCommunicationRecord(base)).toBe(true);
    expect(isCommunicationRecord({ ...base, documentId: 'EV-02' })).toBe(true);
    expect(isCommunicationRecord({ ...base, receivedMinute: 30 })).toBe(true);
    expect(isCommunicationRecord({ ...base, documentId: 'EV-02', receivedMinute: 30 })).toBe(true);
  });

  it('rechaza canales ajenos, textos vacíos o minutos incoherentes', () => {
    expect(isCommunicationRecord({ ...base, channel: 'paloma' })).toBe(false);
    expect(isCommunicationRecord({ ...base, requestText: '   ' })).toBe(false);
    expect(isCommunicationRecord({ ...base, requestText: 'x'.repeat(4001) })).toBe(false);
    expect(isCommunicationRecord({ ...base, dueMinute: 0, sentMinute: 10 })).toBe(false);
    expect(isCommunicationRecord({ ...base, receivedMinute: 29 })).toBe(false);
    expect(isCommunicationRecord({ ...base, extra: 1 })).toBe(false);
    expect(isCommunicationRecord({ ...base, recipientId: 'a b' })).toBe(false);
  });
});
