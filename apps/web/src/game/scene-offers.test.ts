import { describe, expect, it } from 'vitest';
import type { PlayerViewDto, PublicActionOffer } from '@meridiano/contracts';
import { groupOffers, groupTalkOffers, offerVerbKey, sceneEvidence } from './scene-offers';
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

describe('offerVerbKey: el botón de la tarjeta lleva solo el verbo', () => {
  it('da verbo a inspeccionar, viajar, recoger, consultar, orden, detención, irregular, esperar y recuperar', () => {
    expect(offerVerbKey('inspect')).toBe('game.scene.actInspect');
    expect(offerVerbKey('travel')).toBe('game.scene.actTravel');
    expect(offerVerbKey('collect')).toBe('game.scene.actCollect');
    expect(offerVerbKey('query')).toBe('game.scene.actQuery');
    expect(offerVerbKey('request_warrant')).toBe('game.scene.actWarrant');
    expect(offerVerbKey('detain')).toBe('game.scene.actDetain');
    expect(offerVerbKey('irregular')).toBe('game.scene.actIrregular');
    expect(offerVerbKey('wait')).toBe('game.scene.actWait');
    expect(offerVerbKey('recover')).toBe('game.scene.actRecover');
  });

  it('hablar, cerrar y los tipos desconocidos no tienen verbo: el botón usa la etiqueta', () => {
    expect(offerVerbKey('talk')).toBeUndefined();
    expect(offerVerbKey('finish')).toBeUndefined();
    expect(offerVerbKey('analyze')).toBeUndefined();
    expect(offerVerbKey('inventado')).toBeUndefined();
  });
});

describe('sceneEvidence: el dossier en escena enseña lo encontrado aquí', () => {
  function viewWith(objects: PlayerViewDto['objects']): PlayerViewDto {
    return {
      position: { city: { id: 'madrid', name: 'Madrid', country: 'España' }, location: { id: 'MAD-SALA', name: 'Sala de embalaje', description: 'Sala' } },
      objects,
    } as unknown as PlayerViewDto;
  }

  it('enseña las del lugar actual y las de su ciudad, no las de otra escena', () => {
    const view = viewWith([
      { id: 'EV-02', type: 'observation', origin: 'MAD-SALA', minute: 10, admissible: true },
      { id: 'EV-10', type: 'record', origin: 'madrid', minute: 20, admissible: true },
      { id: 'EV-04', type: 'record', origin: 'PAR-ARCH', minute: 200, admissible: true },
      { id: 'EV-08', type: 'record', origin: 'LIS-ALM', minute: 400, admissible: true },
    ]);
    expect(sceneEvidence(view).map(item => item.id)).toEqual(['EV-02', 'EV-10']);
  });

  it('sin evidencias en la escena, el dossier queda vacío', () => {
    const view = viewWith([{ id: 'EV-04', type: 'record', origin: 'PAR-ARCH', minute: 200, admissible: true }]);
    expect(sceneEvidence(view)).toEqual([]);
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
