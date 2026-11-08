import { describe, expect, it } from 'vitest';
import type { PublicActionOffer } from '@meridiano/contracts';
import { groupOffers, groupTalkOffers } from './scene-offers';
import { locationArtId } from './scene-art';

function offer(id: string, type: PublicActionOffer['action']['type'], label: string): PublicActionOffer {
  return { id, label, action: { type, params: {} } as PublicActionOffer['action'] };
}

describe('groupOffers: las acciones de la escena salen de las ofertas reales', () => {
  it('agrupa hablar, inspeccionar, viajar, resto y cierre sin perder ninguna', () => {
    const offers = [
      offer('inspect:MAD-SALA', 'inspect', 'Inspeccionar Sala de embalaje'),
      offer('talk:tomas:identidad', 'talk', 'Hablar con Tomás Ríos sobre su identidad'),
      offer('collect:EV-02', 'collect', 'Recoger EV-02 · observación'),
      offer('travel:paris', 'travel', 'Viajar a París'),
      offer('wait:30', 'wait', 'Esperar 30 minutos'),
      offer('finish', 'finish', 'Cerrar el caso y presentar el informe'),
    ];
    const grouped = groupOffers(offers);
    expect(grouped.talk.map(item => item.id)).toEqual(['talk:tomas:identidad']);
    expect(grouped.inspect.map(item => item.id)).toEqual(['inspect:MAD-SALA']);
    expect(grouped.travel.map(item => item.id)).toEqual(['travel:paris']);
    expect(grouped.other.map(item => item.id)).toEqual(['collect:EV-02', 'wait:30']);
    expect(grouped.finish?.id).toBe('finish');
  });

  it('los análisis salen de la escena y van al grupo del laboratorio', () => {
    const offers = [
      offer('analyze:EV-02', 'analyze', 'Análisis de huellas — EV-02 · 90 min'),
      offer('collect:EV-06', 'collect', 'Recoger EV-06 · objeto'),
    ];
    const grouped = groupOffers(offers);
    expect(grouped.lab.map(item => item.id)).toEqual(['analyze:EV-02']);
    expect(grouped.other.map(item => item.id)).toEqual(['collect:EV-06']);
  });

  it('conserva el orden del motor dentro de cada grupo', () => {
    const offers = [
      offer('talk:lucia:identidad', 'talk', 'Hablar con Lucía sobre su identidad'),
      offer('talk:tomas:identidad', 'talk', 'Hablar con Tomás Ríos sobre su identidad'),
      offer('inspect:MAD-SALA', 'inspect', 'Inspeccionar Sala de embalaje'),
    ];
    const grouped = groupOffers(offers);
    expect(grouped.talk.map(item => item.id)).toEqual(['talk:lucia:identidad', 'talk:tomas:identidad']);
  });

  it('sin ofertas, todos los grupos quedan vacíos y sin cierre', () => {
    const grouped = groupOffers([]);
    expect(grouped).toEqual({ talk: [], inspect: [], travel: [], lab: [], other: [], finish: undefined });
  });
});

describe('groupTalkOffers: un personaje con varios temas sale una sola vez', () => {
  function talk(id: string, npcId: string, label: string): PublicActionOffer {
    return { id, label, action: { type: 'talk', params: { npcId, topicId: id.split(':').pop() } } };
  }

  it('agrupa la identidad y la caja de Lucía en un solo grupo, en orden', () => {
    const groups = groupTalkOffers([
      talk('talk:lucia:identidad', 'lucia', 'Hablar con Lucía sobre su identidad'),
      talk('talk:tomas:identidad', 'tomas', 'Hablar con Tomás Ríos sobre su identidad'),
      talk('talk:lucia:caja', 'lucia', 'Preguntar a Lucía por la caja'),
    ]);
    expect(groups.map(group => group.npcId)).toEqual(['lucia', 'tomas']);
    const [lucia, tomas] = groups;
    expect(lucia?.offers.map(item => item.id)).toEqual(['talk:lucia:identidad', 'talk:lucia:caja']);
    expect(tomas?.offers.map(item => item.id)).toEqual(['talk:tomas:identidad']);
  });

  it('sin ofertas de hablar no hay grupos', () => {
    expect(groupTalkOffers([])).toEqual([]);
  });
});

describe('locationArtId: cada localización del caso tiene su fondo', () => {
  it('asigna el arte propio a cada localización del astrolabio', () => {
    expect(locationArtId('MAD-SALA')).toBe('madrid-sala');
    expect(locationArtId('PAR-ARCH')).toBe('paris-archivo');
    expect(locationArtId('LIS-ALM')).toBe('lisboa-almacen');
  });

  it('las localizaciones desconocidas usan el arte de Madrid como respaldo', () => {
    expect(locationArtId('XXX-UNKNOWN')).toBe('madrid-sala');
    expect(locationArtId('')).toBe('madrid-sala');
  });
});
