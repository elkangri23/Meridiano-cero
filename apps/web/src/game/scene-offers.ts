import type { LocaleKey, PlayerViewDto, PublicActionOffer } from '@meridiano/contracts';

export interface TalkGroup {
  /** Personaje al que van dirigidas las ofertas del grupo. */
  npcId: string;
  /** Sus ofertas de hablar, en el orden del motor. */
  offers: PublicActionOffer[];
}

/** Agrupa las ofertas de hablar por personaje, en orden de primera
 * aparición: un personaje con varios temas (Lucía y su caja, o los temas de
 * un expediente generado) sale una sola vez en la escena, con un botón por
 * tema, en vez de repetirse una fila por oferta. */
export function groupTalkOffers(offers: PublicActionOffer[]): TalkGroup[] {
  const groups: TalkGroup[] = [];
  for (const offer of offers) {
    const npcId = typeof offer.action.params.npcId === 'string' ? offer.action.params.npcId : '';
    const group = groups.find(item => item.npcId === npcId);
    if (group) group.offers.push(offer);
    else groups.push({ npcId, offers: [offer] });
  }
  return groups;
}

/** Verbo corto del botón de una tarjeta de oferta (fase 4 del rediseño
 * A2): la tarjeta ya enseña la etiqueta completa como título, así que el
 * botón lleva solo el verbo («Inspeccionar →»). Hablar y cerrar el caso
 * no usan verbo: el botón de hablar lleva el tema («Hablar con Lucía
 * sobre su identidad», que distingue un tema de otro) y el de cerrar su
 * etiqueta completa. Un tipo desconocido no tiene verbo: quien llama usa
 * la etiqueta como texto del botón, para no ocultar la oferta. */
export function offerVerbKey(actionType: string): LocaleKey | undefined {
  switch (actionType) {
    case 'inspect': return 'game.scene.actInspect';
    case 'travel': return 'game.scene.actTravel';
    case 'collect': return 'game.scene.actCollect';
    case 'query': return 'game.scene.actQuery';
    case 'request_warrant': return 'game.scene.actWarrant';
    case 'detain': return 'game.scene.actDetain';
    case 'irregular': return 'game.scene.actIrregular';
    case 'wait': return 'game.scene.actWait';
    case 'recover': return 'game.scene.actRecover';
    default: return undefined;
  }
}

/** Evidencias en poder encontradas en la escena actual (fase 4 del
 * rediseño A2, «Dossier en escena»): la procedencia es el lugar actual o
 * su ciudad. La procedencia es un lugar en casi todas las evidencias; una
 * ciudad (p. ej. EV-10, origin `madrid`) también es de aquí: se encontró
 * en esta ciudad, no en otra escena. La misma regla usa el motor para
 * recoger (`evidence.origin === run.position.locationId`). */
export function sceneEvidence(view: PlayerViewDto): PlayerViewDto['objects'] {
  const locationId = view.position.location.id;
  const cityId = view.position.city.id;
  return view.objects.filter(item => item.origin === locationId || item.origin === cityId);
}

export interface GroupedOffers {
  /** Con quién se puede hablar en esta escena (NPC presentes). */
  talk: PublicActionOffer[];
  /** Qué se puede inspeccionar en esta escena. */
  inspect: PublicActionOffer[];
  /** A dónde se puede viajar desde aquí. */
  travel: PublicActionOffer[];
  /** Análisis del laboratorio forense: fuera de la lista de la escena
   * (la ventana «Laboratorio» es su propia herramienta), pero se siguen
   * enviando por la misma ruta interpret del resto de ofertas. */
  lab: PublicActionOffer[];
  /** Resto de acciones (recoger, consultar, esperar, órdenes…). */
  other: PublicActionOffer[];
  /** Cerrar el caso, si está disponible. */
  finish: PublicActionOffer | undefined;
}

/** Agrupa las ofertas reales del motor para mostrarlas dentro de la escena:
 * quién hay aquí, qué se puede inspeccionar, a dónde se puede viajar y el
 * resto. No inventa ofertas ni reordena dentro de cada grupo (el orden es
 * el del motor, que es el de la escena). */
export function groupOffers(offers: PublicActionOffer[]): GroupedOffers {
  const talk: PublicActionOffer[] = [];
  const inspect: PublicActionOffer[] = [];
  const travel: PublicActionOffer[] = [];
  const lab: PublicActionOffer[] = [];
  const other: PublicActionOffer[] = [];
  let finish: PublicActionOffer | undefined;
  for (const offer of offers) {
    switch (offer.action.type) {
      case 'talk': talk.push(offer); break;
      case 'inspect': inspect.push(offer); break;
      case 'travel': travel.push(offer); break;
      case 'analyze': lab.push(offer); break;
      case 'finish': finish = offer; break;
      default: other.push(offer);
    }
  }
  return { talk, inspect, travel, lab, other, finish };
}
