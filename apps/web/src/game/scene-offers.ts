import type { PublicActionOffer } from '@meridiano/contracts';

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
