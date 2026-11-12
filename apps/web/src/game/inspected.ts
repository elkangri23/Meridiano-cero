// Elementos ya inspeccionados (rediseño Norte, fase 2): la tarjeta del
// elemento queda marcada «Revisado ✓» y volver a pulsarla no cuesta nada
// ni duplica evidencia.
//
// Por qué se guarda en la vista web y no se deriva del motor: el motor
// retira la oferta de inspeccionar en cuanto su evidencia se conoce
// (`inspectElementOffers` salta lo ya conocido), así que la vista ya no
// trae ni la etiqueta ni el elemento. La vista sí expone las evidencias
// en poder y el dossier, pero no el mapa elemento → evidencia (vive en el
// motor, distinto en cada expediente), así que no se puede reconstruir qué
// elemento se revisó solo con la vista. Se anota en esta pestaña, por
// partida, cuando una inspección se confirma (`meridiano:inspected:<runId>`,
// mismo patrón que el chat y la consola). Al recargar en la misma pestaña
// el registro sigue; en una pestaña nueva se pierde y las tarjetas
// simplemente desaparecen como antes (sin regresión: el motor ya cobra 0
// por re-inspeccionar sin novedad, `materialMinutes`, y no duplica la
// evidencia). La inspección general del lugar sí se contrasta con la
// vista: el motor añade el lugar al dossier al inspeccionarlo, así que una
// tarjeta genérica anotada solo se enseña como revisada si el lugar sigue
// en el dossier (al cargar un guardado anterior, vuelve a estar viva).
import type { PlayerViewDto, PublicActionOffer } from '@meridiano/contracts';

export interface InspectedRecord {
  /** Id de la oferta (`inspect:<lugar>` o `inspect:<lugar>:<elemento>`). */
  id: string;
  /** Etiqueta de la oferta tal como la sirvió el motor. */
  label: string;
  /** Lugar inspeccionado (`targetId` de la oferta). */
  locationId: string;
}

/** Clave de sessionStorage por partida, como el chat y la consola. */
export function inspectedKey(runId: string): string {
  return `meridiano:inspected:${runId}`;
}

function isInspectedRecord(value: unknown): value is InspectedRecord {
  return !!value && typeof value === 'object'
    && typeof (value as InspectedRecord).id === 'string'
    && typeof (value as InspectedRecord).label === 'string'
    && typeof (value as InspectedRecord).locationId === 'string';
}

/** Registro guardado en esta pestaña, validado al cargar. */
export function loadInspected(storage: Pick<Storage, 'getItem'>, runId: string): InspectedRecord[] {
  try {
    const stored = JSON.parse(storage.getItem(inspectedKey(runId)) ?? 'null') as unknown;
    if (!Array.isArray(stored)) return [];
    return stored.filter(isInspectedRecord);
  } catch { return []; }
}

export function saveInspected(storage: Pick<Storage, 'setItem'>, runId: string, records: InspectedRecord[]): void {
  try { storage.setItem(inspectedKey(runId), JSON.stringify(records)); } catch { /* sin almacenamiento */ }
}

/** Anota una inspección confirmada; sin duplicados por id. */
export function recordInspected(records: InspectedRecord[], offer: PublicActionOffer): InspectedRecord[] {
  if (offer.action.type !== 'inspect') return records;
  const locationId = typeof offer.action.params.targetId === 'string' ? offer.action.params.targetId : '';
  if (!locationId || records.some(record => record.id === offer.id)) return records;
  return [...records, { id: offer.id, label: offer.label, locationId }];
}

/** ¿Es la oferta de inspeccionar el lugar entero (sin elemento)? */
export function isGenericInspectOffer(offer: PublicActionOffer): boolean {
  return offer.action.type === 'inspect' && offer.id === `inspect:${offer.action.params.targetId}`;
}

/** Tarjetas «Revisado ✓» del lugar actual: elementos anotados cuya oferta
 * ya no está viva, y el lugar entero anotado si el dossier aún lo trae.
 * La vista manda: al cargar un guardado anterior, una oferta viva vuelve
 * a enseñarse como viva y no como revisada. */
export function reviewedInspectRecords(view: PlayerViewDto, records: InspectedRecord[]): InspectedRecord[] {
  const locationId = view.position.location.id;
  const liveIds = new Set(view.offers.map(offer => offer.id));
  return records.filter(record => {
    if (record.locationId !== locationId) return false;
    if (record.id === `inspect:${locationId}`) return view.dossier.includes(locationId);
    return !liveIds.has(record.id);
  });
}
