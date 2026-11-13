import { describe, expect, it } from 'vitest';
import type { PlayerViewDto, PublicActionOffer } from '@meridiano/contracts';
import {
  isGenericInspectOffer,
  loadInspected,
  recordInspected,
  reviewedInspectRecords,
  saveInspected,
} from './inspected';
import type { InspectedRecord } from './inspected';

function inspectOffer(id: string, targetId: string, elementId?: string): PublicActionOffer {
  return {
    id,
    label: elementId ? `Inspeccionar ${elementId}` : 'Inspeccionar Sala de embalaje',
    action: { type: 'inspect', params: elementId ? { targetId, elementId } : { targetId } },
  };
}

function view(overrides: Partial<PlayerViewDto> = {}): PlayerViewDto {
  return {
    dossier: ['MAD-SALA', 'EV-01'],
    evidenceTexts: {},
    pendingRequests: [],
    analysisResults: [],
    clock: { minute: 30, deadlineMinutes: 2880 },
    offers: [inspectOffer('inspect:MAD-SALA', 'MAD-SALA')],
    position: { city: { id: 'madrid', name: 'Madrid', country: 'España' }, location: { id: 'MAD-SALA', name: 'Sala de embalaje', description: '' } },
    ...overrides,
  } as PlayerViewDto;
}

function memoryStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
  };
}

const cerradura: InspectedRecord = { id: 'inspect:MAD-SALA:cerradura', label: 'Inspeccionar cerradura', locationId: 'MAD-SALA' };
const caja: InspectedRecord = { id: 'inspect:MAD-SALA:caja', label: 'Inspeccionar la caja', locationId: 'MAD-SALA' };
const sala: InspectedRecord = { id: 'inspect:MAD-SALA', label: 'Inspeccionar Sala de embalaje', locationId: 'MAD-SALA' };

describe('recordInspected: anota la inspección confirmada sin duplicar', () => {
  it('anota la cerradura y no la repite', () => {
    const once = recordInspected([], inspectOffer('inspect:MAD-SALA:cerradura', 'MAD-SALA', 'cerradura'));
    expect(once).toEqual([cerradura]);
    expect(recordInspected(once, inspectOffer('inspect:MAD-SALA:cerradura', 'MAD-SALA', 'cerradura'))).toEqual([cerradura]);
  });

  it('ignora lo que no es inspeccionar', () => {
    const offer: PublicActionOffer = { id: 'collect:EV-02', label: 'Recoger', action: { type: 'collect', params: { evidenceId: 'EV-02' } } };
    expect(recordInspected([], offer)).toEqual([]);
  });
});

describe('isGenericInspectOffer: el lugar entero frente al elemento', () => {
  it('distingue la sala de la cerradura', () => {
    expect(isGenericInspectOffer(inspectOffer('inspect:MAD-SALA', 'MAD-SALA'))).toBe(true);
    expect(isGenericInspectOffer(inspectOffer('inspect:MAD-SALA:cerradura', 'MAD-SALA', 'cerradura'))).toBe(false);
  });
});

describe('reviewedInspectRecords: qué tarjetas quedan como revisadas', () => {
  it('el elemento anotado sin oferta viva sale como revisado', () => {
    expect(reviewedInspectRecords(view(), [cerradura, caja])).toEqual([cerradura, caja]);
  });

  it('el elemento con oferta viva no sale como revisado', () => {
    const current = view({ offers: [inspectOffer('inspect:MAD-SALA', 'MAD-SALA'), inspectOffer('inspect:MAD-SALA:cerradura', 'MAD-SALA', 'cerradura')] });
    expect(reviewedInspectRecords(current, [cerradura])).toEqual([]);
  });

  it('el lugar entero anotado sale como revisado si el dossier aún lo trae', () => {
    expect(reviewedInspectRecords(view(), [sala])).toEqual([sala]);
  });

  it('el lugar entero anotado no sale como revisado si el dossier ya no lo trae (guardado anterior)', () => {
    const current = view({ dossier: [] });
    expect(reviewedInspectRecords(current, [sala])).toEqual([]);
  });

  it('solo el lugar actual: lo de otra escena no sale', () => {
    const paris: InspectedRecord = { id: 'inspect:PAR-ARCH:ficha', label: 'Inspeccionar la ficha', locationId: 'PAR-ARCH' };
    expect(reviewedInspectRecords(view(), [cerradura, paris])).toEqual([cerradura]);
  });
});

describe('load/saveInspected: el registro sobrevive en la pestaña', () => {
  it('guarda y recupera, y descarta lo que no valida', () => {
    const storage = memoryStorage();
    saveInspected(storage, 'run-1', [cerradura]);
    expect(loadInspected(storage, 'run-1')).toEqual([cerradura]);
    expect(loadInspected(storage, 'run-2')).toEqual([]);
    storage.setItem('meridiano:inspected:run-3', '[{"id":1}]');
    expect(loadInspected(storage, 'run-3')).toEqual([]);
    storage.setItem('meridiano:inspected:run-4', 'no-json{');
    expect(loadInspected(storage, 'run-4')).toEqual([]);
  });
});
